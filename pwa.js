'use strict';
// スマホWebアプリ: オフライン対応と「新しいバージョンがあります → 今すぐ更新」(データはそのまま残る)
(() => {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  let reg = null, reloading = false;
  const bar = () => {
    if (document.getElementById('updbar')) return; const b = document.createElement('div'); b.id = 'updbar'; b.setAttribute('role', 'status'); b.innerHTML = '新しいバージョンがあります <button id="updgo">今すぐ更新</button><button id="updx" aria-label="閉じる">✕</button>'; document.body.appendChild(b);
    b.querySelector('#updgo').onclick = () => { const w = reg && reg.waiting; if (w) w.postMessage('skip'); else location.reload(); }; b.querySelector('#updx').onclick = () => b.remove();
  };
  addEventListener('load', async () => {
    try { reg = await navigator.serviceWorker.register('sw.js'); } catch { return; }
    if (reg.waiting && navigator.serviceWorker.controller) bar();
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) bar(); }); });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
    const chk = () => reg.update().catch(() => { }); setInterval(chk, 30 * 60e3); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') chk(); });
  });
  window.__pwaUpdate = async () => { if (!reg) return typeof toast === 'function' && toast('更新確認を開始できません'); try { await reg.update(); } catch { } setTimeout(() => { if (reg.waiting) bar(); else if (typeof toast === 'function') toast('最新版です'); }, 1500); };
})();
