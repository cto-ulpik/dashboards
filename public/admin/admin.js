(() => {
  const editorPanel = document.getElementById('editor-panel');
  const form = document.getElementById('dashboard-form');
  const formTitle = document.getElementById('form-title');
  const idInput = document.getElementById('dashboard-id');
  const titleInput = document.getElementById('title');
  const subtitleInput = document.getElementById('subtitle');
  const tagsInput = document.getElementById('tags');
  const categoryInput = document.getElementById('category');
  const needsAiInput = document.getElementById('needs-ai');
  const fileInput = document.getElementById('file');
  const fileDrop = document.getElementById('file-drop');
  const fileNameEl = document.getElementById('file-name');
  const fileHint = document.getElementById('file-hint');
  const btnNew = document.getElementById('btn-new');
  const btnPreview = document.getElementById('btn-preview');
  const btnSave = document.getElementById('btn-save');
  const btnCancel = document.getElementById('btn-cancel');
  const btnCancelBottom = document.getElementById('btn-cancel-bottom');
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
  let mode = 'closed'; // closed | new | edit

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
      showPreviewFromHtml(editor.getValue());
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

  function clearFormFields() {
    form.reset();
    idInput.value = '';
    titleInput.value = '';
    subtitleInput.value = '';
    tagsInput.value = '';
    categoryInput.value = '';
    needsAiInput.checked = false;
    fileInput.value = '';
    editor.setValue('');
    updateFileLabel();
    clearPreview();
    document.querySelectorAll('.list-item.is-editing').forEach((el) => {
      el.classList.remove('is-editing');
    });
  }

  function closeEditor() {
    mode = 'closed';
    clearFormFields();
    editorPanel.hidden = true;
  }

  function openNew() {
    mode = 'new';
    clearFormFields();
    formTitle.textContent = 'Nuevo dashboard';
    btnSave.textContent = 'Guardar';
    fileHint.textContent = 'También puedes escribir o pegar el HTML en el editor.';
    editorPanel.hidden = false;
    editor.refresh();
    editorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    titleInput.focus();
  }

  async function openEdit(dashboard) {
    mode = 'edit';
    clearFormFields();

    idInput.value = dashboard.id;
    titleInput.value = dashboard.title;
    subtitleInput.value = dashboard.subtitle;
    tagsInput.value = dashboard.tags.join(', ');
    categoryInput.value = dashboard.category || '';
    needsAiInput.checked = Boolean(dashboard.needsAi);
    formTitle.textContent = 'Editar dashboard';
    btnSave.textContent = 'Actualizar';
    fileHint.textContent = 'Importar un archivo reemplaza el contenido del editor.';

    document.querySelectorAll('.list-item.is-editing').forEach((el) => {
      el.classList.remove('is-editing');
    });
    const item = listEl.querySelector(`[data-id="${dashboard.id}"]`);
    if (item) item.classList.add('is-editing');

    editorPanel.hidden = false;
    editor.refresh();

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

    editorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          Aún no hay dashboards. Pulsa <strong>Nuevo</strong> para crear el primero.
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
              <div class="tags">
                <span class="tag tag-static">${escapeHtml(d.categoryLabel || d.category || 'Sin clase')}</span>
                ${d.needsAi ? '<span class="tag tag-ai">Necesita IA</span>' : ''}
                ${tags || ''}
              </div>
              <div class="field" style="margin-top: 0.75rem; max-width: 240px;">
                <label for="category-${escapeHtml(d.id)}">Clasificación</label>
                <select id="category-${escapeHtml(d.id)}" data-action="category" data-id="${escapeHtml(d.id)}">
                  <option value="comite-ulpik"${d.category === 'comite-ulpik' ? ' selected' : ''}>Comité Ulpik</option>
                  <option value="comite-mqi"${d.category === 'comite-mqi' ? ' selected' : ''}>Comité MQI</option>
                  <option value="herramientas"${d.category === 'herramientas' ? ' selected' : ''}>Herramientas</option>
                </select>
              </div>
              <div class="meta-row">
                <span>Actualizado: ${escapeHtml(formatDate(d.updatedAt))}</span>
              </div>
            </div>
            <div class="actions">
              <a class="btn btn-secondary btn-sm" href="${escapeHtml(`/view/${d.id}`)}" target="_blank" rel="noopener">Ver</a>
              <button type="button" class="btn btn-secondary btn-sm" data-action="edit">Editar</button>
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
    const category = categoryInput.value.trim();
    const needsAi = needsAiInput.checked;
    const id = idInput.value.trim();
    const html = editor.getValue();
    const file = fileInput.files?.[0];

    if (!title || !subtitle || !tags) {
      showToast('Completa título, subtítulo y etiquetas', 'error');
      return;
    }

    if (!category) {
      showToast('Elige una clasificación', 'error');
      return;
    }

    if (!html.trim()) {
      showToast('El HTML no puede estar vacío', 'error');
      return;
    }

    btnSave.disabled = true;
    try {
      let res;

      if (file) {
        const body = new FormData();
        body.append('title', title);
        body.append('subtitle', subtitle);
        body.append('tags', tags);
        body.append('category', category);
        body.append('needs_ai', needsAi ? '1' : '0');
        body.append('html', html);
        body.append('file', file);
        res = await fetch(id ? `/api/dashboards/${id}` : '/api/dashboards', {
          method: id ? 'PUT' : 'POST',
          body,
        });
      } else {
        res = await fetch(id ? `/api/dashboards/${id}` : '/api/dashboards', {
          method: id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, subtitle, tags, category, needsAi, html }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');

      showToast(id ? 'Dashboard actualizado' : 'Dashboard creado');
      closeEditor();
      await loadDashboards();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSave.disabled = false;
    }
  }

  async function changeCategory(id, category) {
    try {
      const res = await fetch(`/api/dashboards/${id}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar la clasificación');
      showToast(`Clasificación: ${data.categoryLabel || category}`);
      await loadDashboards();
    } catch (err) {
      showToast(err.message, 'error');
      await loadDashboards();
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

      if (idInput.value === id) closeEditor();
      closeDeleteModal();
      showToast('Dashboard eliminado');
      await loadDashboards();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnConfirmDelete.disabled = false;
    }
  }

  btnNew.addEventListener('click', openNew);
  btnCancel.addEventListener('click', closeEditor);
  btnCancelBottom.addEventListener('click', closeEditor);

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
    const html = editor.getValue().trim();
    if (!html) {
      showToast('El editor está vacío', 'error');
      clearPreview();
      return;
    }
    showPreviewFromHtml(html);
  });

  editor.on('change', schedulePreview);
  form.addEventListener('submit', saveDashboard);

  listEl.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const item = button.closest('.list-item');
    const id = item?.dataset.id;
    if (!id) return;

    if (button.dataset.action === 'edit') {
      const dashboard = dashboards.find((d) => d.id === id);
      if (dashboard) openEdit(dashboard);
      return;
    }

    if (button.dataset.action === 'delete') {
      openDeleteModal(id);
    }
  });

  listEl.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-action="category"]');
    if (!select) return;
    const id = select.dataset.id;
    const category = select.value;
    if (!id || !category) return;
    changeCategory(id, category);
  });

  btnCancelDelete.addEventListener('click', closeDeleteModal);
  btnConfirmDelete.addEventListener('click', confirmDelete);
  deleteModal.addEventListener('click', (event) => {
    if (event.target === deleteModal) closeDeleteModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && deleteModal.classList.contains('is-open')) {
      closeDeleteModal();
      return;
    }
    if (event.key === 'Escape' && mode !== 'closed') {
      closeEditor();
    }
  });

  loadDashboards().catch((err) => {
    showToast(err.message || 'Error al cargar dashboards', 'error');
  });
})();
