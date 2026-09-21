'use strict';

const CACHE_LIMIT = 80;
const FETCH_TIMEOUT_MS = 8000;
const MYMEMORY_MAX_Q_BYTES = 500;
const translationCache = new Map();
const textEncoder = new TextEncoder();

chrome.runtime.onInstalled.addListener(() => {
  injectIntoOpenTabs();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'TRANSLATE') return undefined;

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

async function translate({ text, from, to, langA, langB, auto }) {
  const source = (text || '').trim();
  if (!source) {
    return { ok: false, error: '没有可翻译的文本' };
  }

  let sl = toLangCode(from);
  let tl = toLangCode(to);
  const pairA = toLangCode(langA || 'zh-CN');
  const pairB = toLangCode(langB || 'en');

  if (auto) {
    const probeTl = tl || pairB;
    const probed = await translateGoogleGtx(source, 'auto', probeTl);
    if (probed.ok && probed.detected && sameLangFamily(probed.detected, probeTl)) {
      sl = toLangCode(probed.detected);
      tl = sameLangFamily(sl, pairA) ? pairB : pairA;
    } else if (probed.ok && probed.translation) {
      sl = toLangCode(probed.detected || sl);
      putCache(`${sl}|${probeTl}|${source}`, probed.translation);
      return {
        ok: true,
        translation: probed.translation,
        engine: 'Google',
        from: sl,
        to: probeTl,
      };
    }
  }

  const cacheKey = `${sl}|${tl}|${source}`;
  const cached = takeCache(cacheKey);
  if (cached) {
    return { ok: true, translation: cached, engine: '缓存', from: sl, to: tl };
  }

  const engines = [
    { name: 'Google', run: translateGoogleGtx },
    { name: 'Google备用', run: translateGoogleClients5 },
    { name: 'MyMemory', run: translateMyMemory },
  ];
  let lastError = '翻译失败';

  for (const engine of engines) {
    const result = await engine.run(source, sl, tl);
    if (result.ok && result.translation) {
      putCache(cacheKey, result.translation);
      return {
        ok: true,
        translation: result.translation,
        engine: engine.name,
        from: sl,
        to: tl,
      };
    }
    if (result && result.error) lastError = `${engine.name}：${result.error}`;
  }

  return { ok: false, error: lastError };
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

  if (!response.ok) {
    return { ok: false, error: `翻译接口错误（${response.status}）` };
  }

  try {
    return { ok: true, data: await response.json() };
  } catch (_error) {
    return { ok: false, error: '翻译结果解析失败' };
  }
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
