// Asigna reporte y mes a los dashboards de un comité que se subieron antes de que
// existieran esos campos. No toca los HTML ni los links (/view/:id).

const {
  listDashboards,
  updateDashboard,
  normalizeReportFields,
  findReportDuplicate,
  categoryLabel,
} = require('../../src/db');

// Título actual sin tildes, espacios ni signos: "IK SAS - Reporte Comercial" → "iksasreportecomercial".
function titleKey(title) {
  return String(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// mapping: { [titleKey]: { reportType, period, eventName? } }
function runMigration(category, mapping, argv = process.argv) {
  const apply = argv.includes('--apply');
  const pending = listDashboards({ category }).filter((d) => !d.reportType);

  console.log(`${categoryLabel(category)}${apply ? '' : ' (solo vista previa)'}`);
  console.log('');

  if (!pending.length) {
    console.log('No hay dashboards sin reporte asignado. Nada que hacer.');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const dashboard of pending) {
    const target = mapping[titleKey(dashboard.title)];
    if (!target) {
      console.log(`SIN MAPEO   «${dashboard.title}» (${dashboard.id}) → queda en "Sin asignar"; asígnalo a mano desde el admin`);
      skipped += 1;
      continue;
    }

    const { errors, value } = normalizeReportFields(category, target);
    if (errors.length) {
      console.log(`ERROR       «${dashboard.title}»: ${errors.join('. ')}`);
      skipped += 1;
      continue;
    }

    const duplicate = findReportDuplicate({ category, ...value, excludeId: dashboard.id });
    if (duplicate) {
      console.log(`DUPLICADO   «${dashboard.title}» → ya existe «${duplicate.title}» (${duplicate.id}), se omite`);
      skipped += 1;
      continue;
    }

    if (apply) {
      const result = updateDashboard(dashboard.id, { category, ...value });
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
}

module.exports = { runMigration, titleKey };
