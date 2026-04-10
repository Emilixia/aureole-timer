// Frieren Chronomark — In-App Document Reader
// Features: PDF + DOCX, drag-drop, manual page, scroll-zoom,
//           draw/text/highlight annotation tools, persistent annotations,
//           last-page restore.

var Reader = (function () {

  // ── State ──────────────────────────────────────────────────────────────────
  var _library    = [];
  var _activeId   = null;
  var _pdfDoc     = null;
  var _pdfPage    = 1;
  var _pdfScale   = 1.0;
  var _rendering  = false;

  // Annotation tool state
  var _tool       = 'none';   // 'draw' | 'text' | 'highlight' | 'erase' | 'none'
  var _drawing    = false;
  var _drawPath   = [];
  var _annots     = {};        // { docId_page: { strokes:[], texts:[] } }
  var _annotsDirty = false;

  // Customization state
  var _drawColor        = '#ff3366';
  var _highlightColor   = '#ffe94d';
  var _highlightOpacity = 0.38;  // 0–1
  var _penStyle         = 'pen'; // 'pen' | 'marker' | 'brush'

  // Pending text placement (used by custom text popup)
  var _textPendingPos = null;
  var _textPendingCtx = null;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  function safeName(name) {
    var d = document.createElement('div');
    d.textContent = name;
    return d.innerHTML;
  }

  function annotKey(docId, page) { return docId + '_' + page; }

  // ── Storage ────────────────────────────────────────────────────────────────
  async function loadLibrary() {
    _library = await Storage.get('readerLibrary', []);
  }

  async function saveLibrary() {
    await Storage.set('readerLibrary', _library);
  }

  async function loadAnnotations() {
    _annots = await Storage.get('readerAnnotations', {});
  }

  async function saveAnnotations() {
    if (_annotsDirty) {
      await Storage.set('readerAnnotations', _annots);
      _annotsDirty = false;
    }
  }

  async function saveLastPage(docId, page) {
    var meta = await Storage.get('readerDocMeta', {});
    if (!meta[docId]) meta[docId] = {};
    meta[docId].lastPage = page;
    await Storage.set('readerDocMeta', meta);
  }

  async function getLastPage(docId) {
    var meta = await Storage.get('readerDocMeta', {});
    return (meta[docId] && meta[docId].lastPage) || 1;
  }

  // ── Reader stats (for achievements) ───────────────────────────────────────
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

  // ── Library sidebar ────────────────────────────────────────────────────────
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

  // ── Add / Remove documents ─────────────────────────────────────────────────
  function addFiles(files) {
    var promises = Array.from(files).map(function (file) {
      return new Promise(function (resolve) {
        var type = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
        var fr = new FileReader();
        fr.onload = function (e) {
          _library.push({
            id:      Date.now() + '_' + Math.random().toString(36).slice(2),
            name:    file.name,
            type:    type,
            dataUrl: e.target.result
          });
          resolve();
        };
        fr.readAsDataURL(file);
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

  // ── Open a document ────────────────────────────────────────────────────────
  async function openDoc(id) {
    var doc = _library.find(function (d) { return d.id === id; });
    if (!doc) return;

    // Save current annotations before switching
    await saveAnnotations();

    _activeId = id;
    renderDocList();
    await incrementDocsOpened();

    if (doc.type === 'pdf') {
      openPdf(doc);
    } else {
      openDocx(doc);
    }
  }

  // ── PDF rendering ──────────────────────────────────────────────────────────
  async function openPdf(doc) {
    showPdfContainer();
    _pdfScale = 1.0;
    updateZoomLabel();

    var base64 = doc.dataUrl.split(',')[1];
    var binary = atob(base64);
    var bytes  = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    var pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      showError('PDF.js failed to load. Please restart the app.');
      return;
    }

    try {
      _pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
      var totalPages = _pdfDoc.numPages;
      el('readerPageTotal').textContent = totalPages;

      var pageInput = el('readerPageInput');
      if (pageInput) { pageInput.max = totalPages; }

      _pdfPage = await getLastPage(doc.id);
      _pdfPage = Math.max(1, Math.min(_pdfPage, totalPages));

      await renderPdfPage(_pdfPage, true);
    } catch (err) {
      showError('Could not open PDF: ' + err.message);
    }
  }

  async function renderPdfPage(pageNum, isNewDoc) {
    if (!_pdfDoc || _rendering) return;
    _rendering = true;

    var prevPage = _pdfPage;
    _pdfPage = Math.max(1, Math.min(pageNum, _pdfDoc.numPages));

    var pageInput = el('readerPageInput');
    if (pageInput) pageInput.value = _pdfPage;

    // Save annotations for the page we're leaving
    if (!isNewDoc && prevPage !== _pdfPage) {
      await flushAnnotCanvas(prevPage);
      await saveAnnotations();
    }

    var page     = await _pdfDoc.getPage(_pdfPage);
    var viewport = page.getViewport({ scale: _pdfScale });
    var canvas   = el('readerPdfCanvas');
    var ctx      = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width  = viewport.width;

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    // Resize & restore annotation canvas
    var annotCanvas = el('readerAnnotCanvas');
    if (annotCanvas) {
      annotCanvas.width  = canvas.width;
      annotCanvas.height = canvas.height;
      restoreAnnotations(annotCanvas, _activeId, _pdfPage);
    }

    _rendering = false;

    if (!isNewDoc && prevPage !== _pdfPage) {
      addPagesRead(1);
      saveLastPage(_activeId, _pdfPage);
    } else if (isNewDoc) {
      saveLastPage(_activeId, _pdfPage);
    }
  }

  // ── DOCX rendering ─────────────────────────────────────────────────────────
  async function openDocx(doc) {
    showDocxContainer();

    var base64 = doc.dataUrl.split(',')[1];
    var binary = atob(base64);
    var bytes  = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    if (!window.mammoth) {
      showError('mammoth.js failed to load. Please restart the app.');
      return;
    }

    try {
      var result  = await window.mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
      var content = el('readerDocxContent');
      if (content) {
        // Restore saved HTML (includes previously highlighted text) or use fresh
        var saved = await Storage.get('readerDocxHtml_' + doc.id, null);
        content.innerHTML = saved || result.value;
        content.contentEditable = 'true';
        content.spellcheck = false;

        var approxPages = Math.max(1, Math.round(result.value.length / 3000));
        addPagesRead(approxPages);

        // Auto-save DOCX HTML on input (debounced)
        var saveTimer = null;
        content.addEventListener('input', function () {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(function () {
            Storage.set('readerDocxHtml_' + doc.id, content.innerHTML);
          }, 1500);
        });
      }
    } catch (err) {
      showError('Could not open document: ' + err.message);
    }
  }

  // ── Annotation canvas helpers ──────────────────────────────────────────────
  function getAnnotData(docId, page) {
    var key = annotKey(docId, page);
    if (!_annots[key]) _annots[key] = { strokes: [], texts: [] };
    return _annots[key];
  }

  function restoreAnnotations(canvas, docId, page) {
    var ctx  = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var data = getAnnotData(docId, page);
    data.strokes.forEach(function (s) { drawStroke(ctx, s); });
    data.texts.forEach(function (t) { drawText(ctx, t); });
  }

  function drawStroke(ctx, s) {
    if (!s.points || s.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha   = s.alpha || 1;
    ctx.strokeStyle   = s.color || '#ff3366';
    ctx.lineWidth     = s.width || 2;
    ctx.lineCap       = s.lineCap || 'round';
    ctx.lineJoin      = 'round';
    if (s.shadow) { ctx.shadowBlur = 6; ctx.shadowColor = s.shadow; }
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (var i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x, s.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawText(ctx, t) {
    ctx.save();
    ctx.font      = (t.size || 14) + 'px Inter, sans-serif';
    ctx.fillStyle = t.color || '#ffdd44';
    ctx.globalAlpha = 1;
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    var metrics = ctx.measureText(t.text);
    ctx.fillRect(t.x - 2, t.y - (t.size || 14), metrics.width + 4, (t.size || 14) + 4);
    ctx.fillStyle = t.color || '#ffdd44';
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }

  // Flush current annotation canvas pixels into _annots (no-op: we store strokes/texts, not pixels)
  async function flushAnnotCanvas(page) {
    // Strokes are stored incrementally; nothing extra to flush.
    // Mark dirty so saveAnnotations() persists.
    _annotsDirty = true;
  }

  // ── Custom text input popup ─────────────────────────────────────────────────
  function showTextPopup(screenX, screenY, onConfirm) {
    var popup = el('readerTextPopup');
    var input = el('readerTextInput');
    var okBtn = el('readerTextOk');
    var cancelBtn = el('readerTextCancel');
    if (!popup || !input) return;

    // Position popup near the click, keeping it on-screen
    var pw = 240, ph = 100;
    var left = Math.min(screenX, window.innerWidth  - pw - 10);
    var top  = Math.min(screenY, window.innerHeight - ph - 10);
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
    input.value = '';
    popup.style.display = 'block';
    setTimeout(function () { input.focus(); }, 30);

    function confirm() {
      var txt = input.value.trim();
      popup.style.display = 'none';
      cleanup();
      if (txt) onConfirm(txt);
    }
    function cancel() {
      popup.style.display = 'none';
      cleanup();
    }
    function onKey(e) {
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') cancel();
    }

    // Clone buttons to clear previous listeners
    var newOk     = okBtn.cloneNode(true);
    var newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    newOk.addEventListener('click', confirm);
    newCancel.addEventListener('click', cancel);
    input.addEventListener('keydown', onKey);

    function cleanup() {
      input.removeEventListener('keydown', onKey);
    }
  }

  // ── Tool bar wiring ────────────────────────────────────────────────────────
  function setTool(name) {
    _tool = name;
    var tools = ['draw', 'text', 'highlight', 'erase'];
    tools.forEach(function (t) {
      var btn = el('readerTool_' + t);
      if (btn) btn.classList.toggle('active', t === name);
    });
    var canvas = el('readerAnnotCanvas');
    if (canvas) {
      // Toggle pointer-events: only intercept mouse when a tool is active
      canvas.style.pointerEvents = (name === 'none') ? 'none' : 'auto';
      canvas.style.cursor =
        name === 'none'      ? 'default'    :
        name === 'text'      ? 'text'       :
        name === 'highlight' ? 'crosshair'  :
        name === 'erase'     ? 'cell'       : 'crosshair';
    }
  }

  // ── Annotation canvas events ───────────────────────────────────────────────
  function getCanvasPos(canvas, e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width  / rect.width;
    var scaleY = canvas.height / rect.height;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY
    };
  }

  function initAnnotCanvas(canvas) {
    var ctx = canvas.getContext('2d');

    canvas.addEventListener('mousedown', function (e) {
      if (_tool === 'none') return;
      e.preventDefault();
      var pos = getCanvasPos(canvas, e);

      if (_tool === 'text') {
        // Use custom popup instead of window.prompt (which is blocked in Electron)
        showTextPopup(e.clientX, e.clientY, function (txt) {
          var t = { x: pos.x, y: pos.y, text: txt, color: _drawColor, size: Math.max(10, Math.round(14 / _pdfScale)) };
          var data = getAnnotData(_activeId, _pdfPage);
          data.texts.push(t);
          drawText(ctx, t);
          _annotsDirty = true;
          saveAnnotations();
        });
        return;
      }

      if (_tool === 'erase') {
        // Remove strokes/texts near click point
        var data = getAnnotData(_activeId, _pdfPage);
        var r = 20;
        data.strokes = data.strokes.filter(function (s) {
          return !s.points.some(function (p) {
            return Math.abs(p.x - pos.x) < r && Math.abs(p.y - pos.y) < r;
          });
        });
        data.texts = data.texts.filter(function (t) {
          return !(Math.abs(t.x - pos.x) < 60 && Math.abs(t.y - pos.y) < 20);
        });
        restoreAnnotations(canvas, _activeId, _pdfPage);
        _annotsDirty = true;
        return;
      }

      _drawing = true;
      _drawPath = [pos];
    });

    canvas.addEventListener('mousemove', function (e) {
      if (!_drawing) return;
      e.preventDefault();
      var pos = getCanvasPos(canvas, e);
      _drawPath.push(pos);

      var isHL = _tool === 'highlight';
      ctx.save();
      ctx.globalAlpha = isHL ? _highlightOpacity : 1;
      ctx.strokeStyle = isHL ? _highlightColor : _drawColor;
      ctx.lineWidth   = isHL
        ? Math.max(14, 18 / _pdfScale)
        : _penLineWidth(_penStyle, _pdfScale);
      ctx.lineCap  = _penLineCap(_penStyle);
      ctx.lineJoin = 'round';
      if (_penStyle === 'brush' && !isHL) {
        ctx.shadowBlur  = 6;
        ctx.shadowColor = _drawColor;
      }
      ctx.beginPath();
      var len = _drawPath.length;
      ctx.moveTo(_drawPath[len - 2].x, _drawPath[len - 2].y);
      ctx.lineTo(_drawPath[len - 1].x, _drawPath[len - 1].y);
      ctx.stroke();
      ctx.restore();
    });

    canvas.addEventListener('mouseup', function (e) {
      if (!_drawing) return;
      _drawing = false;
      if (_drawPath.length < 2) return;
      var isHL = _tool === 'highlight';
      var stroke = {
        points: _drawPath,
        color:  isHL ? _highlightColor : _drawColor,
        width:  isHL
          ? Math.max(14, 18 / _pdfScale)
          : _penLineWidth(_penStyle, _pdfScale),
        alpha:  isHL ? _highlightOpacity : 1,
        lineCap: _penLineCap(_penStyle),
        shadow:  (!isHL && _penStyle === 'brush') ? _drawColor : null
      };
      var data = getAnnotData(_activeId, _pdfPage);
      data.strokes.push(stroke);
      _drawPath  = [];
      _annotsDirty = true;
      saveAnnotations();
    });

    canvas.addEventListener('mouseleave', function () {
      if (_drawing) {
        _drawing = false;
        _drawPath = [];
      }
    });
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────
  function showEmpty() {
    var e = el('readerEmpty'), p = el('readerPdfContainer'), d = el('readerDocxContainer');
    if (e) e.style.display = 'flex';
    if (p) p.style.display = 'none';
    if (d) d.style.display = 'none';
  }

  function showPdfContainer() {
    var e = el('readerEmpty'), p = el('readerPdfContainer'), d = el('readerDocxContainer');
    if (e) e.style.display = 'none';
    if (p) p.style.display = 'flex';
    if (d) d.style.display = 'none';
  }

  function showDocxContainer() {
    var e = el('readerEmpty'), p = el('readerPdfContainer'), d = el('readerDocxContainer');
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

  function doZoom(delta) {
    _pdfScale = Math.max(0.25, Math.min(4.0, _pdfScale + delta));
    updateZoomLabel();
    renderPdfPage(_pdfPage, false);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    await loadLibrary();
    await loadAnnotations();
    renderDocList();

    // File input
    var fileInput = el('readerFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files.length) addFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    // Drag-and-drop on whole reader panel
    var panel    = el('tab-reader');
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

    // PDF nav buttons
    var prev = el('readerPrevPage'), next = el('readerNextPage');
    if (prev) prev.addEventListener('click', function () { renderPdfPage(_pdfPage - 1, false); });
    if (next) next.addEventListener('click', function () { renderPdfPage(_pdfPage + 1, false); });

    // Manual page input
    var pageInput = el('readerPageInput');
    if (pageInput) {
      pageInput.addEventListener('change', function () {
        var n = parseInt(pageInput.value, 10);
        if (!isNaN(n)) renderPdfPage(n, false);
      });
      pageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var n = parseInt(pageInput.value, 10);
          if (!isNaN(n)) renderPdfPage(n, false);
        }
      });
    }

    // Zoom buttons
    var zoomIn  = el('readerZoomIn'),  zoomOut = el('readerZoomOut');
    if (zoomIn)  zoomIn.addEventListener('click',  function () { doZoom(+0.25); });
    if (zoomOut) zoomOut.addEventListener('click', function () { doZoom(-0.25); });

    // Scroll-wheel zoom on the PDF scroll area
    var scrollArea = el('readerPdfScroll');
    if (scrollArea) {
      scrollArea.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          doZoom(e.deltaY < 0 ? +0.1 : -0.1);
        }
      }, { passive: false });
    }

    // Close buttons
    var closePdf  = el('readerCloseDoc'),  closeDocx = el('readerDocxClose');
    if (closePdf)  closePdf.addEventListener('click',  async function () {
      await saveAnnotations();
      _activeId = null; _pdfDoc = null;
      showEmpty(); renderDocList();
    });
    if (closeDocx) closeDocx.addEventListener('click', function () {
      _activeId = null; showEmpty(); renderDocList();
    });

    // Annotation tool buttons
    ['draw', 'text', 'highlight', 'erase'].forEach(function (t) {
      var btn = el('readerTool_' + t);
      if (btn) btn.addEventListener('click', function () {
        setTool(_tool === t ? 'none' : t);
      });
    });

    // Clear page annotations
    var clearAnnot = el('readerClearAnnot');
    if (clearAnnot) clearAnnot.addEventListener('click', function () {
      if (!_activeId || !_pdfDoc) return;
      if (!confirm('Clear all annotations on this page?')) return;
      var key = annotKey(_activeId, _pdfPage);
      _annots[key] = { strokes: [], texts: [] };
      _annotsDirty = true;
      saveAnnotations();
      var annotCanvas = el('readerAnnotCanvas');
      if (annotCanvas) {
        var ctx = annotCanvas.getContext('2d');
        ctx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);
      }
    });

    // Init annotation canvas
    var annotCanvas = el('readerAnnotCanvas');
    if (annotCanvas) initAnnotCanvas(annotCanvas);

    // Keyboard nav
    document.addEventListener('keydown', function (e) {
      var pdfVisible = el('readerPdfContainer') && el('readerPdfContainer').style.display !== 'none';
      if (!pdfVisible) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') renderPdfPage(_pdfPage + 1, false);
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   renderPdfPage(_pdfPage - 1, false);
    });

    // Periodic auto-save annotations
    setInterval(saveAnnotations, 10000);
  }

  return { init: init, saveAnnotations: saveAnnotations };
})();

window.Reader = Reader;
