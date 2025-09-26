let Pool;
let pool;
let usingMemoryFallback = false;

try {
  ({ Pool } = require('pg'));
} catch (error) {
  usingMemoryFallback = true;
  console.warn('pg module not found – using in-memory fallback.');
}

const memoryStore = {
  usersByEmail: new Map(),
  usersById: new Map(),
  dtpJobs: new Map(),
  catalogItems: new Map(),
};

function ensurePool() {
  if (usingMemoryFallback) {
    return null;
  }

  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Missing DATABASE_URL environment variable.');
    process.exit(1);
  }

  pool = new Pool({ connectionString });
  pool.on('error', err => {
    console.error('Unexpected database error:', err);
  });
  return pool;
}

async function query(text, params = []) {
  if (!usingMemoryFallback) {
    const activePool = ensurePool();
    return activePool.query(text, params);
  }

  return runMemoryQuery(text, params);
}

async function initDatabase() {
  if (usingMemoryFallback) {
    return;
  }

  const activePool = ensurePool();
  await activePool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS dtp_jobs (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      request_payload JSONB,
      result_url TEXT,
      keypoint_data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS catalog_items (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price NUMERIC(10, 2) DEFAULT 0,
      image_url TEXT NOT NULL,
      pregenerated_lookbook_url TEXT,
      pregenerated_try_on_url TEXT,
      pregenerated_material_url TEXT,
      pregenerated_logo_url TEXT,
      fitting_metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function updateDtpJobStatus(jobId, status, resultUrl = null, keypointData = undefined) {
  const updatedAt = new Date().toISOString();

  if (!usingMemoryFallback) {
    const activePool = ensurePool();
    if (typeof keypointData === 'undefined') {
      await activePool.query(
        'UPDATE dtp_jobs SET status = $1, result_url = $2, updated_at = $3 WHERE id = $4',
        [status, resultUrl, updatedAt, jobId]
      );
    } else {
      await activePool.query(
        'UPDATE dtp_jobs SET status = $1, result_url = $2, keypoint_data = $3, updated_at = $4 WHERE id = $5',
        [status, resultUrl, keypointData, updatedAt, jobId]
      );
    }
    return;
  }

  const job = memoryStore.dtpJobs.get(jobId);
  if (job) {
    job.status = status;
    job.result_url = resultUrl;
    job.updated_at = updatedAt;
    if (typeof keypointData !== 'undefined') {
      job.keypoint_data = keypointData;
    }
  }
}

async function getDtpJobById(jobId) {
  if (usingMemoryFallback) {
    return memoryStore.dtpJobs.get(jobId) || null;
  }

  const result = await query(
    'SELECT id, user_id, status, result_url, keypoint_data, request_payload, created_at, updated_at FROM dtp_jobs WHERE id = $1 LIMIT 1',
    [jobId]
  );
  return result.rows[0] || null;
}

async function getLatestBaseAvatarJobWithKeypoints(userId) {
  if (!userId) {
    return null;
  }

  if (usingMemoryFallback) {
    const jobs = Array.from(memoryStore.dtpJobs.values());
    const sorted = jobs
      .filter(job => job.user_id === userId && job.keypoint_data && isBaseAvatarJob(job.request_payload))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return sorted[0] || null;
  }

  const result = await query(
    `SELECT id, user_id, status, result_url, keypoint_data, request_payload, created_at, updated_at
       FROM dtp_jobs
      WHERE user_id = $1
        AND keypoint_data IS NOT NULL
        AND (
          request_payload->'metadata'->>'jobType' IS NULL OR
          UPPER(request_payload->'metadata'->>'jobType') = 'BASE_AVATAR'
        )
      ORDER BY updated_at DESC
      LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function getCatalogItems() {
  if (usingMemoryFallback) {
    return Array.from(memoryStore.catalogItems.values());
  }

  const result = await query(
    `SELECT id, name, description, price, image_url, pregenerated_lookbook_url, pregenerated_try_on_url,
            pregenerated_material_url, pregenerated_logo_url, fitting_metadata, created_at, updated_at
       FROM catalog_items
       ORDER BY created_at ASC`
  );

  return result.rows;
}

async function getCatalogItemById(id) {
  if (!id) {
    return null;
  }

  if (usingMemoryFallback) {
    return memoryStore.catalogItems.get(id) || null;
  }

  const result = await query(
    `SELECT id, name, description, price, image_url, pregenerated_lookbook_url, pregenerated_try_on_url,
            pregenerated_material_url, pregenerated_logo_url, fitting_metadata, created_at, updated_at
       FROM catalog_items
       WHERE id = $1
       LIMIT 1`,
    [id]
  );

  return result.rows[0] || null;
}

async function upsertCatalogItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  if (usingMemoryFallback) {
    for (const item of items) {
      memoryStore.catalogItems.set(item.id, { ...item });
    }
    return;
  }

  const client = await ensurePool().connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await client.query(
        `INSERT INTO catalog_items
           (id, name, description, price, image_url, pregenerated_lookbook_url, pregenerated_try_on_url,
            pregenerated_material_url, pregenerated_logo_url, fitting_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           image_url = EXCLUDED.image_url,
           pregenerated_lookbook_url = EXCLUDED.pregenerated_lookbook_url,
           pregenerated_try_on_url = EXCLUDED.pregenerated_try_on_url,
           pregenerated_material_url = EXCLUDED.pregenerated_material_url,
           pregenerated_logo_url = EXCLUDED.pregenerated_logo_url,
           fitting_metadata = EXCLUDED.fitting_metadata,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.name,
          item.description,
          item.price,
          item.image_url,
          item.pregenerated_lookbook_url,
          item.pregenerated_try_on_url,
          item.pregenerated_material_url,
          item.pregenerated_logo_url,
          item.fitting_metadata,
          item.created_at,
          item.updated_at,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function runMemoryQuery(text, params) {
  const normalized = text.trim().toLowerCase();

  if (normalized.startsWith('create table')) {
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('insert into users')) {
    const [id, email, passwordHash] = params;
    if (memoryStore.usersByEmail.has(email)) {
      const error = new Error('duplicate key value violates unique constraint "users_email_key"');
      error.code = '23505';
      throw error;
    }
    const userRecord = {
      id,
      email,
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
    };
    memoryStore.usersByEmail.set(email, userRecord);
    memoryStore.usersById.set(id, userRecord);
    return { rows: [], rowCount: 1 };
  }

  if (normalized.startsWith('select id, password_hash from users where email')) {
    const [email] = params;
    const user = memoryStore.usersByEmail.get(email);
    return {
      rows: user ? [{ id: user.id, password_hash: user.password_hash }] : [],
      rowCount: user ? 1 : 0,
    };
  }

  if (normalized.startsWith('select id from users where email')) {
    const [email] = params;
    const user = memoryStore.usersByEmail.get(email);
    return {
      rows: user ? [{ id: user.id }] : [],
      rowCount: user ? 1 : 0,
    };
  }

  if (normalized.startsWith('insert into dtp_jobs')) {
    const [id, userId, status, requestPayload, resultUrl, keypointData, createdAt, updatedAt] = params.length === 8
      ? params
      : [...params.slice(0, 5), null, params[5], params[6]];
    const jobRecord = {
      id,
      user_id: userId,
      status,
      request_payload: requestPayload ? JSON.parse(requestPayload) : null,
      result_url: resultUrl || null,
      keypoint_data: keypointData ? JSON.parse(JSON.stringify(keypointData)) : null,
      created_at: createdAt,
      updated_at: updatedAt,
    };
    memoryStore.dtpJobs.set(id, jobRecord);
    return { rows: [], rowCount: 1 };
  }

  if (normalized.startsWith('select id, user_id, status, result_url, request_payload, created_at, updated_at from dtp_jobs where id')) {
    const [id, userId] = params;
    const job = memoryStore.dtpJobs.get(id);
    if (!job || job.user_id !== userId) {
      return { rows: [], rowCount: 0 };
    }
    return {
      rows: [job],
      rowCount: 1,
    };
  }

  if (normalized.startsWith('update dtp_jobs set status')) {
    const hasKeypoints = normalized.includes('keypoint_data');
    const [status, resultUrl, maybeKeypoints, updatedAt, id] = hasKeypoints
      ? params
      : [params[0], params[1], undefined, params[2], params[3]];
    const job = memoryStore.dtpJobs.get(id);
    if (job) {
      job.status = status;
      job.result_url = resultUrl;
      job.updated_at = updatedAt;
      if (hasKeypoints) {
        job.keypoint_data = maybeKeypoints;
      }
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('insert into catalog_items')) {
    const [
      id,
      name,
      description,
      price,
      imageUrl,
      lookbookUrl,
      tryOnUrl,
      materialUrl,
      logoUrl,
      fittingMetadata,
      createdAt,
      updatedAt,
    ] = params;
    const record = {
      id,
      name,
      description,
      price,
      image_url: imageUrl,
      pregenerated_lookbook_url: lookbookUrl,
      pregenerated_try_on_url: tryOnUrl,
      pregenerated_material_url: materialUrl,
      pregenerated_logo_url: logoUrl,
      fitting_metadata: fittingMetadata,
      created_at: createdAt,
      updated_at: updatedAt,
    };
    memoryStore.catalogItems.set(id, record);
    return { rows: [], rowCount: 1 };
  }

  if (normalized.startsWith('select id, name, description, price, image_url, pregenerated_lookbook_url, pregenerated_try_on_url,')) {
    if (!params || params.length === 0) {
      const rows = Array.from(memoryStore.catalogItems.values());
      return { rows, rowCount: rows.length };
    }
    const [id] = params;
    const record = memoryStore.catalogItems.get(id);
    return {
      rows: record ? [record] : [],
      rowCount: record ? 1 : 0,
    };
  }

  if (normalized.startsWith('select id, name, description, price, image_url')) {
    const rows = Array.from(memoryStore.catalogItems.values());
    return { rows, rowCount: rows.length };
  }

  const fallbackError = new Error(`Unsupported memory fallback query: ${text}`);
  throw fallbackError;
}

function isBaseAvatarJob(payload) {
  if (!payload || typeof payload !== 'object') {
    return true;
  }

  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : null;
  const jobType = metadata && typeof metadata.jobType === 'string' ? metadata.jobType.toUpperCase() : '';
  return !jobType || jobType === 'BASE_AVATAR';
}

module.exports = {
  query,
  initDatabase,
  updateDtpJobStatus,
  getDtpJobById,
  getLatestBaseAvatarJobWithKeypoints,
  getCatalogItems,
  getCatalogItemById,
  upsertCatalogItems,
  usingMemoryFallback: () => usingMemoryFallback,
};
