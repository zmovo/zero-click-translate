'use strict';

(function (root) {
  const STORAGE_KEY = 'zctPlan';

  async function getPlan() {
    try {
      const data = await chrome.storage.local.get({ [STORAGE_KEY]: 'FREE' });
      return data[STORAGE_KEY] === 'PRO' ? 'PRO' : 'FREE';
    } catch (_error) {
      return 'FREE';
    }
  }

  async function isPro() {
    return (await getPlan()) === 'PRO';
  }

  async function setPlan(plan) {
    const next = plan === 'PRO' ? 'PRO' : 'FREE';
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  }

  root.zctEntitlement = { getPlan, isPro, setPlan };
})(globalThis);
