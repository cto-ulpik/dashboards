// Programas internos de Herramientas. Por ahora: Auditor SENADI.
const express = require('express');
const { callOpenAI, checkRateLimit } = require('./ai');
const store = require('../tools/senadi/store');
const prompts = require('../tools/senadi/prompts');

const router = express.Router();

const MAX_TEXT = 200_000;
const MAX_LOGO_BASE64 = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function extraerJSON(texto) {
  let t = String(texto).trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function text(value) {
  return String(value ?? '').slice(0, MAX_TEXT).trim();
}

async function askAi(system, content, maxTokens = 4000) {
  if (!checkRateLimit('tool:auditor-senadi')) {
    const err = new Error('Demasiadas consultas de IA. Espera un minuto.');
    err.status = 429;
    throw err;
  }
  const { text: answer } = await callOpenAI({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content },
    ],
    maxTokens,
  });
  return answer;
}

function fail(res, err, fallback) {
  console.error('[tools/senadi]', err.message || err);
  res.status(err.status || 500).json({ error: err.message || fallback });
}

router.get('/senadi/observaciones', (_req, res) => {
  res.json({ observaciones: store.listObservations() });
});

// Registra una observación real: la IA extrae campo, patrón y regla, y se guarda para todos.
router.post('/senadi/observaciones', async (req, res) => {
  try {
    const textoOriginal = text(req.body?.texto);
    if (!textoOriginal) {
      return res.status(400).json({ error: 'Pega el texto de la observación o sube el PDF primero.' });
    }
    const raw = await askAi(prompts.OBSERVACION_SYSTEM, textoOriginal, 1500);
    const json = extraerJSON(raw);
    const observacion = store.addObservation({
      ...json,
      textoOriginal,
      registradoPor: req.body?.registradoPor,
    });
    res.status(201).json(observacion);
  } catch (err) {
    fail(res, err, 'No se pudo registrar la observación');
  }
});

// Sube a la base compartida las observaciones que alguien tenía solo en su navegador.
router.post('/senadi/observaciones/importar', (req, res) => {
  const items = Array.isArray(req.body?.observaciones) ? req.body.observaciones.slice(0, 500) : [];
  if (!items.length) {
    return res.status(400).json({ error: 'No hay observaciones para importar' });
  }
  const registradoPor = req.body?.registradoPor;
  res.json(store.importObservations(items.map((o) => ({ ...o, registradoPor: o.registradoPor || registradoPor }))));
});

router.delete('/senadi/observaciones/:id', (req, res) => {
  const deleted = store.deleteObservation(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Observación no encontrada' });
  res.json({ ok: true, id: deleted.id });
});

router.post('/senadi/auditar', async (req, res) => {
  try {
    const textoFormulario = text(req.body?.textoFormulario);
    if (!textoFormulario) {
      return res.status(400).json({ error: 'El formulario no tiene texto legible.' });
    }

    let logo = null;
    if (req.body?.logo?.data) {
      const mediaType = String(req.body.logo.mediaType || '').toLowerCase();
      if (!IMAGE_TYPES.has(mediaType)) {
        return res.status(400).json({ error: 'El logotipo debe ser PNG, JPG, WEBP o GIF.' });
      }
      if (String(req.body.logo.data).length > MAX_LOGO_BASE64) {
        return res.status(400).json({ error: 'El logotipo es demasiado pesado (máx. ~6 MB).' });
      }
      logo = { mediaType, data: String(req.body.logo.data) };
    }

    const content = prompts.auditoriaContent({
      textoFormulario,
      textoDescuento: text(req.body?.textoDescuento),
      textoNombramiento: text(req.body?.textoNombramiento),
      logo,
    });
    const raw = await askAi(prompts.auditoriaSystem(store.listObservations()), content);
    res.json(extraerJSON(raw));
  } catch (err) {
    fail(res, err, 'No se pudo completar la auditoría');
  }
});

router.post('/senadi/alcance', async (req, res) => {
  try {
    const observacion = text(req.body?.observacion);
    if (!observacion) {
      return res.status(400).json({ error: 'Pega el texto de la observación recibida.' });
    }
    const borrador = await askAi(
      prompts.ALCANCE_SYSTEM,
      prompts.alcanceUser({
        tramite: text(req.body?.tramite),
        denominacion: text(req.body?.denominacion),
        observacion,
      }),
      2500
    );
    res.json({ borrador: borrador.trim() });
  } catch (err) {
    fail(res, err, 'No se pudo generar el borrador');
  }
});

module.exports = router;
