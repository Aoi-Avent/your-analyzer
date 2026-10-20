'use strict';
// オフライン対応。VERSION は build.py が内容から自動で付与します(手動編集不要)。
const VERSION = 'ytha-v4.0.0-bfa64a43', ASSETS = ["./", "index.html", "manifest.webmanifest", "app.css", "g2.css", "g4.css", "parse.js", "genre.js", "sync.js", "app.js", "g2core.js", "g2study.js", "g2music.js", "g2sync.js", "g2extra.js", "g4coll.js", "g4lyrics.js", "g4workersrc.js", "g4cloud.js", "g4ui.js", "pwa.js", "icon180.png", "icon192.png", "icon512.png"];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS))));
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => { const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/ext/')) return; e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))); });
