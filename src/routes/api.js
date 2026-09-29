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
  archiveVersion,
  listVersions,
  deleteDashboard,
  getAllTags,
  CATEGORIES,
  ULPIK_AREAS,
  ULPIK_REPORTS,
  isUlpik,
  normalizeCategory,
  normalizeUlpikFields,
  findUlpikDuplicate,
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

const ULPIK_CATALOG = { areas: ULPIK_AREAS, reports: ULPIK_REPORTS };

function removeFileSafe(filename) {
  if (!filename) return;
  const filePath = path.join(uploadsDir, path.basename(filename));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// En el Comité Ulpik el HTML anterior se guarda como versión; en el resto se borra.
function retireFile(dashboard, category) {
  if (isUlpik(category) || isUlpik(dashboard.category)) {
    archiveVersion(dashboard.id, dashboard.filename);
  } else {
    removeFileSafe(dashboard.filename);
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

// Valida los metadatos según la clasificación. El Comité Ulpik pide reporte y mes
// en vez de título, subtítulo y etiquetas.
function resolveMeta(input) {
  const category = normalizeCategory(input.category);
  if (!isUlpik(category)) {
    return { errors: validateMeta(input), meta: { ...input, category } };
  }

  const { errors, value } = normalizeUlpikFields(input);
  return { errors, meta: { category, ...value } };
}

function ulpikFieldsFromBody(body, existing = {}) {
  return {
    reportType: body.reportType ?? body.report_type ?? existing.reportType,
    period: body.period ?? existing.period,
    eventName: body.eventName ?? body.event_name ?? existing.eventName,
  };
}

function duplicateMessage(dashboard) {
  return `Ya existe «${dashboard.title}». Si continúas, se reemplaza y la versión anterior queda guardada en el historial.`;
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

function storeSource(source, baseName) {
  return source.type === 'file' ? source.filename : writeHtmlFile(source.html, baseName);
}

router.get('/categories', (_req, res) => {
  res.json({ categories: CATEGORIES, ulpik: ULPIK_CATALOG });
});

router.get('/dashboards', (req, res) => {
  const { q = '', tag = '', category = '' } = req.query;
  res.json({
    dashboards: listDashboards({ q, tag, category }),
    tags: getAllTags(),
    categories: CATEGORIES,
    ulpik: ULPIK_CATALOG,
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

router.get('/dashboards/:id/versions', (req, res) => {
  const dashboard = getDashboard(req.params.id);
  if (!dashboard) {
    return res.status(404).json({ error: 'Dashboard no encontrado' });
  }
  const versions = listVersions(dashboard.id).map(({ filename: _f, ...version }) => version);
  res.json({ id: dashboard.id, versions });
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
    const { errors, meta } = resolveMeta({
      title,
      subtitle,
      tags,
      category,
      ...ulpikFieldsFromBody(req.body),
    });
    const source = resolveHtmlSource(req);

    if (!source) {
      errors.push('Debes subir un archivo HTML o escribir el código en el editor');
    }

    if (errors.length) {
      if (req.file) removeFileSafe(req.file.filename);
      return res.status(400).json({ error: errors.join('. ') });
    }

    const nextNeedsAi = parseNeedsAi(needsAi ?? needs_ai);

    if (isUlpik(meta.category)) {
      const duplicate = findUlpikDuplicate(meta);
      if (duplicate) {
        if (!parseNeedsAi(req.body.replace)) {
          if (req.file) removeFileSafe(req.file.filename);
          return res.status(409).json({
            error: duplicateMessage(duplicate),
            code: 'duplicate',
            existingId: duplicate.id,
          });
        }

        // Reemplazo confirmado: mismo dashboard (mismo link), HTML nuevo, el anterior al historial.
        const filename = storeSource(source, meta.reportType);
        updateDashboard(duplicate.id, { ...meta, needsAi: nextNeedsAi });
        retireFile(duplicate, meta.category);
        replaceDashboardFile(duplicate.id, filename);
        return res.json({ ...getDashboard(duplicate.id), replaced: true });
      }
    }

    const filename = storeSource(source, meta.title || meta.reportType);

    const dashboard = createDashboard({
      id: uuidv4(),
      ...meta,
      needsAi: nextNeedsAi,
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
    const { errors, meta } = resolveMeta({
      title,
      subtitle,
      tags,
      category,
      ...ulpikFieldsFromBody(req.body, existing),
    });

    if (!errors.length && isUlpik(meta.category)) {
      const duplicate = findUlpikDuplicate({ ...meta, excludeId: existing.id });
      if (duplicate) {
        errors.push(`Ya existe «${duplicate.title}». Elige otro mes o edita ese dashboard`);
      }
    }

    if (errors.length) {
      if (req.file) removeFileSafe(req.file.filename);
      return res.status(400).json({ error: errors.join('. ') });
    }

    updateDashboard(req.params.id, {
      ...meta,
      needsAi: needsAiRaw === undefined ? existing.needsAi : parseNeedsAi(needsAiRaw),
    });

    const source = resolveHtmlSource(req);
    if (source) {
      const filename = storeSource(source, meta.title || meta.reportType);
      retireFile(existing, meta.category);
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

    const category = normalizeCategory(req.body?.category);
    if (!category) {
      return res.status(400).json({
        error: 'La clasificación es obligatoria (Comité Ulpik, Comité MQI o Herramientas)',
      });
    }

    if (category === existing.category) {
      return res.json(existing);
    }

    if (isUlpik(category)) {
      return res.status(400).json({
        error: 'Para pasarlo al Comité Ulpik, pulsa Editar y elige el reporte y el mes',
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
    retireFile(existing, existing.category);
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
  deleted.versions.forEach((version) => removeFileSafe(version.filename));
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
