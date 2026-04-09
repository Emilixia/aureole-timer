// Frieren Chronomark — In-App Document Reader
// Supports PDF (via PDF.js) and DOCX (via mammoth.js)

var Reader = (function () {

  var _library    = [];   // [{ id, name, type, dataUrl, pages? }]
  var _activeId   = null;
  var _pdfDoc     = null;
  var _pdfPage    = 1;
  var _pdfScale   = 1.0;
  var _rendering  = false;

  // ── Helpers ────────────────────────────────────────────────

  function el(id) { return document.getElementById(id); }

  function safeName(name) {
    var d = document.createElement('div');
    d.textContent = name;
    return d.innerHTML;
  }

  // ── Storage ────────────────────────────────────────────────

  async function loadLibrary() {
    _library = await Storage.get('readerLibrary', []);
  }

  async function saveLibrary() {
    await Storage.set('readerLibrary', _library);
  }

  // ── Reader stats (for achievements) ────────────────────────

  async function addPagesRead(n) {
    if (!n || n <= 0) return;
    var stats = await Storage.get('readerStats', { docs: 0, pages: 0 });
    stats.pages = (stats.pages || 0) + n;
    await Storage.set('readerStats', stats);
    checkReaderMedals(stats);
  }

  async function incrementDocsOpened() {
    var stats = await Storage.get('readerStats', { docs: 0, pages: 0 });
    stats.docs = (stats.docs || 0) + 1;
    await Storage.set('readerStats', stats);
    checkReaderMedals(stats);
  }

  function checkReaderMedals(stats) {
    if (!window.Achievements) return;
    window.Achievements.checkAchievements({
      readerDocs:  stats.docs  || 0,
      readerPages: stats.pages || 0
    });
  }

  // ── Library sidebar ────────────────────────────────────────

  function renderDocList() {
    var list = el('readerDocList');
    var drop = el('readerDropZone');
    if (!list) return;

    list.innerHTML = '';
    if (_library.length === 0) {
      if (drop) drop.style.display = 'flex';
      return;
    }
    if (drop) drop.style.display = 'none';

    _library.forEach(function (doc) {
      var li = document.createElement('li');
      li.className = 'reader-doc-item' + (doc.id === _activeId ? ' active' : '');
      li.dataset.id = doc.id;

      var icon = doc.type === 'pdf' ? '📄' : '📝';
      var nameEl = document.createElement('span');
      nameEl.className = 'reader-doc-name';
      nameEl.textContent = icon + ' ' + doc.name;

      var del = document.createElement('button');
      del.className = 'reader-doc-del';
      del.textContent = '✕';
      del.title = 'Remove from library';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        removeDoc(doc.id);
      });

      li.appendChild(nameEl);
      li.appendChild(del);
      li.addEventListener('click', function () { openDoc(doc.id); });
      list.appendChild(li);
    });
  }

  // ── Add documents ──────────────────────────────────────────

  function addFiles(files) {
    var promises = Array.from(files).map(function (file) {
      return new Promise(function (resolve) {
        var type = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
        var reader = new FileReader();
        reader.onload = function (e) {
          var doc = {
            id: Date.now() + '_' + Math.random().toString(36).slice(2),
            name: file.name,
            type: type,
            dataUrl: e.target.result
          };
          _library.push(doc);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });
    Promise.all(promises).then(function () {
      saveLibrary();
      renderDocList();
    });
  }

  function removeDoc(id) {
    _library = _library.filter(function (d) { return d.id !== id; });
    saveLibrary();
    if (_activeId === id) {
      _activeId = null;
      _pdfDoc   = null;
      showEmpty();
    }
    renderDocList();
  }

  // ── Open a document ────────────────────────────────────────

  async function openDoc(id) {
    var doc = _library.find(function (d) { return d.id === id; });
    if (!doc) return;

    _activeId = id;
    renderDocList();
    await incrementDocsOpened();

    if (doc.type === 'pdf') {
      openPdf(doc);
    } else {
      openDocx(doc);
    }
  }

  // ── PDF rendering ──────────────────────────────────────────

  async function openPdf(doc) {
    showPdfContainer();
    _pdfPage  = 1;
    _pdfScale = 1.0;
    updateZoomLabel();

    // Convert data-url to Uint8Array for PDF.js
    var base64 = doc.dataUrl.split(',')[1];
    var binary = atob(base64);
    var bytes  = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }

    var pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    if (!pdfjsLib) {
      showError('PDF.js failed to load. Please check your network connection.');
      return;
    }
    // Use local vendor worker (avoids CDN and CSP issues)
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

    try {
      _pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
      el('readerPageTotal').textContent = _pdfDoc.numPages;
      await renderPdfPage(_pdfPage);
    } catch (err) {
      showError('Could not open PDF: ' + err.message);
    }
  }

  async function renderPdfPage(pageNum) {
    if (!_pdfDoc || _rendering) return;
    _rendering = true;

    var prevPageNum = _pdfPage;
    _pdfPage = Math.max(1, Math.min(pageNum, _pdfDoc.numPages));
    el('readerPageNum').textContent = _pdfPage;

    var page    = await _pdfDoc.getPage(_pdfPage);
    var viewport = page.getViewport({ scale: _pdfScale });
    var canvas  = el('readerPdfCanvas');
    var ctx     = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width  = viewport.width;

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    _rendering = false;

    // Track pages turned (each new page = 1 page read)
    if (_pdfPage !== prevPageNum) {
      addPagesRead(1);
    }
  }

  // ── DOCX rendering ─────────────────────────────────────────

  async function openDocx(doc) {
    showDocxContainer();

    var base64   = doc.dataUrl.split(',')[1];
    var binary   = atob(base64);
    var bytes    = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }

    if (!window.mammoth) {
      showError('mammoth.js failed to load. Please check your network connection.');
      return;
    }

    try {
      var result = await window.mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
      var content = el('readerDocxContent');
      if (content) {
        content.innerHTML = result.value;
        // Estimate pages: ~3000 chars per page (rough estimate)
        var approxPages = Math.max(1, Math.round(result.value.length / 3000));
        addPagesRead(approxPages);
      }
    } catch (err) {
      showError('Could not open document: ' + err.message);
    }
  }

  // ── UI helpers ─────────────────────────────────────────────

  function showEmpty() {
    var e = el('readerEmpty'); var p = el('readerPdfContainer'); var d = el('readerDocxContainer');
    if (e) e.style.display = 'flex';
    if (p) p.style.display = 'none';
    if (d) d.style.display = 'none';
  }

  function showPdfContainer() {
    var e = el('readerEmpty'); var p = el('readerPdfContainer'); var d = el('readerDocxContainer');
    if (e) e.style.display = 'none';
    if (p) p.style.display = 'flex';
    if (d) d.style.display = 'none';
  }

  function showDocxContainer() {
    var e = el('readerEmpty'); var p = el('readerPdfContainer'); var d = el('readerDocxContainer');
    if (e) e.style.display = 'none';
    if (p) p.style.display = 'none';
    if (d) d.style.display = 'flex';
  }

  function showError(msg) {
    showEmpty();
    var e = el('readerEmpty');
    if (e) e.innerHTML = '<div class="reader-empty-icon">⚠️</div><p>' + safeName(msg) + '</p>';
  }

  function updateZoomLabel() {
    var lbl = el('readerZoomLabel');
    if (lbl) lbl.textContent = Math.round(_pdfScale * 100) + '%';
  }

  // ── Init ───────────────────────────────────────────────────

  async function init() {
    await loadLibrary();
    renderDocList();

    // File input
    var fileInput = el('readerFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files.length) addFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    // Drag and drop on the whole reader panel
    var panel = el('tab-reader');
    var dropZone = el('readerDropZone');
    if (panel) {
      panel.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        panel.classList.add('drag-over');
        if (dropZone) dropZone.classList.add('drag-over');
      });
      panel.addEventListener('dragleave', function (e) {
        if (!panel.contains(e.relatedTarget)) {
          panel.classList.remove('drag-over');
          if (dropZone) dropZone.classList.remove('drag-over');
        }
      });
      panel.addEventListener('drop', function (e) {
        e.preventDefault();
        panel.classList.remove('drag-over');
        if (dropZone) dropZone.classList.remove('drag-over');
        var files = Array.from(e.dataTransfer.files).filter(function (f) {
          return f.name.match(/\.(pdf|docx|doc)$/i);
        });
        if (files.length) addFiles(files);
      });
    }

    // PDF controls
    var prev = el('readerPrevPage');
    var next = el('readerNextPage');
    var zoomIn  = el('readerZoomIn');
    var zoomOut = el('readerZoomOut');
    var closePdf  = el('readerCloseDoc');
    var closeDocx = el('readerDocxClose');

    if (prev) prev.addEventListener('click', function () { renderPdfPage(_pdfPage - 1); });
    if (next) next.addEventListener('click', function () { renderPdfPage(_pdfPage + 1); });
    if (zoomIn) zoomIn.addEventListener('click', function () {
      _pdfScale = Math.min(3.0, _pdfScale + 0.25);
      updateZoomLabel();
      renderPdfPage(_pdfPage);
    });
    if (zoomOut) zoomOut.addEventListener('click', function () {
      _pdfScale = Math.max(0.5, _pdfScale - 0.25);
      updateZoomLabel();
      renderPdfPage(_pdfPage);
    });
    if (closePdf)  closePdf.addEventListener('click',  function () { _activeId = null; _pdfDoc = null; showEmpty(); renderDocList(); });
    if (closeDocx) closeDocx.addEventListener('click', function () { _activeId = null; showEmpty(); renderDocList(); });

    // Keyboard navigation while reader tab is visible
    document.addEventListener('keydown', function (e) {
      var pdfVisible = el('readerPdfContainer') && el('readerPdfContainer').style.display !== 'none';
      if (!pdfVisible) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') renderPdfPage(_pdfPage + 1);
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   renderPdfPage(_pdfPage - 1);
    });
  }

  return { init: init };
})();

window.Reader = Reader;
