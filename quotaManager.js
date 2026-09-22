'use strict';

(function (root) {
  const FREE_MONTHLY_LIMIT = 10000;
  const LOW_RATIO = 0.2;
  const STORAGE_KEY = 'zctQuota';

  function periodStamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  function nextResetAt() {
    const reset = new Date();
    reset.setMonth(reset.getMonth() + 1, 1);
    reset.setHours(0, 0, 0, 0);
    return reset;
  }

  function resetLabel() {
    const reset = nextResetAt();
    const hours = String(reset.getHours()).padStart(2, '0');
    const minutes = String(reset.getMinutes()).padStart(2, '0');
    const date = reset.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    return `Resets on ${date} at ${hours}:${minutes}`;
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
    const period = periodStamp();
    let stored = null;
    try {
      const data = await chrome.storage.local.get({ [STORAGE_KEY]: null });
      stored = data[STORAGE_KEY];
    } catch (_error) {
      stored = null;
    }

    const monthlyLimit = FREE_MONTHLY_LIMIT;
    let used = 0;
    if (stored && stored.date === period) {
      used = Math.max(0, Number(stored.todayUsed) || 0);
    } else {
      await persist({ date: period, todayUsed: 0, dailyLimit: monthlyLimit });
    }

    if (plan === 'PRO') {
      return {
        plan,
        dailyLimit: monthlyLimit,
        monthlyLimit,
        todayUsed: 0,
        remaining: Number.MAX_SAFE_INTEGER,
        date: period,
        low: false,
      };
    }

    const remaining = Math.max(0, monthlyLimit - used);
    return {
      plan,
      dailyLimit: monthlyLimit,
      monthlyLimit,
      todayUsed: Math.min(used, monthlyLimit),
      remaining,
      date: period,
      low: remaining > 0 && remaining / monthlyLimit < LOW_RATIO,
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
    FREE_MONTHLY_LIMIT,
    FREE_DAILY_LIMIT: FREE_MONTHLY_LIMIT,
    countChars,
    getState,
    canTranslate,
    consume,
    nextResetAt,
    resetLabel,
  };
})(globalThis);
