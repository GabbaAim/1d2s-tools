/* =========================================================
   1D2S Title Editor — UI controller
   No build step, no external dependencies.
   ========================================================= */
(function () {
  'use strict';

  const C = window.TitleCore;
  if (!C) throw new Error('TitleCore is not loaded.');

  const VERSION = '1.0.0';
  const DRAFT_KEY = '1d2s-title-editor:draft:v1';
  const JSON_LIMIT = 2 * 1024 * 1024;
  const HISTORY_LIMIT = 50;

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
    arrowUp: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
    duplicate: '<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/><path d="M13.5 13.5h4M15.5 11.5v4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.3-1.7 2.7"/><path d="M12 17.5h.01"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/>',
    code: '<path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="m13 5-2 14"/>',
    play: '<path d="m8 5 11 7-11 7Z"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-4-4L7 21"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    swap: '<path d="M4 8h13"/><path d="m14 5 3 3-3 3"/><path d="M20 16H7"/><path d="m10 13-3 3 3 3"/>',
  };

  function icon(name, small) {
    const path = ICONS[name] || '';
    return '<svg class="icon' + (small ? ' icon-sm' : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + path + '</svg>';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function highlightJson(text) {
    const source = String(text == null ? '' : text);
    const re = /"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    let out = '';
    let last = 0;
    let match;
    while ((match = re.exec(source))) {
      out += esc(source.slice(last, match.index));
      const token = match[0];
      const rest = source.slice(match.index + token.length);
      let cls = 'json-number';
      if (token.charAt(0) === '"') {
        cls = /^\s*:/.test(rest) ? 'json-key' : 'json-string';
      } else if (/^(true|false|null)$/.test(token)) {
        cls = 'json-boolean';
      }
      out += '<span class="' + cls + '">' + esc(token) + '</span>';
      last = match.index + token.length;
    }
    out += esc(source.slice(last));
    return out;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function hashString(text) {
    let hash = 2166136261;
    const source = String(text == null ? '' : text);
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function formatClock(timestamp) {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  }

  function formatDraftDate(timestamp) {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleString('ja-JP', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch (error) {
      return '';
    }
  }

  function playLabel(type) {
    return (C.TYPE_META[type] && C.TYPE_META[type].label) || '不明';
  }

  function typeCode(type) {
    return (C.TYPE_META[type] && C.TYPE_META[type].code) || '?';
  }

  const state = {
    view: 'home',
    titles: [],
    selectedUid: null,
    songTitle: '',
    idPrefix: 'title',
    search: '',
    showInspector: false,
    expandedConditions: new Set(),
    dirHandle: null,
    draftInfo: null,
    draftStatus: 'empty',
    draftStorageState: 'unknown',
    draftErrorShown: false,
    lastDraftAt: null,
    lastExportHash: null,
    outputText: '',
  };

  let validation = null;
  let undoStack = [];
  let redoStack = [];
  let editSnapshot = null;
  let editHistoryCommitted = false;
  let draftTimer = null;
  let dragUid = null;
  let dragOverUid = null;
  let dragDepth = 0;
  let pendingConfirm = null;
  let modalReturnFocus = null;
  let modalOnClose = null;

  const els = {
    header: document.getElementById('app-header'),
    main: document.getElementById('main'),
    footer: document.getElementById('app-footer'),
    modalRoot: document.getElementById('modal-root'),
    toastRoot: document.getElementById('toast-root'),
    dropOverlay: document.getElementById('drop-overlay'),
    jsonInput: document.getElementById('json-file-input'),
  };

  /* =========================================================
     Boot
     ========================================================= */

  function init() {
    state.draftInfo = readDraft();
    if (state.draftInfo) state.lastDraftAt = state.draftInfo.savedAt || null;
    bindGlobalEvents();
    renderHome();
  }

  function bindGlobalEvents() {
    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleChange);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleListDrop);
    document.addEventListener('dragend', handleDragEnd);

    els.jsonInput.addEventListener('change', async function () {
      const file = els.jsonInput.files && els.jsonInput.files[0];
      els.jsonInput.value = '';
      if (file) await handleJsonFile(file);
    });

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', function (event) {
      if (hasFileDrag(event)) event.preventDefault();
    });
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('beforeunload', function () {
      if (state.view === 'editor') {
        clearTimeout(draftTimer);
        writeDraft();
      }
    });
  }

  /* =========================================================
     Home
     ========================================================= */

  function renderHome() {
    state.view = 'home';
    state.showInspector = false;
    document.title = '1D2S 称号エディタ | title.json ジェネレーター';
    els.header.innerHTML = homeHeaderMarkup();
    els.main.className = 'main home-main';
    els.main.innerHTML = homeMarkup();
    els.footer.innerHTML = homeFooterMarkup();
  }

  function homeHeaderMarkup() {
    return '' +
      '<div class="header-inner">' +
        '<div class="brand">' +
          '<span class="brand-mark" aria-hidden="true">1D2S</span>' +
          '<span class="brand-text"><strong>称号エディタ</strong><small>TITLE.JSON GENERATOR</small></span>' +
        '</div>' +
        '<div class="header-actions">' +
          '<span class="privacy-note">LOCAL ONLY / NO UPLOAD</span>' +
          '<button type="button" class="btn btn-ghost" data-action="open-help">' + icon('help') + 'ヘルプ</button>' +
        '</div>' +
      '</div>';
  }

  function homeMarkup() {
    const draftMarkup = homeDraftMarkup();
    const sample = '[\n' +
      '  {\n' +
      '    "Id": "song_001",\n' +
      '    "Title": "初見プレイヤー",\n' +
      '    "PlateId": "01",\n' +
      '    "Condition": {\n' +
      '      "Type": "Play",\n' +
      '      "Difficulty": -1,\n' +
      '      "OptionConditions": []\n' +
      '    }\n' +
      '  }\n' +
      ']';

    return '' +
      '<section class="home">' +
        '<div class="home-hero">' +
          '<div class="hero-copy">' +
            '<p class="eyebrow"><span class="rule"></span>TITLE DEFINITION TOOL / FOR CHART AUTHORS</p>' +
            '<h1 class="home-title">title.json を作る</h1>' +
            '<p class="hero-lead">曲名と獲得条件を入力するだけで、曲のフォルダに置く title.json を作成・検証・出力できます。ゲームと同じ条件判定で、獲得できない定義を先に潰します。</p>' +
            '<div class="home-actions">' +
              '<button type="button" class="action-card action-primary" data-action="new-project">' +
                '<span class="action-card-icon">' + icon('plus') + '</span>' +
                '<span class="action-card-copy"><strong>新規作成</strong><small>空の称号リストから始める</small></span>' +
                '<span class="action-arrow">' + icon('arrowLeft') + '</span>' +
              '</button>' +
              '<button type="button" class="action-card" data-action="open-json-file">' +
                '<span class="action-card-icon">' + icon('upload') + '</span>' +
                '<span class="action-card-copy"><strong>title.json を読み込む</strong><small>既存の定義を編集・点検する</small></span>' +
                '<span class="action-arrow">' + icon('arrowLeft') + '</span>' +
              '</button>' +
            '</div>' +
            '<button type="button" class="text-action" data-action="open-paste">JSON を貼り付けて読み込む</button>' +
          '</div>' +
          '<aside class="home-side">' +
            '<div class="sample-card">' +
              '<div class="sample-head"><span>OUTPUT / title.json</span><span class="sample-dot"></span></div>' +
              '<pre class="sample-code"><code>' + highlightJson(sample) + '</code></pre>' +
              '<div class="sample-foot">UTF-8 / LF / 2 SPACES / TITLE.JSON</div>' +
            '</div>' +
            '<div class="home-note"><span class="note-index">01</span><p>入力はブラウザ内だけで処理されます。サーバー送信・アカウント・アクセス解析はありません。</p></div>' +
            '<div class="home-note"><span class="note-index">02</span><p>称号IDの重複、条件式の誤り、設定できないスクロール速度などを入力中に検出します。</p></div>' +
            '<div class="home-note"><span class="note-index">03</span><p>書き出した title.json は、曲の譜面フォルダに置いてください。</p></div>' +
          '</aside>' +
        '</div>' +
        draftMarkup +
      '</section>';
  }

  function homeDraftMarkup() {
    const draft = state.draftInfo;
    if (!draft || !Array.isArray(draft.titles)) return '';
    if (draft.titles.length === 0 && !draft.songTitle) return '';

    const count = draft.titles.length;
    const title = draft.songTitle ? draft.songTitle : '無題の曲';
    return '' +
      '<section class="draft-banner" aria-label="下書き">' +
        '<div class="draft-copy">' +
          '<span class="eyebrow small">DRAFT</span>' +
          '<strong>' + esc(title) + '</strong>' +
          '<span class="muted">' + esc(formatDraftDate(draft.savedAt)) + ' / ' + count + ' 件</span>' +
        '</div>' +
        '<div class="draft-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" data-action="restore-draft">復元</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="discard-draft">破棄</button>' +
        '</div>' +
      '</section>';
  }

  function homeFooterMarkup() {
    return '' +
      '<div class="footer-inner">' +
        '<span>1D2S TITLE EDITOR</span><span class="footer-sep"></span><span>v' + VERSION + '</span>' +
        '<span class="footer-grow"></span>' +
        '<span>データはこのブラウザ内だけで処理されます</span>' +
        '<span class="footer-sep"></span>' +
        '<button type="button" class="link-button" data-action="open-help">仕様と注意</button>' +
      '</div>';
  }

  /* =========================================================
     Editor shell
     ========================================================= */

  function enterEditor() {
    state.view = 'editor';
    state.showInspector = false;
    validation = C.validateAll(state.titles);
    document.title = (state.songTitle || '無題の曲') + ' | 1D2S 称号エディタ';
    renderEditorHeader();
    renderEditorShell();
    renderEditorFooter();
    renderAll();
  }

  function renderEditorHeader() {
    const total = state.titles.length;
    const draftText = draftStatusText();
    els.header.innerHTML = '' +
      '<div class="header-inner editor-header">' +
        '<button type="button" class="btn btn-icon btn-ghost" data-action="go-home" aria-label="ホームへ戻る" title="ホームへ戻る">' + icon('arrowLeft') + '</button>' +
        '<div class="editor-heading">' +
          '<span class="brand-mini">1D2S 称号エディタ</span>' +
          '<span class="editor-song" id="editor-song" title="' + esc(state.songTitle || '無題の曲') + '">' + esc(state.songTitle || '無題の曲') + '</span>' +
        '</div>' +
        '<div class="header-actions">' +
          '<span class="status-chip' + (state.draftStatus === 'saving' ? ' is-saving' : '') + '" id="draft-status">' + esc(draftText) + '</span>' +
          '<button type="button" class="btn btn-ghost inspector-toggle" data-action="toggle-inspector">検証</button>' +
          '<button type="button" class="btn btn-ghost validation-summary" id="validation-summary" data-action="show-checks" aria-label="検証結果を表示">' + validationBadges() + '</button>' +
          '<button type="button" class="btn btn-primary" data-action="open-output">' + icon('download') + '書き出す</button>' +
          '<button type="button" class="btn btn-icon btn-ghost" data-action="open-help" aria-label="ヘルプ" title="ヘルプ">' + icon('help') + '</button>' +
        '</div>' +
        '<span class="sr-only" id="validation-live" aria-live="polite"></span>' +
      '</div>';
  }

  function renderEditorShell() {
    els.main.className = 'main editor-main';
    els.main.innerHTML = '' +
      '<div class="editor-layout' + (state.showInspector ? ' show-inspector' : '') + '" id="editor-layout">' +
        '<aside class="sidebar" aria-label="称号一覧">' +
          '<div class="sidebar-head">' +
            '<div><span class="eyebrow small">TITLES</span><strong id="title-count">' + state.titles.length + ' 件</strong></div>' +
            '<button type="button" class="btn btn-primary btn-sm" data-action="add-title">' + icon('plus', true) + '追加</button>' +
          '</div>' +
          '<div class="song-field">' +
            '<label for="song-title">曲名</label>' +
            '<input class="input" id="song-title" data-song-title type="text" value="' + esc(state.songTitle) + '" placeholder="曲名を入力" autocomplete="off">' +
            '<span class="field-hint">説明文の自動生成に使います</span>' +
          '</div>' +
          '<div class="search-box">' + icon('search') +
            '<input id="title-search" type="search" value="' + esc(state.search) + '" placeholder="称号ID / 称号名 / 説明を検索" aria-label="称号を検索" autocomplete="off">' +
          '</div>' +
          '<div class="title-list" id="title-list" role="listbox" aria-label="称号一覧"></div>' +
          '<div class="sidebar-foot">' +
            '<button type="button" class="btn btn-secondary btn-block btn-sm" data-action="open-templates">' + icon('layers', true) + 'テンプレートから追加</button>' +
            '<button type="button" class="btn btn-ghost btn-block btn-sm" data-action="open-json-file">' + icon('upload', true) + 'title.json を読み込む</button>' +
          '</div>' +
        '</aside>' +
        '<section class="form-pane" aria-label="称号の編集">' +
          '<div class="form-scroll" id="form-scroll"><div class="form-inner" id="form-inner"></div></div>' +
        '</section>' +
        '<aside class="inspector" aria-label="検証">' +
          '<div class="inspector-head"><span class="eyebrow small">検証</span><span class="tab-count" id="checks-count">0</span></div>' +
          '<div class="inspector-body" id="inspector-body"></div>' +
        '</aside>' +
      '</div>';
  }

  function renderAll() {
    syncAutoDescriptions();
    validation = C.validateAll(state.titles);
    renderList();
    renderForm();
    renderInspector();
    refreshHeaderMetrics();
    refreshFooter();
  }

  function refreshAfterEdit() {
    syncAutoDescriptions();
    validation = C.validateAll(state.titles);
    renderList();
    refreshFieldErrors();
    updateConditionRowVisuals();
    updateDescriptionField();
    updateCharCount();
    updateInlineSummary();
    updateFormHeadName();
    updateTypeUi();
    renderInspector();
    refreshHeaderMetrics();
    refreshFooter();
    scheduleDraft();
  }

  /* =========================================================
     Sidebar list
     ========================================================= */

  function filteredTitles() {
    const query = state.search.trim().toLowerCase();
    if (!query) return state.titles.map(function (title, index) { return { title: title, index: index }; });
    return state.titles
      .map(function (title, index) { return { title: title, index: index }; })
      .filter(function (entry) {
        const title = entry.title;
        return [title.id, title.title, title.description].some(function (value) {
          return String(value || '').toLowerCase().includes(query);
        });
      });
  }

  function renderList() {
    const list = document.getElementById('title-list');
    if (!list) return;

    const entries = filteredTitles();
    if (entries.length === 0) {
      list.innerHTML = '<div class="title-empty">' +
        (state.titles.length === 0
          ? 'まだ称号がありません。<br>「追加」から最初の 1 件を作成できます。'
          : '検索に一致する称号がありません。') +
        '</div>';
      updateTitleCount();
      return;
    }

    list.innerHTML = entries.map(function (entry) {
      const title = entry.title;
      const issues = (validation && validation.byTitle[entry.index]) || [];
      const severity = issues.some(function (issue) { return issue.severity === 'error'; })
        ? 'error'
        : issues.some(function (issue) { return issue.severity === 'warning'; })
          ? 'warning'
          : 'ok';
      const selected = title._uid === state.selectedUid;
      return '' +
        '<button type="button" class="title-item' + (selected ? ' is-selected' : '') + '"' +
          ' data-action="select-title" data-uid="' + esc(title._uid) + '" role="option" aria-selected="' + (selected ? 'true' : 'false') + '"' +
          ' draggable="true" title="' + esc(title.title || '（無題）') + '">' +
          '<span class="title-index">' + pad2(entry.index + 1) + '</span>' +
          '<span class="title-item-main">' +
            '<span class="title-item-name' + (title.title ? '' : ' is-untitled') + '">' + esc(title.title || '（無題）') + '</span>' +
            '<span class="title-item-meta">' +
              '<span class="type-chip">' + esc(typeCode(title.type)) + '</span>' +
              '<span class="title-id">' + esc(title.id || 'Id 未設定') + '</span>' +
            '</span>' +
          '</span>' +
          '<span class="severity-dot ' + severity + '" aria-hidden="true"></span>' +
        '</button>';
    }).join('');
    updateTitleCount();
  }

  function updateTitleCount() {
    const element = document.getElementById('title-count');
    if (element) element.textContent = state.titles.length + ' 件';
  }

  /* =========================================================
     Form
     ========================================================= */

  function selectedTitle() {
    return state.titles.find(function (title) { return title._uid === state.selectedUid; }) || null;
  }

  function selectedIndex() {
    return state.titles.findIndex(function (title) { return title._uid === state.selectedUid; });
  }

  function allIds() {
    return state.titles.map(function (title) { return title.id; }).filter(function (id) { return Boolean(id); });
  }

  function renderForm() {
    const inner = document.getElementById('form-inner');
    if (!inner) return;

    const title = selectedTitle();
    if (!title) {
      inner.innerHTML = emptyEditorMarkup();
      return;
    }

    const index = selectedIndex();
    const total = state.titles.length;
    const type = C.TYPES.includes(title.type) ? title.type : '';
    const typeDescription = C.TYPE_META[type] ? C.TYPE_META[type].description : 'プレイ条件が不明です。4 つのいずれかを選択してください。';

    inner.innerHTML = '' +
      '<div class="form-head" id="form-head">' +
        '<div class="form-head-copy">' +
          '<span class="eyebrow small">TITLE ' + pad2(index + 1) + ' / ' + pad2(total) + '</span>' +
          '<h2 id="editing-title">' + esc(title.title || '（無題の称号）') + '</h2>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn btn-icon btn-ghost btn-sm" data-action="move-up" aria-label="上へ移動" title="上へ移動"' + (index <= 0 ? ' disabled' : '') + '>' + icon('arrowUp', true) + '</button>' +
          '<button type="button" class="btn btn-icon btn-ghost btn-sm" data-action="move-down" aria-label="下へ移動" title="下へ移動"' + (index >= total - 1 ? ' disabled' : '') + '>' + icon('arrowDown', true) + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="duplicate-title">' + icon('duplicate', true) + '複製</button>' +
          '<button type="button" class="btn btn-danger-ghost btn-sm" data-action="delete-title">' + icon('trash', true) + '削除</button>' +
        '</div>' +
      '</div>' +

      '<section class="section" aria-labelledby="section-basic">' +
        '<div class="section-head"><h3 id="section-basic">基本情報</h3><span class="section-note">ネームプレートに表示されます</span></div>' +
        '<div class="field-grid">' +
          '<div class="field field-wide">' +
            '<label for="field-id">称号ID <span class="required">必須</span></label>' +
            '<input class="input' + (hasFieldError('id') ? ' is-invalid' : '') + '" id="field-id" data-field="id" type="text" value="' + esc(title.id) + '" autocomplete="off" spellcheck="false" placeholder="title_001" aria-describedby="hint-id error-id">' +
            '<p class="field-hint" id="hint-id">称号を追加すると自動で設定されます。全曲で一意。<code>_ - .</code> を含む半角英数字を推奨。現在 <span id="id-length">' + String(title.id || '').length + '</span> / 64 文字。</p>' +
            '<div class="field-error" id="error-id">' + fieldErrorHtml('id') + '</div>' +
          '</div>' +
          '<div class="field field-wide">' +
            '<label for="field-title">称号名 <span class="required">必須</span></label>' +
            '<input class="input' + (hasFieldError('title') ? ' is-invalid' : '') + '" id="field-title" data-field="title" type="text" value="' + esc(title.title) + '" autocomplete="off" spellcheck="false" placeholder="初見プレイヤー" aria-describedby="hint-title error-title">' +
            '<p class="field-hint" id="hint-title">改行・制御文字は使用できません。</p>' +
            '<div class="field-error" id="error-title">' + fieldErrorHtml('title') + '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label for="field-plate">プレートID</label>' +
            plateSelectHtml(title) +
            '<div class="plate-custom-wrap' + (isCustomPlate(title.plateId) ? '' : ' hidden') + '" id="plate-custom-wrap">' +
              '<input class="input' + (hasFieldError('plateId') ? ' is-invalid' : '') + '" id="field-plate-custom" data-field="plateId-custom" type="text" value="' + esc(isCustomPlate(title.plateId) ? title.plateId : '') + '" autocomplete="off" spellcheck="false" placeholder="カスタムのフォルダ名" aria-describedby="hint-plate error-plateId">' +
            '</div>' +
            '<p class="field-hint" id="hint-plate">空の場合は既定プレート <code>00</code>。スキンのフォルダ名と一致するものを選ぶか、カスタムで自由入力してください。</p>' +
            '<div class="field-error" id="error-plateId">' + fieldErrorHtml('plateId') + '</div>' +
          '</div>' +
          '<div class="field">' +
            '<div class="field-label-row">' +
              '<label for="field-description">説明</label>' +
              '<label class="checkbox auto-toggle"><input type="checkbox" data-description-auto' + (title.descriptionAuto !== false ? ' checked' : '') + '> 自動</label>' +
            '</div>' +
            '<textarea class="textarea' + (title.descriptionAuto !== false ? ' is-auto' : '') + (hasFieldError('description') ? ' is-invalid' : '') + '" id="field-description" data-field="description" rows="3" maxlength="500" placeholder="この称号を獲得したときの説明"' + (title.descriptionAuto !== false ? ' readonly' : '') + ' aria-describedby="hint-description error-description">' + esc(title.description) + '</textarea>' +
            '<p class="field-hint" id="hint-description">「自動」がオンの間は、曲名・難易度・プレイ条件・オプション条件から文章を生成します。編集する場合は自動をオフにしてください。</p>' +
            '<div class="char-count" id="description-count">' + String(title.description || '').length + ' / 200 文字</div>' +
            '<div class="field-error" id="error-description">' + fieldErrorHtml('description') + '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="section" aria-labelledby="section-condition">' +
        '<div class="section-head"><h3 id="section-condition">獲得条件</h3><span class="section-note">難易度と演奏オプションで判定</span></div>' +
        '<div class="field">' +
          '<span class="field-label" id="type-label">プレイ条件 <span class="required">必須</span></span>' +
          '<div class="segmented' + (hasFieldError('type') ? ' is-invalid' : '') + '" id="field-type" role="group" aria-labelledby="type-label">' +
            C.TYPES.map(function (candidate) {
              const meta = C.TYPE_META[candidate];
              const active = candidate === type;
              return '<button type="button" class="segment' + (active ? ' is-active' : '') + '" data-action="set-type" data-type="' + candidate + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
                '<span class="segment-label">' + esc(meta.label) + '</span>' +
                '<span class="segment-code">' + esc(meta.code) + '</span>' +
              '</button>';
            }).join('') +
          '</div>' +
          '<p class="type-description" id="type-description">' + esc(typeDescription) + '</p>' +
          '<div class="field-error" id="error-type">' + fieldErrorHtml('type') + '</div>' +
        '</div>' +
        '<div class="field" style="margin-top:16px">' +
          '<label for="field-difficulty">難易度</label>' +
          '<select class="select' + (hasFieldError('difficulty') ? ' is-invalid' : '') + '" id="field-difficulty" data-field="difficulty" aria-describedby="error-difficulty">' +
            difficultyOptionsHtml(title.difficulty) +
          '</select>' +
          '<div class="field-error" id="error-difficulty">' + fieldErrorHtml('difficulty') + '</div>' +
        '</div>' +
        '<div class="field" style="margin-top:20px">' +
          '<div class="section-head" style="margin-bottom:8px"><span class="field-label">オプション条件</span><button type="button" class="btn btn-ghost btn-sm" data-action="add-condition">' + icon('plus', true) + '条件を追加</button></div>' +
          '<div class="condition-list" id="conditions-list">' + conditionRowsHtml(title) + '</div>' +
          '<div class="field-error" id="error-conditions">' + fieldErrorHtml('conditions', { conditionIndex: null }) + '</div>' +
          '<p class="condition-note">設定可能値: ScrollSpeed 0.5〜2.0（0.1 刻み）、2.5、3.0、3.5、4.0。Doron / Random は <code>=</code> と <code>!=</code> のみ使用できます。</p>' +
        '</div>' +
        '<div class="summary-inline">' +
          '<span class="eyebrow small">CONDITION SUMMARY</span>' +
          '<p id="inline-summary">' + esc(C.buildDescription(title, state.songTitle)) + '</p>' +
        '</div>' +
      '</section>';
  }

  function emptyEditorMarkup() {
    return '' +
      '<div class="empty-state">' +
        '<div class="empty-state-inner">' +
          '<div class="empty-state-mark">' + icon('file') + '</div>' +
          '<h2>まだ称号がありません</h2>' +
          '<p>最初の 1 件を作りましょう。テンプレートから追加すると、条件の組み合わせを確認しながら始められます。</p>' +
          '<div class="empty-actions">' +
            '<button type="button" class="btn btn-primary" data-action="add-title">' + icon('plus') + '称号を追加</button>' +
            '<button type="button" class="btn" data-action="open-templates">' + icon('layers') + 'テンプレート</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function difficultyOptionsHtml(current) {
    const values = C.DIFFICULTIES;
    const exists = values.some(function (difficulty) { return difficulty.value === current; });
    let html = values.map(function (difficulty) {
      return '<option value="' + difficulty.value + '"' + (difficulty.value === current ? ' selected' : '') + '>' + esc(difficulty.label) + '</option>';
    }).join('');
    if (!exists) {
      html = '<option value="__invalid" selected>' + esc(String(current)) + '（不正な値）</option>' + html;
    }
    return html;
  }

  function isCustomPlate(plateId) {
    return Boolean(plateId) && !C.PLATE_IDS.includes(plateId);
  }

  function plateSelectHtml(title) {
    const custom = isCustomPlate(title.plateId);
    const options = C.PLATE_IDS.map(function (id) {
      return '<option value="' + esc(id) + '"' + (title.plateId === id ? ' selected' : '') + '>' + esc(id) + '</option>';
    }).join('');
    return '' +
      '<select class="select' + (hasFieldError('plateId') ? ' is-invalid' : '') + '" id="field-plate" data-field="plateId" aria-describedby="hint-plate error-plateId">' +
        '<option value=""' + (!title.plateId ? ' selected' : '') + '>指定なし（00）</option>' +
        options +
        '<option value="__custom"' + (custom ? ' selected' : '') + '>カスタム</option>' +
      '</select>';
  }

  function syncAutoDescriptions() {
    state.titles.forEach(function (title) {
      if (title.descriptionAuto !== false) {
        title.description = C.buildDescription(title, state.songTitle);
      }
    });
  }

  function updateDescriptionField() {
    const title = selectedTitle();
    const textarea = document.getElementById('field-description');
    if (!title || !textarea) return;
    const auto = title.descriptionAuto !== false;
    if (textarea.value !== title.description) textarea.value = title.description;
    textarea.readOnly = auto;
    textarea.classList.toggle('is-auto', auto);
    const checkbox = document.querySelector('[data-description-auto]');
    if (checkbox) checkbox.checked = auto;
  }

  /* =========================================================
     Conditions
     ========================================================= */

  function conditionRowsHtml(title) {
    if (!title.conditions.length) {
      return '<div class="condition-empty">条件はありません。必要な場合だけ追加してください。</div>';
    }
    return title.conditions.map(function (expression, index) {
      return conditionRowHtml(title, index);
    }).join('');
  }

  function conditionRowHtml(title, index) {
    const expression = String(title.conditions[index] == null ? '' : title.conditions[index]);
    const parsed = C.parseExpression(expression);
    const key = title._uid + ':' + index;
    const expanded = !parsed.ok || state.expandedConditions.has(key);
    const meta = parsed.ok ? parsed.propertyMeta : null;
    const issues = conditionIssues(index).filter(function (issue) { return issue.severity !== 'info'; });
    const code = parsed.ok ? expression : '式を確認してください';
    const description = parsed.ok ? C.describeExpression(expression) : '条件式を修正するか、直接入力で書き直してください。';
    const propertyOptions = '<option value=""' + (!parsed.ok ? ' selected' : '') + '>—</option>' +
      C.PROPERTY_NAMES.map(function (name) {
        const propertyMeta = C.PROPERTY_META[name];
        return '<option value="' + name + '"' + (parsed.ok && parsed.property === name ? ' selected' : '') + '>' + esc(propertyMeta.label) + ' / ' + name + '</option>';
      }).join('');

    const operatorOptions = '<option value=""' + (!parsed.ok ? ' selected' : '') + '>—</option>' +
      (meta ? meta.operators.map(function (operator) {
        return '<option value="' + esc(operator) + '"' + (parsed.operator === operator ? ' selected' : '') + '>' + esc(operator) + '</option>';
      }).join('') : '');

    let valueControl = '<input class="input" disabled placeholder="—" aria-label="条件値">';
    if (meta) {
      if (meta.type === 'boolean') {
        valueControl = '<select class="select" data-condition-part="value" data-condition-index="' + index + '" aria-label="条件値">' +
          '<option value="true"' + (String(parsed.value) === 'true' ? ' selected' : '') + '>true</option>' +
          '<option value="false"' + (String(parsed.value) === 'false' ? ' selected' : '') + '>false</option>' +
        '</select>';
      } else if (meta.type === 'enum') {
        valueControl = '<select class="select" data-condition-part="value" data-condition-index="' + index + '" aria-label="条件値">' +
          meta.values.map(function (value) {
            return '<option value="' + value + '"' + (parsed.value === value ? ' selected' : '') + '>' + value + ' / ' + esc(meta.valueLabels[value]) + '</option>';
          }).join('') +
        '</select>';
      } else if (parsed.operator === '=' || parsed.operator === '!=') {
        const speeds = C.SCROLL_SPEEDS.slice();
        if (!speeds.some(function (speed) { return Math.abs(speed - parsed.value) < 1e-4; })) speeds.push(parsed.value);
        valueControl = '<select class="select" data-condition-part="value" data-condition-index="' + index + '" aria-label="条件値">' +
          speeds.map(function (speed) {
            const selected = Math.abs(speed - parsed.value) < 1e-4;
            return '<option value="' + speed + '"' + (selected ? ' selected' : '') + '>' + C.formatSpeed(speed) + '</option>';
          }).join('') +
        '</select>';
      } else {
        valueControl = '<input class="input" type="number" min="0.5" max="4" step="0.1" data-condition-part="value" data-condition-index="' + index + '" value="' + esc(parsed.valueText) + '" aria-label="条件値">';
      }
    }

    return '' +
      '<div class="condition-row' + (issues.some(function (issue) { return issue.severity === 'error'; }) ? ' has-error' : '') + '" data-condition-index="' + index + '">' +
        '<div class="condition-builder">' +
          '<span class="condition-index">' + pad2(index + 1) + '</span>' +
          '<select class="select" data-condition-part="prop" data-condition-index="' + index + '" aria-label="条件プロパティ">' + propertyOptions + '</select>' +
          '<select class="select" data-condition-part="op" data-condition-index="' + index + '" aria-label="比較演算子"' + (!meta ? ' disabled' : '') + '>' + operatorOptions + '</select>' +
          valueControl +
          '<button type="button" class="btn btn-icon btn-ghost btn-sm" data-action="toggle-condition-raw" data-condition-index="' + index + '" aria-label="式を直接編集" aria-expanded="' + (expanded ? 'true' : 'false') + '" title="式を直接編集">' + icon('code', true) + '</button>' +
          '<button type="button" class="btn btn-icon btn-ghost btn-sm" data-action="remove-condition" data-condition-index="' + index + '" aria-label="条件を削除" title="条件を削除">' + icon('x', true) + '</button>' +
        '</div>' +
        '<div class="condition-code"><code>' + esc(code) + '</code><span class="condition-desc">' + esc(description) + '</span></div>' +
        '<div class="condition-raw' + (expanded ? '' : ' hidden') + '">' +
          '<input class="input" data-condition-part="raw" data-condition-index="' + index + '" value="' + esc(expression) + '" spellcheck="false" autocomplete="off" placeholder="ScrollSpeed>=2.0" aria-label="条件式 ' + (index + 1) + '">' +
          '<button type="button" class="btn btn-sm" data-action="apply-condition-raw" data-condition-index="' + index + '">適用</button>' +
        '</div>' +
        '<div class="condition-error">' + issueLines(issues) + '</div>' +
      '</div>';
  }

  function conditionIssues(index) {
    const titleIndex = selectedIndex();
    if (!validation || titleIndex < 0) return [];
    return (validation.byTitle[titleIndex] || []).filter(function (issue) {
      return issue.field === 'conditions' && issue.conditionIndex === index;
    });
  }

  function renderConditions(options) {
    const list = document.getElementById('conditions-list');
    const title = selectedTitle();
    if (!list || !title) return;
    list.innerHTML = conditionRowsHtml(title);
    const errorBox = document.getElementById('error-conditions');
    if (errorBox) errorBox.innerHTML = fieldErrorHtml('conditions', { conditionIndex: null });

    if (options && Number.isInteger(options.focusIndex)) {
      const row = list.querySelector('[data-condition-index="' + options.focusIndex + '"]');
      if (row) {
        const control = row.querySelector('[data-condition-part="' + (options.focusPart || 'prop') + '"]');
        if (control) control.focus();
      }
    }
  }

  function toggleConditionRaw(index) {
    const title = selectedTitle();
    if (!title) return;
    const key = title._uid + ':' + index;
    const parsed = C.parseExpression(title.conditions[index] || '');
    if (state.expandedConditions.has(key)) {
      state.expandedConditions.delete(key);
      renderConditions({ focusIndex: index, focusPart: parsed.ok ? 'prop' : 'raw' });
    } else {
      state.expandedConditions.add(key);
      renderConditions({ focusIndex: index, focusPart: 'raw' });
    }
  }

  function updateConditionValue(index, value) {
    const title = selectedTitle();
    if (!title) return;
    const parsed = C.parseExpression(title.conditions[index] || '');
    if (!parsed.ok) return;
    title.conditions[index] = C.formatExpression(parsed.property, parsed.operator, value);
    updateConditionRowVisuals();
    refreshAfterEdit();
  }

  function updateConditionRaw(index, value) {
    const title = selectedTitle();
    if (!title) return;
    title.conditions[index] = value;
    updateConditionRowVisuals();
    refreshAfterEdit();
  }

  function applyConditionRaw(index) {
    const title = selectedTitle();
    if (!title) return;
    const row = document.querySelector('.condition-row[data-condition-index="' + index + '"]');
    const input = row && row.querySelector('[data-condition-part="raw"]');
    if (input) title.conditions[index] = input.value;
    const parsed = C.parseExpression(title.conditions[index] || '');
    renderConditions({ focusIndex: index, focusPart: parsed.ok ? 'prop' : 'raw' });
    refreshAfterEdit();
  }

  function applyConditionBuilder(index, part, value) {
    const title = selectedTitle();
    if (!title) return;
    const parsed = C.parseExpression(title.conditions[index] || '');

    if (part === 'prop') {
      const meta = C.PROPERTY_META[value];
      if (!meta) {
        title.conditions[index] = '';
      } else {
        const operator = parsed.ok && meta.operators.includes(parsed.operator) ? parsed.operator : meta.operators[0];
        title.conditions[index] = C.formatExpression(value, operator, meta.defaultValue);
      }
      renderConditions({ focusIndex: index, focusPart: 'prop' });
    } else if (part === 'op' && parsed.ok) {
      title.conditions[index] = C.formatExpression(parsed.property, value, parsed.valueText);
      renderConditions({ focusIndex: index, focusPart: 'op' });
    } else if (part === 'value' && parsed.ok) {
      title.conditions[index] = C.formatExpression(parsed.property, parsed.operator, value);
      updateConditionRowVisuals();
    }
    refreshAfterEdit();
  }

  function updateConditionRowVisuals() {
    const title = selectedTitle();
    if (!title) return;
    document.querySelectorAll('.condition-row').forEach(function (row) {
      const index = Number(row.dataset.conditionIndex);
      const expression = String(title.conditions[index] == null ? '' : title.conditions[index]);
      const parsed = C.parseExpression(expression);
      const code = row.querySelector('.condition-code code');
      const description = row.querySelector('.condition-desc');
      const error = row.querySelector('.condition-error');
      if (code) code.textContent = parsed.ok ? expression : '式を確認してください';
      if (description) description.textContent = parsed.ok ? C.describeExpression(expression) : '条件式を修正するか、直接入力で書き直してください。';
      if (error) error.innerHTML = issueLines(conditionIssues(index).filter(function (issue) { return issue.severity !== 'info'; }));
      row.classList.toggle('has-error', conditionIssues(index).some(function (issue) { return issue.severity === 'error'; }));
    });
  }

  /* =========================================================
     Inspector
     ========================================================= */

  function renderInspector() {
    const body = document.getElementById('inspector-body');
    if (!body) return;
    const count = document.getElementById('checks-count');
    if (count) count.textContent = validation ? String(validation.counts.total) : '0';
    body.innerHTML = checksMarkup();
  }

  function checksMarkup() {
    if (!validation) return '';
    const selected = selectedTitle();
    const index = selectedIndex();
    const selectedIssues = index >= 0 ? validation.byTitle[index] : [];
    const globalIssues = validation.globalIssues;
    const otherIssues = validation.issues.filter(function (issue) {
      return issue.titleIndex != null && issue.titleIndex !== index && issue.severity !== 'info';
    }).slice(0, 40);

    if (validation.issues.length === 0) {
      return '<div class="check-empty"><strong>問題は見つかりませんでした</strong>このまま title.json を書き出せます。</div>' +
        '<div class="checks-summary">' + validationBadges() + '</div>';
    }

    let html = '<div class="checks-summary">' + validationBadges() + '</div>';

    if (selectedIssues.length) {
      html += '<div class="check-group"><h3>選択中の称号</h3>' +
        selectedIssues.map(function (issue) { return checkItemMarkup(issue, selected); }).join('') +
        '</div>';
    }

    if (globalIssues.length) {
      html += '<div class="check-group"><h3>全体</h3>' +
        globalIssues.map(function (issue) { return checkItemMarkup(issue, null); }).join('') +
        '</div>';
    }

    if (otherIssues.length) {
      html += '<div class="check-group"><h3>その他の称号</h3>' +
        otherIssues.map(function (issue) {
          const title = validation && state.titles[issue.titleIndex] ? state.titles[issue.titleIndex] : null;
          return checkItemMarkup(issue, title);
        }).join('') +
        '</div>';
    }

    return html;
  }

  function checkItemMarkup(issue, title) {
    const label = issue.severity === 'error' ? 'E' : issue.severity === 'warning' ? 'W' : 'I';
    const titleLabel = title && issue.titleIndex != null
      ? '<span class="issue-code">' + esc(title.title || '（無題）') + ' / ' + issue.code + '</span>'
      : '<span class="issue-code">' + issue.code + '</span>';
    return '' +
      '<button type="button" class="check-item is-' + issue.severity + '" data-action="focus-issue"' +
        ' data-uid="' + esc(title && title._uid ? title._uid : '') + '"' +
        ' data-field="' + esc(issue.field) + '"' +
        ' data-condition-index="' + (issue.conditionIndex == null ? '' : issue.conditionIndex) + '">' +
        '<span class="issue-icon ' + issue.severity + '">' + label + '</span>' +
        '<span>' + titleLabel + '<span class="issue-message">' + esc(issue.message) + '</span></span>' +
      '</button>';
  }

  function validationBadges() {
    if (!validation) return '<span class="badge badge-success">' + icon('check', true) + '問題なし</span>';
    const counts = validation.counts;
    const parts = [];
    if (counts.errors > 0) parts.push('<span class="badge badge-error">E ' + counts.errors + '</span>');
    if (counts.warnings > 0) parts.push('<span class="badge badge-warning">W ' + counts.warnings + '</span>');
    if (counts.errors === 0 && counts.warnings === 0) {
      parts.push('<span class="badge badge-success">' + icon('check', true) + '問題なし</span>');
    }
    return parts.join('');
  }

  function refreshHeaderMetrics() {
    if (state.view !== 'editor') return;
    const summary = document.getElementById('validation-summary');
    if (summary) summary.innerHTML = validationBadges();
    const live = document.getElementById('validation-live');
    if (live && validation) {
      live.textContent = 'エラー ' + validation.counts.errors + ' 件、警告 ' + validation.counts.warnings + ' 件';
    }
    const draft = document.getElementById('draft-status');
    if (draft) {
      draft.textContent = draftStatusText();
      draft.classList.toggle('is-saving', state.draftStatus === 'saving');
    }
    const song = document.getElementById('editor-song');
    if (song) {
      song.textContent = state.songTitle || '無題の曲';
      song.title = state.songTitle || '無題の曲';
    }
    const checks = document.getElementById('checks-count');
    if (checks && validation) checks.textContent = String(validation.counts.total);
    updateTitleCount();
    document.title = (state.songTitle || '無題の曲') + ' | 1D2S 称号エディタ';
  }

  function draftStatusText() {
    if (state.draftStorageState === 'unavailable') return '自動保存オフ';
    if (state.draftStatus === 'saving') return '下書き保存中…';
    if (state.draftStatus === 'error') return '下書き未保存';
    if (state.lastDraftAt) return '下書き保存 ' + formatClock(state.lastDraftAt);
    return '下書き未保存';
  }

  /* =========================================================
     Field errors
     ========================================================= */

  function fieldIssues(field, options) {
    const index = selectedIndex();
    if (!validation || index < 0) return [];
    const conditionIndex = options && Object.prototype.hasOwnProperty.call(options, 'conditionIndex')
      ? options.conditionIndex
      : undefined;
    return (validation.byTitle[index] || []).filter(function (issue) {
      if (issue.field !== field) return false;
      if (conditionIndex !== undefined && issue.conditionIndex !== conditionIndex) return false;
      return issue.severity !== 'info';
    });
  }

  function hasFieldError(field) {
    return fieldIssues(field).some(function (issue) { return issue.severity === 'error'; });
  }

  function fieldErrorHtml(field, options) {
    return issueLines(fieldIssues(field, options));
  }

  function issueLines(issues) {
    return issues.map(function (issue) {
      const label = issue.severity === 'error' ? 'E' : issue.severity === 'warning' ? 'W' : 'I';
      return '<span class="issue-line is-' + issue.severity + '">' + label + ' ' + esc(issue.message) + '</span>';
    }).join('');
  }

  function refreshFieldErrors() {
    const fields = ['id', 'title', 'plateId', 'description', 'type', 'difficulty'];
    const controlIds = {
      id: 'field-id',
      title: 'field-title',
      plateId: 'field-plate',
      description: 'field-description',
      type: 'field-type',
      difficulty: 'field-difficulty',
    };
    fields.forEach(function (field) {
      const error = document.getElementById('error-' + field);
      if (error) error.innerHTML = fieldErrorHtml(field);
      const control = document.getElementById(controlIds[field]);
      if (control && (control.classList.contains('input') || control.classList.contains('select') || control.classList.contains('segmented'))) {
        control.classList.toggle('is-invalid', hasFieldError(field));
      }
    });
    const conditionsError = document.getElementById('error-conditions');
    if (conditionsError) conditionsError.innerHTML = fieldErrorHtml('conditions', { conditionIndex: null });
    const customPlate = document.getElementById('field-plate-custom');
    if (customPlate) customPlate.classList.toggle('is-invalid', hasFieldError('plateId'));
  }

  function updateCharCount() {
    const title = selectedTitle();
    if (!title) return;
    const idLength = document.getElementById('id-length');
    if (idLength) idLength.textContent = String(title.id || '').length;
    const descriptionCount = document.getElementById('description-count');
    if (descriptionCount) {
      const length = String(title.description || '').length;
      descriptionCount.textContent = length + ' / 200 文字';
      descriptionCount.classList.toggle('over', length > 200);
    }
  }

  function updateInlineSummary() {
    const title = selectedTitle();
    const element = document.getElementById('inline-summary');
    if (title && element) element.textContent = C.buildDescription(title, state.songTitle);
  }

  function updateFormHeadName() {
    const title = selectedTitle();
    const element = document.getElementById('editing-title');
    if (title && element) element.textContent = title.title || '（無題の称号）';
  }

  function updateTypeUi() {
    const title = selectedTitle();
    if (!title) return;
    document.querySelectorAll('[data-action="set-type"]').forEach(function (button) {
      const active = button.dataset.type === title.type;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const description = document.getElementById('type-description');
    if (description) {
      description.textContent = C.TYPE_META[title.type]
        ? C.TYPE_META[title.type].description
        : 'プレイ条件が不明です。4 つのいずれかを選択してください。';
    }
  }

  /* =========================================================
     Footer
     ========================================================= */

  function renderEditorFooter() {
    els.footer.innerHTML = '' +
      '<div class="footer-inner">' +
        '<div class="footer-stats">' +
          '<span>称号 <strong id="footer-count">0</strong> 件</span>' +
          '<span>E <strong id="footer-errors">0</strong></span>' +
          '<span>W <strong id="footer-warnings">0</strong></span>' +
          '<span id="footer-export">未出力</span>' +
        '</div>' +
        '<span class="footer-sep"></span>' +
        '<span id="footer-draft">下書き未保存</span>' +
        '<span class="footer-grow"></span>' +
        '<span class="footer-shortcuts"><span class="kbd">Ctrl</span> <span class="kbd">S</span> 書き出す　<span class="kbd">/</span> 検索</span>' +
      '</div>';
  }

  function refreshFooter() {
    if (state.view !== 'editor') return;
    const count = document.getElementById('footer-count');
    if (count) count.textContent = String(state.titles.length);
    if (validation) {
      const errors = document.getElementById('footer-errors');
      const warnings = document.getElementById('footer-warnings');
      if (errors) errors.textContent = String(validation.counts.errors);
      if (warnings) warnings.textContent = String(validation.counts.warnings);
    }
    const draft = document.getElementById('footer-draft');
    if (draft) draft.textContent = draftStatusText();
    const output = document.getElementById('footer-export');
    if (output) {
      const current = hashString(C.serializeTitles(state.titles));
      if (state.lastExportHash == null) output.textContent = '未出力';
      else if (state.lastExportHash === current) output.textContent = '出力済み';
      else output.textContent = '未出力の変更あり';
    }
  }

  /* =========================================================
     Draft storage
     ========================================================= */

  function readDraft() {
    let raw;
    try {
      raw = localStorage.getItem(DRAFT_KEY);
    } catch (error) {
      state.draftStorageState = 'unavailable';
      return null;
    }
    if (!raw) return null;

    try {
      const payload = JSON.parse(raw);
      if (!payload || payload.version !== 1 || !Array.isArray(payload.titles)) {
        localStorage.removeItem(DRAFT_KEY);
        return null;
      }
      return {
        version: 1,
        savedAt: Number(payload.savedAt) || 0,
        titles: payload.titles.map(normalizeStoredTitle),
        selectedUid: typeof payload.selectedUid === 'string' ? payload.selectedUid : null,
        songTitle: typeof payload.songTitle === 'string' ? payload.songTitle : '',
        idPrefix: typeof payload.idPrefix === 'string' ? payload.idPrefix : 'title',
      };
    } catch (error) {
      try { localStorage.removeItem(DRAFT_KEY); } catch (ignored) { /* ignore */ }
      return null;
    }
  }

  function normalizeStoredTitle(raw) {
    const description = raw && raw.description != null ? String(raw.description) : '';
    return C.createTitle({
      _uid: raw && raw._uid ? raw._uid : undefined,
      id: raw && raw.id != null ? String(raw.id) : '',
      title: raw && raw.title != null ? String(raw.title) : '',
      plateId: raw && raw.plateId != null ? String(raw.plateId) : '',
      description: description,
      descriptionAuto: raw && typeof raw.descriptionAuto === 'boolean' ? raw.descriptionAuto : !description,
      type: raw && raw.type ? String(raw.type) : 'Play',
      difficulty: raw && raw.difficulty != null ? raw.difficulty : -1,
      conditions: raw && Array.isArray(raw.conditions) ? raw.conditions.map(String) : [],
    });
  }

  function scheduleDraft() {
    if (state.view !== 'editor') return;
    if (state.draftStorageState === 'unavailable') {
      state.draftStatus = 'error';
      refreshHeaderMetrics();
      refreshFooter();
      return;
    }
    clearTimeout(draftTimer);
    state.draftStatus = 'saving';
    refreshHeaderMetrics();
    refreshFooter();
    draftTimer = setTimeout(writeDraft, 500);
  }

  function saveDraftNow() {
    clearTimeout(draftTimer);
    writeDraft();
  }

  function writeDraft() {
    if (state.view !== 'editor') return;
    if (state.draftStorageState === 'unavailable') return;
    if (state.titles.length === 0 && !state.songTitle) {
      try { localStorage.removeItem(DRAFT_KEY); } catch (error) { /* ignore */ }
      state.draftInfo = null;
      state.lastDraftAt = null;
      state.draftStatus = 'empty';
      refreshHeaderMetrics();
      refreshFooter();
      return;
    }

    const payload = {
      version: 1,
      savedAt: Date.now(),
      titles: deepClone(state.titles),
      selectedUid: state.selectedUid,
      songTitle: state.songTitle,
      idPrefix: state.idPrefix,
    };

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      state.draftStorageState = 'ok';
      state.draftInfo = payload;
      state.lastDraftAt = payload.savedAt;
      state.draftStatus = 'saved';
    } catch (error) {
      state.draftStorageState = 'unavailable';
      state.draftStatus = 'error';
      if (!state.draftErrorShown) {
        state.draftErrorShown = true;
        showToast('この環境では下書きの自動保存を利用できません。必要な内容は title.json として書き出してください。', 'warning');
      }
    }
    refreshHeaderMetrics();
    refreshFooter();
  }

  function removeDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (error) { /* ignore */ }
    state.draftInfo = null;
    state.lastDraftAt = null;
    state.draftStatus = 'empty';
  }

  function restoreDraft() {
    const payload = state.draftInfo;
    if (!payload || !Array.isArray(payload.titles)) {
      showToast('復元できる下書きがありません。', 'warning');
      return;
    }
    setProject(payload.titles, {
      songTitle: payload.songTitle,
      idPrefix: payload.idPrefix,
      selectedUid: payload.selectedUid,
    });
    state.lastDraftAt = payload.savedAt || Date.now();
    state.draftStatus = state.draftStorageState === 'unavailable' ? 'error' : 'saved';
    refreshHeaderMetrics();
    refreshFooter();
    showToast('下書きを復元しました。', 'success');
  }

  async function discardDraft() {
    const ok = await confirmDialog({
      kicker: 'DRAFT',
      title: '下書きを破棄しますか？',
      message: '保存済みの下書きを削除します。この操作は取り消せません。',
      confirmLabel: '破棄する',
    });
    if (!ok) return;
    removeDraft();
    renderHome();
    showToast('下書きを破棄しました。', 'success');
  }

  /* =========================================================
     Project lifecycle
     ========================================================= */

  function setProject(titles, options) {
    state.titles = (titles || []).map(function (title) {
      return C.createTitle({
        _uid: title._uid,
        id: title.id,
        title: title.title,
        plateId: title.plateId,
        description: title.description,
        descriptionAuto: typeof title.descriptionAuto === 'boolean' ? title.descriptionAuto : !title.description,
        type: title.type,
        difficulty: title.difficulty,
        conditions: Array.isArray(title.conditions) ? title.conditions.slice() : [],
      });
    });
    state.selectedUid = options && options.selectedUid && state.titles.some(function (title) { return title._uid === options.selectedUid; })
      ? options.selectedUid
      : (state.titles.length ? state.titles[0]._uid : null);
    state.songTitle = options && options.songTitle ? options.songTitle : '';
    state.idPrefix = options && options.idPrefix ? options.idPrefix : (C.inferIdPrefix(state.titles) || 'title');
    state.dirHandle = null;
    state.search = '';
    state.expandedConditions.clear();
    state.lastExportHash = null;
    state.draftStatus = 'empty';
    undoStack = [];
    redoStack = [];
    editSnapshot = null;
    editHistoryCommitted = false;
    enterEditor();
    scheduleDraft();
  }

  async function newProject() {
    const hasWork = state.titles.length > 0 || (state.draftInfo && state.draftInfo.titles && state.draftInfo.titles.length > 0);
    if (hasWork) {
      const ok = await confirmDialog({
        kicker: 'NEW PROJECT',
        title: '新規作成しますか？',
        message: '現在の編集内容と下書きを破棄して、空の称号リストから始めます。',
        confirmLabel: '新規作成',
      });
      if (!ok) return;
    }
    removeDraft();
    setProject([], {
      songTitle: '',
      idPrefix: 'title',
    });
    showToast('新規プロジェクトを作成しました。', 'success');
  }

  function goHome() {
    if (state.view === 'editor') saveDraftNow();
    state.view = 'home';
    state.showInspector = false;
    renderHome();
  }

  async function confirmReplaceIfNeeded(message) {
    const hasWork = state.titles.length > 0 || (state.draftInfo && state.draftInfo.titles && state.draftInfo.titles.length > 0);
    if (!hasWork) return true;
    return confirmDialog({
      kicker: 'REPLACE',
      title: '編集内容を置き換えますか？',
      message: message || '現在の編集内容と下書きを、読み込むデータで置き換えます。この操作は取り消せません。',
      confirmLabel: '置き換える',
    });
  }

  async function loadProjectFromJson(text, options) {
    const result = C.parseTitleJson(text);
    if (!result.ok) {
      openMessageModal({
        kicker: 'IMPORT ERROR',
        title: 'title.json を読み込めませんでした',
        tone: 'error',
        message: result.error.message,
        details: result.error.code ? ['コード: ' + result.error.code] : [],
      });
      return false;
    }

    if (!(await confirmReplaceIfNeeded('現在の編集内容と下書きを、読み込んだ title.json で置き換えます。'))) return false;

    const preserve = options && options.preserveContext;
    setProject(result.titles, {
      songTitle: preserve ? state.songTitle : '',
      idPrefix: preserve ? state.idPrefix : C.inferIdPrefix(result.titles),
    });
    showToast('title.json を読み込みました。', 'success');
    if (result.notes.length) showImportNotes(result.notes);
    return true;
  }

  async function handleJsonFile(file) {
    if (file.size > JSON_LIMIT) {
      openMessageModal({
        kicker: 'IMPORT ERROR',
        title: 'ファイルが大きすぎます',
        tone: 'error',
        message: 'title.json は 2MB 以内にしてください。',
        details: ['選択したファイル: ' + file.name + '（' + Math.ceil(file.size / 1024) + 'KB）'],
      });
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch (error) {
      showToast('ファイルを読み取れませんでした。', 'error');
      return;
    }
    await loadProjectFromJson(text, { preserveContext: state.view === 'editor' });
  }

  /* =========================================================
     Output
     ========================================================= */

  function openOutput() {
    syncAutoDescriptions();
    validation = C.validateAll(state.titles);
    const output = C.serializeTitles(state.titles);
    state.outputText = output;

    const counts = validation.counts;
    const errorBanner = counts.errors > 0
      ? '<div class="modal-error-banner"><span>' + icon('alert') + '</span><span><strong>エラーが ' + counts.errors + ' 件あります。</strong>エラーを修正するまで出力できません。</span></div>'
      : '';
    const warningBanner = counts.errors === 0 && counts.warnings > 0
      ? '<div class="modal-warning-banner"><span>' + icon('alert') + '</span><span><strong>警告が ' + counts.warnings + ' 件あります。</strong>内容を確認したうえで出力してください。</span></div>'
      : '';
    const okBanner = counts.errors === 0 && counts.warnings === 0
      ? '<div class="modal-info-banner"><span>' + icon('check') + '</span><span><strong>検証を通過しました。</strong>title.json をそのまま書き出せます。</span></div>'
      : '';
    const firstError = counts.errors > 0
      ? '<button type="button" class="btn btn-sm btn-ghost" data-action="goto-first-error">最初のエラーへ</button>'
      : '';
    const disabled = counts.errors > 0 ? ' disabled' : '';
    const folderLabel = state.dirHandle ? 'フォルダに上書き保存' : 'フォルダに保存';
    const canSaveFolder = typeof window.showDirectoryPicker === 'function';

    const body = '' +
      '<div class="output-counts">' + validationBadges() + firstError + '</div>' +
      errorBanner + warningBanner + okBanner +
      '<pre class="output-json"><code>' + highlightJson(output) + '</code></pre>' +
      '<p class="output-meta"><span>UTF-8 / BOM なし</span><span>LF</span><span>2 スペース</span><span>title.json</span></p>';

    const foot = '' +
      '<button type="button" class="btn btn-ghost" data-action="close-modal">閉じる</button>' +
      '<span class="spacer"></span>' +
      '<button type="button" class="btn" data-action="copy-output"' + disabled + '>' + icon('copy', true) + 'コピー</button>' +
      '<button type="button" class="btn" data-action="download-output"' + disabled + '>' + icon('download', true) + 'ダウンロード</button>' +
      (canSaveFolder ? '<button type="button" class="btn btn-primary" data-action="save-folder-output"' + disabled + '>' + icon('folder', true) + esc(folderLabel) + '</button>' : '');

    openModal({
      kicker: 'EXPORT',
      title: 'title.json を書き出す',
      body: body,
      foot: foot,
      className: 'modal-wide',
      initialFocus: '.modal-foot .btn-ghost',
    });
  }

  function gotoFirstError() {
    if (!validation || validation.errors.length === 0) return;
    const issue = validation.errors[0];
    closeModal();
    focusIssue(issue);
  }

  async function copyOutput() {
    if (!state.outputText) return;
    const ok = await copyText(state.outputText);
    if (ok) {
      state.lastExportHash = hashString(state.outputText);
      refreshFooter();
      showToast('title.json をクリップボードにコピーしました。', 'success');
    } else {
      showToast('コピーできませんでした。ダウンロードを使用してください。', 'error');
    }
  }

  function downloadOutput() {
    if (!state.outputText) return;
    downloadText(state.outputText, 'title.json');
    state.lastExportHash = hashString(state.outputText);
    refreshFooter();
    showToast('title.json をダウンロードしました。', 'success');
  }

  async function saveFolderOutput() {
    if (!state.outputText) return;
    const saved = await saveToFolder(state.outputText);
    if (saved) {
      state.lastExportHash = hashString(state.outputText);
      refreshFooter();
      showToast('title.json をフォルダに保存しました。', 'success');
    }
  }

  async function saveToFolder(text) {
    let handle = state.dirHandle;
    if (!handle) {
      if (typeof window.showDirectoryPicker !== 'function') {
        showToast('このブラウザはフォルダへの直接保存に対応していません。ダウンロードを使用してください。', 'warning');
        return false;
      }
      try {
        handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        state.dirHandle = handle;
      } catch (error) {
        if (error && error.name === 'AbortError') return false;
        showToast('保存先のフォルダを開けませんでした。', 'error');
        return false;
      }
    }
    try {
      const fileHandle = await handle.getFileHandle('title.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
      return true;
    } catch (error) {
      showToast('title.json を保存できませんでした。', 'error');
      return false;
    }
  }

  /* =========================================================
     Actions
     ========================================================= */

  async function handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (!action) return;
    event.preventDefault();

    switch (action) {
      case 'go-home':
        goHome();
        return;
      case 'new-project':
        await newProject();
        return;
      case 'open-json-file':
        els.jsonInput.value = '';
        els.jsonInput.click();
        return;
      case 'open-paste':
        openPasteModal();
        return;
      case 'open-help':
        openHelpModal();
        return;
      case 'open-templates':
        openTemplatesModal();
        return;
      case 'restore-draft':
        restoreDraft();
        return;
      case 'discard-draft':
        await discardDraft();
        return;
      case 'add-title':
        addTitle();
        return;
      case 'add-template':
        addTemplate(Number(target.dataset.templateIndex));
        return;
      case 'select-title':
        selectTitle(target.dataset.uid);
        return;
      case 'duplicate-title':
        duplicateSelected();
        return;
      case 'delete-title':
        await deleteSelected();
        return;
      case 'move-up':
        moveSelected(-1);
        return;
      case 'move-down':
        moveSelected(1);
        return;
      case 'set-type':
        setType(target.dataset.type);
        return;
      case 'add-condition':
        addCondition();
        return;
      case 'remove-condition':
        removeCondition(Number(target.dataset.conditionIndex));
        return;
      case 'toggle-condition-raw':
        toggleConditionRaw(Number(target.dataset.conditionIndex));
        return;
      case 'apply-condition-raw':
        applyConditionRaw(Number(target.dataset.conditionIndex));
        return;
      case 'show-checks':
        showChecksPanel();
        return;
      case 'toggle-inspector':
        toggleInspector();
        return;
      case 'open-output':
        openOutput();
        return;
      case 'copy-output':
        await copyOutput();
        return;
      case 'download-output':
        downloadOutput();
        return;
      case 'save-folder-output':
        await saveFolderOutput();
        return;
      case 'goto-first-error':
        gotoFirstError();
        return;
      case 'focus-issue':
        closeModal();
        focusIssue({
          uid: target.dataset.uid || null,
          field: target.dataset.field || null,
          conditionIndex: target.dataset.conditionIndex === '' ? null : Number(target.dataset.conditionIndex),
        });
        return;
      case 'close-modal':
        closeModal();
        return;
      case 'confirm-yes':
        resolveConfirm(true);
        return;
      case 'confirm-no':
        resolveConfirm(false);
        return;
      case 'scroll-help':
        scrollHelp(target.dataset.target);
        return;
      case 'import-paste':
        await importPaste();
        return;
      default:
        return;
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (!target) return;

    if (target.id === 'title-search') {
      state.search = target.value;
      renderList();
      return;
    }

    if (state.view !== 'editor') return;

    if (target.id === 'song-title') {
      commitEditHistory();
      state.songTitle = target.value;
      refreshAfterEdit();
      return;
    }

    if (target.dataset && target.dataset.field) {
      const field = target.dataset.field;
      if (field === 'id' || field === 'title' || field === 'plateId' || field === 'description') {
        const title = selectedTitle();
        if (!title) return;
        commitEditHistory();
        title[field] = target.value;
        if (field === 'description') title.descriptionAuto = false;
        refreshAfterEdit();
        return;
      }
      if (field === 'plateId-custom') {
        const title = selectedTitle();
        if (!title) return;
        commitEditHistory();
        title.plateId = target.value;
        refreshAfterEdit();
        return;
      }
    }

    if (target.dataset && target.dataset.conditionPart === 'value' && target.tagName === 'INPUT') {
      commitEditHistory();
      updateConditionValue(Number(target.dataset.conditionIndex), target.value);
      return;
    }

    if (target.dataset && target.dataset.conditionPart === 'raw') {
      commitEditHistory();
      updateConditionRaw(Number(target.dataset.conditionIndex), target.value);
      return;
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (!target) return;

    if (state.view !== 'editor') return;

    if (target.dataset && target.dataset.field === 'difficulty') {
      if (target.value === '__invalid') return;
      const title = selectedTitle();
      if (!title) return;
      pushUndo(makeSnapshot());
      editSnapshot = null;
      title.difficulty = Number(target.value);
      refreshAfterEdit();
      return;
    }

    if (target.dataset && target.dataset.field === 'plateId') {
      const title = selectedTitle();
      if (!title) return;
      pushUndo(makeSnapshot());
      editSnapshot = null;
      title.plateId = target.value === '__custom' ? 'custom' : target.value;
      renderForm();
      refreshAfterEdit();
      const next = document.getElementById(target.value === '__custom' ? 'field-plate-custom' : 'field-plate');
      if (next) next.focus();
      return;
    }

    if (target.matches && target.matches('[data-description-auto]')) {
      const title = selectedTitle();
      if (!title) return;
      pushUndo(makeSnapshot());
      editSnapshot = null;
      title.descriptionAuto = target.checked;
      if (title.descriptionAuto) title.description = C.buildDescription(title, state.songTitle);
      updateDescriptionField();
      refreshAfterEdit();
      return;
    }

    if (target.dataset && target.dataset.conditionPart) {
      const part = target.dataset.conditionPart;
      if (target.tagName === 'SELECT' && (part === 'prop' || part === 'op' || part === 'value')) {
        pushUndo(makeSnapshot());
        editSnapshot = null;
        applyConditionBuilder(Number(target.dataset.conditionIndex), part, target.value);
      }
    }
  }

  function handleFocusIn(event) {
    const target = event.target;
    if (state.view !== 'editor') return;
    if (!target || !target.matches) return;
    if (target.matches('#form-inner input, #form-inner textarea, #song-title')) {
      editSnapshot = makeSnapshot();
      editHistoryCommitted = false;
    }
  }

  function handleKeydown(event) {
    if (!els.modalRoot.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key === 'Tab') {
        trapFocus(event);
      }
      return;
    }

    const target = event.target;
    const isTextInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
    const mod = event.ctrlKey || event.metaKey;

    if (mod && event.key.toLowerCase() === 's') {
      if (state.view === 'editor') {
        event.preventDefault();
        openOutput();
      }
      return;
    }

    if (mod && !isTextInput && state.view === 'editor' && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }

    if (mod && !isTextInput && state.view === 'editor' && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }

    if (!isTextInput && event.key === '/' && state.view === 'editor') {
      event.preventDefault();
      const search = document.getElementById('title-search');
      if (search) search.focus();
      return;
    }

    if (!isTextInput && (event.key === 'Delete' || event.key === 'Backspace') && state.view === 'editor') {
      event.preventDefault();
      deleteSelected();
      return;
    }

    if (event.key === 'Escape' && target && target.id === 'title-search' && target.value) {
      target.value = '';
      state.search = '';
      renderList();
    }
  }

  /* =========================================================
     Title mutations
     ========================================================= */

  function selectTitle(uid) {
    if (!uid || uid === state.selectedUid) return;
    state.selectedUid = uid;
    editSnapshot = null;
    renderList();
    renderForm();
    renderInspector();
    refreshFooter();
    scheduleDraft();
  }

  function addTitle() {
    pushUndo(makeSnapshot());
    editSnapshot = null;
    const title = C.createTitle({
      id: C.nextId(allIds(), state.idPrefix || 'title'),
      type: 'Play',
      difficulty: -1,
      conditions: [],
      descriptionAuto: true,
    });
    title.description = C.buildDescription(title, state.songTitle);
    state.titles.push(title);
    state.selectedUid = title._uid;
    state.search = '';
    const search = document.getElementById('title-search');
    if (search) search.value = '';
    renderAll();
    scheduleDraft();
    const input = document.getElementById('field-title');
    if (input) input.focus();
  }

  function addTemplate(index) {
    const template = C.TEMPLATES[index];
    if (!template || !Array.isArray(template.items)) return;
    closeModal();
    pushUndo(makeSnapshot());
    editSnapshot = null;

    const usedIds = allIds();
    const added = [];
    template.items.forEach(function (item) {
      const id = C.nextId(usedIds, state.idPrefix || 'title');
      usedIds.push(id);
      const displayTitle = template.useSongTitle
        ? (state.songTitle.trim() || '曲名未設定')
        : item.title;
      const title = C.createTitle({
        id: id,
        title: displayTitle,
        plateId: item.plateId,
        type: item.type,
        difficulty: item.difficulty,
        conditions: Array.isArray(item.conditions) ? item.conditions.slice() : [],
        descriptionAuto: true,
      });
      title.description = C.buildDescription(title, state.songTitle);
      state.titles.push(title);
      added.push(title);
    });

    if (added.length === 0) return;
    state.selectedUid = added[0]._uid;
    state.search = '';
    const search = document.getElementById('title-search');
    if (search) search.value = '';
    renderAll();
    scheduleDraft();
    showToast('テンプレート「' + template.name + '」から ' + added.length + ' 件追加しました。', 'success');
    const input = document.getElementById('field-title');
    if (input) input.focus();
  }

  function duplicateSelected() {
    const title = selectedTitle();
    if (!title) return;
    pushUndo(makeSnapshot());
    editSnapshot = null;
    const index = selectedIndex();
    const copy = C.createTitle({
      id: C.nextCopyId(title.id, allIds()),
      title: title.title ? title.title + 'のコピー' : '称号のコピー',
      plateId: title.plateId,
      description: title.description,
      type: title.type,
      difficulty: title.difficulty,
      conditions: title.conditions.slice(),
      descriptionAuto: title.descriptionAuto,
    });
    copy.descriptionAuto = title.descriptionAuto !== false;
    if (copy.descriptionAuto) copy.description = C.buildDescription(copy, state.songTitle);
    state.titles.splice(index + 1, 0, copy);
    state.selectedUid = copy._uid;
    renderAll();
    scheduleDraft();
    showToast('称号を複製しました。', 'success');
    const input = document.getElementById('field-title');
    if (input) input.focus();
  }

  async function deleteSelected() {
    const title = selectedTitle();
    if (!title) return;
    const ok = await confirmDialog({
      kicker: 'DELETE',
      title: '称号を削除しますか？',
      message: '「' + (title.title || '（無題の称号）') + '」を削除します。この操作は取り消せません。',
      confirmLabel: '削除する',
    });
    if (!ok) return;
    pushUndo(makeSnapshot());
    editSnapshot = null;
    const index = selectedIndex();
    state.titles.splice(index, 1);
    if (state.titles.length) {
      const next = state.titles[Math.min(index, state.titles.length - 1)];
      state.selectedUid = next._uid;
    } else {
      state.selectedUid = null;
    }
    renderAll();
    scheduleDraft();
    showToast('称号を削除しました。', 'success');
  }

  function moveSelected(direction) {
    const index = selectedIndex();
    const next = index + direction;
    if (index < 0 || next < 0 || next >= state.titles.length) return;
    pushUndo(makeSnapshot());
    editSnapshot = null;
    const item = state.titles[index];
    state.titles[index] = state.titles[next];
    state.titles[next] = item;
    renderAll();
    scheduleDraft();
  }

  function setType(type) {
    const title = selectedTitle();
    if (!title || !C.TYPES.includes(type)) return;
    pushUndo(makeSnapshot());
    editSnapshot = null;
    title.type = type;
    updateTypeUi();
    refreshAfterEdit();
  }

  function addCondition() {
    const title = selectedTitle();
    if (!title) return;
    pushUndo(makeSnapshot());
    editSnapshot = null;
    title.conditions.push('ScrollSpeed>=2.0');
    renderConditions({ focusIndex: title.conditions.length - 1, focusPart: 'prop' });
    refreshAfterEdit();
  }

  function removeCondition(index) {
    const title = selectedTitle();
    if (!title || index < 0 || index >= title.conditions.length) return;
    pushUndo(makeSnapshot());
    editSnapshot = null;
    title.conditions.splice(index, 1);
    state.expandedConditions.clear();
    renderConditions();
    refreshAfterEdit();
  }

  /* =========================================================
     History
     ========================================================= */

  function makeSnapshot() {
    return {
      titles: deepClone(state.titles),
      selectedUid: state.selectedUid,
      songTitle: state.songTitle,
      idPrefix: state.idPrefix,
    };
  }

  function pushUndo(snapshot) {
    undoStack.push(snapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    editHistoryCommitted = false;
  }

  function commitEditHistory() {
    if (editHistoryCommitted) return;
    if (!editSnapshot) editSnapshot = makeSnapshot();
    undoStack.push(editSnapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    editHistoryCommitted = true;
  }

  function restoreSnapshot(snapshot) {
    state.titles = deepClone(snapshot.titles);
    state.selectedUid = state.titles.some(function (title) { return title._uid === snapshot.selectedUid; })
      ? snapshot.selectedUid
      : (state.titles[0] ? state.titles[0]._uid : null);
    state.songTitle = snapshot.songTitle || '';
    state.idPrefix = snapshot.idPrefix || 'title';
    state.expandedConditions.clear();
    editSnapshot = null;
    editHistoryCommitted = false;
    renderAll();
    scheduleDraft();
  }

  function undo() {
    if (undoStack.length === 0) {
      showToast('これ以上元に戻せません。', 'normal');
      return;
    }
    const current = makeSnapshot();
    const previous = undoStack.pop();
    redoStack.push(current);
    restoreSnapshot(previous);
  }

  function redo() {
    if (redoStack.length === 0) {
      showToast('これ以上やり直せません。', 'normal');
      return;
    }
    const current = makeSnapshot();
    const next = redoStack.pop();
    undoStack.push(current);
    restoreSnapshot(next);
  }

  /* =========================================================
     Inspector actions
     ========================================================= */

  function showChecksPanel() {
    state.showInspector = true;
    updateInspectorLayout();
    renderInspector();
  }

  function toggleInspector() {
    state.showInspector = !state.showInspector;
    updateInspectorLayout();
    renderInspector();
  }

  function updateInspectorLayout() {
    const layout = document.getElementById('editor-layout');
    if (layout) layout.classList.toggle('show-inspector', state.showInspector);
    const button = document.querySelector('.inspector-toggle');
    if (button) button.textContent = state.showInspector ? '編集に戻る' : '検証';
  }

  function focusIssue(issue) {
    if (!issue) return;
    if (issue.uid) {
      const exists = state.titles.some(function (title) { return title._uid === issue.uid; });
      if (exists && state.selectedUid !== issue.uid) {
        state.selectedUid = issue.uid;
        renderList();
        renderForm();
        renderInspector();
        refreshFooter();
      }
    }

    requestAnimationFrame(function () {
      if (issue.field === 'conditions') {
        const title = selectedTitle();
        if (title && Number.isInteger(issue.conditionIndex)) {
          const key = title._uid + ':' + issue.conditionIndex;
          state.expandedConditions.add(key);
          renderConditions({ focusIndex: issue.conditionIndex, focusPart: 'raw' });
          const row = document.querySelector('.condition-row[data-condition-index="' + issue.conditionIndex + '"]');
          const raw = row && row.querySelector('[data-condition-part="raw"]');
          if (raw) raw.focus();
          else row && row.scrollIntoView({ block: 'center' });
        } else {
          const add = document.querySelector('[data-action="add-condition"]');
          if (add) add.focus();
        }
        return;
      }

      if (issue.field === 'type') {
        const segment = document.querySelector('[data-action="set-type"]');
        if (segment) segment.focus();
        return;
      }

      const idMap = {
        id: 'field-id',
        title: 'field-title',
        plateId: 'field-plate',
        description: 'field-description',
        difficulty: 'field-difficulty',
      };
      const element = document.getElementById(idMap[issue.field] || '');
      if (element) {
        element.focus();
        element.scrollIntoView({ block: 'center' });
      } else {
        const form = document.getElementById('form-head');
        if (form) form.scrollIntoView({ block: 'start' });
      }
    });
  }

  /* =========================================================
     Modals
     ========================================================= */

  function openModal(options) {
    if (!els.modalRoot.hidden) {
      if (pendingConfirm) {
        const pending = pendingConfirm;
        pendingConfirm = null;
        pending(false);
      }
      els.modalRoot.innerHTML = '';
    } else {
      modalReturnFocus = document.activeElement;
    }

    modalOnClose = options.onClose || null;
    els.modalRoot.innerHTML = '' +
      '<button type="button" class="modal-backdrop" tabindex="-1" data-action="close-modal" aria-label="閉じる"></button>' +
      '<section class="modal' + (options.className ? ' ' + options.className : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<header class="modal-head">' +
          '<div class="modal-head-copy">' +
            '<span class="modal-kicker">' + esc(options.kicker || 'DIALOG') + '</span>' +
            '<h2 class="modal-title" id="modal-title">' + esc(options.title || '') + '</h2>' +
          '</div>' +
          '<button type="button" class="btn btn-icon btn-ghost modal-close" data-action="close-modal" aria-label="閉じる">' + icon('x') + '</button>' +
        '</header>' +
        '<div class="modal-body">' + options.body + '</div>' +
        '<footer class="modal-foot">' + options.foot + '</footer>' +
      '</section>';
    els.modalRoot.hidden = false;
    document.body.classList.add('modal-open');

    requestAnimationFrame(function () {
      const selector = options.initialFocus || '[data-autofocus], .modal-body input, .modal-body select, .modal-body textarea, .modal-body button, .modal-foot .btn-primary, .modal-close';
      const focusTarget = els.modalRoot.querySelector(selector);
      if (focusTarget) focusTarget.focus();
    });
  }

  function closeModal() {
    if (els.modalRoot.hidden) return;
    if (pendingConfirm) {
      const pending = pendingConfirm;
      pendingConfirm = null;
      pending(false);
    }
    els.modalRoot.hidden = true;
    els.modalRoot.innerHTML = '';
    document.body.classList.remove('modal-open');
    const callback = modalOnClose;
    modalOnClose = null;
    if (callback) callback();
    if (modalReturnFocus && modalReturnFocus.isConnected) {
      modalReturnFocus.focus();
    }
    modalReturnFocus = null;
  }

  function trapFocus(event) {
    const modal = els.modalRoot.querySelector('.modal');
    if (!modal) return;
    const focusables = Array.from(modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function confirmDialog(options) {
    return new Promise(function (resolve) {
      pendingConfirm = resolve;
      openModal({
        kicker: options.kicker || 'CONFIRM',
        title: options.title || '確認',
        body: '<p class="modal-note">' + esc(options.message || '') + '</p>',
        foot: '' +
          '<button type="button" class="btn btn-ghost" data-action="confirm-no">キャンセル</button>' +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn btn-primary" data-action="confirm-yes">' + esc(options.confirmLabel || '実行する') + '</button>',
        className: 'modal-narrow',
        initialFocus: '[data-action="confirm-no"]',
      });
    });
  }

  function resolveConfirm(value) {
    const pending = pendingConfirm;
    pendingConfirm = null;
    closeModal();
    if (pending) pending(value);
  }

  function openMessageModal(options) {
    const tone = options.tone || 'info';
    const bannerClass = tone === 'error' ? 'modal-error-banner' : tone === 'warning' ? 'modal-warning-banner' : 'modal-info-banner';
    const iconName = tone === 'error' ? 'alert' : tone === 'warning' ? 'alert' : 'info';
    const details = (options.details || []).map(function (detail) {
      return '<li>' + esc(detail) + '</li>';
    }).join('');
    openModal({
      kicker: options.kicker || 'NOTICE',
      title: options.title || 'お知らせ',
      body: '' +
        '<div class="' + bannerClass + '"><span>' + icon(iconName) + '</span><span><strong>' + esc(options.title || '') + '</strong>' + (options.message ? esc(options.message) : '') + '</span></div>' +
        (details ? '<ul class="notes-list" style="margin-top:12px">' + details + '</ul>' : ''),
      foot: '<button type="button" class="btn btn-primary" data-action="close-modal">閉じる</button>',
      className: 'modal-narrow',
    });
  }

  function showImportNotes(notes) {
    const items = notes.map(function (note) {
      return '<li><span class="note-code">' + esc(note.code) + '</span>' + esc(note.message) + '</li>';
    }).join('');
    openModal({
      kicker: 'IMPORT NOTES',
      title: '読み込み時に補正しました',
      body: '' +
        '<p class="modal-note">ゲームで読み込める形に正規化した項目です。内容を確認してから編集を続けてください。</p>' +
        '<ul class="notes-list" style="margin-top:12px">' + items + '</ul>',
      foot: '<button type="button" class="btn btn-primary" data-action="close-modal">編集を開始</button>',
      className: 'modal-narrow',
    });
  }

  function openPasteModal() {
    openModal({
      kicker: 'PASTE',
      title: 'JSON を貼り付けて読み込む',
      body: '' +
        '<p class="modal-note">title.json の内容をそのまま貼り付けてください。読み込み時に構文と構造を検証します。</p>' +
        '<textarea class="paste-area" id="paste-textarea" spellcheck="false" placeholder="[&#10;  {&#10;    &quot;Id&quot;: &quot;song_001&quot;,&#10;    &quot;Title&quot;: &quot;初見プレイヤー&quot;&#10;  }&#10;]" data-autofocus></textarea>',
      foot: '' +
        '<button type="button" class="btn btn-ghost" data-action="close-modal">キャンセル</button>' +
        '<span class="spacer"></span>' +
        '<button type="button" class="btn btn-primary" data-action="import-paste">読み込む</button>',
      className: 'modal-narrow',
    });
  }

  async function importPaste() {
    const textarea = document.getElementById('paste-textarea');
    const text = textarea ? textarea.value : '';
    if (!text.trim()) {
      showToast('JSON が入力されていません。', 'warning');
      return;
    }
    closeModal();
    await loadProjectFromJson(text, { preserveContext: state.view === 'editor' });
  }

  function openTemplatesModal() {
    const cards = C.TEMPLATES.map(function (template, index) {
      const templateTitle = template.useSongTitle
        ? (state.songTitle.trim() || '曲名未設定')
        : '';
      const items = (template.items || []).map(function (item) {
        const itemTitle = template.useSongTitle ? templateTitle : item.title;
        return '<span>' + esc(itemTitle) + ' <span class="type-chip">' + esc(typeCode(item.type)) + '</span> ' +
          esc(C.difficultyLabel(item.difficulty)) + ' / プレート ' + esc(item.plateId) + '</span>';
      }).join('');
      return '' +
        '<button type="button" class="template-card" data-action="add-template" data-template-index="' + index + '">' +
          '<strong>' + esc(template.name) + '</strong>' +
          '<span class="template-meta">' + (template.items || []).length + ' 件を追加</span>' +
          '<span class="template-items">' + items + '</span>' +
        '</button>';
    }).join('');

    openModal({
      kicker: 'TEMPLATES',
      title: 'テンプレートから追加',
      body: '<p class="modal-note">定型の称号をまとめて追加します。追加後に自由に編集できます。</p><div class="template-grid" style="margin-top:14px">' + cards + '</div>',
      foot: '<button type="button" class="btn btn-ghost" data-action="close-modal">閉じる</button>',
      className: 'modal-wide',
      initialFocus: '.template-card',
    });
  }

  function openHelpModal() {
    openModal({
      kicker: 'REFERENCE',
      title: '仕様と注意',
      body: helpMarkup(),
      foot: '<button type="button" class="btn btn-ghost" data-action="close-modal">閉じる</button>',
      className: 'modal-wide',
    });
  }

  function helpMarkup() {
    return '' +
      '<div class="help-nav">' +
        '<button type="button" data-action="scroll-help" data-target="help-basic">基本</button>' +
        '<button type="button" data-action="scroll-help" data-target="help-types">プレイ条件</button>' +
        '<button type="button" data-action="scroll-help" data-target="help-difficulty">難易度</button>' +
        '<button type="button" data-action="scroll-help" data-target="help-options">オプション条件</button>' +
        '<button type="button" data-action="scroll-help" data-target="help-pitfalls">よくある失敗</button>' +
        '<button type="button" data-action="scroll-help" data-target="help-keys">ショートカット</button>' +
      '</div>' +
      '<section class="help-section" id="help-basic">' +
        '<h3>基本</h3>' +
        '<p>title.json は曲のフォルダに置く称号定義ファイルです。ルートは称号オブジェクトの配列で、空配列も許容されます。</p>' +
        '<ul>' +
          '<li>称号ID は全曲を通じて一意にしてください。空文字や重複は出力エラーになります。</li>' +
          '<li>プレイ条件は文字列で出力されます。数値や大文字小文字の違いは読み込み時に正規化します。</li>' +
          '<li>Condition と OptionConditions は null にできません。空配列は条件なしとして扱います。</li>' +
          '<li>出力は UTF-8（BOM なし）、LF、2 スペース、末尾改行 1 つです。</li>' +
        '</ul>' +
        '<p>説明は「自動」をオンにすると、曲名・難易度・プレイ条件・オプション条件から生成されます。手動で編集する場合は「自動」をオフにしてください。</p>' +
      '</section>' +
      '<section class="help-section" id="help-types">' +
        '<h3>プレイ条件</h3>' +
        '<table class="help-table"><thead><tr><th>プレイ条件</th><th>意味</th><th>補足</th></tr></thead><tbody>' +
          '<tr><td><code>Play</code></td><td>プレイする</td><td>クリア不要。オプション条件だけを問う。</td></tr>' +
          '<tr><td><code>Clear</code></td><td>クリアする</td><td>ゲージ状態がクリア以上。</td></tr>' +
          '<tr><td><code>FullCombo</code></td><td>フルコンボする</td><td>不可・Miss が 0。可（OK）は許容。</td></tr>' +
          '<tr><td><code>DonderfulCombo</code></td><td>ドンダフルコンボする</td><td>不可・Miss・可がすべて 0。</td></tr>' +
        '</tbody></table>' +
      '</section>' +
      '<section class="help-section" id="help-difficulty">' +
        '<h3>難易度</h3>' +
        '<table class="help-table"><thead><tr><th>値</th><th>表示</th></tr></thead><tbody>' +
          C.DIFFICULTIES.map(function (difficulty) {
            return '<tr><td><code>' + difficulty.value + '</code></td><td>' + esc(difficulty.label) + '</td></tr>';
          }).join('') +
        '</tbody></table>' +
      '</section>' +
      '<section class="help-section" id="help-options">' +
        '<h3>オプション条件</h3>' +
        '<p>式は <code>プロパティ 演算子 値</code> の形で記述します。プロパティ名は大文字小文字を区別します。</p>' +
        '<table class="help-table"><thead><tr><th>プロパティ</th><th>演算子</th><th>値</th></tr></thead><tbody>' +
          '<tr><td><code>ScrollSpeed</code></td><td><code>&gt;= &lt;= != = &gt; &lt;</code></td><td>0.5〜4.0（設定可能値は 0.5〜2.0 の 0.1 刻み、2.5、3.0、3.5、4.0）</td></tr>' +
          '<tr><td><code>Swap</code></td><td><code>= !=</code></td><td><code>true</code> / <code>false</code></td></tr>' +
          '<tr><td><code>Doron</code></td><td><code>= !=</code></td><td><code>0</code> なし / <code>1</code> ドロン / <code>2</code> ステルス</td></tr>' +
          '<tr><td><code>Random</code></td><td><code>= !=</code></td><td><code>0</code> なし / <code>1</code> きまぐれ / <code>2</code> でたらめ</td></tr>' +
        '</tbody></table>' +
        '<pre class="help-code">ScrollSpeed&gt;=2.0\nSwap=true\nDoron=1\nRandom!=0</pre>' +
        '<p><code>Doron&gt;=1</code> のような範囲比較は実装上つねに不成立になります。ツールはエラーとして扱います。</p>' +
      '</section>' +
      '<section class="help-section" id="help-pitfalls">' +
        '<h3>よくある失敗</h3>' +
        '<ul>' +
          '<li>称号ID が空、または別の曲と同じ称号ID になっている。</li>' +
          '<li>プレイ条件の綴りが違う。ファイル全体の読み込みエラーになります。</li>' +
          '<li>Condition や OptionConditions を null にしている。</li>' +
          '<li>Doron / Random に &gt;= や &lt; を使っている。</li>' +
          '<li>ScrollSpeed=2.3 のように、設定できない値との一致を書いている。</li>' +
        '</ul>' +
      '</section>' +
      '<section class="help-section" id="help-keys">' +
        '<h3>ショートカット</h3>' +
        '<ul>' +
          '<li><span class="kbd">Ctrl</span> + <span class="kbd">S</span> : 書き出しモーダルを開く</li>' +
          '<li><span class="kbd">Ctrl</span> + <span class="kbd">Z</span> : 元に戻す（入力欄の外）</li>' +
          '<li><span class="kbd">Ctrl</span> + <span class="kbd">Shift</span> + <span class="kbd">Z</span> / <span class="kbd">Ctrl</span> + <span class="kbd">Y</span> : やり直す</li>' +
          '<li><span class="kbd">/</span> : 称号検索へフォーカス</li>' +
          '<li><span class="kbd">Delete</span> : 選択中の称号を削除（入力欄の外）</li>' +
        '</ul>' +
      '</section>';
  }

  function scrollHelp(targetId) {
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* =========================================================
     Drag and drop
     ========================================================= */

  function hasFileDrag(event) {
    const types = event.dataTransfer && event.dataTransfer.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }

  function handleWindowDragEnter(event) {
    if (!hasFileDrag(event) || !els.modalRoot.hidden) return;
    event.preventDefault();
    dragDepth += 1;
    els.dropOverlay.hidden = false;
  }

  function handleWindowDragLeave(event) {
    if (!hasFileDrag(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) els.dropOverlay.hidden = true;
  }

  async function handleWindowDrop(event) {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    dragDepth = 0;
    els.dropOverlay.hidden = true;
    if (!els.modalRoot.hidden) return;

    const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
    const jsonFile = files.find(function (file) { return /\.json$/i.test(file.name); });
    if (jsonFile) {
      await handleJsonFile(jsonFile);
      return;
    }
    showToast('title.json をドロップしてください。', 'warning');
  }

  function handleDragStart(event) {
    const item = event.target.closest && event.target.closest('.title-item');
    if (!item || !item.dataset.uid) return;
    dragUid = item.dataset.uid;
    item.classList.add('is-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      try { event.dataTransfer.setData('text/plain', dragUid); } catch (error) { /* ignore */ }
    }
  }

  function handleDragOver(event) {
    if (!dragUid) return;
    const item = event.target.closest && event.target.closest('.title-item');
    if (!item) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (dragOverUid !== item.dataset.uid) {
      dragOverUid = item.dataset.uid;
      document.querySelectorAll('.title-item.is-drop-target').forEach(function (element) {
        element.classList.remove('is-drop-target');
      });
      item.classList.add('is-drop-target');
    }
  }

  function handleListDrop(event) {
    if (!dragUid) return;
    const item = event.target.closest && event.target.closest('.title-item');
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    const toUid = item.dataset.uid;
    const from = state.titles.findIndex(function (title) { return title._uid === dragUid; });
    const to = state.titles.findIndex(function (title) { return title._uid === toUid; });
    if (from >= 0 && to >= 0 && from !== to) {
      pushUndo(makeSnapshot());
      editSnapshot = null;
      const moved = state.titles.splice(from, 1)[0];
      state.titles.splice(to, 0, moved);
      state.selectedUid = moved._uid;
      renderAll();
      scheduleDraft();
    }
    cleanupDrag();
  }

  function handleDragEnd() {
    cleanupDrag();
  }

  function cleanupDrag() {
    dragUid = null;
    dragOverUid = null;
    document.querySelectorAll('.title-item.is-dragging, .title-item.is-drop-target').forEach(function (element) {
      element.classList.remove('is-dragging', 'is-drop-target');
    });
  }

  /* =========================================================
     Utility I/O
     ========================================================= */

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      /* fallback below */
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch (error) {
      return false;
    }
  }

  function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function showToast(message, tone) {
    if (!els.toastRoot) return;
    const type = tone || 'normal';
    const iconName = type === 'error' ? 'alert' : type === 'warning' ? 'alert' : type === 'success' ? 'check' : 'info';
    const element = document.createElement('div');
    element.className = 'toast' + (type === 'error' ? ' is-error' : type === 'warning' ? ' is-warning' : type === 'success' ? ' is-success' : '');
    element.innerHTML = icon(iconName, true) + '<span>' + esc(message) + '</span>';
    els.toastRoot.appendChild(element);
    while (els.toastRoot.children.length > 3) els.toastRoot.removeChild(els.toastRoot.firstChild);
    setTimeout(function () {
      if (element.parentNode) element.parentNode.removeChild(element);
    }, 4200);
  }

  /* =========================================================
     Start
     ========================================================= */

  init();
})();
