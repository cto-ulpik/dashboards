(() => {
  const categoriesView = document.getElementById('categories-view');
  const listView = document.getElementById('list-view');
  const categoryGrid = document.getElementById('category-grid');
  const dashboardList = document.getElementById('dashboard-list');
  const searchInput = document.getElementById('search');
  const listTitle = document.getElementById('list-title');
  const listSubtitle = document.getElementById('list-subtitle');
  const listCount = document.getElementById('list-count');
  const btnBackCategories = document.getElementById('btn-back-categories');
  const toastEl = document.getElementById('toast');

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

  let dashboards = [];
  let categories = [
    { id: 'comite-ulpik', label: 'Comité Ulpik' },
    { id: 'comite-mqi', label: 'Comité MQI' },
    { id: 'herramientas', label: 'Herramientas' },
  ];
  let activeCategory = null;
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

  function setQueryParams({ category = activeCategory, q = searchQuery } = {}) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (q && category) params.set('q', q);
    const next = params.toString();
    window.history.replaceState({}, '', next ? `/?${next}` : '/');
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

  function showCategories() {
    activeCategory = null;
    searchQuery = '';
    searchInput.value = '';
    categoriesView.hidden = false;
    listView.hidden = true;
    setQueryParams({ category: null, q: '' });
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
    listTitle.textContent = category.label;
    listSubtitle.textContent =
      CATEGORY_META[category.id]?.description || 'Dashboards de esta categoría';
    categoriesView.hidden = true;
    listView.hidden = false;
    setQueryParams({ category: activeCategory });
    renderList();
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
  }

  categoryGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.category-card[data-category]');
    if (!card) return;
    searchQuery = '';
    searchInput.value = '';
    openCategory(card.dataset.category);
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = searchInput.value;
      setQueryParams();
      renderList();
    }, 160);
  });

  dashboardList.addEventListener('click', (event) => {
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
  });

  btnBackCategories.addEventListener('click', showCategories);

  async function init() {
    await fetchDashboards();

    const params = getQueryParams();
    const category = params.get('category');
    const id = params.get('id');
    searchQuery = params.get('q') || '';
    searchInput.value = searchQuery;

    if (id) {
      window.open(`/view/${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
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
