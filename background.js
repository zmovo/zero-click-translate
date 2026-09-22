'use strict';

try {
  importScripts('entitlementManager.js');
} catch (_error) {
  // Entitlements stay Free if this helper is missing.
}

try {
  importScripts('quotaManager.js');
} catch (_error) {
  // Translate without a quota gate if this helper is missing.
}

try {
  importScripts('secrets.js');
} catch (_error) {
  // secrets.js is optional and must not be committed.
}

const CACHE_LIMIT = 80;
const FETCH_TIMEOUT_MS = 8000;
const MYMEMORY_MAX_Q_BYTES = 500;
const translationCache = new Map();
const textEncoder = new TextEncoder();

const PAGE_SCRIPT_ID = 'zct-content';
const LOG = '[划词即翻译]';
const ENGINE_ENDPOINTS = {
  Google官方: 'translation.googleapis.com/language/translate/v2',
  Google网页: 'translate.googleapis.com/translate_a/single',
  Google备用: 'clients5.google.com/translate_a/t',
  MyMemory: 'api.mymemory.translated.net/get',
  缓存: 'memory-cache',
};
let applyEnabledChain = Promise.resolve();

console.info(LOG, '官方API Key', getGoogleApiKey() ? '已加载' : '未加载');

chrome.runtime.onInstalled.addListener(() => {
  restoreInjectionFromStorage();
});

chrome.runtime.onStartup.addListener(() => {
  restoreInjectionFromStorage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) {
    applyEnabledState(changes.enabled.newValue !== false).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return undefined;

  if (message.type === 'ZCT_APPLY_ENABLED') {
    applyEnabledState(message.enabled !== false)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'ZCT_UPGRADE') {
    openUpgradePage()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type !== 'TRANSLATE') return undefined;

  translate(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : '翻译失败',
      });
    });

  return true;
});

async function injectIntoOpenTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  } catch (_error) {
    return;
  }

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id || tab.discarded) return;
      if (await tabHasLiveContentScript(tab.id)) return;
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id, allFrames: true },
          files: ['content.css'],
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['langs.js', 'content.js'],
        });
      } catch (_error) {
        // Restricted pages such as the Chrome Web Store cannot be injected.
      }
    })
  );
}

async function tabHasLiveContentScript(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'ZCT_PING' });
    return Boolean(response && response.ok);
  } catch (_error) {
    return false;
  }
}

async function restoreInjectionFromStorage() {
  let enabled = true;
  try {
    const data = await chrome.storage.local.get({ enabled: true });
    enabled = data.enabled !== false;
  } catch (_error) {
    enabled = true;
  }
  await applyEnabledState(enabled);
}

async function applyEnabledState(enabled) {
  const run = async () => {
    await syncEnabledBadge();
    if (enabled) {
      await registerPageScripts();
      await injectIntoOpenTabs();
      return;
    }
    await unregisterPageScripts();
    await notifyTabsDisabled();
  };
  const pending = applyEnabledChain.then(run, run);
  applyEnabledChain = pending.catch(() => {});
  return pending;
}

async function registerPageScripts() {
  let existing = [];
  try {
    existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [PAGE_SCRIPT_ID],
    });
  } catch (_error) {
    existing = [];
  }
  if (existing.some((item) => item.id === PAGE_SCRIPT_ID)) return;

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: PAGE_SCRIPT_ID,
        matches: ['http://*/*', 'https://*/*'],
        js: ['langs.js', 'content.js'],
        css: ['content.css'],
        runAt: 'document_idle',
        allFrames: true,
        persistAcrossSessions: true,
      },
    ]);
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (/duplicate script id/i.test(message)) return;
    throw error;
  }
}

async function unregisterPageScripts() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [PAGE_SCRIPT_ID] });
  } catch (_error) {
    // Already unregistered.
  }
}

