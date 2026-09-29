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

// Comité Ulpik: cada dashboard es un reporte fijo de un mes (periodo YYYY-MM).
const ULPIK_CATEGORY = 'comite-ulpik';

const ULPIK_AREAS = [
  { id: 'comercial', label: 'Comercial' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'experiencia-cliente', label: 'Experiencia del cliente' },
  { id: 'cursos', label: 'Cursos' },
];

const ULPIK_REPORTS = [
  { id: 'reporte-comercial', label: 'Reporte Comercial', area: 'comercial' },
  { id: 'profit-first', label: 'Profit First', area: 'finanzas' },
  { id: 'flujo-caja', label: 'Flujo de Caja', area: 'finanzas' },
  { id: 'sat-inicio-tramite', label: 'Sat. Inicio de trámite', area: 'experiencia-cliente' },
  { id: 'sat-fin-tramite', label: 'Sat. Fin de trámite', area: 'experiencia-cliente' },
  { id: 'sat-ulpik-priv', label: 'Sat. Ulpik PRIV', area: 'experiencia-cliente' },
  { id: 'evento', label: 'Evento / Curso', area: 'cursos', needsEventName: true },
];

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

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
if (!columns.includes('report_type')) {
  db.exec(`ALTER TABLE dashboards ADD COLUMN report_type TEXT`);
}
if (!columns.includes('period')) {
  db.exec(`ALTER TABLE dashboards ADD COLUMN period TEXT`);
}
if (!columns.includes('event_name')) {
  db.exec(`ALTER TABLE dashboards ADD COLUMN event_name TEXT`);
}

// Versiones anteriores del HTML de un dashboard (se guardan en vez de borrarse).
db.exec(`
  CREATE TABLE IF NOT EXISTS dashboard_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id TEXT NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    replaced_at TEXT NOT NULL DEFAULT (datetime('now'))
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

function isUlpik(category) {
  return category === ULPIK_CATEGORY;
}

function getUlpikReport(reportType) {
  return ULPIK_REPORTS.find((r) => r.id === reportType) || null;
}

function ulpikAreaLabel(areaId) {
  return ULPIK_AREAS.find((a) => a.id === areaId)?.label || areaId;
}

function periodLabel(period) {
  if (!PERIOD_RE.test(String(period || ''))) return '';
  const [year, month] = period.split('-');
  return `${MONTHS_ES[Number(month) - 1]} ${year}`;
}

// Valida reporte + mes (+ nombre del evento) de un dashboard del Comité Ulpik.
function normalizeUlpikFields({ reportType, period, eventName } = {}) {
  const errors = [];
  const report = getUlpikReport(String(reportType || '').trim());
  const normalizedPeriod = String(period || '').trim();
  const normalizedEvent = String(eventName || '').trim().replace(/\s+/g, ' ');

  if (!report) errors.push('Elige el reporte');
  if (!PERIOD_RE.test(normalizedPeriod)) errors.push('Elige el mes y el año del reporte');
  if (report?.needsEventName && !normalizedEvent) errors.push('Escribe el nombre del evento');

  return {
    errors,
    value: {
      reportType: report?.id || null,
      period: PERIOD_RE.test(normalizedPeriod) ? normalizedPeriod : null,
      eventName: report?.needsEventName ? normalizedEvent.slice(0, 120) : null,
    },
  };
}

// Título, subtítulo y etiquetas se generan solos en el Comité Ulpik.
function buildUlpikMeta({ reportType, period, eventName }) {
  const report = getUlpikReport(reportType);
  const area = ulpikAreaLabel(report.area);
  const when = periodLabel(period);
  const name = report.needsEventName ? eventName : report.label;
  return {
    title: `${name} · ${when}`,
    subtitle: report.needsEventName ? `${area} · Evento` : `${area} · ${report.label}`,
    tags: [area, report.needsEventName ? 'evento' : report.label, period],
  };
}

function rowToDashboard(row) {
  if (!row) return null;
  const category = normalizeCategory(row.category) || DEFAULT_CATEGORY;
  const report = isUlpik(category) ? getUlpikReport(row.report_type) : null;
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    tags: parseTags(row.tags),
    category,
    categoryLabel: categoryLabel(category),
    needsAi: Boolean(row.needs_ai),
    filename: row.filename,
    reportType: report?.id || null,
    reportLabel: report?.label || null,
    area: report?.area || null,
    areaLabel: report ? ulpikAreaLabel(report.area) : null,
    period: report ? row.period : null,
    periodLabel: report ? periodLabel(row.period) : null,
    eventName: report?.needsEventName ? row.event_name : null,
    versionsCount: row.versions_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_DASHBOARD = `
  SELECT d.*,
         (SELECT COUNT(*) FROM dashboard_versions v WHERE v.dashboard_id = d.id) AS versions_count
  FROM dashboards d
`;

const statements = {
  list: db.prepare(`
    ${SELECT_DASHBOARD}
    ORDER BY datetime(d.updated_at) DESC
  `),
  getById: db.prepare(`${SELECT_DASHBOARD} WHERE d.id = ?`),
  insert: db.prepare(`
    INSERT INTO dashboards (id, title, subtitle, tags, category, needs_ai, filename,
                            report_type, period, event_name, created_at, updated_at)
    VALUES (@id, @title, @subtitle, @tags, @category, @needs_ai, @filename,
            @report_type, @period, @event_name, datetime('now'), datetime('now'))
  `),
  updateMeta: db.prepare(`
    UPDATE dashboards
    SET title = @title,
        subtitle = @subtitle,
        tags = @tags,
        category = @category,
        needs_ai = @needs_ai,
        report_type = @report_type,
        period = @period,
        event_name = @event_name,
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
  findUlpik: db.prepare(`
    ${SELECT_DASHBOARD}
    WHERE d.category = '${ULPIK_CATEGORY}'
      AND d.report_type = @report_type
      AND d.period = @period
      AND lower(coalesce(d.event_name, '')) = lower(@event_name)
      AND d.id <> @exclude_id
  `),
  insertVersion: db.prepare(`
    INSERT INTO dashboard_versions (dashboard_id, filename, replaced_at)
    VALUES (?, ?, datetime('now'))
  `),
  listVersions: db.prepare(`
    SELECT * FROM dashboard_versions
    WHERE dashboard_id = ?
    ORDER BY id DESC
  `),
  getVersion: db.prepare(`SELECT * FROM dashboard_versions WHERE id = ? AND dashboard_id = ?`),
};

function rowToVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    dashboardId: row.dashboard_id,
    filename: row.filename,
    replacedAt: row.replaced_at,
  };
}

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

// Devuelve el dashboard que ya ocupa ese reporte + mes (+ evento), si existe.
function findUlpikDuplicate({ reportType, period, eventName, excludeId = '' }) {
  return rowToDashboard(
    statements.findUlpik.get({
      report_type: reportType,
      period,
      event_name: eventName || '',
      exclude_id: excludeId,
    })
  );
}

// En el Comité Ulpik el título, subtítulo y etiquetas salen del reporte y el mes.
function resolveStoredMeta({ title, subtitle, tags, category, reportType, period, eventName }) {
  if (isUlpik(category) && reportType) {
    const meta = buildUlpikMeta({ reportType, period, eventName });
    return {
      title: meta.title,
      subtitle: meta.subtitle,
      tags: normalizeTags(meta.tags),
      report_type: reportType,
      period,
      event_name: eventName || null,
    };
  }
  return {
    title: String(title || '').trim(),
    subtitle: String(subtitle || '').trim(),
    tags: normalizeTags(tags),
    report_type: null,
    period: null,
    event_name: null,
  };
}

function createDashboard({ id, title, subtitle, tags, category, needsAi, filename, reportType, period, eventName }) {
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) {
    throw new Error('La clasificación es inválida');
  }

  statements.insert.run({
    id,
    ...resolveStoredMeta({ title, subtitle, tags, category: normalizedCategory, reportType, period, eventName }),
    category: normalizedCategory,
    needs_ai: parseNeedsAi(needsAi) ? 1 : 0,
    filename,
  });
  return getDashboard(id);
}

function updateDashboard(id, { title, subtitle, tags, category, needsAi, reportType, period, eventName }) {
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
    ...resolveStoredMeta({ title, subtitle, tags, category: normalizedCategory, reportType, period, eventName }),
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

function archiveVersion(dashboardId, filename) {
  statements.insertVersion.run(dashboardId, filename);
}

function listVersions(dashboardId) {
  return statements.listVersions.all(dashboardId).map(rowToVersion);
}

function getVersion(dashboardId, versionId) {
  return rowToVersion(statements.getVersion.get(versionId, dashboardId));
}

function deleteDashboard(id) {
  const existing = getDashboard(id);
  if (!existing) return null;
  const versions = listVersions(id);
  statements.remove.run(id);
  return { ...existing, versions };
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
  ULPIK_CATEGORY,
  ULPIK_AREAS,
  ULPIK_REPORTS,
  isUlpik,
  normalizeCategory,
  categoryLabel,
  parseNeedsAi,
  normalizeUlpikFields,
  findUlpikDuplicate,
  listDashboards,
  getDashboard,
  createDashboard,
  updateDashboard,
  replaceDashboardFile,
  archiveVersion,
  listVersions,
  getVersion,
  deleteDashboard,
  getAllTags,
  normalizeTags,
  parseTags,
};
