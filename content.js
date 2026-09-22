(() => {
  'use strict';

  if (globalThis.__ZCT_LOADED__) return;
  globalThis.__ZCT_LOADED__ = true;

  const MAX_TEXT_LENGTH = 800;
  const POPUP_GAP = 8;
  const VIEWPORT_PADDING = 8;
  const MISS_HIDE_MS = 2500;
  const POPUP_ID = 'zct-popup';
  const INSTANCE_ATTR = 'data-zct-instance';
  const LOG = '[划词即翻译]';
  const instanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  document.documentElement.setAttribute(INSTANCE_ATTR, instanceId);

  let requestSeq = 0;
  let popupEl = null;
  let missTimer = 0;
  let lastSelectEndAt = 0;
  let langA = globalThis.ZCT_DEFAULT_LANG_A || 'zh-CN';
  let langB = globalThis.ZCT_DEFAULT_LANG_B || 'en';
  let enabled = false;
  let settingsReady = false;

  console.info(LOG, '已注入', location.href);
  removeExtraPopups();
  loadLangPair();
  chrome.storage.onChanged.addListener(onLangPairChanged);

  document.addEventListener('mouseup', onSelectEnd, true);
  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange, true);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  // Only watch direct children of <html>. subtree:true on Claude/ChatGPT
  // fires on every streamed token and can throw contains() TypeError.
  const popupObserver = new MutationObserver((records) => {
    try {
      if (!isRuntimeValid() || !isCurrentInstance()) {
        teardown();
        return;
      }
      if (!enabled) return;
      const addedOurs = records.some((record) =>
        Array.from(record.addedNodes).some((node) => node && node.id === POPUP_ID)
      );
      if (addedOurs) removeExtraPopups();
    } catch (_error) {
      // Host pages mutate constantly; never throw into the page.
    }
  });
  try {
    popupObserver.observe(document.documentElement, { childList: true });
  } catch (_error) {
    // Ignore documents that replace <html> before observe().
  }

  function onLangPairChanged(changes, area) {
    if (area !== 'local') return;
    if (changes.langA && changes.langA.newValue) langA = changes.langA.newValue;
    if (changes.langB && changes.langB.newValue) langB = changes.langB.newValue;
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      if (!enabled) {
        destroyAllPopups();
        teardown();
      }
    }
  }

  async function loadLangPair() {
    try {
      const data = await chrome.storage.local.get({
        langA: globalThis.ZCT_DEFAULT_LANG_A || 'zh-CN',
        langB: globalThis.ZCT_DEFAULT_LANG_B || 'en',
        enabled: true,
      });
      langA = data.langA || globalThis.ZCT_DEFAULT_LANG_A || 'zh-CN';
      langB = data.langB || globalThis.ZCT_DEFAULT_LANG_B || 'en';
      enabled = data.enabled !== false;
    } catch (_error) {
      enabled = true;
    } finally {
      settingsReady = true;
      if (!enabled) {
        destroyAllPopups();
        teardown();
      }
    }
  }

  function onRuntimeMessage(message, _sender, sendResponse) {
    if (!message) return undefined;
    if (message.type === 'ZCT_PING') {
      sendResponse({ ok: true, instanceId });
      return false;
    }
    if (message.type === 'ZCT_SET_ENABLED') {
      enabled = message.enabled !== false;
      settingsReady = true;
      if (!enabled) {
        destroyAllPopups();
        teardown();
      }
      sendResponse({ ok: true });
      return false;
    }
    return undefined;
  }

  function isRuntimeValid() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch (_error) {
      return false;
    }
  }

  function isCurrentInstance() {
    return (
      isRuntimeValid() &&
      document.documentElement.getAttribute(INSTANCE_ATTR) === instanceId
    );
  }

  function teardown() {
    document.removeEventListener('mouseup', onSelectEnd, true);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange, true);
    popupObserver.disconnect();
    try {
      chrome.storage.onChanged.removeListener(onLangPairChanged);
    } catch (_error) {
      // Ignore if storage is already unavailable.
    }
    try {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    } catch (_error) {
      // Ignore if the extension context is already gone.
    }
    globalThis.__ZCT_LOADED__ = false;
    try {
      if (document.documentElement.getAttribute(INSTANCE_ATTR) === instanceId) {
        document.documentElement.removeAttribute(INSTANCE_ATTR);
      }
    } catch (_error) {
      // Ignore detached documents.
    }
    if (missTimer) {
      window.clearTimeout(missTimer);
      missTimer = 0;
    }
  }

  function onMouseDown(event) {
    if (!isCurrentInstance()) {
      teardown();
      return;
    }
    if (event.button !== 0) return;
    if (eventTouchesPopup(event)) return;
    hidePopup();
  }

  function onKeyDown(event) {
    if (!isCurrentInstance()) {
      teardown();
      return;
    }
    if (event.key === 'Escape') hidePopup();
  }

  function onViewportChange(event) {
    if (!isCurrentInstance()) {
      teardown();
      return;
    }
    if (eventTouchesPopup(event)) return;
    hidePopup();
  }

  function onSelectEnd(event) {
    if (!isCurrentInstance()) {
      teardown();
      return;
    }
    if (event.button != null && event.button !== 0) return;
    if (eventTouchesPopup(event)) return;
    if (!settingsReady || !enabled) return;

    const now = Date.now();
    if (now - lastSelectEndAt < 40) return;
    lastSelectEndAt = now;

    window.requestAnimationFrame(() => {
      const snapshot = inspectSelection(event);
      if (snapshot.silent) return;

      if (!snapshot.captured) {
        const copy = uiCopy(snapshot.lang, snapshot.text);
        console.info(LOG, '未捕捉', snapshot.reason, snapshot.text || '');
        renderPopup({
          state: 'miss',
          badge: copy.missed,
          source: snapshot.text || '',
          sourceLabel: copy.selection,
          body: snapshot.reason,
          rect: snapshot.rect,
        });
        return;
      }

      console.info(LOG, '已捕捉', snapshot.text, snapshot.lang.badge);
      translateSelection(snapshot);
    });
  }

  function inspectSelection(event) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return { captured: false, silent: true, reason: '没有选区' };
    }

    const rawText = selection.toString();
    const text = rawText.replace(/\s+/g, ' ').trim();
    const rect = getSelectionRect(selection, event);
    const node = selection.anchorNode && selection.anchorNode.parentElement;

    if (!text) {
      return {
        captured: false,
        silent: false,
        reason: missReason('spaces', text),
        text: '',
        rect,
      };
    }

    if (node && isInsidePopup(node)) {
      return { captured: false, silent: true, reason: '点在翻译浮层上' };
    }

    if (node && isEditable(node)) {
      return {
        captured: false,
        silent: false,
        reason: missReason('editable', text),
        text,
        rect,
      };
    }

    if (!hasTranslatableLetters(text)) {
      return {
        captured: false,
        silent: false,
        reason: missReason('letters', text),
        text,
        rect,
      };
    }

    const clipped =
      text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;

    return {
      captured: true,
      silent: false,
      text: clipped,
      rect,
      lang: detectLang(clipped),
    };
  }

  function getSelectionRect(selection, event) {
    try {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0)) return rect;
    } catch (_error) {
      // Fall through to the mouse position.
    }

    const x = event && typeof event.clientX === 'number' ? event.clientX : 12;
    const y = event && typeof event.clientY === 'number' ? event.clientY : 12;
    return { left: x, top: y, right: x, bottom: y + 12, width: 0, height: 12 };
  }

  function hasTranslatableLetters(text) {
    try {
      return /[\p{L}\p{N}]/u.test(text);
    } catch (_error) {
      return /[\u4e00-\u9fffA-Za-z\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0e00-\u0e7f]/.test(
        text
      );
    }
  }

  function detectLang(text) {
    return typeof globalThis.zctDetectPair === 'function'
      ? globalThis.zctDetectPair(text, langA, langB)
      : { from: langA, to: langB, auto: true, badge: 'A ↔ B' };
  }

  function missReason(key, text) {
    const zh = isChineseSource(null, text);
    if (key === 'spaces') return zh ? '选区只有空格，没有文字' : 'Selection is only whitespace';
    if (key === 'editable') return zh ? '在输入框里，打字时不翻译' : 'Not translating inside input fields';
    return zh ? '没有可翻译的文字' : 'No translatable text';
  }

  function isChineseSource(lang, text) {
    if (lang && lang.from) {
      return String(lang.from).toLowerCase().startsWith('zh');
    }
    if (text) return detectLang(text).from.toLowerCase().startsWith('zh');
    return true;
  }

  function uiCopy(lang, text) {
    if (isChineseSource(lang, text)) {
      return {
        captured: '已捕捉',
        missed: '未捕捉',
        selection: '选区：',
        translating: '正在翻译…',
        failed: '翻译失败',
        engine(name) {
          return name || '';
        },
      };
    }
    return {
      captured: 'Captured',
      missed: 'Not captured',
      selection: 'Selection: ',
      translating: 'Translating…',
      failed: 'Failed',
      engine(name) {
        if (name === '缓存') return 'Cache';
        if (name === 'Google官方') return 'Google official';
        if (name === 'Google网页') return 'Google webpage';
        if (name === 'Google备用') return 'Google fallback';
        return name || '';
      },
    };
  }

  function isEditable(element) {
    if (!element || !element.closest) return false;
    if (element.closest('input, textarea, select')) return true;
    const editable = element.closest('[contenteditable]');
    if (!editable) return false;
    return editable.getAttribute('contenteditable') !== 'false';
  }

  function isDomNode(value) {
    try {
      return Boolean(value) && typeof value.nodeType === 'number' && value.nodeType > 0;
    } catch (_error) {
      return false;
    }
  }

  function isInsidePopup(node) {
    if (!popupEl || !isDomNode(node)) return false;
    if (node === popupEl) return true;
    if (node.nodeType === 1 && typeof node.closest === 'function') {
      try {
        if (node.closest(`#${POPUP_ID}`)) return true;
      } catch (_error) {
        // Detached or foreign-realm elements.
      }
    }
    try {
      return typeof popupEl.contains === 'function' && popupEl.contains(node);
    } catch (_error) {
      return false;
    }
  }

  function eventTouchesPopup(event) {
    if (!event) return false;
    if (typeof event.composedPath === 'function') {
      try {
        return event.composedPath().some((node) => isInsidePopup(node));
      } catch (_error) {
        // Fall through to event.target.
      }
    }
    return isInsidePopup(event.target);
  }

  async function translateSelection(snapshot) {
    const id = ++requestSeq;
    const copy = uiCopy(snapshot.lang, snapshot.text);
    renderPopup({
      state: 'loading',
      badge: `${copy.captured} · ${snapshot.lang.badge}`,
      source: snapshot.text,
      sourceLabel: copy.selection,
      body: copy.translating,
      rect: snapshot.rect,
    });

    let result;
    try {
      result = await chrome.runtime.sendMessage({
        type: 'TRANSLATE',
        text: snapshot.text,
        from: snapshot.lang.from,
        to: snapshot.lang.to,
        langA,
        langB,
        auto: Boolean(snapshot.lang.auto),
      });
    } catch (_error) {
      teardown();
      return;
    }

    if (id !== requestSeq) return;

    if (result && result.reason === 'QUOTA_EXCEEDED') {
      renderPopup({
        state: 'quota',
        badge: '',
        source: '',
        body: 'Free limit reached for today\nResets tomorrow',
        action: 'Upgrade',
        rect: snapshot.rect,
      });
      return;
    }

    if (result && result.ok) {
      const engineName = copy.engine(result.engine);
      const engine = engineName ? ` · ${engineName}` : '';
      console.info(LOG, '翻译成功', result.engine || engineName, result.endpoint || '', result.translation);
      console.info(LOG, '官方Key', result.officialKey || '未知');
      if (result.trace && result.trace.length) {
        console.info(LOG, '链路', result.trace.join(' → '));
      }
      renderPopup({
        state: 'ready',
        badge: `${copy.captured}${engine}`,
        source: snapshot.text,
        sourceLabel: copy.selection,
        body: result.translation,
        rect: snapshot.rect,
      });
      return;
    }

    const error = (result && result.error) || copy.failed;
    console.info(LOG, '已捕捉但翻译失败', error);
    if (result && result.trace && result.trace.length) {
      console.info(LOG, '链路', result.trace.join(' → '));
    }
    renderPopup({
      state: 'error',
      badge: `${copy.captured} · ${copy.failed}`,
      source: snapshot.text,
      sourceLabel: copy.selection,
      body: error,
      rect: snapshot.rect,
    });
  }

  function ensurePopup() {
    removeExtraPopups();
    const existing = document.getElementById(POPUP_ID);
    if (existing) {
      popupEl = existing;
      if (!popupEl.querySelector('.zct-action')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'zct-action';
        button.hidden = true;
        const card = popupEl.querySelector('.zct-card');
        if (card) card.appendChild(button);
      }
      attachPopup(popupEl);
      return popupEl;
    }

    popupEl = document.createElement('div');
    popupEl.id = POPUP_ID;
    popupEl.setAttribute('popover', 'manual');
    popupEl.innerHTML =
      '<div class="zct-card">' +
      '<div class="zct-badge"></div>' +
      '<div class="zct-source"></div>' +
      '<div class="zct-body"></div>' +
      '<button type="button" class="zct-action" hidden></button>' +
      '</div>';

    attachPopup(popupEl);
    return popupEl;
  }

  function removeExtraPopups() {
    const popups = Array.from(document.querySelectorAll(`#${POPUP_ID}`));
    if (popups.length === 0) return;

    const keep =
      popupEl && popups.includes(popupEl) ? popupEl : popups[popups.length - 1];
    popups.forEach((el) => {
      if (el === keep) return;
      try {
        if (typeof el.hidePopover === 'function' && el.matches(':popover-open')) {
          el.hidePopover();
        }
      } catch (_error) {
        // Ignore popovers that are already gone.
      }
      el.remove();
    });
    popupEl = keep;
  }

  function destroyAllPopups() {
    requestSeq += 1;
    if (missTimer) {
      window.clearTimeout(missTimer);
      missTimer = 0;
    }
    Array.from(document.querySelectorAll(`#${POPUP_ID}`)).forEach((el) => {
      try {
        if (typeof el.hidePopover === 'function' && el.matches(':popover-open')) {
          el.hidePopover();
        }
      } catch (_error) {
        // Ignore popovers that are already gone.
      }
      el.remove();
    });
    popupEl = null;
  }

  function attachPopup(popup) {
    if (popup.parentElement !== document.documentElement) {
      document.documentElement.appendChild(popup);
    }
    if (popup.dataset.zctBound === '1') return;
    popup.dataset.zctBound = '1';
    popup.addEventListener('click', onPopupClick);
  }

  function onPopupClick(event) {
    const button = event.target && event.target.closest && event.target.closest('.zct-action');
    if (!button || button.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      chrome.runtime.sendMessage({ type: 'ZCT_UPGRADE' });
    } catch (_error) {
      // Extension context may be gone.
    }
  }

  function renderPopup({ state, badge, source, sourceLabel, body, action, rect }) {
    const popup = ensurePopup();
    const card = popup.querySelector('.zct-card');
    const badgeEl = popup.querySelector('.zct-badge');
    const sourceEl = popup.querySelector('.zct-source');
    const bodyEl = popup.querySelector('.zct-body');
    const actionEl = popup.querySelector('.zct-action');

    card.dataset.state = state;
    badgeEl.textContent = badge || '';
    sourceEl.textContent = source ? `${sourceLabel || '选区：'}${source}` : '';
    bodyEl.textContent = body;
    if (actionEl) {
      actionEl.hidden = !action;
      actionEl.textContent = action || '';
    }

    if (missTimer) {
      window.clearTimeout(missTimer);
      missTimer = 0;
    }

    showPopover(popup);
    placePopup(popup, rect);
    window.requestAnimationFrame(() => {
      if (!popupEl || popupEl !== popup) return;
      placePopup(popup, rect);
    });

    if (state === 'miss') {
      missTimer = window.setTimeout(() => {
        hidePopup();
      }, MISS_HIDE_MS);
    }
  }

  function showPopover(popup) {
    attachPopup(popup);
    popup.style.removeProperty('display');
    popup.removeAttribute('hidden');

    if (typeof popup.showPopover !== 'function') {
      popup.style.display = 'block';
      return;
    }

    try {
      if (!popup.matches(':popover-open')) {
        popup.showPopover();
      }
    } catch (_error) {
      popup.style.display = 'block';
    }
  }

  function hidePopup() {
    requestSeq += 1;
    if (missTimer) {
      window.clearTimeout(missTimer);
      missTimer = 0;
    }
    if (!popupEl) return;

    if (typeof popupEl.hidePopover === 'function') {
      try {
        if (popupEl.matches(':popover-open')) {
          popupEl.hidePopover();
        }
      } catch (_error) {
        // Native popover already closed; do not set display:none,
        // or later showPopover() will open an invisible panel.
      }
      return;
    }

    popupEl.style.display = 'none';
  }

  function placePopup(popup, rect) {
    popup.style.position = 'fixed';
    popup.style.inset = 'auto';
    popup.style.margin = '0';
    popup.style.right = 'auto';
    popup.style.bottom = 'auto';

    const popupRect = popup.getBoundingClientRect();
    const popupWidth = popupRect.width || 280;
    const popupHeight = popupRect.height || 48;
    const safeRect = rect || { left: 12, top: 12, bottom: 24 };

    let left = safeRect.left;
    let top = safeRect.bottom + POPUP_GAP;

    if (left + popupWidth > window.innerWidth - VIEWPORT_PADDING) {
      left = window.innerWidth - popupWidth - VIEWPORT_PADDING;
    }
    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;

    if (top + popupHeight > window.innerHeight - VIEWPORT_PADDING) {
      top = safeRect.top - popupHeight - POPUP_GAP;
    }
    if (top < VIEWPORT_PADDING) top = VIEWPORT_PADDING;

    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
  }
})();
