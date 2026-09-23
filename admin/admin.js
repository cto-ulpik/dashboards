(() => {
  const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nuevo dashboard</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #2dd4bf;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Georgia, "Times New Roman", serif;
      background: radial-gradient(circle at top, #1e293b, var(--bg));
      color: var(--text);
      padding: 2rem;
    }
    h1 { margin: 0 0 0.4rem; }
    p { margin: 0 0 1.25rem; color: var(--muted); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
    }
    .metric {
      background: var(--card);
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1rem;
    }
    .metric span { display: block; color: var(--muted); font-size: 0.85rem; margin-bottom: 0.3rem; }
    .metric strong { font-size: 1.5rem; color: var(--accent); }
  </style>
</head>
<body>
  <h1>Nuevo dashboard</h1>
  <p>Edita este HTML para construir tu visualización.</p>
  <div class="grid">
    <div class="metric"><span>Métrica A</span><strong>—</strong></div>
    <div class="metric"><span>Métrica B</span><strong>—</strong></div>
    <div class="metric"><span>Métrica C</span><strong>—</strong></div>
  </div>
</body>
</html>`;

  const form = document.getElementById('dashboard-form');
  const formTitle = document.getElementById('form-title');
  const idInput = document.getElementById('dashboard-id');
  const titleInput = document.getElementById('title');
  const subtitleInput = document.getElementById('subtitle');
  const tagsInput = document.getElementById('tags');
  const fileInput = document.getElementById('file');
  const fileDrop = document.getElementById('file-drop');
  const fileNameEl = document.getElementById('file-name');
  const fileHint = document.getElementById('file-hint');
  const btnPreview = document.getElementById('btn-preview');
  const btnSave = document.getElementById('btn-save');
  const btnReset = document.getElementById('btn-reset');
  const previewEmpty = document.getElementById('preview-empty');
  const previewFrame = document.getElementById('preview-frame');
  const listEl = document.getElementById('dashboard-list');
  const countLabel = document.getElementById('count-label');
  const toastEl = document.getElementById('toast');
  const deleteModal = document.getElementById('delete-modal');
  const deleteMessage = document.getElementById('delete-message');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');

  let previewUrl = null;
  let pendingDeleteId = null;
  let dashboards = [];
  let previewTimer = null;

  const editor = CodeMirror.fromTextArea(document.getElementById('html-editor'), {
    mode: 'htmlmixed',
    theme: 'neo',
    lineNumbers: true,
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2,
    autoCloseTags: true,
    matchBrackets: true,
    extraKeys: {
      'Ctrl-S': (cm) => {
        cm.save();
        form.requestSubmit();
      },
      'Cmd-S': (cm) => {
        cm.save();
        form.requestSubmit();
      },
    },
  });

  editor.setValue(DEFAULT_HTML);

  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast is-visible is-${type}`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 2800);
  }

  function revokePreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  function clearPreview() {
    revokePreview();
    previewFrame.hidden = true;
    previewFrame.removeAttribute('src');
    previewEmpty.hidden = false;
  }

  function showPreviewFromHtml(html) {
    const content = String(html || '').trim();
    if (!content) {
      clearPreview();
      showToast('El editor está vacío', 'error');
      return;
    }

    revokePreview();
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    previewUrl = URL.createObjectURL(blob);
    previewFrame.src = previewUrl;
    previewFrame.hidden = false;
    previewEmpty.hidden = true;
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const html = editor.getValue().trim();
      if (!html) {
        clearPreview();
        return;
      }
      showPreviewFromHtml(html);
    }, 450);
  }

  function updateFileLabel() {
    const file = fileInput.files?.[0];
    if (file) {
      fileNameEl.hidden = false;
      fileNameEl.textContent = file.name;
    } else {
      fileNameEl.hidden = true;
      fileNameEl.textContent = '';
    }
  }

  async function loadFileIntoEditor(file) {
    if (!file) return;
    const text = await file.text();
    editor.setValue(text);
    showPreviewFromHtml(text);
  }

  function resetForm() {
    form.reset();
    idInput.value = '';
    formTitle.textContent = 'Nuevo dashboard';
    btnSave.textContent = 'Guardar';
    btnReset.hidden = true;
    fileHint.textContent = 'Opcional. También puedes escribir o pegar el HTML directamente.';
    editor.setValue(DEFAULT_HTML);
    updateFileLabel();
    showPreviewFromHtml(DEFAULT_HTML);
    document.querySelectorAll('.list-item.is-editing').forEach((el) => {
      el.classList.remove('is-editing');
    });
  }

  async function fillForm(dashboard) {
    idInput.value = dashboard.id;
    titleInput.value = dashboard.title;
    subtitleInput.value = dashboard.subtitle;
    tagsInput.value = dashboard.tags.join(', ');
    fileInput.value = '';
    formTitle.textContent = 'Editar dashboard';
    btnSave.textContent = 'Actualizar';
    btnReset.hidden = false;
    fileHint.textContent = 'Importar un archivo reemplaza el contenido del editor.';
    updateFileLabel();

    document.querySelectorAll('.list-item.is-editing').forEach((el) => {
      el.classList.remove('is-editing');
    });
    const item = listEl.querySelector(`[data-id="${dashboard.id}"]`);
    if (item) item.classList.add('is-editing');

    try {
      const res = await fetch(`/api/dashboards/${dashboard.id}/content`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el HTML');
      editor.setValue(data.html || '');
      showPreviewFromHtml(data.html || '');
    } catch (err) {
      showToast(err.message, 'error');
      clearPreview();
    }

    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat('es', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso.includes('T') ? iso : `${iso}Z`));
    } catch {
      return iso;
    }
  }

  function renderList() {
    countLabel.textContent = `${dashboards.length} dashboard${dashboards.length === 1 ? '' : 's'}`;

    if (!dashboards.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          Aún no hay dashboards. Crea el primero con el editor de arriba.
        </div>
      `;
      return;
    }

    listEl.innerHTML = dashboards
      .map((d) => {
        const tags = d.tags
          .map((tag) => `<span class="tag tag-static">${escapeHtml(tag)}</span>`)
          .join('');

        return `
          <article class="list-item" data-id="${escapeHtml(d.id)}">
            <div>
              <h3>${escapeHtml(d.title)}</h3>
              <p>${escapeHtml(d.subtitle)}</p>
              <div class="tags">${tags || '<span class="meta-row">Sin etiquetas</span>'}</div>
              <div class="meta-row">
                <span>Actualizado: ${escapeHtml(formatDate(d.updatedAt))}</span>
              </div>
            </div>
            <div class="actions">
              <a class="btn btn-secondary btn-sm" href="/?id=${encodeURIComponent(d.id)}" target="_blank" rel="noopener">Ver</a>
              <button type="button" class="btn btn-secondary btn-sm" data-action="edit">Editar HTML</button>
              <button type="button" class="btn btn-danger btn-sm" data-action="delete">Eliminar</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  async function loadDashboards() {
    const res = await fetch('/api/dashboards');
    if (!res.ok) throw new Error('No se pudo cargar el listado');
    const data = await res.json();
    dashboards = data.dashboards || [];
    renderList();
  }

  async function saveDashboard(event) {
    event.preventDefault();

    const title = titleInput.value.trim();
    const subtitle = subtitleInput.value.trim();
    const tags = tagsInput.value.trim();
    const id = idInput.value.trim();
    const html = editor.getValue();

    if (!title || !subtitle || !tags) {
      showToast('Completa título, subtítulo y etiquetas', 'error');
      return;
    }

    if (!html.trim()) {
      showToast('El HTML no puede estar vacío', 'error');
      return;
    }

    const body = new FormData();
    body.append('title', title);
    body.append('subtitle', subtitle);
    body.append('tags', tags);
    body.append('html', html);

    btnSave.disabled = true;
    try {
      const res = await fetch(id ? `/api/dashboards/${id}` : '/api/dashboards', {
        method: id ? 'PUT' : 'POST',
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');

      showToast(id ? 'Dashboard actualizado' : 'Dashboard creado');
      resetForm();
      await loadDashboards();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSave.disabled = false;
    }
  }

  function openDeleteModal(id) {
    const dashboard = dashboards.find((d) => d.id === id);
    pendingDeleteId = id;
    deleteMessage.textContent = dashboard
      ? `¿Eliminar «${dashboard.title}»? Esta acción no se puede deshacer.`
      : '¿Eliminar este dashboard? Esta acción no se puede deshacer.';
    deleteModal.classList.add('is-open');
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    deleteModal.classList.remove('is-open');
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    btnConfirmDelete.disabled = true;
    try {
      const res = await fetch(`/api/dashboards/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar');

      if (idInput.value === id) resetForm();
      closeDeleteModal();
      showToast('Dashboard eliminado');
      await loadDashboards();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnConfirmDelete.disabled = false;
    }
  }

  fileInput.addEventListener('change', async () => {
    updateFileLabel();
    const file = fileInput.files?.[0];
    if (file) {
      try {
        await loadFileIntoEditor(file);
      } catch {
        showToast('No se pudo leer el archivo', 'error');
      }
    }
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    fileDrop.addEventListener(eventName, (event) => {
      event.preventDefault();
      fileDrop.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    fileDrop.addEventListener(eventName, (event) => {
      event.preventDefault();
      fileDrop.classList.remove('is-dragover');
    });
  });

  fileDrop.addEventListener('drop', async (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    updateFileLabel();
    try {
      await loadFileIntoEditor(file);
    } catch {
      showToast('No se pudo leer el archivo', 'error');
    }
  });

  btnPreview.addEventListener('click', () => {
    showPreviewFromHtml(editor.getValue());
  });

  editor.on('change', schedulePreview);

  btnReset.addEventListener('click', resetForm);
  form.addEventListener('submit', saveDashboard);

  listEl.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const item = button.closest('.list-item');
    const id = item?.dataset.id;
    if (!id) return;

    if (button.dataset.action === 'edit') {
      const dashboard = dashboards.find((d) => d.id === id);
      if (dashboard) fillForm(dashboard);
      return;
    }

    if (button.dataset.action === 'delete') {
      openDeleteModal(id);
    }
  });

  btnCancelDelete.addEventListener('click', closeDeleteModal);
  btnConfirmDelete.addEventListener('click', confirmDelete);
  deleteModal.addEventListener('click', (event) => {
    if (event.target === deleteModal) closeDeleteModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && deleteModal.classList.contains('is-open')) {
      closeDeleteModal();
    }
  });

  showPreviewFromHtml(DEFAULT_HTML);

  loadDashboards().catch((err) => {
    showToast(err.message || 'Error al cargar dashboards', 'error');
  });
})();
