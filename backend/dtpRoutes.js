const express = require('express');
const { randomUUID } = require('crypto');

const db = require('./db');
const dtpService = require('./dtpService');
const { protect } = require('./middlewares/auth');
const logger = require('./logger');

const router = express.Router();

const RATE_LIMIT_WINDOW_MS = 30 * 1000;
const userRateLimitMap = new Map();

function enforceDtpRateLimit(req, res, next) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const jobType = String(req.body?.metadata?.jobType || '').toUpperCase();
  if (jobType === 'GARMENT_OVERLAY') {
    return next();
  }

  const now = Date.now();
  const lastRequestAt = userRateLimitMap.get(userId) || 0;
  const elapsed = now - lastRequestAt;

  if (elapsed < RATE_LIMIT_WINDOW_MS) {
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    logger.audit('DTP submission throttled by rate limiter.', {
      event: 'DTP_JOB_RATE_LIMITED',
      userId,
      retryAfterSeconds,
    });
    return res.status(429).json({ error: 'Too many DTP requests. Please wait before submitting another job.' });
  }

  userRateLimitMap.set(userId, now);
  logger.info('DTP rate limiter check passed.', {
    event: 'DTP_RATE_LIMIT_PASS',
    userId,
    jobType,
  });
  return next();
}

router.post('/process', protect, enforceDtpRateLimit, async (req, res) => {
  const { photoBase64, prompt, metadata, garmentImageBase64 } = req.body || {};

  const jobType = String(metadata?.jobType || 'BASE_AVATAR').toUpperCase();

  if (!photoBase64 || typeof photoBase64 !== 'string') {
    return res.status(400).json({ error: 'photoBase64 is required.' });
  }

  if (jobType === 'GARMENT_OVERLAY' && (!garmentImageBase64 || typeof garmentImageBase64 !== 'string')) {
    return res.status(400).json({ error: 'garmentImageBase64 is required for garment overlay jobs.' });
  }

  const jobId = randomUUID();
  const nowIso = new Date().toISOString();
  const requestPayload = {
    photoBase64,
  };

  if (prompt) {
    requestPayload.prompt = prompt;
  }

  if (metadata) {
    requestPayload.metadata = metadata;
  }

  if (garmentImageBase64) {
    requestPayload.garmentImageBase64 = garmentImageBase64;
  }

  try {
    logger.info('Received DTP job submission.', {
      event: 'DTP_JOB_RECEIVED',
      userId: req.userId,
      jobId,
      jobType,
    });

    await db.query(
      'INSERT INTO dtp_jobs (id, user_id, status, request_payload, result_url, keypoint_data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        jobId,
        req.userId,
        'QUEUED',
        JSON.stringify(requestPayload),
        null,
        null,
        nowIso,
        nowIso,
      ]
    );

    logger.audit('DTP job queued for processing.', {
      event: 'DTP_JOB_QUEUED',
      userId: req.userId,
      jobId,
      jobType,
    });

    dtpService.processDtpJob(jobId, req.userId);

    return res.status(200).json({
      jobId,
      status: 'QUEUED',
      createdAt: nowIso,
    });
  } catch (error) {
    logger.error('Failed to queue DTP job.', {
      event: 'DTP_JOB_QUEUE_ERROR',
      userId: req.userId,
      jobId,
      jobType,
      error: error.message,
    });
    return res.status(500).json({ error: 'Failed to queue DTP job.' });
  }
});

router.get('/status/:jobId', protect, async (req, res) => {
  const { jobId } = req.params;

  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required.' });
  }

  try {
    const result = await db.query(
      'SELECT id, user_id, status, result_url, keypoint_data, request_payload, created_at, updated_at FROM dtp_jobs WHERE id = $1 AND user_id = $2 LIMIT 1',
      [jobId, req.userId]
    );

    if (result.rowCount === 0) {
      logger.audit('Requested DTP job not found for user.', {
        event: 'DTP_JOB_STATUS_MISS',
        userId: req.userId,
        jobId,
      });
      return res.status(404).json({ error: 'Job not found.' });
    }

    const job = result.rows[0];
    logger.info('Fetched DTP job status.', {
      event: 'DTP_JOB_STATUS_RETRIEVED',
      userId: req.userId,
      jobId: job.id,
      status: job.status,
    });
    return res.status(200).json({
      jobId: job.id,
      status: job.status,
      resultUrl: job.result_url,
      keypointData: job.keypoint_data,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    });
  } catch (error) {
    logger.error('Failed to fetch DTP job status.', {
      event: 'DTP_JOB_STATUS_ERROR',
      userId: req.userId,
      jobId,
      error: error.message,
    });
    return res.status(500).json({ error: 'Failed to fetch DTP job status.' });
  }
});

module.exports = router;
