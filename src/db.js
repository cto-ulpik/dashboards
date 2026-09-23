const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'dashboards.db');

const CATEGORIES = [
  { id: 'comite-ulpik', label: 'Comité Ulpik' },
  { id: 'comite-mqi', label: 'Comité MQI' },
  { id: 'herramientas', label: 'Herramientas' },
];

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));
const DEFAULT_CATEGORY = 'comite-ulpik';

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS dashboards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '${DEFAULT_CATEGORY}',
    filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const columns = db.prepare(`PRAGMA table_info(dashboards)`).all().map((col) => col.name);
if (!columns.includes('category')) {
  db.exec(`ALTER TABLE dashboards ADD COLUMN category TEXT NOT NULL DEFAULT '${DEFAULT_CATEGORY}'`);
}
if (!columns.includes('needs_ai')) {
  db.exec(`ALTER TABLE dashboards ADD COLUMN needs_ai INTEGER NOT NULL DEFAULT 0`);
}

function parseTags(tagsInput) {
  if (Array.isArray(tagsInput)) {
    return tagsInput
      .map((t) => String(t).trim())
      .filter(Boolean);
  }

  return String(tagsInput || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeTags(tagsInput) {
  return [...new Set(parseTags(tagsInput).map((t) => t.toLowerCase()))].join(', ');
}

function normalizeCategory(category) {
  const value = String(category || '').trim().toLowerCase();
  if (CATEGORY_IDS.has(value)) return value;
  return null;
}

function categoryLabel(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId;
}

function parseNeedsAi(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'yes';
}

function rowToDashboard(row) {
  if (!row) return null;
  const category = normalizeCategory(row.category) || DEFAULT_CATEGORY;
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    tags: parseTags(row.tags),
    category,
    categoryLabel: categoryLabel(category),
    needsAi: Boolean(row.needs_ai),
    filename: row.filename,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const statements = {
  list: db.prepare(`
    SELECT * FROM dashboards
    ORDER BY datetime(updated_at) DESC
  `),
  getById: db.prepare(`SELECT * FROM dashboards WHERE id = ?`),
  insert: db.prepare(`
    INSERT INTO dashboards (id, title, subtitle, tags, category, needs_ai, filename, created_at, updated_at)
    VALUES (@id, @title, @subtitle, @tags, @category, @needs_ai, @filename, datetime('now'), datetime('now'))
  `),
  updateMeta: db.prepare(`
    UPDATE dashboards
    SET title = @title,
        subtitle = @subtitle,
        tags = @tags,
        category = @category,
        needs_ai = @needs_ai,
        updated_at = datetime('now')
    WHERE id = @id
  `),
  updateFile: db.prepare(`
    UPDATE dashboards
    SET filename = @filename,
        updated_at = datetime('now')
    WHERE id = @id
  `),
  remove: db.prepare(`DELETE FROM dashboards WHERE id = ?`),
  allTags: db.prepare(`SELECT tags FROM dashboards`),
};

function listDashboards({ q = '', tag = '', category = '' } = {}) {
  const query = q.trim().toLowerCase();
  const tagFilter = tag.trim().toLowerCase();
  const categoryFilter = normalizeCategory(category);

  return statements.list
    .all()
    .map(rowToDashboard)
    .filter((dashboard) => {
      const matchesQuery =
        !query ||
        dashboard.title.toLowerCase().includes(query) ||
        dashboard.subtitle.toLowerCase().includes(query);

      const matchesTag =
        !tagFilter || dashboard.tags.some((t) => t.toLowerCase() === tagFilter);

      const matchesCategory = !categoryFilter || dashboard.category === categoryFilter;

      return matchesQuery && matchesTag && matchesCategory;
    });
}

function getDashboard(id) {
  return rowToDashboard(statements.getById.get(id));
}

function createDashboard({ id, title, subtitle, tags, category, needsAi, filename }) {
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) {
    throw new Error('La clasificación es inválida');
  }

  statements.insert.run({
    id,
    title: title.trim(),
    subtitle: subtitle.trim(),
    tags: normalizeTags(tags),
    category: normalizedCategory,
    needs_ai: parseNeedsAi(needsAi) ? 1 : 0,
    filename,
  });
  return getDashboard(id);
}

function updateDashboard(id, { title, subtitle, tags, category, needsAi }) {
  const existing = getDashboard(id);
  if (!existing) return null;

  const normalizedCategory = normalizeCategory(category ?? existing.category);
  if (!normalizedCategory) {
    throw new Error('La clasificación es inválida');
  }

  const nextNeedsAi =
    needsAi === undefined ? existing.needsAi : parseNeedsAi(needsAi);

  statements.updateMeta.run({
    id,
    title: title.trim(),
    subtitle: subtitle.trim(),
    tags: normalizeTags(tags),
    category: normalizedCategory,
    needs_ai: nextNeedsAi ? 1 : 0,
  });

  return getDashboard(id);
}

function replaceDashboardFile(id, filename) {
  const existing = getDashboard(id);
  if (!existing) return null;
  statements.updateFile.run({ id, filename });
  return getDashboard(id);
}

function deleteDashboard(id) {
  const existing = getDashboard(id);
  if (!existing) return null;
  statements.remove.run(id);
  return existing;
}

function getAllTags() {
  const tagSet = new Set();
  for (const row of statements.allTags.all()) {
    for (const tag of parseTags(row.tags)) {
      tagSet.add(tag.toLowerCase());
    }
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b));
}

module.exports = {
  db,
  CATEGORIES,
  DEFAULT_CATEGORY,
  normalizeCategory,
  categoryLabel,
  parseNeedsAi,
  listDashboards,
  getDashboard,
  createDashboard,
  updateDashboard,
  replaceDashboardFile,
  deleteDashboard,
  getAllTags,
  normalizeTags,
  parseTags,
};
