const db = require('./db');
const { DEFAULT_MODEL, generateContent } = require('./geminiService');
const gcsService = require('./gcsService');
const logger = require('./logger');
const vertexAIService = require('./vertexAIService');

const PROCESSING_STATUS = 'PROCESSING';
const READY_STATUS = 'READY';
const FAILED_STATUS = 'FAILED';

const JOB_TYPES = {
  BASE_AVATAR: 'BASE_AVATAR',
  GARMENT_OVERLAY: 'GARMENT_OVERLAY',
};

const DTP_PROMPT = `You are closet.city's digital tailoring pipeline. Cleanly segment the subject from the provided photo, preserve their identity, and return a photorealistic base avatar suitable for garment try-on. Maintain the subject's original pose and lighting, remove background distractions, and deliver the result as a transparent-background PNG.`;

const GARMENT_OVERLAY_PROMPT = `You are closet.city's digital tailor. Combine the provided base avatar with the garment reference image to produce a photorealistic, properly fitted look. Preserve the subject's identity, proportions, pose, and lighting. Align the garment naturally with realistic draping and shadows. Return a transparent-background PNG of the fitted result.`;

async function processDtpJob(jobId, userId) {
  try {
    const jobRecord = await db.getDtpJobById(jobId);
    if (!jobRecord) {
      logger.error('DTP job not found for user.', {
        event: 'DTP_JOB_MISSING',
        jobId,
        userId,
      });
      return;
    }

    const payload = parseRequestPayload(jobRecord.request_payload);
    const jobType = normalizeJobType(payload?.metadata?.jobType);

    logger.audit('DTP job created and loaded for processing.', {
      event: 'DTP_JOB_CREATED',
      jobId,
      userId,
      status: jobRecord.status,
      jobType,
    });

    await db.updateDtpJobStatus(jobId, PROCESSING_STATUS, null);

    const processingStart = Date.now();
    logger.audit('DTP job transitioned to PROCESSING.', {
      event: 'DTP_JOB_PROCESSING_START',
      jobId,
      userId,
      jobType,
    });

    let poseKeypointData;
    let baseAvatarContext = null;
    let garmentMetadata = null;
    let garmentReferenceUrl = null;

    if (jobType === JOB_TYPES.BASE_AVATAR) {
      if (!payload?.photoBase64) {
        throw new Error('Missing photo for base avatar job.');
      }
      const vertexStart = Date.now();
      poseKeypointData = await vertexAIService.getPoseKeypoints(payload.photoBase64);
      if (!poseKeypointData || !Array.isArray(poseKeypointData.keypoints)) {
        throw new Error('Vertex AI pose detection did not return keypoints.');
      }
      const vertexLatencyMs = Date.now() - vertexStart;
      logger.info('Vertex AI pose detection completed.', {
        event: 'VERTEX_POSE_COMPLETE',
        jobId,
        userId,
        latencyMs: vertexLatencyMs,
        keypointCount: Array.isArray(poseKeypointData?.keypoints) ? poseKeypointData.keypoints.length : 0,
      });
    } else if (jobType === JOB_TYPES.GARMENT_OVERLAY) {
      baseAvatarContext = await resolveBaseAvatarContext(userId, payload, jobId);
      const garmentResolution = await resolveGarmentFittingMetadata(payload?.metadata || {}, userId);
      garmentMetadata = garmentResolution.metadata;
      garmentReferenceUrl = garmentResolution.referenceUrl;

      if (!baseAvatarContext) {
        logger.error('Unable to resolve base avatar context for garment overlay job.', {
          event: 'DTP_OVERLAY_BASE_AVATAR_MISSING',
          jobId,
          userId,
        });
      } else if (!Array.isArray(baseAvatarContext?.keypoint_data?.keypoints)) {
        logger.info('Base avatar job resolved for overlay but missing keypoints.', {
          event: 'DTP_OVERLAY_KEYPOINTS_MISSING',
          jobId,
          userId,
          baseAvatarJobId: baseAvatarContext.id,
        });
      }
    }

    const buildResult = await buildPartsForJob(jobType, payload, {
      jobId,
      userId,
      baseAvatarContext,
      garmentMetadata,
      garmentReferenceUrl,
    });

    const parts = buildResult?.parts;
    const promptSummary = buildResult?.promptSummary;

    if (!parts || parts.length === 0) {
      await db.updateDtpJobStatus(jobId, FAILED_STATUS, null);
      logger.error('Failed to build Gemini payload for DTP job.', {
        event: 'DTP_JOB_PAYLOAD_BUILD_FAILED',
        jobId,
        userId,
        jobType,
      });
      return;
    }

    if (promptSummary) {
      logger.info('Prepared intelligent fitting payload for Gemini.', {
        event: 'DTP_PROMPT_PREPARED',
        jobId,
        userId,
        jobType,
        ...promptSummary,
      });
    }

    const geminiStart = Date.now();
    const imageDataUrl = await generateContent({
      parts,
      model: DEFAULT_MODEL,
      generationConfig: { responseMimeType: 'image/png' },
    });
    const geminiLatencyMs = Date.now() - geminiStart;
    const estimatedCostUsd = estimateImageJobCost(parts);
    logger.info('Gemini image generation completed.', {
      event: 'GEMINI_REQUEST_COMPLETE',
      jobId,
      userId,
      latencyMs: geminiLatencyMs,
      estimatedCostUsd,
      model: DEFAULT_MODEL,
    });

    const inlineOutput = extractInlineData(imageDataUrl);
    if (!inlineOutput) {
      throw new Error('Gemini response did not include image data.');
    }

    const { signedUrl, bucket, filePath } = await gcsService.uploadBase64Image(
      userId,
      jobId,
      inlineOutput.data,
      inlineOutput.mimeType
    );

    const keypointUpdate = jobType === JOB_TYPES.BASE_AVATAR ? poseKeypointData : undefined;
    await db.updateDtpJobStatus(jobId, READY_STATUS, signedUrl, keypointUpdate);
    const totalProcessingMs = Date.now() - processingStart;
    logger.audit('DTP job marked READY.', {
      event: 'DTP_JOB_READY',
      jobId,
      userId,
      assetPath: `gs://${bucket}/${filePath}`,
      latencyMs: totalProcessingMs,
      estimatedCostUsd,
      ...(Array.isArray(poseKeypointData?.keypoints)
        ? { keypointCount: poseKeypointData.keypoints.length }
        : {}),
    });
  } catch (error) {
    logger.error('Failed to process DTP job.', {
      event: 'DTP_JOB_FAILED',
      jobId,
      userId,
      error: error.message,
    });
    try {
      await db.updateDtpJobStatus(jobId, FAILED_STATUS, null);
    } catch (updateError) {
      logger.error('Failed to mark DTP job as FAILED.', {
        event: 'DTP_JOB_STATUS_UPDATE_FAILED',
        jobId,
        userId,
        error: updateError.message,
      });
    }
  }
}

