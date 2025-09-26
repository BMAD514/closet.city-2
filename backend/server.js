const express = require('express');
const fs = require('fs');
const path = require('path');

const authRoutes = require('./authRoutes');
const catalogRoutes = require('./catalogRoutes');
const dtpRoutes = require('./dtpRoutes');
const db = require('./db');
const geminiService = require('./geminiService');

const JSON_BODY_LIMIT = '20mb';

loadEnvFile();

const PORT = parseInt(process.env.PORT || '4000', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY environment variable.');
  process.exit(1);
}

const app = express();

app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT, extended: false }));
app.use((req, res, next) => {
  setCorsHeaders(req, res);
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/dtp', dtpRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/api/gemini/generate', async (req, res) => {
  try {
    const imageDataUrl = await geminiService.generateContent(req.body);
    return res.status(200).json({ imageDataUrl });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = error.message || 'Unexpected error while processing request.';
    console.error('Gemini proxy error:', message);
    return res.status(status).json({ error: message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

bootstrap();

async function bootstrap() {
  try {
    await db.initDatabase();
    if (db.usingMemoryFallback && db.usingMemoryFallback()) {
      console.warn('Database fallback mode enabled. Data will not persist between restarts.');
    }
    app.listen(PORT, () => {
      console.log(`Backend gateway listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize backend services:', error.message);
    process.exit(1);
  }
}

function setCorsHeaders(req, res) {
  const requestOrigin = req.headers.origin;
  const allowOrigin = resolveAllowedOrigin(requestOrigin);
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function resolveAllowedOrigin(requestOrigin) {
  if (!requestOrigin || ALLOWED_ORIGINS.includes('*')) {
    return '*';
  }
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  return ALLOWED_ORIGINS[0] || '*';
}
