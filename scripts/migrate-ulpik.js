// Asigna reporte y mes a los dashboards del Comité Ulpik que se subieron antes
// de que existieran esos campos. No toca los HTML ni los links (/view/:id).
//
// Uso (desde la raíz del proyecto):
//   node scripts/migrate-ulpik.js           → solo muestra lo que haría
//   node scripts/migrate-ulpik.js --apply   → aplica los cambios
//
// Haz un respaldo de data/ y uploads/ antes de usar --apply.

const {
  listDashboards,
  updateDashboard,
  normalizeUlpikFields,
  findUlpikDuplicate,
  ULPIK_CATEGORY,
} = require('../src/db');

const PERIOD = '2026-08';

// Clave: título actual sin tildes, espacios ni signos.
const MAPPING = {
  iksasreportecomercial: { reportType: 'reporte-comercial' },
  iksasprofitfirst: { reportType: 'profit-first' },
  iksasreportedeflujo: { reportType: 'flujo-caja' },
  iksassatisfaccioniniciodetramites: { reportType: 'sat-inicio-tramite' },
  iksassatisfaccionfindetramiteslegales: { reportType: 'sat-fin-tramite' },
  ulpikprivago2026: { reportType: 'sat-ulpik-priv' },
  satisfaccionmasterclassclaude20: { reportType: 'evento', eventName: 'Masterclass Claude 2.0' },
};

function titleKey(title) {
  return String(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const apply = process.argv.includes('--apply');
const pending = listDashboards({ category: ULPIK_CATEGORY }).filter((d) => !d.reportType);

if (!pending.length) {
  console.log('No hay dashboards del Comité Ulpik sin reporte asignado. Nada que hacer.');
  process.exit(0);
}

let updated = 0;
let skipped = 0;

for (const dashboard of pending) {
  const target = MAPPING[titleKey(dashboard.title)];
  if (!target) {
    console.log(`SIN MAPEO   «${dashboard.title}» (${dashboard.id}) → asígnalo a mano desde el admin`);
    skipped += 1;
    continue;
  }

  const { errors, value } = normalizeUlpikFields({ ...target, period: PERIOD });
  if (errors.length) {
    console.log(`ERROR       «${dashboard.title}»: ${errors.join('. ')}`);
    skipped += 1;
    continue;
  }

  const duplicate = findUlpikDuplicate({ ...value, excludeId: dashboard.id });
  if (duplicate) {
    console.log(`DUPLICADO   «${dashboard.title}» → ya existe «${duplicate.title}» (${duplicate.id}), se omite`);
    skipped += 1;
    continue;
  }

  if (apply) {
    const result = updateDashboard(dashboard.id, { category: ULPIK_CATEGORY, ...value });
    console.log(`ACTUALIZADO «${dashboard.title}» → «${result.title}» [${result.areaLabel}]`);
  } else {
    console.log(`SE HARÍA    «${dashboard.title}» → ${value.reportType} · ${value.period}${value.eventName ? ` · ${value.eventName}` : ''}`);
  }
  updated += 1;
}

console.log('');
console.log(`${apply ? 'Actualizados' : 'Por actualizar'}: ${updated} · Omitidos: ${skipped}`);
if (!apply && updated) {
  console.log('Ejecuta de nuevo con --apply para guardar los cambios.');
}
