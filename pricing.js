'use strict';

const resetLine = document.getElementById('resetLine');
const limitLine = document.getElementById('limitLine');

if (globalThis.zctQuota) {
  if (limitLine && typeof zctQuota.FREE_DAILY_LIMIT === 'number') {
    limitLine.textContent =
      (zctQuota.FREE_MONTHLY_LIMIT || zctQuota.FREE_DAILY_LIMIT).toLocaleString('en-US') +
      ' characters / month';
  }
  if (resetLine && typeof zctQuota.resetLabel === 'function') {
    resetLine.textContent = zctQuota.resetLabel();
  }
}
