'use strict';

globalThis.ZCT_DEFAULT_LANG_A = 'zh-CN';
globalThis.ZCT_DEFAULT_LANG_B = 'en';

globalThis.ZCT_LANGUAGES = [
  { code: 'zh-CN', name: '中文', short: '中' },
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'ja', name: '日本語', short: 'JA' },
  { code: 'ko', name: '한국어', short: 'KO' },
  { code: 'fr', name: 'Français', short: 'FR' },
  { code: 'de', name: 'Deutsch', short: 'DE' },
  { code: 'es', name: 'Español', short: 'ES' },
  { code: 'pt', name: 'Português', short: 'PT' },
  { code: 'ru', name: 'Русский', short: 'RU' },
  { code: 'ar', name: 'العربية', short: 'AR' },
  { code: 'vi', name: 'Tiếng Việt', short: 'VI' },
  { code: 'th', name: 'ไทย', short: 'TH' },
];

globalThis.ZCT_LATIN = { en: 1, fr: 1, de: 1, es: 1, pt: 1, vi: 1 };

globalThis.zctLangFamily = function zctLangFamily(code) {
  const value = String(code || '').toLowerCase();
  if (value.startsWith('zh')) return 'zh';
  return value.split('-')[0] || 'en';
};

globalThis.zctLangByCode = function zctLangByCode(code) {
  const family = globalThis.zctLangFamily(code);
  return (
    globalThis.ZCT_LANGUAGES.find((item) => item.code === code) ||
    globalThis.ZCT_LANGUAGES.find((item) => globalThis.zctLangFamily(item.code) === family) ||
    globalThis.ZCT_LANGUAGES[1]
  );
};

globalThis.zctShort = function zctShort(code) {
  return globalThis.zctLangByCode(code).short;
};

globalThis.zctScoreLang = function zctScoreLang(text, code) {
  const family = globalThis.zctLangFamily(code);
  if (family === 'ja') {
    return (text.match(/[\u3040-\u30ff]/g) || []).length;
  }
  if (family === 'zh') {
    const kana = (text.match(/[\u3040-\u30ff]/g) || []).length;
    const hangul = (text.match(/[\uac00-\ud7af]/g) || []).length;
    if (kana || hangul) return 0;
    return (text.match(/[\u4e00-\u9fff]/g) || []).length;
  }
  if (family === 'ko') return (text.match(/[\uac00-\ud7af]/g) || []).length;
  if (family === 'ru') return (text.match(/[\u0400-\u04ff]/g) || []).length;
  if (family === 'ar') return (text.match(/[\u0600-\u06ff]/g) || []).length;
  if (family === 'th') return (text.match(/[\u0e00-\u0e7f]/g) || []).length;
  return (text.match(/[A-Za-z]/g) || []).length;
};

globalThis.zctDetectPair = function zctDetectPair(text, langA, langB) {
  const a = langA || globalThis.ZCT_DEFAULT_LANG_A;
  const b = langB || globalThis.ZCT_DEFAULT_LANG_B;
  const latinPair =
    globalThis.ZCT_LATIN[globalThis.zctLangFamily(a)] &&
    globalThis.ZCT_LATIN[globalThis.zctLangFamily(b)];
  const scoreA = globalThis.zctScoreLang(text, a);
  const scoreB = globalThis.zctScoreLang(text, b);
  const auto = latinPair || scoreA === scoreB;

  if (!auto && scoreA > scoreB) {
    return {
      from: a,
      to: b,
      auto: false,
      badge: `${globalThis.zctShort(a)} → ${globalThis.zctShort(b)}`,
    };
  }
  if (!auto && scoreB > scoreA) {
    return {
      from: b,
      to: a,
      auto: false,
      badge: `${globalThis.zctShort(b)} → ${globalThis.zctShort(a)}`,
    };
  }
  return {
    from: a,
    to: b,
    auto: true,
    badge: `${globalThis.zctShort(a)} ↔ ${globalThis.zctShort(b)}`,
  };
};
