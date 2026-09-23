(() => {
  const galleryView = document.getElementById('gallery-view');
  const viewerView = document.getElementById('viewer-view');
  const gallery = document.getElementById('gallery');
  const searchInput = document.getElementById('search');
  const tagFilters = document.getElementById('tag-filters');
  const viewerTitle = document.getElementById('viewer-title');
  const viewerSubtitle = document.getElementById('viewer-subtitle');
  const viewerTags = document.getElementById('viewer-tags');
  const viewerFrame = document.getElementById('viewer-frame');
  const btnBack = document.getElementById('btn-back');
  const btnShare = document.getElementById('btn-share');
  const btnOpenRaw = document.getElementById('btn-open-raw');
  const toastEl = document.getElementById('toast');

  let dashboards = [];
  let allTags = [];
  let activeTag = '';
  let searchQuery = '';
  let debounceTimer = null;
  let currentDashboardId = null;

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

    if (!copied) {
      copied = copyWithTextarea(url);
    }

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

  function setQueryParams({ id = null, q = searchQuery, tag = activeTag } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tag) params.set('tag', tag);
    if (id) params.set('id', id);

    const next = params.toString();
    const url = next ? `/?${next}` : '/';
    window.history.replaceState({}, '', url);
  }

  function filteredDashboards() {
    const q = searchQuery.trim().toLowerCase();
    const tag = activeTag.trim().toLowerCase();

    return dashboards.filter((d) => {
      const matchesQuery =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.subtitle.toLowerCase().includes(q);
      const matchesTag = !tag || d.tags.some((t) => t.toLowerCase() === tag);
      return matchesQuery && matchesTag;
    });
  }

  function renderTags() {
    if (!allTags.length) {
      tagFilters.innerHTML = '<span class="meta-row">Sin etiquetas todavía</span>';
      return;
    }

    const chips = [
      `<button type="button" class="tag${activeTag ? '' : ' is-active'}" data-tag="">Todas</button>`,
      ...allTags.map(
        (tag) =>
          `<button type="button" class="tag${activeTag === tag ? ' is-active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
      ),
    ];

    tagFilters.innerHTML = chips.join('');
  }

  function renderGallery() {
    const items = filteredDashboards();

    if (!items.length) {
      gallery.innerHTML = `
        <div class="empty-state panel panel-pad" style="grid-column: 1 / -1;">
          No hay dashboards que coincidan con la búsqueda.
        </div>
      `;
      return;
    }

    gallery.innerHTML = items
      .map((d) => {
        const url = shareUrl(d.id);
        return `
        <div class="card" data-id="${escapeHtml(d.id)}" role="button" tabindex="0">
          <h2>${escapeHtml(d.title)}</h2>
          <p>${escapeHtml(d.subtitle)}</p>
          <div class="card-footer">
            <span class="card-cta">Abrir dashboard →</span>
            <a
              class="card-share"
              href="${escapeHtml(url)}"
              data-action="share"
              aria-label="Compartir ${escapeHtml(d.title)}"
            >Compartir</a>
          </div>
        </div>
      `;
      })
      .join('');
  }

  function showGallery() {
    viewerView.hidden = true;
    galleryView.hidden = false;
    viewerFrame.removeAttribute('src');
    currentDashboardId = null;
    btnShare.href = '#';
    btnOpenRaw.href = '#';
    setQueryParams({ id: null });
  }

  function openDashboard(id) {
    const dashboard = dashboards.find((d) => d.id === id);
    if (!dashboard) {
      showToast('Dashboard no encontrado', 'error');
      showGallery();
      return;
    }

    currentDashboardId = dashboard.id;
    viewerTitle.textContent = dashboard.title;
    viewerSubtitle.textContent = dashboard.subtitle;
    viewerTags.innerHTML = dashboard.tags
      .map((tag) => `<span class="tag tag-static">${escapeHtml(tag)}</span>`)
      .join('');

    const url = shareUrl(dashboard.id);
    viewerFrame.src = `/view/${encodeURIComponent(dashboard.id)}`;
    btnOpenRaw.href = url;
    btnShare.href = url;

    galleryView.hidden = true;
    viewerView.hidden = false;
    setQueryParams({ id: dashboard.id });
  }

  async function fetchDashboards() {
    const res = await fetch('/api/dashboards');
    if (!res.ok) throw new Error('No se pudieron cargar los dashboards');
    const data = await res.json();
    dashboards = data.dashboards || [];
    allTags = data.tags || [];
    renderTags();
    renderGallery();
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = searchInput.value;
      setQueryParams();
      renderGallery();
    }, 180);
  });

  tagFilters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tag]');
    if (!button) return;
    activeTag = button.dataset.tag || '';
    setQueryParams();
    renderTags();
    renderGallery();
  });

  gallery.addEventListener('click', (event) => {
    const shareLink = event.target.closest('a[data-action="share"]');
    if (shareLink) {
      event.preventDefault();
      event.stopPropagation();
      copyShareLink(shareLink.href);
      return;
    }

    const card = event.target.closest('.card[data-id]');
    if (!card) return;
    openDashboard(card.dataset.id);
  });

  gallery.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.card[data-id]');
    if (!card || event.target.closest('[data-action="share"]')) return;
    event.preventDefault();
    openDashboard(card.dataset.id);
  });

  btnBack.addEventListener('click', showGallery);

  btnShare.addEventListener('click', (event) => {
    event.preventDefault();
    if (!currentDashboardId) {
      showToast('No hay dashboard abierto', 'error');
      return;
    }
    const url = btnShare.href && btnShare.href !== `${window.location.origin}/#`
      ? btnShare.href
      : shareUrl(currentDashboardId);
    copyShareLink(url);
  });

  async function init() {
    const params = getQueryParams();
    searchQuery = params.get('q') || '';
    activeTag = params.get('tag') || '';
    searchInput.value = searchQuery;

    await fetchDashboards();

    const id = params.get('id');
    if (id) openDashboard(id);
  }

  init().catch((err) => {
    showToast(err.message || 'Error al iniciar el visualizador', 'error');
  });
})();
