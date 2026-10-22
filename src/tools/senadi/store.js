// Base de observaciones del Auditor SENADI, compartida por todo el equipo legal.
const { db } = require('../../db');

db.exec(`
  CREATE TABLE IF NOT EXISTS senadi_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campo TEXT NOT NULL DEFAULT '',
    patron TEXT NOT NULL DEFAULT '',
    regla TEXT NOT NULL DEFAULT '',
    resumen TEXT NOT NULL DEFAULT '',
    texto_original TEXT NOT NULL DEFAULT '',
    registrado_por TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// Observaciones reales que ya venían precargadas en la herramienta original.
const SEMILLAS = [
  {
    campo: 'Quién actúa a través de / Anexos',
    patron: 'Solicitante persona extranjera representada por apoderado, sin poder apostillado adjunto ni código en el libro de poderes.',
    regla: 'Si el solicitante es una persona extranjera (natural o jurídica) y actúa mediante apoderado en Ecuador, verificar SIEMPRE que se adjunte el poder debidamente apostillado y que su código conste ingresado en el libro de poderes del SENADI, antes de subir el trámite.',
    resumen: 'Caso real LUNSOLL MÁS LOGOTIPO (SENADI-2026-24618): observación por falta de poder apostillado de solicitante chileno.',
    textoOriginal: 'Adjuntar el poder debidamente apostillado, así como el código del mismo que debe estar ingresado en el libro de poderes, en razón que el solicitante del signo distintivo es una persona extranjera y necesita un representante en Ecuador.',
  },
  {
    campo: 'Certificado de descuento',
    patron: 'El nombre del beneficiario en el certificado de descuento no coincide con el nombre actual del solicitante (por cambio de denominación societaria posterior a la emisión del certificado).',
    regla: 'Verificar SIEMPRE que el nombre/razón social en el certificado de descuento coincida EXACTAMENTE, letra por letra, con el nombre del solicitante declarado en el formulario. Si la empresa cambió de denominación después de emitido el certificado, el certificado no es válido y se debe completar el 50% restante de la tasa antes de iniciar.',
    resumen: 'Caso real VIDASUA MÁS LOGOTIPO (SENADI-2026-53095): certificado emitido a nombre de la razón social anterior de la compañía.',
    textoOriginal: 'El certificado de descuento no coincide con la identificación del solicitante del presente signo distintivo, en razón de un cambio de denominación societaria.',
  },
  {
    campo: 'Descripción del signo',
    patron: 'El logotipo incluye una frase o texto adicional a la denominación principal, y la descripción del signo no aclara si es un lema comercial o si es de carácter meramente informativo.',
    regla: "Si el logotipo contiene cualquier texto adicional a la denominación principal, revisar antes de subir si corresponde a un LEMA COMERCIAL (debe excluirse del diseño/descripción y tramitarse en solicitud aparte) o si es de carácter INFORMATIVO (debe indicarse expresamente esa calificación en el campo 'Descripción clara y completa del signo'). Nunca dejar ese texto sin calificar.",
    resumen: 'Caso real ECOPRAL MÁS LOGOTIPO (SENADI-2026-49617): frase adicional en el logo sin aclarar si era lema comercial o informativa.',
    textoOriginal: 'Aclarar si la expresión que consta en el logotipo corresponde a un lema comercial o tiene carácter informativo.',
  },
];

const statements = {
  list: db.prepare(`SELECT * FROM senadi_observations ORDER BY datetime(created_at) DESC, id DESC`),
  get: db.prepare(`SELECT * FROM senadi_observations WHERE id = ?`),
  insert: db.prepare(`
    INSERT INTO senadi_observations (campo, patron, regla, resumen, texto_original, registrado_por, created_at)
    VALUES (@campo, @patron, @regla, @resumen, @texto_original, @registrado_por, coalesce(@created_at, datetime('now')))
  `),
  remove: db.prepare(`DELETE FROM senadi_observations WHERE id = ?`),
  findSame: db.prepare(`
    SELECT id FROM senadi_observations
    WHERE lower(trim(patron)) = lower(trim(@patron))
       OR (@texto_original <> '' AND lower(trim(texto_original)) = lower(trim(@texto_original)))
  `),
  getMeta: db.prepare(`SELECT value FROM app_meta WHERE key = ?`),
  setMeta: db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`),
};

function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

// "2026-09-01T10:00:00.000Z" o "2026-09-01 10:00:00" → formato de SQLite; otro valor → null.
function toSqlDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function rowToObservation(row) {
  if (!row) return null;
  return {
    id: row.id,
    campo: row.campo,
    patron: row.patron,
    regla: row.regla,
    resumen: row.resumen,
    textoOriginal: row.texto_original,
    registradoPor: row.registrado_por,
    fecha: row.created_at,
  };
}

function toRow(input) {
  return {
    campo: clean(input.campo, 200),
    patron: clean(input.patron, 2000),
    regla: clean(input.regla, 3000),
    resumen: clean(input.resumen, 1000),
    texto_original: clean(input.textoOriginal, 800),
    registrado_por: clean(input.registradoPor, 80),
    created_at: toSqlDate(input.fecha),
  };
}

function listObservations() {
  return statements.list.all().map(rowToObservation);
}

function addObservation(input) {
  const result = statements.insert.run(toRow(input));
  return rowToObservation(statements.get.get(result.lastInsertRowid));
}

function deleteObservation(id) {
  const existing = rowToObservation(statements.get.get(id));
  if (existing) statements.remove.run(id);
  return existing;
}

// Sube observaciones guardadas en el navegador de alguien; omite las que ya existen.
const importObservations = db.transaction((items) => {
  let added = 0;
  let skipped = 0;
  for (const item of items) {
    const row = toRow(item);
    if (!row.patron && !row.regla) {
      skipped += 1;
      continue;
    }
    if (statements.findSame.get({ patron: row.patron, texto_original: row.texto_original })) {
      skipped += 1;
      continue;
    }
    statements.insert.run(row);
    added += 1;
  }
  return { added, skipped };
});

// Carga las 3 observaciones iniciales una sola vez (si alguien las borra, no vuelven).
function seedObservations() {
  if (statements.getMeta.get('senadi:seed-done')) return;
  db.transaction(() => {
    SEMILLAS.forEach((s) => statements.insert.run(toRow({ ...s, registradoPor: 'Precargada' })));
    statements.setMeta.run('senadi:seed-done', new Date().toISOString());
  })();
}

seedObservations();

module.exports = {
  listObservations,
  addObservation,
  deleteObservation,
  importObservations,
};
