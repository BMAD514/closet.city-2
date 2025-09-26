const express = require('express');
const { randomUUID } = require('crypto');

const db = require('./db');
const { protect } = require('./middlewares/auth');

const router = express.Router();

router.get('/', protect, async (_req, res) => {
  try {
    const rows = await db.getCatalogItems();
    const items = rows.map(mapRowToCatalogItem);
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Failed to fetch catalog items:', error.message);
    return res.status(500).json({ error: 'Failed to fetch catalog items.' });
  }
});

router.post('/seed', protect, async (req, res) => {
  const adminSecret = process.env.CATALOG_SEED_SECRET;
  if (adminSecret && req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required to seed the catalog.' });
  }

  try {
    const now = new Date();
    const records = items.map(item => buildCatalogRecord(item, now));
    await db.upsertCatalogItems(records);
    const rows = await db.getCatalogItems();
    const normalized = rows.map(mapRowToCatalogItem);
    return res.status(201).json({ items: normalized });
  } catch (error) {
    if (error && error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to seed catalog items:', error.message);
    return res.status(500).json({ error: 'Failed to seed catalog items.' });
  }
});

function buildCatalogRecord(item = {}, timestamp) {
  const id = item.id || randomUUID();
  const createdAtIso = item.createdAt || item.created_at || timestamp.toISOString();
  const updatedAtIso = timestamp.toISOString();

  const sourceUrl = item.url || item.imageUrl;
  if (!sourceUrl) {
    const error = new Error('Catalog items require a url field.');
    error.statusCode = 400;
    throw error;
  }

  return {
    id,
    name: String(item.name || 'Untitled Item'),
    description: item.description ? String(item.description) : '',
    price: normalizePrice(item.price),
    image_url: sourceUrl,
    pregenerated_lookbook_url: item.pregeneratedLookbookUrl || null,
    pregenerated_try_on_url: item.pregeneratedTryOnUrl || null,
    pregenerated_material_url: item.pregeneratedMaterialUrl || null,
    pregenerated_logo_url: item.pregeneratedLogoUrl || null,
    fitting_metadata: normalizeFittingMetadata(item.fittingMetadata || item.poseMetadata || null),
    created_at: createdAtIso,
    updated_at: updatedAtIso,
  };
}

function normalizePrice(value) {
  if (value === null || value === undefined) {
    return 0;
  }
  const asNumber = Number(value);
  if (Number.isNaN(asNumber)) {
    return 0;
  }
  return Math.max(0, asNumber);
}

function mapRowToCatalogItem(row) {
  const priceValue = row.price !== null && row.price !== undefined ? Number(row.price) : undefined;
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    price: Number.isFinite(priceValue) ? priceValue : undefined,
    url: row.image_url,
    pregeneratedLookbookUrl: row.pregenerated_lookbook_url || undefined,
    pregeneratedTryOnUrl: row.pregenerated_try_on_url || undefined,
    pregeneratedMaterialUrl: row.pregenerated_material_url || undefined,
    pregeneratedLogoUrl: row.pregenerated_logo_url || undefined,
    fittingMetadata: row.fitting_metadata || undefined,
  };
}

function normalizeFittingMetadata(rawMetadata) {
  if (!rawMetadata) {
    return null;
  }

  if (Array.isArray(rawMetadata)) {
    return {
      anchors: rawMetadata.map(entry => normalizeAnchor(entry)).filter(Boolean),
    };
  }

  if (typeof rawMetadata === 'object') {
    const anchors = Array.isArray(rawMetadata.anchors)
      ? rawMetadata.anchors.map(entry => normalizeAnchor(entry)).filter(Boolean)
      : undefined;

    const notes = typeof rawMetadata.notes === 'string' ? rawMetadata.notes : undefined;
    const additional = typeof rawMetadata.additionalInstructions === 'string'
      ? rawMetadata.additionalInstructions
      : undefined;

    const normalized = {};
    if (anchors && anchors.length > 0) {
      normalized.anchors = anchors;
    }
    if (notes) {
      normalized.notes = notes;
    }
    if (additional) {
      normalized.additionalInstructions = additional;
    }

    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  return null;
}

function normalizeAnchor(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const anchorName = typeof entry.name === 'string' ? entry.name : null;
  const anchorRole = typeof entry.role === 'string' ? entry.role : undefined;
  const anchorNotes = typeof entry.notes === 'string' ? entry.notes : undefined;

  const coordinates = typeof entry.coordinates === 'object' && entry.coordinates !== null
    ? entry.coordinates
    : entry;

  const x = typeof coordinates.x === 'number' ? coordinates.x : undefined;
  const y = typeof coordinates.y === 'number' ? coordinates.y : undefined;

  if (!anchorName && (x === undefined || y === undefined)) {
    return null;
  }

  const normalized = {};
  if (anchorName) {
    normalized.name = anchorName;
  }
  if (anchorRole) {
    normalized.role = anchorRole;
  }
  if (x !== undefined && y !== undefined) {
    normalized.x = x;
    normalized.y = y;
  }
  if (anchorNotes) {
    normalized.notes = anchorNotes;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

module.exports = router;
