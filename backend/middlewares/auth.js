const jwt = require('jsonwebtoken');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || 'closet.city-dev-secret-change-me';

function protect(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = extractBearerToken(authHeader);

  if (!token) {
    logger.audit('Authorization attempt missing bearer token.', {
      event: 'AUTH_TOKEN_MISSING',
      path: req.originalUrl,
      method: req.method,
    });
    return res.status(401).json({ error: 'Authorization token missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId) {
      logger.audit('Authorization token contained invalid payload.', {
        event: 'AUTH_TOKEN_INVALID_PAYLOAD',
        path: req.originalUrl,
        method: req.method,
      });
      return res.status(401).json({ error: 'Invalid token payload.' });
    }
    req.userId = decoded.userId;
    return next();
  } catch (error) {
    logger.audit('Authorization token failed verification.', {
      event: 'AUTH_TOKEN_VERIFICATION_FAILED',
      path: req.originalUrl,
      method: req.method,
      error: error.message,
    });
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function signToken(userId, options = {}) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h', ...options });
}

function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return '';
  }
  const parts = headerValue.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return '';
  }
  return parts[1];
}

module.exports = {
  protect,
  signToken,
};