async function notifyTabsDisabled() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  } catch (_error) {
    return;
  }

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id || tab.discarded) return;
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'ZCT_SET_ENABLED',
          enabled: false,
        });
      } catch (_error) {
        // Tab has no live content script.
      }
    })
  );
}

async function syncEnabledBadge() {
  let enabled = true;
  try {
    const data = await chrome.storage.local.get({ enabled: true });
    enabled = data.enabled !== false;
  } catch (_error) {
    enabled = true;
  }

  const offText = chrome.i18n.getMessage('badgeOff') || 'OFF';
  try {
    await chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
    await chrome.action.setBadgeText({ text: enabled ? '' : offText });
  } catch (_error) {
    // Badge APIs are unavailable in some contexts.
  }
}

async function openUpgradePage() {
  await chrome.tabs.create({ url: chrome.runtime.getURL('pricing.html') });
}

function countSourceChars(text) {
  return globalThis.zctQuota && typeof globalThis.zctQuota.countChars === 'function'
    ? globalThis.zctQuota.countChars(text)
    : Array.from(String(text || '')).length;
}

async function allowTranslate(charCount) {
  if (!globalThis.zctQuota || typeof globalThis.zctQuota.canTranslate !== 'function') {
    return true;
  }
  try {
    const gate = await globalThis.zctQuota.canTranslate(charCount);
    return Boolean(gate && gate.ok);
  } catch (_error) {
    return true;
  }
}

async function consumeQuota(charCount, engine) {
  if (!charCount || engine === '缓存') return;
  if (!globalThis.zctQuota || typeof globalThis.zctQuota.consume !== 'function') return;
  try {
    await globalThis.zctQuota.consume(charCount);
  } catch (_error) {
    // Never block a finished translation on quota bookkeeping.
  }
}

async function finishOk(payload, charCount) {
  await consumeQuota(charCount, payload.engine);
  return payload;
}

async function translate({ text, from, to, langA, langB, auto }) {
  const source = (text || '').trim();
  if (!source) {
    return { ok: false, error: '没有可翻译的文本' };
  }

  const charCount = countSourceChars(source);
  if (!(await allowTranslate(charCount))) {
    return {
      ok: false,
      reason: 'QUOTA_EXCEEDED',
      error: 'Free limit reached for today',
    };
  }

  let sl = toLangCode(from);
  let tl = toLangCode(to);
  const pairA = toLangCode(langA || 'zh-CN');
  const pairB = toLangCode(langB || 'en');

  const hasOfficialKey = Boolean(getGoogleApiKey());
  const officialKey = hasOfficialKey ? '已加载' : '未加载';
  const trace = [];
  const note = (action, name, extra) => {
    const line = extra ? `${action} ${name} ${extra}` : `${action} ${name}`;
    trace.push(line);
    console.info(LOG, line, ENGINE_ENDPOINTS[name] || '');
  };

  note('开始', hasOfficialKey ? 'Google官方' : '无官方Key', officialKey);

  if (auto) {
    const probeTl = tl || pairB;
    const probeName = hasOfficialKey ? 'Google官方' : 'Google网页';
    note('探测', probeName);
    const probed = hasOfficialKey
      ? await translateGoogleOfficial(source, 'auto', probeTl)
      : await translateGoogleGtx(source, 'auto', probeTl);
    if (probed.ok && probed.detected && sameLangFamily(probed.detected, probeTl)) {
      sl = toLangCode(probed.detected);
      tl = sameLangFamily(sl, pairA) ? pairB : pairA;
      note('探测完成，对调', probeName, `${probed.detected} -> ${sl}|${tl}`);
    } else if (probed.ok && probed.translation) {
      sl = toLangCode(probed.detected || sl);
      putCache(`${sl}|${probeTl}|${source}`, probed.translation);
      note('命中', probeName);
      return finishOk(
        {
          ok: true,
          translation: probed.translation,
          engine: probeName,
          endpoint: ENGINE_ENDPOINTS[probeName],
          officialKey,
          trace,
          from: sl,
          to: probeTl,
        },
        charCount
      );
    } else {
      note('探测失败', probeName, probed.error || '无结果');
    }
  }

  const cacheKey = `${sl}|${tl}|${source}`;
  const cached = takeCache(cacheKey);
  if (cached) {
    note('命中', '缓存');
    return finishOk(
      {
        ok: true,
        translation: cached,
        engine: '缓存',
        endpoint: ENGINE_ENDPOINTS['缓存'],
        officialKey,
        trace,
        from: sl,
        to: tl,
      },
      charCount
    );
  }

  const engines = [];
  if (hasOfficialKey) {
    engines.push({ name: 'Google官方', run: translateGoogleOfficial });
  }
  engines.push(
    { name: 'Google网页', run: translateGoogleGtx },
    { name: 'Google备用', run: translateGoogleClients5 },
    { name: 'MyMemory', run: translateMyMemory }
  );
  let lastError = '翻译失败';

  for (const engine of engines) {
    note('尝试', engine.name);
    const result = await engine.run(source, sl, tl);
    if (result.ok && result.translation) {
      putCache(cacheKey, result.translation);
      note('命中', engine.name);
      return finishOk(
        {
          ok: true,
          translation: result.translation,
          engine: engine.name,
          endpoint: ENGINE_ENDPOINTS[engine.name],
          officialKey,
          trace,
          from: sl,
          to: tl,
        },
        charCount
      );
    }
    lastError = `${engine.name}：${(result && result.error) || '无结果'}`;
    note('失败', engine.name, result && result.error ? result.error : '无结果');
  }

  console.info(LOG, '全部失败', lastError);
  return { ok: false, error: lastError, officialKey, trace };
}