function parseRequestPayload(rawPayload) {
  if (!rawPayload) {
    return {};
  }

  if (typeof rawPayload === 'object') {
    return rawPayload;
  }

  try {
    return JSON.parse(rawPayload);
  } catch (error) {
    logger.info('Failed to parse DTP job payload, falling back to empty object.', {
      event: 'DTP_JOB_PAYLOAD_PARSE_FALLBACK',
      error: error.message,
    });
    return {};
  }
}

function normalizeJobType(jobType) {
  const normalized = String(jobType || '').toUpperCase();
  if (normalized === JOB_TYPES.GARMENT_OVERLAY) {
    return JOB_TYPES.GARMENT_OVERLAY;
  }
  return JOB_TYPES.BASE_AVATAR;
}

async function buildPartsForJob(jobType, payload, context = {}) {
  if (jobType === JOB_TYPES.GARMENT_OVERLAY) {
    const baseAvatarInline = await resolveInlineImage(
      payload.photoBase64,
      context.baseAvatarContext?.result_url,
      {
        jobId: context.jobId,
        userId: context.userId,
        label: 'base avatar',
      }
    );

    const garmentInline = await resolveInlineImage(
      payload.garmentImageBase64,
      context.garmentReferenceUrl,
      {
        jobId: context.jobId,
        userId: context.userId,
        label: 'garment reference',
      }
    );

    if (!baseAvatarInline || !garmentInline) {
      return { parts: null };
    }

    const keypointSummary = formatKeypointsForPrompt(context.baseAvatarContext?.keypoint_data);
    const garmentMetadataSummary = formatGarmentMetadataForPrompt(context.garmentMetadata);
    const garmentLabel = sanitizeGarmentLabel(payload?.metadata?.garmentName);

    const parts = [
      {
        type: 'text',
        text: `${GARMENT_OVERLAY_PROMPT}\n\nOverlay the garment precisely onto the human figure, ensuring the collar aligns with the neckline.`,
      },
    ];

    if (keypointSummary) {
      parts.push({
        type: 'text',
        text: `Pose keypoints to prioritize (pixel coordinates): ${keypointSummary}.`,
      });
    }

    if (garmentMetadataSummary) {
      parts.push({
        type: 'text',
        text: `Garment fitting metadata: ${garmentMetadataSummary}.`,
      });
    }

    parts.push({ type: 'text', text: 'Base avatar reference image. Respect the provided keypoints during warping.' });
    parts.push({ type: 'inlineData', inlineData: baseAvatarInline });
    parts.push({
      type: 'text',
      text: `Garment reference image${garmentLabel ? `: ${garmentLabel}` : ''}. Fit and drape this garment over the avatar using the specified anchors.`,
    });
    parts.push({ type: 'inlineData', inlineData: garmentInline });

    return {
      parts,
      promptSummary: {
        baseAvatarJobId: context.baseAvatarContext?.id || null,
        alignmentKeypoints: keypointSummary || null,
        garmentMetadata: garmentMetadataSummary || null,
      },
    };
  }

  const inlineData = await resolveInlineImage(payload.photoBase64, null, {
    jobId: context.jobId,
    userId: context.userId,
    label: 'base avatar capture',
  });

  if (!inlineData) {
    return { parts: null };
  }

  return {
    parts: [
      { type: 'text', text: DTP_PROMPT },
      { type: 'inlineData', inlineData },
    ],
  };
}

