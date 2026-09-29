(() => {
  const categoriesView = document.getElementById('categories-view');
  const areasView = document.getElementById('areas-view');
  const reportsView = document.getElementById('reports-view');
  const listView = document.getElementById('list-view');
  const categoryGrid = document.getElementById('category-grid');
  const areaGrid = document.getElementById('area-grid');
  const reportList = document.getElementById('report-list');
  const reportsTitle = document.getElementById('reports-title');
  const reportsSubtitle = document.getElementById('reports-subtitle');
  const dashboardList = document.getElementById('dashboard-list');
  const searchInput = document.getElementById('search');
  const listTitle = document.getElementById('list-title');
  const listSubtitle = document.getElementById('list-subtitle');
  const listCount = document.getElementById('list-count');
  const btnBackCategories = document.getElementById('btn-back-categories');
  const toastEl = document.getElementById('toast');

  const ULPIK_CATEGORY = 'comite-ulpik';
  const UNASSIGNED_AREA = 'sin-asignar';
  const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const CATEGORY_META = {
    'comite-ulpik': {
      description: 'Reportes y tableros del comité Ulpik.',
      markClass: '',
    },
    'comite-mqi': {
      description: 'Informes y seguimiento del comité MQI.',
      markClass: 'is-mqi',
    },
    herramientas: {
      description: 'Utilidades y paneles operativos.',
      markClass: 'is-tools',
    },
  };

  const AREA_META = {
    comercial: { markClass: 'is-area-comercial' },
    finanzas: { markClass: 'is-area-finanzas' },
    'experiencia-cliente': { markClass: 'is-area-experiencia' },
    cursos: { markClass: 'is-area-cursos', description: 'Eventos, masterclass y cursos.' },
  };

  let dashboards = [];
  let categories = [
    { id: 'comite-ulpik', label: 'Comité Ulpik' },
    { id: 'comite-mqi', label: 'Comité MQI' },
    { id: 'herramientas', label: 'Herramientas' },
  ];
  let ulpikCatalog = { areas: [], reports: [] };
  let activeCategory = null;
  let activeArea = null;
  let searchQuery = '';
  let debounceTimer = null;

  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast is-visible is-${type}`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 3200);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shareUrl(id) {
    return `${window.location.origin}/view/${encodeURIComponent(id)}`;
  }

  function periodLabel(period) {
    const [year, month] = String(period || '').split('-');
    return MONTHS[Number(month) - 1] ? `${MONTHS[Number(month) - 1]} ${year}` : '';
  }

  // Mes que ya debería estar subido: el mes anterior al actual.
  function expectedPeriod() {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  }

  function copyWithTextarea(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:0;opacity:0;';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }

  async function copyShareLink(url) {
    let copied = false;
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) copied = copyWithTextarea(url);
    if (copied) {
      showToast('Link copiado', 'success');
      return true;
    }
    window.prompt('Copia este enlace:', url);
    showToast('Copia el enlace del cuadro de diálogo', 'error');
    return false;
  }

  function getQueryParams() {
    return new URLSearchParams(window.location.search);
  }

  function setQueryParams({ category = activeCategory, area = activeArea, q = searchQuery } = {}) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (category === ULPIK_CATEGORY && area) params.set('area', area);
    if (q && category && category !== ULPIK_CATEGORY) params.set('q', q);
    const next = params.toString();
    window.history.replaceState({}, '', next ? `/?${next}` : '/');
  }

  function showView(view) {
    categoriesView.hidden = view !== categoriesView;
    areasView.hidden = view !== areasView;
    reportsView.hidden = view !== reportsView;
    listView.hidden = view !== listView;
  }

  function countByCategory(categoryId) {
    return dashboards.filter((d) => d.category === categoryId).length;
  }

  function filteredInCategory() {
    const q = searchQuery.trim().toLowerCase();
    return dashboards.filter((d) => {
      if (d.category !== activeCategory) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.subtitle.toLowerCase().includes(q)
      );
    });
  }

  function ulpikDashboards() {
    return dashboards.filter((d) => d.category === ULPIK_CATEGORY);
  }

  function ulpikInArea(areaId) {
    return ulpikDashboards().filter((d) =>
      areaId === UNASSIGNED_AREA ? !d.reportType : d.area === areaId
    );
  }

  function ulpikAreas() {
    const areas = [...ulpikCatalog.areas];
    if (ulpikInArea(UNASSIGNED_AREA).length) {
      areas.push({ id: UNASSIGNED_AREA, label: 'Sin asignar' });
    }
    return areas;
  }

  function latestPeriod(items) {
    return items.reduce((max, d) => (d.period && d.period > max ? d.period : max), '');
  }

  // Agrupa los dashboards del área en series: un reporte fijo (todos sus meses) o un evento.
  function buildSeries(areaId) {
    const items = ulpikInArea(areaId);

    if (areaId === UNASSIGNED_AREA) {
      return items.map((d) => ({
        key: d.id,
        label: d.title,
        note: d.subtitle,
        monthly: false,
        entries: [d],
      }));
    }

    const groups = new Map();
    ulpikCatalog.reports
      .filter((r) => r.area === areaId && !r.needsEventName)
      .forEach((r) => groups.set(r.id, { key: r.id, label: r.label, monthly: true, entries: [] }));

    items.forEach((d) => {
      const key = d.eventName ? `evento:${d.eventName.toLowerCase()}` : d.reportType;
      if (!groups.has(key)) {
        groups.set(key, { key, label: d.eventName || d.reportLabel, monthly: !d.eventName, entries: [] });
      }
      groups.get(key).entries.push(d);
    });

    const series = [...groups.values()];
    series.forEach((s) => s.entries.sort((a, b) => b.period.localeCompare(a.period)));
    const monthly = series.filter((s) => s.monthly);
    const events = series
      .filter((s) => !s.monthly)
      .sort((a, b) => b.entries[0].period.localeCompare(a.entries[0].period));
    return [...monthly, ...events];
  }

  function showCategories() {
    activeCategory = null;
    activeArea = null;
    searchQuery = '';
    searchInput.value = '';
    showView(categoriesView);
    setQueryParams({ category: null, area: null, q: '' });
    renderCategories();
  }

  function openCategory(categoryId) {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) {
      showToast('Categoría no encontrada', 'error');
      showCategories();
      return;
    }

    activeCategory = category.id;
    activeArea = null;

    if (category.id === ULPIK_CATEGORY) {
      showView(areasView);
      setQueryParams({ category: activeCategory, area: null });
      renderAreas();
      return;
    }

    listTitle.textContent = category.label;
    listSubtitle.textContent =
      CATEGORY_META[category.id]?.description || 'Dashboards de esta categoría';
    showView(listView);
    setQueryParams({ category: activeCategory });
    renderList();
  }

  function openArea(areaId) {
    const area = ulpikAreas().find((a) => a.id === areaId);
    if (!area) {
      openCategory(ULPIK_CATEGORY);
      return;
    }

    activeCategory = ULPIK_CATEGORY;
    activeArea = area.id;
    reportsTitle.textContent = area.label;
    reportsSubtitle.textContent =
      area.id === UNASSIGNED_AREA
        ? 'Dashboards del comité que aún no tienen reporte ni mes. Asígnalos desde Administración.'
        : 'Cada reporte muestra el último mes. Elige otro mes para ver el historial.';
    showView(reportsView);
    setQueryParams({ category: ULPIK_CATEGORY, area: area.id });
    renderReports();
  }

  function openDashboard(id) {
    window.open(`/view/${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
  }

  function renderCategories() {
    categoryGrid.innerHTML = categories
      .map((category) => {
        const count = countByCategory(category.id);
        const meta = CATEGORY_META[category.id] || {};
        return `
          <button type="button" class="category-card" data-category="${escapeHtml(category.id)}">
            <div class="category-card-top">
              <div class="category-mark ${escapeHtml(meta.markClass || '')}" aria-hidden="true"></div>
              <span class="category-count">${count}</span>
            </div>
            <h2>${escapeHtml(category.label)}</h2>
            <p>${escapeHtml(meta.description || 'Ver dashboards de esta categoría')}</p>
            <span class="category-cta">Abrir categoría →</span>
          </button>
        `;
      })
      .join('');
  }

  function renderAreas() {
    areaGrid.innerHTML = ulpikAreas()
      .map((area) => {
        const items = ulpikInArea(area.id);
        const meta = AREA_META[area.id] || {};
        const reports = ulpikCatalog.reports
          .filter((r) => r.area === area.id && !r.needsEventName)
          .map((r) => r.label)
          .join(' · ');
        const description =
          area.id === UNASSIGNED_AREA
            ? 'Dashboards sin reporte ni mes asignado.'
            : meta.description || reports || 'Reportes del área';
        const latest = latestPeriod(items);
        return `
          <button type="button" class="category-card area-card" data-area="${escapeHtml(area.id)}">
            <div class="category-card-top">
              <div class="category-mark ${escapeHtml(meta.markClass || 'is-area-none')}" aria-hidden="true"></div>
              <span class="category-count">${items.length}</span>
            </div>
            <h2>${escapeHtml(area.label)}</h2>
            <p>${escapeHtml(description)}</p>
            <span class="area-latest">${latest ? `Último: ${escapeHtml(periodLabel(latest))}` : 'Sin reportes todavía'}</span>
            <span class="category-cta">Ver reportes →</span>
          </button>
        `;
      })
      .join('');
  }

  function renderReports() {
    const series = buildSeries(activeArea);

    if (!series.length) {
      reportList.innerHTML = '<div class="list-empty">Todavía no hay reportes en esta área.</div>';
      return;
    }

    const expected = expectedPeriod();

    reportList.innerHTML = series
      .map((s) => {
        const latest = s.entries[0];

        if (!latest) {
          return `
            <article class="list-row report-row is-empty">
              <div class="list-main-static">
                <h2>${escapeHtml(s.label)}</h2>
                <p>Todavía no se ha subido ningún mes.</p>
              </div>
            </article>
          `;
        }

        const url = shareUrl(latest.id);
        const months = s.entries.length;
        const pending =
          s.monthly && latest.period < expected
            ? `<span class="badge-pending">Falta ${escapeHtml(periodLabel(expected))}</span>`
            : '';
        const note = s.note
          ? escapeHtml(s.note)
          : s.monthly
            ? `Último: ${escapeHtml(latest.periodLabel)} · ${months} ${months === 1 ? 'mes' : 'meses'}`
            : escapeHtml(latest.periodLabel);
        const picker =
          months > 1
            ? `
              <select class="period-select" data-action="period" aria-label="Mes de ${escapeHtml(s.label)}">
                ${s.entries
                  .map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.periodLabel)}</option>`)
                  .join('')}
              </select>
            `
            : latest.periodLabel
              ? `<span class="period-chip">${escapeHtml(latest.periodLabel)}</span>`
              : '';

        return `
          <article class="list-row report-row" data-id="${escapeHtml(latest.id)}">
            <button type="button" class="list-main" data-action="open">
              <h2>${escapeHtml(s.label)} ${pending}</h2>
              <p>${note}</p>
            </button>
            <div class="list-actions">
              ${picker}
              <a class="btn btn-secondary btn-sm" href="${escapeHtml(url)}" data-action="share">Compartir</a>
              <a class="btn btn-primary btn-sm" href="${escapeHtml(url)}" data-action="open" target="_blank" rel="noopener noreferrer">Abrir</a>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderList() {
    const items = filteredInCategory();
    listCount.textContent = String(items.length);

    if (!items.length) {
      dashboardList.innerHTML = `
        <div class="list-empty">
          ${
            searchQuery.trim()
              ? 'No hay resultados para esa búsqueda en esta categoría.'
              : 'Todavía no hay dashboards en esta categoría.'
          }
        </div>
      `;
      return;
    }

    dashboardList.innerHTML = items
      .map((d) => {
        const url = shareUrl(d.id);
        return `
          <article class="list-row" data-id="${escapeHtml(d.id)}">
            <button type="button" class="list-main" data-action="open">
              <h2>${escapeHtml(d.title)}</h2>
              <p>${escapeHtml(d.subtitle)}</p>
            </button>
            <div class="list-actions">
              <a class="btn btn-secondary btn-sm" href="${escapeHtml(url)}" data-action="share">Compartir</a>
              <a class="btn btn-primary btn-sm" href="${escapeHtml(url)}" data-action="open" target="_blank" rel="noopener noreferrer">Abrir</a>
            </div>
          </article>
        `;
      })
      .join('');
  }

  async function fetchDashboards() {
    const res = await fetch('/api/dashboards');
    if (!res.ok) throw new Error('No se pudieron cargar los dashboards');
    const data = await res.json();
    dashboards = data.dashboards || [];
    if (Array.isArray(data.categories) && data.categories.length) {
      categories = data.categories;
    }
    if (data.ulpik) {
      ulpikCatalog = data.ulpik;
    }
  }

  function handleRowClick(event) {
    const shareLink = event.target.closest('a[data-action="share"]');
    if (shareLink) {
      event.preventDefault();
      copyShareLink(shareLink.href);
      return;
    }

    const openControl = event.target.closest('[data-action="open"]');
    if (!openControl) return;
    const row = openControl.closest('.list-row[data-id]');
    if (!row) return;

    if (openControl.tagName === 'A') return;
    event.preventDefault();
    openDashboard(row.dataset.id);
  }

  categoryGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.category-card[data-category]');
    if (!card) return;
    searchQuery = '';
    searchInput.value = '';
    openCategory(card.dataset.category);
  });

  areaGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.area-card[data-area]');
    if (!card) return;
    openArea(card.dataset.area);
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = searchInput.value;
      setQueryParams();
      renderList();
    }, 160);
  });

  dashboardList.addEventListener('click', handleRowClick);
  reportList.addEventListener('click', handleRowClick);

  // Al elegir otro mes, la fila pasa a apuntar a ese dashboard.
  reportList.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-action="period"]');
    if (!select) return;
    const row = select.closest('.list-row');
    const url = shareUrl(select.value);
    row.dataset.id = select.value;
    row.querySelectorAll('a[data-action]').forEach((link) => {
      link.href = url;
    });
  });

  btnBackCategories.addEventListener('click', showCategories);
  document.querySelectorAll('[data-back="categories"]').forEach((btn) => {
    btn.addEventListener('click', showCategories);
  });
  document.querySelectorAll('[data-back="areas"]').forEach((btn) => {
    btn.addEventListener('click', () => openCategory(ULPIK_CATEGORY));
  });

  async function init() {
    await fetchDashboards();

    const params = getQueryParams();
    const category = params.get('category');
    const area = params.get('area');
    const id = params.get('id');
    searchQuery = params.get('q') || '';
    searchInput.value = searchQuery;

    if (id) {
      window.open(`/view/${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
    }

    if (category === ULPIK_CATEGORY && area) {
      openArea(area);
      return;
    }

    if (category && categories.some((c) => c.id === category)) {
      openCategory(category);
      return;
    }

    showCategories();
  }

  init().catch((err) => {
    showToast(err.message || 'Error al iniciar el visualizador', 'error');
  });
})();
