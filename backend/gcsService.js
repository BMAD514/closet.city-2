const { randomUUID } = require('crypto');

const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // 60 minutes to reduce revalidation churn
const CACHE_CONTROL_HEADER = 'public,max-age=3600,immutable';

function getBucketName() {
  const bucket = process.env.GCS_BUCKET_NAME;
  if (!bucket) {
    const error = new Error('Missing GCS_BUCKET_NAME environment variable.');
    error.statusCode = 500;
    throw error;
  }
  return bucket;
}

function extensionFromMimeType(mimeType = '') {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  return 'png';
}

function uploadBase64Image(userId, jobId, base64Data, mimeType = 'image/png') {
  if (!base64Data || typeof base64Data !== 'string') {
    const error = new Error('uploadBase64Image requires a base64-encoded payload.');
    error.statusCode = 400;
    throw error;
  }

  const bucket = getBucketName();
  const extension = extensionFromMimeType(mimeType);
  const objectId = `${jobId || randomUUID()}.${extension}`;
  const filePath = `images/${sanitizeSegment(userId)}/${objectId}`;

  console.log(`[GCS] Simulated upload of ${base64Data.length} bytes to gs://${bucket}/${filePath}`);

  const signedUrl = generateSignedUrl(filePath);
  return { bucket, filePath, signedUrl };
}

function generateSignedUrl(filePath) {
  if (!filePath) {
    const error = new Error('generateSignedUrl requires a file path.');
    error.statusCode = 400;
    throw error;
  }

  const bucket = getBucketName();
  const expiration = Date.now() + SIGNED_URL_TTL_MS;
  const expiresParam = Math.floor(expiration / 1000);
  const signatureToken = randomUUID().replace(/-/g, '');
  const cacheControlParam = encodeURIComponent(CACHE_CONTROL_HEADER);

  return `https://storage.googleapis.com/${bucket}/${encodeURI(filePath)}?Expires=${expiresParam}&Signature=${signatureToken}&KeyName=simulated-access&response-cache-control=${cacheControlParam}`; // Simulated signed URL
}

function sanitizeSegment(segment) {
  if (!segment) {
    return 'anonymous';
  }
  return String(segment)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-');
}

module.exports = {
  uploadBase64Image,
  generateSignedUrl,
};
