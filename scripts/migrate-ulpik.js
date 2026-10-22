// Asigna reporte y mes a los dashboards del Comité Ulpik subidos antes del catálogo.
//
// Uso (desde la raíz del proyecto):
//   node scripts/migrate-ulpik.js           → solo muestra lo que haría
//   node scripts/migrate-ulpik.js --apply   → aplica los cambios
//
// Haz un respaldo de data/ y uploads/ antes de usar --apply.

const { ULPIK_CATEGORY } = require('../src/db');
const { runMigration } = require('./lib/migrate-catalog');

const PERIOD = '2026-08';

runMigration(ULPIK_CATEGORY, {
  iksasreportecomercial: { reportType: 'reporte-comercial', period: PERIOD },
  iksasprofitfirst: { reportType: 'profit-first', period: PERIOD },
  iksasreportedeflujo: { reportType: 'flujo-caja', period: PERIOD },
  iksassatisfaccioniniciodetramites: { reportType: 'sat-inicio-tramite', period: PERIOD },
  iksassatisfaccionfindetramiteslegales: { reportType: 'sat-fin-tramite', period: PERIOD },
  ulpikprivago2026: { reportType: 'sat-ulpik-priv', period: PERIOD },
  satisfaccionmasterclassclaude20: { reportType: 'evento', period: PERIOD, eventName: 'Masterclass Claude 2.0' },
});
