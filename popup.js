'use strict';

const selectA = document.getElementById('langA');
const selectB = document.getElementById('langB');
const defaultA = globalThis.ZCT_DEFAULT_LANG_A || 'zh-CN';
const defaultB = globalThis.ZCT_DEFAULT_LANG_B || 'en';
let lastA = defaultA;
let lastB = defaultB;

fillSelect(selectA);
fillSelect(selectB);

if (globalThis.chrome && chrome.storage && chrome.storage.local) {
  chrome.storage.local
    .get({ langA: defaultA, langB: defaultB })
    .then((data) => {
      lastA = data.langA || defaultA;
      lastB = data.langB || defaultB;
      if (lastA === lastB) lastB = lastA === 'en' ? defaultA : defaultB;
      selectA.value = lastA;
      selectB.value = lastB;
    });
} else {
  selectA.value = lastA;
  selectB.value = lastB;
}

selectA.addEventListener('change', onChange);
selectB.addEventListener('change', onChange);

function fillSelect(select) {
  const languages = globalThis.ZCT_LANGUAGES || [];
  languages.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.code;
    option.textContent = item.name;
    select.appendChild(option);
  });
}

function onChange(event) {
  let nextA = selectA.value;
  let nextB = selectB.value;
  if (nextA === nextB) {
    if (event.target === selectA) nextB = lastA;
    else nextA = lastB;
    selectA.value = nextA;
    selectB.value = nextB;
  }
  lastA = nextA;
  lastB = nextB;
  if (globalThis.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ langA: nextA, langB: nextB });
  }
}
