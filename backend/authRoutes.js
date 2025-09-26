const express = require('express');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const db = require('./db');
const { protect, signToken } = require('./middlewares/auth');
const logger = require('./logger');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  try {
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );

    if (existingUser.rowCount > 0) {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    await db.query(
      'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
      [userId, normalizedEmail, hashedPassword]
    );

    return res.status(201).json({ userId });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }
    logger.error('Error registering user.', {
      event: 'AUTH_REGISTER_ERROR',
      email: normalizedEmail,
      error: error.message,
    });
    return res.status(500).json({ error: 'Failed to register user.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  try {
    const userResult = await db.query(
      'SELECT id, password_hash FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );

    if (userResult.rowCount === 0) {
      logger.audit('Authentication failed: user not found.', {
        event: 'AUTH_LOGIN_FAILURE',
        email: normalizedEmail,
        reason: 'USER_NOT_FOUND',
      });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = userResult.rows[0];

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      logger.audit('Authentication failed: password mismatch.', {
        event: 'AUTH_LOGIN_FAILURE',
        email: normalizedEmail,
        reason: 'INVALID_PASSWORD',
      });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = signToken(user.id);
    logger.info('Authentication succeeded.', {
      event: 'AUTH_LOGIN_SUCCESS',
      userId: user.id,
    });
    return res.status(200).json({ token });
  } catch (error) {
    logger.error('Error logging in user.', {
      event: 'AUTH_LOGIN_ERROR',
      email: normalizedEmail,
      error: error.message,
    });
    return res.status(500).json({ error: 'Failed to authenticate user.' });
  }
});

router.get('/profile', protect, (req, res) => {
  return res.status(200).json({ userId: req.userId, status: 'Authenticated' });
});

module.exports = router;
