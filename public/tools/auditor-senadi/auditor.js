(() => {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const API = '/api/tools/senadi';
  const AUTHOR_KEY = 'senadi:autor';
  const IMPORT_DONE_KEY = 'senadi:import-done';
  // Un PDF con menos texto que esto probablemente es un escaneo o una imagen.
  const MIN_FORM_TEXT = 80;

  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function errorBox(message) {
    return `<div class="error-box">${escapeHtml(message)}</div>`;
  }

  function readLocal(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function writeLocal(key, value) {
    try { localStorage.setItem(key, value); } catch { /* sin almacenamiento local */ }
  }

  async function api(path, options = {}) {
    const res = await fetch(API + path, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  // ---------- Lectura de archivos ----------
  async function extraerTextoPDF(file) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let texto = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      texto += content.items.map((it) => it.str).join(' ') + '\n';
    }
    return texto.trim();
  }

  function fileToBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(new Error('No se pudo leer el archivo'));
      r.readAsDataURL(file);
    });
  }

  // ---------- Pestañas ----------
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $('panel-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'observaciones') renderObservaciones();
    });
  });

  // ---------- 01 Auditar ----------
  const files = { formulario: null, descuento: null, logo: null, nombramiento: null };

  function bindDropzone(key) {
    const dz = $('dz-' + key);
    const input = $('in-' + key);
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) {
        files[key] = input.files[0];
        $('fn-' + key).textContent = input.files[0].name;
        dz.classList.add('filled');
      }
      $('btn-auditar').disabled = !files.formulario;
    });
  }
  ['formulario', 'descuento', 'logo', 'nombramiento'].forEach(bindDropzone);

  $('btn-auditar').addEventListener('click', async () => {
    const btn = $('btn-auditar');
    const loading = $('loading-auditar');
    const loadingTxt = $('loading-auditar-txt');
    const errBox = $('error-auditar');
    const resultBox = $('resultado-auditoria');
    errBox.innerHTML = '';
    resultBox.innerHTML = '';
    btn.disabled = true;
    loading.style.display = 'flex';

    try {
      loadingTxt.textContent = 'Leyendo el formulario…';
      const textoFormulario = await extraerTextoPDF(files.formulario);
      if (textoFormulario.length < MIN_FORM_TEXT) {
        throw new Error(
          'El PDF del formulario casi no tiene texto legible (¿es un escaneo o una foto?). Sube el formulario original descargado del SENADI.'
        );
      }

      let textoDescuento = '';
      if (files.descuento) {
        loadingTxt.textContent = 'Leyendo el certificado de descuento…';
        textoDescuento = await extraerTextoPDF(files.descuento);
      }

      let textoNombramiento = '';
      if (files.nombramiento) {
        loadingTxt.textContent = 'Leyendo el nombramiento del representante legal…';
        textoNombramiento = await extraerTextoPDF(files.nombramiento);
      }

      let logo = null;
      if (files.logo) {
        loadingTxt.textContent = 'Procesando el logotipo…';
        logo = { mediaType: files.logo.type || 'image/png', data: await fileToBase64(files.logo) };
      }

      loadingTxt.textContent = 'Auditando el trámite con la base de observaciones del equipo…';
      const json = await api('/auditar', {
        method: 'POST',
        body: JSON.stringify({ textoFormulario, textoDescuento, textoNombramiento, logo }),
      });
      renderResultado(json);
    } catch (e) {
      errBox.innerHTML = errorBox(`No se pudo completar la auditoría: ${e.message}`);
    } finally {
      btn.disabled = !files.formulario;
      loading.style.display = 'none';
    }
  });

  function renderResultado(json) {
    let html = '';
    if (json.veredicto === 'NO_AUDITABLE') {
      html += `<div class="veredicto-na"><div class="vtitle">✗ No se puede auditar</div><div class="vsub">${escapeHtml(json.resumen || 'El archivo no parece un formulario de solicitud del SENADI.')} Revisa que hayas subido el formulario correcto.</div></div>`;
    } else if (json.veredicto === 'OK') {
      html += `<div class="veredicto-ok"><div class="vtitle">✓ OK para subir</div><div class="vsub">${escapeHtml(json.resumen || 'No se detectaron elementos que generen observación de forma.')}</div></div>`;
    } else {
      html += `<div class="veredicto-obs"><div class="vtitle">⚠ Hay que corregir antes de subir</div><div class="vsub">${escapeHtml(json.resumen || '')}</div></div>`;
    }
    (json.alertas || []).forEach((a) => {
      const duda = a.confianza !== undefined && a.confianza < 95;
      html += `<div class="alerta ${duda ? 'duda' : ''}">
        <div class="campo">${escapeHtml(a.campo || 'Campo')} ${duda ? '<span class="badge">Verificar manualmente</span>' : ''}</div>
        <div class="problema">${escapeHtml(a.problema || '')}</div>
        <div class="correccion"><b>Corrección sugerida:</b> ${escapeHtml(a.correccion || '')}</div>
      </div>`;
    });
    $('resultado-auditoria').innerHTML = html;
  }

  // ---------- 02 Base de observaciones (compartida) ----------
  const autorInput = $('obs-autor');
  autorInput.value = readLocal(AUTHOR_KEY) || '';
  autorInput.addEventListener('change', () => writeLocal(AUTHOR_KEY, autorInput.value.trim()));

  $('in-obs-pdf').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('fn-obs-pdf').textContent = f.name;
    $('dz-obs-pdf').classList.add('filled');
    try {
      $('obs-texto').value = await extraerTextoPDF(f);
    } catch (err) {
      $('error-obs').innerHTML = errorBox(`No se pudo leer el PDF: ${err.message}`);
    }
  });

  $('btn-registrar-obs').addEventListener('click', async () => {
    const texto = $('obs-texto').value.trim();
    const errBox = $('error-obs');
    const loading = $('loading-obs');
    const btn = $('btn-registrar-obs');
    errBox.innerHTML = '';
    if (!texto) {
      errBox.innerHTML = errorBox('Pega el texto de la observación o sube el PDF primero.');
      return;
    }
    const registradoPor = autorInput.value.trim();
    writeLocal(AUTHOR_KEY, registradoPor);
    btn.disabled = true;
    loading.style.display = 'flex';
    try {
      await api('/observaciones', { method: 'POST', body: JSON.stringify({ texto, registradoPor }) });
      $('obs-texto').value = '';
      $('fn-obs-pdf').textContent = 'opcional — o pega el texto abajo';
      $('dz-obs-pdf').classList.remove('filled');
      $('in-obs-pdf').value = '';
      await renderObservaciones();
    } catch (e) {
      errBox.innerHTML = errorBox(`No se pudo registrar la observación: ${e.message}`);
    } finally {
      btn.disabled = false;
      loading.style.display = 'none';
    }
  });

  function formatFecha(value) {
    if (!value) return '';
    const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function renderObservaciones() {
    const listBox = $('lista-observaciones');
    try {
      const { observaciones } = await api('/observaciones');
      $('obs-count').textContent = observaciones.length;
      if (!observaciones.length) {
        listBox.innerHTML = '<p class="empty">Aún no hay observaciones registradas.</p>';
        return;
      }
      listBox.innerHTML = observaciones
        .map((d) => {
          const meta = [d.campo || 'Campo', formatFecha(d.fecha), d.registradoPor].filter(Boolean).map(escapeHtml).join(' · ');
          return `<div class="obs-item">
            <div>
              <div class="meta">${meta}</div>
              <div class="txt"><b>${escapeHtml(d.patron)}</b><br>${escapeHtml(d.regla)}</div>
            </div>
            <button class="del" data-id="${d.id}" title="Eliminar">✕</button>
          </div>`;
        })
        .join('');
    } catch (e) {
      listBox.innerHTML = errorBox(`No se pudo cargar la base: ${e.message}`);
    }
  }

  $('lista-observaciones').addEventListener('click', async (event) => {
    const btn = event.target.closest('.del[data-id]');
    if (!btn) return;
    const ok = window.confirm('¿Eliminar esta observación de la base? Se borra para todo el equipo.');
    if (!ok) return;
    try {
      await api(`/observaciones/${btn.dataset.id}`, { method: 'DELETE' });
      await renderObservaciones();
    } catch (e) {
      $('error-obs').innerHTML = errorBox(`No se pudo eliminar: ${e.message}`);
    }
  });

  // Observaciones que alguien registró en la versión anterior y quedaron solo en su navegador.
  function observacionesLocales() {
    const items = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('obs:') || key.startsWith('obs:seed-')) continue;
        try {
          items.push(JSON.parse(localStorage.getItem(key)));
        } catch { /* entrada dañada */ }
      }
    } catch { /* sin almacenamiento local */ }
    return items;
  }

  function renderImportBox() {
    const slot = $('import-slot');
    const locales = readLocal(IMPORT_DONE_KEY) ? [] : observacionesLocales();
    if (!locales.length) {
      slot.innerHTML = '';
      return;
    }
    slot.innerHTML = `
      <div class="import-box">
        <span>Este navegador tiene <b>${locales.length}</b> observación(es) registradas con la versión anterior, que solo existen aquí. Súbelas para que todo el equipo las use.</span>
        <button class="secondary" id="btn-importar">Subir a la base compartida</button>
      </div>`;
    $('btn-importar').addEventListener('click', async () => {
      try {
        const r = await api('/observaciones/importar', {
          method: 'POST',
          body: JSON.stringify({ observaciones: locales, registradoPor: autorInput.value.trim() }),
        });
        writeLocal(IMPORT_DONE_KEY, new Date().toISOString());
        slot.innerHTML = `<div class="ok-box">Listo: se subieron ${r.added} observación(es)${r.skipped ? ` y se omitieron ${r.skipped} que ya estaban en la base` : ''}.</div>`;
        await renderObservaciones();
      } catch (e) {
        slot.insertAdjacentHTML('beforeend', errorBox(`No se pudieron subir: ${e.message}`));
      }
    });
  }

  // ---------- 03 Generar alcance ----------
  $('btn-generar-alcance').addEventListener('click', async () => {
    const tramite = $('alcance-tramite').value.trim();
    const denominacion = $('alcance-denom').value.trim();
    const observacion = $('alcance-obs').value.trim();
    const errBox = $('error-alcance');
    const loading = $('loading-alcance');
    const output = $('alcanceOutput');
    const toolbar = $('alcance-toolbar');
    errBox.innerHTML = '';
    output.style.display = 'none';
    toolbar.style.display = 'none';

    if (!observacion) {
      errBox.innerHTML = errorBox('Pega el texto de la observación recibida.');
      return;
    }
    loading.style.display = 'flex';
    try {
      const { borrador } = await api('/alcance', {
        method: 'POST',
        body: JSON.stringify({ tramite, denominacion, observacion }),
      });
      output.textContent = borrador;
      output.style.display = 'block';
      toolbar.style.display = 'flex';
    } catch (e) {
      errBox.innerHTML = errorBox(`No se pudo generar el borrador: ${e.message}`);
    } finally {
      loading.style.display = 'none';
    }
  });

  $('btn-copiar-alcance').addEventListener('click', async () => {
    const b = $('btn-copiar-alcance');
    try {
      await navigator.clipboard.writeText($('alcanceOutput').textContent);
      b.textContent = '¡Copiado!';
    } catch {
      b.textContent = 'No se pudo copiar';
    }
    setTimeout(() => { b.textContent = 'Copiar texto'; }, 1500);
  });

  $('btn-descargar-alcance').addEventListener('click', () => {
    const txt = $('alcanceOutput').textContent;
    const denom = $('alcance-denom').value.trim() || 'alcance';
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Solicitud_Alcance_${denom.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ---------- Carga inicial ----------
  renderImportBox();
  renderObservaciones();
})();
