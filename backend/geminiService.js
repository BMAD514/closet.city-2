const logger = require('./logger');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image-preview';
const MAX_BODY_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const error = new Error('Missing GEMINI_API_KEY environment variable.');
    error.statusCode = 500;
    throw error;
  }
  return key;
}

async function generateContent({ parts, model = DEFAULT_MODEL, generationConfig, safetySettings } = {}) {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw makeBadRequestError('Request must include at least one content part.');
  }

  const estimatedSize = Buffer.byteLength(JSON.stringify(parts), 'utf8');
  if (estimatedSize > MAX_BODY_SIZE_BYTES) {
    const error = new Error('Request payload too large. Maximum size is 20MB.');
    error.statusCode = 413;
    throw error;
  }

  const mappedParts = parts.map(mapPartFromPayload);
  const textPartsPreview = parts
    .filter(part => part && part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .slice(0, 5);

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: mappedParts,
      },
    ],
    generationConfig: Object.assign({ responseMimeType: 'image/png' }, generationConfig || {}),
  };

  if (Array.isArray(safetySettings)) {
    requestBody.safetySettings = safetySettings;
  }

  const endpoint = `${API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(getApiKey())}`;
  const requestStart = Date.now();
  logger.info('Starting Gemini generateContent request.', {
    event: 'GEMINI_REQUEST_START',
    model,
    partCount: parts.length,
    estimatedRequestBytes: estimatedSize,
    textParts: textPartsPreview,
  });

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (networkError) {
    logger.error('Gemini request failed before receiving a response.', {
      event: 'GEMINI_REQUEST_ERROR',
      model,
      error: networkError.message,
    });
    throw networkError;
  }

  const latencyMs = Date.now() - requestStart;

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = extractErrorMessage(responseBody) || `Gemini API returned status ${response.status}.`;
    const error = new Error(message);
    error.statusCode = response.status;
    logger.error('Gemini request returned error response.', {
      event: 'GEMINI_REQUEST_ERROR',
      model,
      status: response.status,
      latencyMs,
      error: message,
    });
    throw error;
  }

  const imageData = extractInlineImage(responseBody);
  if (!imageData) {
    const message = 'Gemini API did not return an image result.';
    const error = new Error(message);
    error.statusCode = 502;
    logger.error('Gemini request completed without image payload.', {
      event: 'GEMINI_RESPONSE_MISSING_IMAGE',
      model,
      status: response.status,
      latencyMs,
    });
    throw error;
  }

  logger.info('Gemini generateContent request succeeded.', {
    event: 'GEMINI_REQUEST_COMPLETE',
    model,
    status: response.status,
    latencyMs,
  });

  return `data:${imageData.mimeType};base64,${imageData.data}`;
}

function mapPartFromPayload(part) {
  if (!part || typeof part !== 'object') {
    throw makeBadRequestError('Each part must be an object.');
  }

  if (part.type === 'text') {
    if (typeof part.text !== 'string') {
      throw makeBadRequestError('Text parts must include a text string.');
    }
    return { text: part.text };
  }

  if (part.type === 'inlineData') {
    if (
      !part.inlineData ||
      typeof part.inlineData.mimeType !== 'string' ||
      typeof part.inlineData.data !== 'string'
    ) {
      throw makeBadRequestError('Inline data parts must include mimeType and data fields.');
    }
    return {
      inlineData: {
        mimeType: part.inlineData.mimeType,
        data: part.inlineData.data,
      },
    };
  }

  throw makeBadRequestError(`Unsupported part type: ${part.type}`);
}

function extractInlineImage(responseBody) {
  const candidates = responseBody.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate && candidate.content && candidate.content.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const inlineData = part && (part.inlineData || part.inline_data);
      if (inlineData && inlineData.mimeType && inlineData.data) {
        return inlineData;
      }
    }
  }
  return null;
}

function extractErrorMessage(responseBody) {
  if (!responseBody) return '';
  if (typeof responseBody.error === 'string') return responseBody.error;
  if (responseBody.error && typeof responseBody.error.message === 'string') {
    return responseBody.error.message;
  }
  if (Array.isArray(responseBody.promptFeedback)) {
    const blocked = responseBody.promptFeedback.find(entry => entry.blockReason);
    if (blocked) {
      return `Request was blocked. Reason: ${blocked.blockReason}. ${blocked.blockReasonMessage || ''}`.trim();
    }
  }
  return '';
}

function makeBadRequestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

module.exports = {
  DEFAULT_MODEL,
  generateContent,
};
