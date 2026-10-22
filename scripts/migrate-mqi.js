// Asigna reporte y mes a los dashboards del Comité MQI subidos antes del catálogo.
//
// Uso (desde la raíz del proyecto):
//   node scripts/migrate-mqi.js           → solo muestra lo que haría
//   node scripts/migrate-mqi.js --apply   → aplica los cambios
//
// Haz un respaldo de data/ y uploads/ antes de usar --apply.

const { MQI_CATEGORY } = require('../src/db');
const { runMigration } = require('./lib/migrate-catalog');

// "Informe MQI Julio" no tiene reporte en el catálogo: queda en "Sin asignar".
runMigration(MQI_CATEGORY, {
  auspiciosingresos2026julio: { reportType: 'informe-comercial', period: '2026-07' },
  ingresosagostomqi: { reportType: 'flujos-balances', period: '2026-08' },
  informepodcastdeshunshoacrackjulio: { reportType: 'de-shunsho-a-crack', period: '2026-07' },
  informerrssjulio: { reportType: 'redes-sociales', period: '2026-07' },
});
