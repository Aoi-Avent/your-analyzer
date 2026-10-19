'use strict';
// オフライン対応(アプリ本体のキャッシュ)。更新時は VERSION を上げてください。
const VERSION = 'ytha-phone-v3.0.0', ASSETS = ["./", "index.html", "app.css", "g2.css", "parse.js", "genre.js", "sync.js", "app.js", "g2core.js", "g2study.js", "g2music.js", "g2sync.js", "g2extra.js", "pwa.js", "manifest.webmanifest", "icon192.png", "icon512.png", "icon180.png"];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => { const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return; e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))); });
