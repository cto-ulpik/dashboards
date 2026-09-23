const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const {
  listDashboards,
  getDashboard,
  createDashboard,
  updateDashboard,
  replaceDashboardFile,
  deleteDashboard,
  getAllTags,
  CATEGORIES,
  normalizeCategory,
  parseNeedsAi,
} = require('../db');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const MAX_HTML_BYTES = 5 * 1024 * 1024;

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${Date.now()}-${safeBase || 'dashboard'}.html`);
  },
});

function htmlFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const isHtml =
    ext === '.html' ||
    ext === '.htm' ||
    file.mimetype === 'text/html' ||
    file.mimetype === 'application/xhtml+xml';

  if (!isHtml) {
    return cb(new Error('Solo se permiten archivos .html'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter: htmlFileFilter,
  limits: { fileSize: MAX_HTML_BYTES },
});

function removeFileSafe(filename) {
  if (!filename) return;
  const filePath = path.join(uploadsDir, path.basename(filename));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function validateMeta({ title, subtitle, tags, category }) {
  const errors = [];
  if (!title || !String(title).trim()) errors.push('El título es obligatorio');
  if (!subtitle || !String(subtitle).trim()) errors.push('El subtítulo es obligatorio');
  if (!tags || !String(tags).trim()) errors.push('Las etiquetas son obligatorias');
  if (!normalizeCategory(category)) {
    errors.push('La clasificación es obligatoria (Comité Ulpik, Comité MQI o Herramientas)');
  }
  return errors;
}

function writeHtmlFile(html, baseName = 'dashboard') {
  const content = String(html);
  const bytes = Buffer.byteLength(content, 'utf8');
  if (!content.trim()) {
    throw new Error('El contenido HTML no puede estar vacío');
  }
  if (bytes > MAX_HTML_BYTES) {
    throw new Error('El HTML supera el límite de 5 MB');
  }

  const safeBase = String(baseName)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40) || 'dashboard';
  const filename = `${Date.now()}-${safeBase}.html`;
  fs.writeFileSync(path.join(uploadsDir, filename), content, 'utf8');
  return filename;
}

function readHtmlFile(filename) {
  const filePath = path.join(uploadsDir, path.basename(filename));
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function resolveHtmlSource(req) {
  if (req.file) {
    return { type: 'file', filename: req.file.filename };
  }

  if (typeof req.body.html === 'string' && req.body.html.trim()) {
    return { type: 'html', html: req.body.html };
  }

  return null;
}

router.get('/categories', (_req, res) => {
  res.json({ categories: CATEGORIES });
});

router.get('/dashboards', (req, res) => {
  const { q = '', tag = '', category = '' } = req.query;
  res.json({
    dashboards: listDashboards({ q, tag, category }),
    tags: getAllTags(),
    categories: CATEGORIES,
  });
});

router.get('/dashboards/:id', (req, res) => {
  const dashboard = getDashboard(req.params.id);
  if (!dashboard) {
    return res.status(404).json({ error: 'Dashboard no encontrado' });
  }
  res.json(dashboard);
});

router.get('/dashboards/:id/content', (req, res) => {
  const dashboard = getDashboard(req.params.id);
  if (!dashboard) {
    return res.status(404).json({ error: 'Dashboard no encontrado' });
  }

  const html = readHtmlFile(dashboard.filename);
  if (html === null) {
    return res.status(404).json({ error: 'Archivo del dashboard no encontrado' });
  }

  res.json({ id: dashboard.id, html });
});

router.post('/dashboards', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return upload.single('file')(req, res, next);
  }
  return next();
}, (req, res) => {
  try {
    const { title, subtitle, tags, category, needs_ai, needsAi } = req.body;
    const errors = validateMeta({ title, subtitle, tags, category });
    const source = resolveHtmlSource(req);

    if (!source) {
      errors.push('Debes subir un archivo HTML o escribir el código en el editor');
    }

    if (errors.length) {
      if (req.file) removeFileSafe(req.file.filename);
      return res.status(400).json({ error: errors.join('. ') });
    }

    let filename;
    if (source.type === 'file') {
      filename = source.filename;
    } else {
      filename = writeHtmlFile(source.html, title);
    }

    const dashboard = createDashboard({
      id: uuidv4(),
      title,
      subtitle,
      tags,
      category,
      needsAi: parseNeedsAi(needsAi ?? needs_ai),
      filename,
    });

    res.status(201).json(dashboard);
  } catch (err) {
    if (req.file) removeFileSafe(req.file.filename);
    res.status(500).json({ error: err.message || 'Error al crear el dashboard' });
  }
});

router.put('/dashboards/:id', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return upload.single('file')(req, res, next);
  }
  return next();
}, (req, res) => {
  try {
    const existing = getDashboard(req.params.id);
    if (!existing) {
      if (req.file) removeFileSafe(req.file.filename);
      return res.status(404).json({ error: 'Dashboard no encontrado' });
    }

    const title = req.body.title ?? existing.title;
    const subtitle = req.body.subtitle ?? existing.subtitle;
    const tags = req.body.tags ?? existing.tags.join(', ');
    const category = req.body.category ?? existing.category;
    const needsAiRaw = req.body.needsAi ?? req.body.needs_ai;
    const errors = validateMeta({ title, subtitle, tags, category });

    if (errors.length) {
      if (req.file) removeFileSafe(req.file.filename);
      return res.status(400).json({ error: errors.join('. ') });
    }

    updateDashboard(req.params.id, {
      title,
      subtitle,
      tags,
      category,
      needsAi: needsAiRaw === undefined ? existing.needsAi : parseNeedsAi(needsAiRaw),
    });

    const source = resolveHtmlSource(req);
    if (source) {
      let filename;
      if (source.type === 'file') {
        filename = source.filename;
      } else {
        filename = writeHtmlFile(source.html, title);
      }
      removeFileSafe(existing.filename);
      replaceDashboardFile(req.params.id, filename);
    }

    res.json(getDashboard(req.params.id));
  } catch (err) {
    if (req.file) removeFileSafe(req.file.filename);
    res.status(500).json({ error: err.message || 'Error al actualizar el dashboard' });
  }
});

router.patch('/dashboards/:id/category', (req, res) => {
  try {
    const existing = getDashboard(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Dashboard no encontrado' });
    }

    const category = req.body?.category;
    if (!normalizeCategory(category)) {
      return res.status(400).json({
        error: 'La clasificación es obligatoria (Comité Ulpik, Comité MQI o Herramientas)',
      });
    }

    const updated = updateDashboard(req.params.id, {
      title: existing.title,
      subtitle: existing.subtitle,
      tags: existing.tags.join(', '),
      category,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al actualizar la clasificación' });
  }
});

router.put('/dashboards/:id/content', (req, res) => {
  try {
    const existing = getDashboard(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Dashboard no encontrado' });
    }

    const html = req.body?.html;
    if (typeof html !== 'string' || !html.trim()) {
      return res.status(400).json({ error: 'El contenido HTML es obligatorio' });
    }

    const filename = writeHtmlFile(html, existing.title);
    removeFileSafe(existing.filename);
    replaceDashboardFile(req.params.id, filename);

    res.json({ id: existing.id, ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al guardar el HTML' });
  }
});

router.delete('/dashboards/:id', (req, res) => {
  const deleted = deleteDashboard(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Dashboard no encontrado' });
  }
  removeFileSafe(deleted.filename);
  res.json({ ok: true, id: deleted.id });
});

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo supera el límite de 5 MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Error en la solicitud' });
  }
  res.status(500).json({ error: 'Error interno' });
});

module.exports = router;
