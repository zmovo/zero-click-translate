'use strict';

(function (root) {
  const FREE_DAILY_LIMIT = 3000;
  const LOW_RATIO = 0.2;
  const STORAGE_KEY = 'zctQuota';

  function todayStamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function countChars(text) {
    return Array.from(String(text || '')).length;
  }

  async function getPlan() {
    if (root.zctEntitlement && typeof root.zctEntitlement.getPlan === 'function') {
      return root.zctEntitlement.getPlan();
    }
    return 'FREE';
  }

  async function persist(quota) {
    await chrome.storage.local.set({ [STORAGE_KEY]: quota });
  }

  async function getState() {
    const plan = await getPlan();
    const today = todayStamp();
    let stored = null;
    try {
      const data = await chrome.storage.local.get({ [STORAGE_KEY]: null });
      stored = data[STORAGE_KEY];
    } catch (_error) {
      stored = null;
    }

    const dailyLimit = FREE_DAILY_LIMIT;
    let todayUsed = 0;
    if (stored && stored.date === today) {
      todayUsed = Math.max(0, Number(stored.todayUsed) || 0);
    } else if (!stored || stored.date !== today) {
      await persist({ date: today, todayUsed: 0, dailyLimit });
    }

    if (plan === 'PRO') {
      return {
        plan,
        dailyLimit,
        todayUsed: 0,
        remaining: Number.MAX_SAFE_INTEGER,
        date: today,
        low: false,
      };
    }

    const remaining = Math.max(0, dailyLimit - todayUsed);
    return {
      plan,
      dailyLimit,
      todayUsed: Math.min(todayUsed, dailyLimit),
      remaining,
      date: today,
      low: remaining > 0 && remaining / dailyLimit < LOW_RATIO,
    };
  }

  async function canTranslate(_charCount) {
    const state = await getState();
    if (state.plan === 'PRO') return { ok: true, state };
    if (state.remaining > 0) return { ok: true, state };
    return { ok: false, state };
  }

  let consumeChain = Promise.resolve();

  async function consume(charCount) {
    const run = async () => {
      const state = await getState();
      if (state.plan === 'PRO') return state;
      const added = Math.max(0, Number(charCount) || 0);
      if (!added) return state;
      const todayUsed = Math.min(state.dailyLimit, state.todayUsed + added);
      await persist({
        date: state.date,
        todayUsed,
        dailyLimit: state.dailyLimit,
      });
      return getState();
    };
    const pending = consumeChain.then(run, run);
    consumeChain = pending.catch(() => {});
    return pending;
  }

  root.zctQuota = {
    FREE_DAILY_LIMIT,
    countChars,
    getState,
    canTranslate,
    consume,
  };
})(globalThis);
