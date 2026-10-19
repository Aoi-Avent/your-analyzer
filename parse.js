'use strict';
// mhtml -> 履歴行。大きなファイルでも全体を文字列化せず、バイト列のまま該当パートだけ読む。
const HEX = (() => { const t = new Int8Array(256).fill(-1); '0123456789abcdef'.split('').forEach((c, i) => { t[c.charCodeAt(0)] = i; t[c.toUpperCase().charCodeAt(0)] = i; }); return t; })();
function qpBytes(u) {
  const o = new Uint8Array(u.length); let n = 0;
  for (let i = 0; i < u.length; i++) {
    const c = u[i];
    if (c === 61) {
      const a = u[i + 1], b = u[i + 2];
      if (a === 13 && b === 10) { i += 2; continue; }
      if (a === 10) { i += 1; continue; }
      if (HEX[a] >= 0 && HEX[b] >= 0) { o[n++] = HEX[a] * 16 + HEX[b]; i += 2; continue; }
    }
    o[n++] = c;
  }
  return o.subarray(0, n);
}
const L1 = u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return s; };
function indexOfSeq(u, seq, from) {
  for (let i = u.indexOf(seq[0], from); i !== -1; i = u.indexOf(seq[0], i + 1)) {
    let k = 1; while (k < seq.length && u[i + k] === seq[k]) k++;
    if (k === seq.length) return i;
  }
  return -1;
}
function htmlParts(buf) {
  const u = new Uint8Array(buf), head = L1(u.subarray(0, 8192));
  const bm = head.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!bm) { if (/<html|<!doctype/i.test(head)) return [{ loc: 'myactivity', enc: '', u }]; throw new Error('MHTML/HTMLとして読めません'); }
  const mk = Uint8Array.from('--' + bm[1], c => c.charCodeAt(0)), pos = [];
  for (let i = indexOfSeq(u, mk, 0); i !== -1; i = indexOfSeq(u, mk, i + mk.length)) pos.push(i);
  const out = [];
  for (let p = 0; p < pos.length - 1; p++) {
    const s = pos[p] + mk.length, e = pos[p + 1], hh = L1(u.subarray(s, Math.min(e, s + 4000)));
    const mm = hh.match(/\r?\n\r?\n/); if (!mm) continue;
    const h = hh.slice(0, mm.index).replace(/\r?\n[ \t]+/g, '');
    if (!/Content-Type:\s*text\/html/i.test(h)) continue;
    out.push({ loc: (h.match(/Content-Location:\s*(\S+)/i) || [])[1] || '', enc: (h.match(/Content-Transfer-Encoding:\s*(\S+)/i) || [])[1] || '', u: u.subarray(s + mm.index + mm[0].length, e) });
  }
  return out;
}
function decodePart(p) {
  let b = p.u;
  if (/quoted/i.test(p.enc)) b = qpBytes(b);
  else if (/base64/i.test(p.enc)) b = Uint8Array.from(atob(L1(b).replace(/\s/g, '')), c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(b);
}
const T = el => (el ? el.textContent.trim() : '');
const toSec = d => (d && /^\d+(:\d+){1,2}$/.test(d)) ? d.split(':').reduce((s, x) => s * 60 + (+x), 0) : null;
function parseCard(c) {
  const box = c.querySelector('.QTGV3c');
  let a = box && box.querySelector('a');
  if (!a) a = [...c.querySelectorAll('a[href]')].find(x => /youtube\.com\/(watch|results|post|shorts)/.test(x.getAttribute('href')));
  if (!a) return null;
  const wrap = c.closest('[data-date]') || c.closest('.CW0isc');
  const d8 = wrap && wrap.getAttribute('data-date'); if (!d8 || d8.length !== 8) return { skip: 'date' };
  const tm = (c.textContent.match(/(\d{1,2}):(\d{2})\s*[•・]/) || T(c.querySelector('.H3Q9vf')).match(/(\d{1,2}):(\d{2})/));
  if (!tm) return { skip: 'time' };
  const url = a.getAttribute('href') || '', title = a.textContent.trim();
  const action = box ? T(box).replace(title, '').trim() : '';
  const kind = /検索/.test(action) || /results\?search_query/.test(url) ? 'search' : /視聴|聴き|再生/.test(action) ? 'watch' : /表示/.test(action) ? 'view' : 'other';
  let id = '', q = '';
  if (kind === 'search') { try { q = new URL(url, 'https://www.youtube.com').searchParams.get('search_query') || title; } catch { q = title; } q = q.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim(); id = q; }
  else { const m = url.match(/[?&]v=([\w-]+)/) || url.match(/\/(?:post|shorts)\/([\w-]+)/); id = m ? m[1] : url; }
  const ch = c.querySelector('.SiEggd a') || [...c.querySelectorAll('a[href]')].find(x => /\/channel\/|\/@/.test(x.getAttribute('href')));
  const pm = (c.querySelector('.HmLFgd') ? c.querySelector('.HmLFgd').getAttribute('style') || '' : '').match(/width:\s*([\d.]+)%/);
  const prod = T(c.querySelector('.hJ7x8b')) || (/YouTube Music/.test(c.textContent.slice(0, 80)) ? 'YouTube Music' : 'YouTube');
  const date = `${d8.slice(0, 4)}-${d8.slice(4, 6)}-${d8.slice(6, 8)}`, time = tm[1].padStart(2, '0') + ':' + tm[2];
  return { row: { k: `${date}|${time}|${kind}|${id}`, d: date, t: time, kind, id, title: kind === 'search' ? q : title, ch: ch ? ch.textContent.trim() : '', chid: ch ? (ch.getAttribute('href') || '').split('/').pop() : '', dur: toSec(T(c.querySelector('.bI9urf'))), pr: pm ? +pm[1] : null, prod, sh: /\/shorts\//.test(url) ? 1 : 0 } };
}
function extractRows(html) { return extractFromDoc(new DOMParser().parseFromString(html, 'text/html')); }
function extractFromDoc(doc) {
  const cards = [...doc.querySelectorAll('[role=listitem]')], rows = [], diag = { cards: cards.length, skipped: 0, prod: {} };
  for (const c of cards) {
    let r = null; try { r = parseCard(c); } catch { r = { skip: 'err' }; }
    if (r && r.row) { rows.push(r.row); diag.prod[r.row.prod] = (diag.prod[r.row.prod] || 0) + 1; } else diag.skipped++;
  }
  return { rows, diag };
}
function parseMhtml(buf) {
  const parts = htmlParts(buf), pri = parts.filter(p => /myactivity/i.test(p.loc)), cand = pri.length ? pri : parts;
  let best = { rows: [], diag: { cards: 0, skipped: 0, prod: {} } };
  for (const p of cand) { const r = extractRows(decodePart(p)); if (r.rows.length > best.rows.length || !best.diag.cards) best = r; }
  return best;
}
function parseTakeout(arr) {
  const rows = [];
  for (const e of arr) {
    if (!e || !e.time || !e.title || !e.titleUrl) continue; const dt = new Date(e.time); if (isNaN(dt)) continue;
    const url = e.titleUrl, d = dt.toLocaleDateString('sv-SE'), t = dt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    let kind, id, title = e.title.replace(/^(Watched|Viewed)\s+/i, '').replace(/\s*を(視聴|表示)しました$/, '');
    if (/[?&]v=([\w-]+)/.test(url)) { kind = /Viewed|表示/.test(e.title) && !/watch\?v=/.test(url) ? 'view' : 'watch'; id = url.match(/[?&]v=([\w-]+)/)[1]; }
    else if (/search_query=/.test(url)) { kind = 'search'; try { id = title = new URL(url).searchParams.get('search_query').replace(/\s+/g, ' ').trim(); } catch { continue; } }
    else if (/\/post\//.test(url)) { kind = 'view'; id = url.split('/post/')[1].split(/[?#]/)[0]; } else continue;
    const sub = (e.subtitles && e.subtitles[0]) || {};
    rows.push({ k: `${d}|${t}|${kind}|${id}`, d, t, kind, id, title, ch: sub.name || '', chid: (sub.url || '').split('/').pop(), dur: null, pr: null, prod: e.header || (e.products && e.products[0]) || 'YouTube', sh: 0 });
  }
  return rows;
}
if (typeof module !== 'undefined') module.exports = { parseMhtml, extractRows, extractFromDoc, parseTakeout };