function getGoogleApiKey() {
  return String(globalThis.GOOGLE_TRANSLATE_API_KEY || '').trim();
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function translateGoogleOfficial(text, sl, tl) {
  const key = getGoogleApiKey();
  if (!key) return { ok: false, error: '未配置 Google Translate API Key' };

  const url = new URL('https://translation.googleapis.com/language/translate/v2');
  url.searchParams.set('key', key);

  const body = {
    q: text,
    target: tl,
    format: 'text',
  };
  if (sl && sl !== 'auto') body.source = sl;

  const payload = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body),
  });
  if (!payload.ok) {
    const apiMessage =
      payload.data && payload.data.error && payload.data.error.message;
    return { ok: false, error: apiMessage || payload.error || 'Google API 请求失败' };
  }

  const item =
    payload.data &&
    payload.data.data &&
    payload.data.data.translations &&
    payload.data.data.translations[0];
  const translation = item && decodeHtmlEntities(item.translatedText);
  if (!translation) return { ok: false, error: '没有返回翻译结果' };

  return {
    ok: true,
    translation,
    detected: item.detectedSourceLanguage || '',
  };
}

async function translateGoogleGtx(text, sl, tl) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', sl);
  url.searchParams.set('tl', tl);
  url.searchParams.set('dt', 't');
  url.searchParams.set('ie', 'UTF-8');
  url.searchParams.set('oe', 'UTF-8');

  const payload = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ q: text }).toString(),
  });
  if (!payload.ok) return payload;

  const translation = parseGtx(payload.data);
  if (!translation) return { ok: false, error: '没有返回翻译结果' };
  return { ok: true, translation, detected: parseGtxDetected(payload.data) };
}

async function translateGoogleClients5(text, sl, tl) {
  const url = new URL('https://clients5.google.com/translate_a/t');
  url.searchParams.set('client', 'dict-chrome-ex');
  url.searchParams.set('sl', sl);
  url.searchParams.set('tl', tl);
  url.searchParams.set('q', text);

  const payload = await requestJson(url);
  if (!payload.ok) return payload;

  const translation = parseClients5(payload.data);
  if (!translation) return { ok: false, error: '没有返回翻译结果' };
  return { ok: true, translation };
}

