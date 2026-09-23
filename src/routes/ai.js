const express = require('express');
const { getDashboard } = require('../db');

const router = express.Router();

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

/** Simple in-memory rate limit: 30 requests / minute per dashboard */
const rateBuckets = new Map();

function checkRateLimit(dashboardId) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 30;
  let bucket = rateBuckets.get(dashboardId);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(dashboardId, bucket);
  }
  bucket.count += 1;
  return bucket.count <= max;
}

function extractSystemContent(body) {
  if (!body || typeof body !== 'object') return '';
  const sys = body.system;
  if (typeof sys === 'string') return sys.trim();
  if (Array.isArray(sys)) {
    return sys
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && part.type === 'text' && part.text) return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

/** Convert Anthropic content blocks (text/image) to OpenAI chat content */
function convertContentPart(part) {
  if (typeof part === 'string') {
    return { type: 'text', text: part };
  }
  if (!part || typeof part !== 'object') return null;

  if (part.type === 'text' && part.text != null) {
    return { type: 'text', text: String(part.text) };
  }

  // Anthropic image: { type:"image", source:{ type:"base64", media_type, data } }
  if (part.type === 'image' && part.source) {
    const src = part.source;
    if (src.type === 'base64' && src.data) {
      const media = src.media_type || 'image/png';
      return {
        type: 'image_url',
        image_url: {
          url: `data:${media};base64,${src.data}`,
        },
      };
    }
    if (src.type === 'url' && src.url) {
      return { type: 'image_url', image_url: { url: src.url } };
    }
  }

  // Already OpenAI-style
  if (part.type === 'image_url' && part.image_url) {
    return part;
  }

  return null;
}

function convertMessageContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');

  const parts = content.map(convertContentPart).filter(Boolean);
  if (!parts.length) return '';

  // If only text parts, flatten to a single string (simpler for JSON mode)
  const onlyText = parts.every((p) => p.type === 'text');
  if (onlyText) {
    return parts.map((p) => p.text).join('\n\n');
  }
  return parts;
}

function messageHasContent(m) {
  if (!m) return false;
  if (typeof m.content === 'string') return m.content.trim().length > 0;
  if (Array.isArray(m.content)) return m.content.length > 0;
  return false;
}

function extractMessages(body) {
  if (!body || typeof body !== 'object') return [];

  const out = [];
  const systemText = extractSystemContent(body);
  if (systemText) {
    out.push({ role: 'system', content: systemText });
  }

  if (Array.isArray(body.messages) && body.messages.length) {
    body.messages.forEach((m) => {
      const content = convertMessageContent(m.content);
      out.push({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content,
      });
    });
    return out;
  }

  if (typeof body.prompt === 'string' && body.prompt.trim()) {
    out.push({ role: 'user', content: body.prompt.trim() });
  }

  return out;
}

function contentToSearchText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p && p.type === 'text' ? p.text : ''))
      .join('\n');
  }
  return '';
}

function wantsJsonObject(messages) {
  const joined = messages.map((m) => contentToSearchText(m.content)).join('\n').toLowerCase();
  return (
    joined.includes('json') ||
    joined.includes('formato obligatorio') ||
    joined.includes('responde únicamente') ||
    joined.includes('unicamente con un objeto json') ||
    joined.includes('únicamente con un objeto json')
  );
}

function resolveModel(requested) {
  const fromEnv = (process.env.OPENAI_MODEL || '').trim();
  if (fromEnv) return fromEnv;
  const r = String(requested || '').trim();
  if (r && !/^claude/i.test(r)) return r;
  return DEFAULT_MODEL;
}

/** GPT-5 / o-series use max_completion_tokens instead of max_tokens */
function usesMaxCompletionTokens(model) {
  const m = String(model || '').toLowerCase();
  return /^gpt-5|^o[0-9]/.test(m);
}

function supportsTemperature(model) {
  const m = String(model || '').toLowerCase();
  // o-series and some gpt-5 variants reject custom temperature
  return !/^o[0-9]/.test(m);
}

function buildTokenLimit(model, maxTokens) {
  const value = Math.min(Math.max(Number(maxTokens) || 4000, 256), 16384);
  return usesMaxCompletionTokens(model)
    ? { max_completion_tokens: value }
    : { max_tokens: value };
}

async function callOpenAI({ messages, maxTokens, model }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    const err = new Error('OPENAI_API_KEY no está configurada en el servidor (.env)');
    err.status = 503;
    throw err;
  }

  const resolvedModel = resolveModel(model);

  const payload = {
    model: resolvedModel,
    messages,
    ...buildTokenLimit(resolvedModel, maxTokens),
  };

  if (supportsTemperature(resolvedModel)) {
    payload.temperature = 0.2;
  }

  if (wantsJsonObject(messages)) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.error?.code ||
      `OpenAI respondió ${response.status}`;
    const err = new Error(detail);
    err.status = response.status >= 400 && response.status < 600 ? response.status : 502;
    throw err;
  }

  const text =
    data?.choices?.[0]?.message?.content?.trim?.() ||
    data?.choices?.[0]?.message?.content ||
    '';

  if (!text) {
    const err = new Error('OpenAI devolvió una respuesta vacía');
    err.status = 502;
    throw err;
  }

  return {
    text,
    model: data.model || payload.model,
    usage: data.usage || null,
  };
}

/**
 * Proxy for AI dashboards. Accepts Anthropic Messages-style bodies
 * (and OpenAI chat bodies) and always returns Anthropic-compatible JSON:
 * { content: [{ type: "text", text: "..." }], model }
 */
router.post('/chat', async (req, res) => {
  try {
    const dashboardId =
      req.get('x-dashboard-id') ||
      req.body?.dashboardId ||
      req.query?.dashboardId;

    if (!dashboardId) {
      return res.status(400).json({ error: 'Falta X-Dashboard-Id' });
    }

    const dashboard = getDashboard(dashboardId);
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard no encontrado' });
    }
    if (!dashboard.needsAi) {
      return res.status(403).json({
        error: 'Este dashboard no tiene habilitada la opción Necesita IA',
      });
    }

    if (!checkRateLimit(dashboardId)) {
      return res.status(429).json({ error: 'Demasiadas consultas de IA. Espera un minuto.' });
    }

    const messages = extractMessages(req.body);
    if (!messages.length || !messages.some(messageHasContent)) {
      return res.status(400).json({ error: 'No hay mensajes para enviar al modelo' });
    }

    const maxTokens = req.body?.max_tokens ?? req.body?.max_completion_tokens ?? 4000;
    const result = await callOpenAI({ messages, maxTokens, model: req.body?.model });

    res.json({
      id: `chatcmpl-proxy-${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: result.model,
      content: [{ type: 'text', text: result.text }],
      stop_reason: 'end_turn',
      usage: result.usage,
    });
  } catch (err) {
    console.error('[ai/chat]', err.message || err);
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Error al consultar OpenAI',
    });
  }
});

module.exports = router;
