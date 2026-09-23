const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'dashboards.db');

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
    filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

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

function rowToDashboard(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    tags: parseTags(row.tags),
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
    INSERT INTO dashboards (id, title, subtitle, tags, filename, created_at, updated_at)
    VALUES (@id, @title, @subtitle, @tags, @filename, datetime('now'), datetime('now'))
  `),
  updateMeta: db.prepare(`
    UPDATE dashboards
    SET title = @title,
        subtitle = @subtitle,
        tags = @tags,
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

function listDashboards({ q = '', tag = '' } = {}) {
  const query = q.trim().toLowerCase();
  const tagFilter = tag.trim().toLowerCase();

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

      return matchesQuery && matchesTag;
    });
}

function getDashboard(id) {
  return rowToDashboard(statements.getById.get(id));
}

function createDashboard({ id, title, subtitle, tags, filename }) {
  statements.insert.run({
    id,
    title: title.trim(),
    subtitle: subtitle.trim(),
    tags: normalizeTags(tags),
    filename,
  });
  return getDashboard(id);
}

function updateDashboard(id, { title, subtitle, tags }) {
  const existing = getDashboard(id);
  if (!existing) return null;

  statements.updateMeta.run({
    id,
    title: title.trim(),
    subtitle: subtitle.trim(),
    tags: normalizeTags(tags),
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