async function translateMyMemory(text, sl, tl) {
  const clipped = clipToBytes(text, MYMEMORY_MAX_Q_BYTES);
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', clipped);
  url.searchParams.set('langpair', `${toMyMemoryLang(sl)}|${toMyMemoryLang(tl)}`);

  const payload = await requestJson(url);
  if (!payload.ok) return payload;

  const data = payload.data;
  const translatedText = data && data.responseData && data.responseData.translatedText;
  const details = data && data.responseDetails;
  const responseStatus = data && Number(data.responseStatus);

  if (data && data.quotaFinished) {
    return { ok: false, error: '今日翻译额度已用完，请稍后再试' };
  }
  if (isQuotaMessage(translatedText) || isQuotaMessage(details)) {
    return { ok: false, error: '今日翻译额度已用完，请稍后再试' };
  }
  if (responseStatus && responseStatus !== 200) {
    return { ok: false, error: details || `翻译接口错误（${responseStatus}）` };
  }
  if (!translatedText) {
    return { ok: false, error: '没有返回翻译结果' };
  }
  return { ok: true, translation: translatedText };
}

async function requestJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url.toString(), {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return { ok: false, error: '翻译超时，请重试' };
    }
    return { ok: false, error: '网络异常，翻译失败' };
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    const apiMessage = data && data.error && data.error.message;
    return {
      ok: false,
      error: apiMessage || `翻译接口错误（${response.status}）`,
      data,
    };
  }

  return { ok: true, data };
}

function parseGtx(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
  return data[0]
    .map((segment) => (segment && segment[0] ? segment[0] : ''))
    .join('')
    .trim();
}

function parseClients5(data) {
  if (typeof data === 'string') return data.trim();
  if (!Array.isArray(data) || data.length === 0) return '';
  if (typeof data[0] === 'string') return data.join('').trim();
  return parseGtx(data);
}

function parseGtxDetected(data) {
  if (!Array.isArray(data) || data[2] == null) return '';
  return String(data[2]);
}

function toLangCode(code) {
  const value = String(code || '').trim();
  if (!value) return 'en';
  const lower = value.toLowerCase();
  if (lower.startsWith('zh')) {
    if (/(tw|hk|hant)/.test(lower)) return 'zh-TW';
    return 'zh-CN';
  }
  return lower.split('-')[0];
}

function sameLangFamily(left, right) {
  return langFamily(left) === langFamily(right);
}

function langFamily(code) {
  const value = String(code || '').toLowerCase();
  if (value.startsWith('zh')) return 'zh';
  return value.split('-')[0] || 'en';
}

function toMyMemoryLang(code) {
  const normalized = toLangCode(code);
  return normalized.startsWith('zh') ? 'zh-CN' : normalized;
}

function isQuotaMessage(text) {
  if (!text) return false;
  return /MYMEMORY WARNING/i.test(text) || /ALL AVAILABLE FREE TRANSLATIONS/i.test(text);
}

function clipToBytes(text, maxBytes) {
  if (textEncoder.encode(text).length <= maxBytes) return text;
  let low = 1;
  let high = text.length;
  let fit = 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (textEncoder.encode(text.slice(0, mid)).length <= maxBytes) {
      fit = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return text.slice(0, fit).trim();
}

function takeCache(cacheKey) {
  if (!translationCache.has(cacheKey)) return '';
  const value = translationCache.get(cacheKey);
  translationCache.delete(cacheKey);
  translationCache.set(cacheKey, value);
  return value;
}

function putCache(cacheKey, value) {
  if (translationCache.has(cacheKey)) {
    translationCache.delete(cacheKey);
  }
  translationCache.set(cacheKey, value);
  while (translationCache.size > CACHE_LIMIT) {
    const oldest = translationCache.keys().next().value;
    translationCache.delete(oldest);
  }
}
