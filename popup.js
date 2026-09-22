'use strict';

const selectA = document.getElementById('langA');
const selectB = document.getElementById('langB');
const enabledEl = document.getElementById('enabled');
const powerLabel = document.getElementById('powerLabel');
const quotaCountEl = document.getElementById('quotaCount');
const quotaBarEl = document.getElementById('quotaBar');
const quotaHintEl = document.getElementById('quotaHint');
const defaultA = globalThis.ZCT_DEFAULT_LANG_A || 'zh-CN';
const defaultB = globalThis.ZCT_DEFAULT_LANG_B || 'en';
let lastA = defaultA;
let lastB = defaultB;
let langRecent = [defaultA, defaultB];

if (powerLabel && globalThis.chrome && chrome.i18n) {
  const label = chrome.i18n.getMessage('toggleTranslate') || 'Translate';
  powerLabel.textContent = label;
  enabledEl.setAttribute('aria-label', label);
}

if (globalThis.chrome && chrome.storage && chrome.storage.local) {
  chrome.storage.local
    .get({ langA: defaultA, langB: defaultB, enabled: true, langRecent: [] })
    .then((data) => {
      lastA = data.langA || defaultA;
      lastB = data.langB || defaultB;
      if (lastA === lastB) lastB = lastA === 'en' ? defaultA : defaultB;
      langRecent = rememberLang(lastA, rememberLang(lastB, data.langRecent || []));
      enabledEl.checked = data.enabled !== false;
      renderLangSelects();
    });
} else {
  renderLangSelects();
}

selectA.addEventListener('change', onLangChange);
selectB.addEventListener('change', onLangChange);
enabledEl.addEventListener('change', onEnabledChange);

function rememberLang(code, recent) {
  if (!code) return recent.slice();
  return [code].concat(recent.filter((item) => item !== code));
}

function orderedLanguages() {
  const all = globalThis.ZCT_LANGUAGES || [];
  const seen = new Set();
  const ordered = [];
  langRecent.forEach((code) => {
    const item = all.find((lang) => lang.code === code);
    if (item && !seen.has(item.code)) {
      seen.add(item.code);
      ordered.push(item);
    }
  });
  all.forEach((item) => {
    if (!seen.has(item.code)) ordered.push(item);
  });
  return ordered;
}

function fillSelect(select, selected) {
  select.innerHTML = '';
  orderedLanguages().forEach((item) => {
    const option = document.createElement('option');
    option.value = item.code;
    option.textContent = item.name;
    select.appendChild(option);
  });
  if (selected) select.value = selected;
}

function renderLangSelects() {
  fillSelect(selectA, lastA);
  fillSelect(selectB, lastB);
}

function onLangChange(event) {
  let nextA = selectA.value;
  let nextB = selectB.value;
  if (nextA === nextB) {
    if (event.target === selectA) nextB = lastA;
    else nextA = lastB;
  }
  lastA = nextA;
  lastB = nextB;
  langRecent = rememberLang(event.target.value, rememberLang(nextA, rememberLang(nextB, langRecent)));
  renderLangSelects();
  if (globalThis.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ langA: nextA, langB: nextB, langRecent });
  }
}

function onEnabledChange() {
  if (globalThis.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ enabled: enabledEl.checked });
  }
}

function formatQuotaNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function renderQuota(state) {
  if (!quotaCountEl || !quotaBarEl || !quotaHintEl) return;
  if (!state) return;

  if (state.plan === 'PRO') {
    quotaCountEl.textContent = 'Unlimited';
    quotaBarEl.style.width = '100%';
    quotaHintEl.hidden = true;
    return;
  }

  quotaCountEl.textContent = `${formatQuotaNumber(state.todayUsed)} / ${formatQuotaNumber(state.dailyLimit)}`;
  const ratio = state.dailyLimit ? Math.min(1, state.todayUsed / state.dailyLimit) : 0;
  quotaBarEl.style.width = `${Math.round(ratio * 100)}%`;
  quotaHintEl.hidden = !state.low;
}

async function refreshQuota() {
  if (!globalThis.zctQuota || typeof globalThis.zctQuota.getState !== 'function') return;
  try {
    renderQuota(await globalThis.zctQuota.getState());
  } catch (_error) {
    // Keep the last rendered quota if storage is unavailable.
  }
}

refreshQuota();
if (globalThis.chrome && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.zctQuota || changes.zctPlan)) {
      refreshQuota();
    }
  });
}