function formatKeypointsForPrompt(keypointData) {
  const keypoints = Array.isArray(keypointData?.keypoints) ? keypointData.keypoints : [];
  if (keypoints.length === 0) {
    return null;
  }

  return keypoints
    .map((kp, index) => {
      const label = typeof kp.name === 'string' && kp.name.trim().length > 0 ? kp.name.trim() : `point_${index + 1}`;
      const x = typeof kp.x === 'number' ? Math.round(kp.x) : undefined;
      const y = typeof kp.y === 'number' ? Math.round(kp.y) : undefined;
      const score = typeof kp.score === 'number' ? kp.score : undefined;
      const coordinateText = x !== undefined && y !== undefined ? `(${x}, ${y})` : '(unknown)';
      const confidenceText = typeof score === 'number' ? ` confidence=${score.toFixed(2)}` : '';
      return `${label}: ${coordinateText}${confidenceText}`;
    })
    .join('; ');
}

function formatGarmentMetadataForPrompt(metadata) {
  if (!metadata) {
    return null;
  }

  const parts = [];

  const anchors = Array.isArray(metadata.anchors) ? metadata.anchors : [];
  if (anchors.length > 0) {
    const anchorText = anchors
      .map(anchor => {
        if (!anchor || typeof anchor !== 'object') {
          return null;
        }
        const name = typeof anchor.name === 'string' && anchor.name.trim().length > 0 ? anchor.name.trim() : null;
        const role = typeof anchor.role === 'string' && anchor.role.trim().length > 0 ? anchor.role.trim() : null;
        const x = typeof anchor.x === 'number' ? Math.round(anchor.x) : undefined;
        const y = typeof anchor.y === 'number' ? Math.round(anchor.y) : undefined;
        const notes = typeof anchor.notes === 'string' && anchor.notes.trim().length > 0 ? anchor.notes.trim() : null;

        const label = name || role || 'anchor';
        const coords = x !== undefined && y !== undefined ? `(${x}, ${y})` : '';
        const noteText = notes ? ` – ${notes}` : '';
        return `${label}${coords}${noteText}`;
      })
      .filter(Boolean)
      .join('; ');

    if (anchorText) {
      parts.push(`Anchors: ${anchorText}`);
    }
  }

  if (typeof metadata.notes === 'string' && metadata.notes.trim().length > 0) {
    parts.push(`Notes: ${metadata.notes.trim()}`);
  }

  if (typeof metadata.additionalInstructions === 'string' && metadata.additionalInstructions.trim().length > 0) {
    parts.push(`Instructions: ${metadata.additionalInstructions.trim()}`);
  }

  return parts.length > 0 ? parts.join(' | ') : null;
}

async function resolveBaseAvatarContext(userId, payload, overlayJobId) {
  const metadata = payload?.metadata || {};
  const explicitJobId = metadata.baseAvatarJobId || metadata.baseAvatarJobID;

  if (explicitJobId) {
    try {
      const job = await db.getDtpJobById(explicitJobId);
      if (job && job.user_id === userId) {
        return job;
      }
      logger.info('Base avatar job ID provided in metadata could not be resolved for user.', {
        event: 'DTP_OVERLAY_BASE_AVATAR_LOOKUP_MISS',
        userId,
        overlayJobId,
        baseAvatarJobId: explicitJobId,
      });
    } catch (error) {
      logger.error('Error retrieving base avatar job by id.', {
        event: 'DTP_OVERLAY_BASE_AVATAR_LOOKUP_ERROR',
        userId,
        overlayJobId,
        baseAvatarJobId: explicitJobId,
        error: error.message,
      });
    }
  }

  try {
    const latest = await db.getLatestBaseAvatarJobWithKeypoints(userId);
    if (latest) {
      return latest;
    }
  } catch (error) {
    logger.error('Failed to retrieve latest base avatar job for overlay.', {
      event: 'DTP_OVERLAY_BASE_AVATAR_LATEST_ERROR',
      userId,
      overlayJobId,
      error: error.message,
    });
  }

  return null;
}

async function resolveGarmentFittingMetadata(metadata = {}, userId) {
  const referenceUrl = typeof metadata.garmentImageUrl === 'string' ? metadata.garmentImageUrl : null;

  if (metadata && typeof metadata.fittingMetadata === 'object') {
    return { metadata: metadata.fittingMetadata, referenceUrl };
  }

  if (metadata && typeof metadata.poseMetadata === 'object') {
    return { metadata: metadata.poseMetadata, referenceUrl };
  }

  if (Array.isArray(metadata?.poseAnchors)) {
    return { metadata: { anchors: metadata.poseAnchors }, referenceUrl };
  }

  const garmentId = metadata?.garmentId;
  if (!garmentId) {
    return { metadata: null, referenceUrl };
  }

  try {
    const record = await db.getCatalogItemById(garmentId);
    if (record && record.fitting_metadata) {
      return { metadata: record.fitting_metadata, referenceUrl: referenceUrl || record.image_url || null };
    }
  } catch (error) {
    logger.error('Failed to resolve garment fitting metadata.', {
      event: 'DTP_GARMENT_METADATA_ERROR',
      userId,
      garmentId,
      error: error.message,
    });
  }

  return { metadata: null, referenceUrl };
}

function sanitizeGarmentLabel(label) {
  if (typeof label !== 'string') {
    return '';
  }
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : '';
}

async function resolveInlineImage(primaryValue, fallbackUrl, logContext = {}) {
  const inlineCandidate = extractInlineData(primaryValue);

  if (inlineCandidate && (isDataUrl(primaryValue) || isProbablyBase64(inlineCandidate.data))) {
    return inlineCandidate;
  }

  const remoteSources = [];
  if (isLikelyRemoteUrl(primaryValue)) {
    remoteSources.push(primaryValue);
  }
  if (fallbackUrl && fallbackUrl !== primaryValue && isLikelyRemoteUrl(fallbackUrl)) {
    remoteSources.push(fallbackUrl);
  }

  for (const source of remoteSources) {
    const fetched = await fetchImageAsInlineData(source, logContext);
    if (fetched) {
      return fetched;
    }
  }

  if (inlineCandidate && (isDataUrl(primaryValue) || isProbablyBase64(inlineCandidate.data))) {
    return inlineCandidate;
  }

  return null;
}

async function fetchImageAsInlineData(url, logContext = {}) {
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      logger.error('Failed to fetch remote image for inline data.', {
        event: 'DTP_REMOTE_IMAGE_FETCH_FAILED',
        url,
        status: response.status,
        jobId: logContext.jobId,
        userId: logContext.userId,
        label: logContext.label,
      });
      return null;
    }

    const mimeType = ensureMimeType(response.headers.get('content-type'), 'image/png');
    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer).toString('base64');

    logger.info('Fetched remote image for inline payload.', {
      event: 'DTP_REMOTE_IMAGE_FETCH_SUCCESS',
      url,
      mimeType,
      jobId: logContext.jobId,
      userId: logContext.userId,
      label: logContext.label,
    });

    return {
      mimeType,
      data,
    };
  } catch (error) {
    logger.error('Error fetching remote image for inline payload.', {
      event: 'DTP_REMOTE_IMAGE_FETCH_ERROR',
      url,
      jobId: logContext.jobId,
      userId: logContext.userId,
      label: logContext.label,
      error: error.message,
    });
    return null;
  }
}

function extractInlineData(photoBase64) {
  if (typeof photoBase64 !== 'string' || photoBase64.trim().length === 0) {
    return null;
  }

  const trimmed = photoBase64.trim();
  const match = /^data:(.+);base64,(.*)$/i.exec(trimmed);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2],
    };
  }

  return {
    mimeType: 'image/png',
    data: trimmed,
  };
}

function ensureMimeType(value, fallback) {
  if (typeof value === 'string' && value.trim().length > 0) {
    const [type] = value.split(';', 1);
    if (type && type.includes('/')) {
      return type.trim();
    }
  }
  return fallback;
}

function isProbablyBase64(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  const sanitized = value.replace(/\s+/g, '');
  if (sanitized.length % 4 !== 0) {
    return false;
  }
  return /^[A-Za-z0-9+/]+={0,2}$/.test(sanitized);
}

function isLikelyRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function isDataUrl(value) {
  return typeof value === 'string' && value.trim().startsWith('data:');
}

function estimateImageJobCost(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return 0;
  }

  const imagePartCount = parts.filter(part => part?.type === 'inlineData').length;
  const baseCost = Number(process.env.GEMINI_IMAGE_JOB_COST_USD || '0.02');
  return Number((imagePartCount * baseCost).toFixed(4));
}

module.exports = {
  processDtpJob,
};
