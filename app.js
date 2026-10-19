'use strict';
/* ===== utils ===== */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
const dnOf = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
const dstr = n => new Date(n * 864e5).toISOString().slice(0, 10);
const hm = s => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const hrs = s => { const h = (s || 0) / 3600; return (h >= 100 ? Math.round(h) : h.toFixed(1)) + 'h'; };
const num = n => Math.round(n || 0).toLocaleString('ja-JP');
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
const delta = (c, p) => p ? `<span class="dl ${c >= p ? 'up' : 'dn'}">${c >= p ? '▲' : '▼'} ${Math.abs(Math.round((c - p) / p * 100))}%</span>` : '';
const cnt = (a, f) => { const m = new Map(); a.forEach(x => { const k = f(x); m.set(k, (m.get(k) || 0) + 1); }); return m; };
const topN = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
const ck = r => r.chid || r.ch || '';
const S = { raw: [], W: [], files: [], chg: new Map(), view: 'dash', range: '28', from: '', to: '', metric: 'views', genre: '音楽', ch: null, f: { q: '', kind: 'watch', g: '', sort: 'new', page: 0 }, ov: {}, errors: [] };
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 4500); };
const err = (e, w) => { const m = `${w || ''} ${e && e.message || e}`; S.errors.push(new Date().toLocaleTimeString() + ' ' + m); console.error(e); toast('エラー: ' + m); };
const busy = (msg, p) => { $('#busy').hidden = !msg; if (msg) { $('#busyt').textContent = msg; $('#busyb').style.width = (p || 0) * 100 + '%'; } };
const tick = () => new Promise(r => setTimeout(r));

/* ===== IndexedDB ===== */
let _db;
const open = () => _db ||= new Promise((res, rej) => { const r = indexedDB.open('ytha', 2); r.onupgradeneeded = () => { const d = r.result; [['acts', 'k'], ['files', 'name'], ['vmeta', 'id'], ['lists', 'id']].forEach(([n, k]) => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: k }); }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('DBがブロックされています')); });
const run = async (st, mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(st, mode); let o; try { o = fn(t.objectStore(st)); } catch (e) { rej(e); return; } t.oncomplete = () => res(o && 'result' in o ? o.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('abort')); }); };
const getAll = st => run(st, 'readonly', s => s.getAll());
const putMany = async (st, rows) => { for (let i = 0; i < rows.length; i += 3000) await run(st, 'readwrite', s => { rows.slice(i, i + 3000).forEach(r => s.put(r)); }); };
const clearAll = () => Promise.all(['acts', 'files'].map(st => run(st, 'readwrite', s => s.clear())));

/* ===== ingest / load ===== */
async function ingest(files) {
  const ok = [...files].filter(f => /\.(mhtml?|html?|json)$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }));
  if (!ok.length) return toast('mhtmlファイルが見つかりません');
  const before = S.raw.length; let bad = 0;
  for (let i = 0; i < ok.length; i++) {
    const f = ok[i]; busy(`読み込み中 ${i + 1}/${ok.length}: ${f.name}`, i / ok.length); await tick();
    try {
      const isJson = /\.json$/i.test(f.name); let rows, diag = { skipped: 0, prod: {}, cards: 0 };
      if (isJson) { const j = JSON.parse(await f.text()); if (!Array.isArray(j) || !j.some(e => e && e.titleUrl)) throw new Error('Google Takeout の watch-history.json ではありません'); const have = new Set(S.raw.map(r => r.k)); rows = parseTakeout(j).filter(r => !have.has(r.k)); if (!rows.length) { S.errors.push(`${f.name}: 新規の履歴はありませんでした`); continue; } }
      else ({ rows, diag } = parseMhtml(await f.arrayBuffer()));
      if (!rows.length) throw new Error(`履歴を検出できません(カード${diag.cards}件)`);
      await putMany('acts', rows); const ds = rows.map(r => r.d).sort();
      await putMany('files', [{ name: f.name, n: rows.length, from: ds[0], to: ds[ds.length - 1], skipped: diag.skipped, prod: diag.prod, at: Date.now() }]);
    } catch (e) { bad++; err(e, f.name); S.errors.push('  ✖ ' + f.name); }
  }
  busy(''); await load();
  toast(`完了: ${ok.length - bad}ファイル成功 / ${bad}失敗。新規${num(S.raw.length - before)}件を追加(合計${num(S.raw.length)}件)`);
}
async function load() {
  try { const [raw, files] = await Promise.all([getAll('acts'), getAll('files')]); S.raw = raw || []; S.files = (files || []).sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true })); if (typeof G2 !== 'undefined') await G2.loadMeta(); prep(); }
  catch (e) { err(e, 'DB読込'); }
  render();
}
function prep() {
  prep.cc = prep.cc || new Map(); if (prep.cc.size > 200000) prep.cc.clear();
  const raw = S.raw; raw.sort((a, b) => (a.d + a.t < b.d + b.t ? -1 : a.d + a.t > b.d + b.t ? 1 : 0));
  const cg = new Map();
  raw.forEach(r => {
    r.dn = dnOf(r.d); r.m = r.d.slice(0, 7); r.h = +r.t.slice(0, 2); r.wd = (r.dn + 4) % 7;
    if (r.kind === 'watch') { const cq = r.title + '\u0001' + r.ch; let cg0 = prep.cc.get(cq); if (cg0 === undefined) { cg0 = classify(r.title, r.ch); prep.cc.set(cq, cg0); } r.bg = cg0; const k = ck(r); if (k && r.bg !== 'その他') { const o = cg.get(k) || {}; o[r.bg] = (o[r.bg] || 0) + 1; cg.set(k, o); } }
  });
  const best = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0][0];
  raw.forEach(r => { if (r.kind !== 'watch') { r.g = ''; return; } const k = ck(r); r.g = S.ov[k] || (r.bg !== 'その他' ? r.bg : (cg.has(k) ? best(cg.get(k)) : 'その他')); });
  S.W = raw.filter(r => r.kind === 'watch'); S.chg = new Map();
  const t = new Map(); S.W.forEach(r => { const k = ck(r); if (!k) return; const o = t.get(k) || {}; o[r.g] = (o[r.g] || 0) + 1; t.set(k, o); }); t.forEach((o, k) => S.chg.set(k, best(o)));
}

/* ===== range / aggregation ===== */
function span() {
  const raw = S.raw; if (!raw.length) return null; const first = raw[0].dn, last = raw[raw.length - 1].dn; let a = first, b = last;
  if (S.range === 'custom' && S.from && S.to) { a = dnOf(S.from); b = dnOf(S.to); if (a > b) [a, b] = [b, a]; }
  else if (S.range !== 'all' && S.range !== 'custom') a = Math.max(first, last - (+S.range) + 1);
  const L = b - a + 1; return { a, b, L, pa: a - L, pb: a - 1, first, last };
}
const sel = (rows, a, b) => rows.filter(r => r.dn >= a && r.dn <= b);
function kpi(R) { const W = R.filter(r => r.kind === 'watch'), v = new Set(), c = new Set(); let s = 0; W.forEach(r => { v.add(r.id); c.add(ck(r)); s += r.dur || 0; }); return { views: W.length, secs: s, uniq: v.size, chs: c.size, q: R.filter(r => r.kind === 'search').length, W }; }
const bk = (dn, m) => m === 'd' ? dstr(dn) : m === 'w' ? dstr(dn - ((dn + 3) % 7)) : dstr(dn).slice(0, 7);
function series(R, sp, metric) {
  const mode = sp.L <= 120 ? 'd' : sp.L <= 900 ? 'w' : 'm', keys = [], seen = new Set();
  for (let d = sp.a; d <= sp.b; d++) { const k = bk(d, mode); if (!seen.has(k)) { seen.add(k); keys.push(k); } }
  const m = new Map(keys.map(k => [k, { n: 0, s: 0, v: new Set(), c: new Set(), q: 0 }]));
  R.forEach(r => { const o = m.get(bk(r.dn, mode)); if (!o) return; if (r.kind === 'watch') { o.n++; o.s += r.dur || 0; o.v.add(r.id); o.c.add(ck(r)); } else if (r.kind === 'search') o.q++; });
  return { mode, keys, vals: keys.map(k => { const o = m.get(k); return { views: o.n, secs: o.s / 3600, uniq: o.v.size, chs: o.c.size, q: o.q }[metric]; }) };
}
function streaks(dns) { let best = 0, cur = 0, prev = null; dns.forEach(d => { cur = prev !== null && d === prev + 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }); return { longest: best, current: cur }; }

/* ===== charts / widgets ===== */
function lineChart(keys, vals) {
  const W = 900, H = 230, l = 46, r = 12, t = 12, b = 26, n = keys.length, mx = Math.max(1e-9, ...vals) * 1.08;
  const x = i => l + (n < 2 ? (W - l - r) / 2 : i * (W - l - r) / (n - 1)), y = v => t + (H - t - b) * (1 - v / mx);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const grid = [0, .25, .5, .75, 1].map(f => { const yy = y(mx * f), v = mx * f; return `<line x1="${l}" x2="${W - r}" y1="${yy}" y2="${yy}" class="gl"/><text x="${l - 6}" y="${yy + 4}" text-anchor="end" class="ax">${v >= 10 ? Math.round(v) : v.toFixed(1)}</text>`; }).join('');
  const step = Math.max(1, Math.ceil(n / 7)), xl = keys.map((k, i) => i % step ? '' : `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="ax">${k.length === 7 ? k.slice(2) : k.slice(5)}</text>`).join('');
  const cw = Math.max(2, (W - l - r) / Math.max(1, n)), hit = vals.map((v, i) => `<rect x="${x(i) - cw / 2}" y="${t}" width="${cw}" height="${H - t - b}" fill="transparent"><title>${keys[i]}: ${+v.toFixed(1)}</title></rect>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}${xl}<polygon points="${l},${H - b} ${pts.join(' ')} ${x(n - 1)},${H - b}" fill="var(--ac)" opacity=".15"/><polyline points="${pts.join(' ')}" fill="none" stroke="var(--ac)" stroke-width="2"/>${hit}</svg>`;
}
function cols(labels, vals, color = 'var(--ac)', H = 120) {
  const n = labels.length; if (!n) return '<p class="sub">データなし</p>';
  const W = Math.max(320, n * 24), mx = Math.max(1, ...vals), bw = W / n;
  return `<svg viewBox="0 0 ${W} ${H + 18}" class="chart">${vals.map((v, i) => { const h = v / mx * H; return `<rect x="${i * bw + 2}" y="${H - h}" width="${bw - 4}" height="${h}" rx="2" fill="${color}"><title>${labels[i]}: ${+v.toFixed(1)}</title></rect>`; }).join('')}${labels.map((l, i) => (n > 16 && i % Math.ceil(n / 12)) ? '' : `<text x="${i * bw + bw / 2}" y="${H + 13}" text-anchor="middle" class="ax">${l}</text>`).join('')}</svg>`;
}
const bars = (ent, col, fmt = num) => { const mx = Math.max(1, ...ent.map(e => e[1])); return ent.length ? ent.map(([l, v]) => `<div class="br"><span title="${esc(l)}">${esc(l)}</span><i style="width:${v / mx * 100}%;background:${(typeof col === 'function' ? col(l) : col) || 'var(--ac)'}"></i><em>${fmt(v)}</em></div>`).join('') : '<p class="sub">データなし</p>'; };
const mLabels = R => { const m = cnt(R, r => r.m), ks = [...m.keys()].sort(); return { ks, lab: ks.map(k => k.slice(2)), m }; };
function hw(R) {
  const g = Array.from({ length: 7 }, () => Array(24).fill(0)); R.forEach(r => g[r.wd][r.h]++); const mx = Math.max(1, ...g.flat()), D = '日月火水木金土';
  return `<div class="hw"><span></span>${[...Array(24).keys()].map(h => `<i class="hl">${h % 3 ? '' : h}</i>`).join('')}${g.map((row, d) => `<b>${D[d]}</b>` + row.map((v, h) => `<i title="${D[d]}曜 ${h}時: ${v}" style="background:color-mix(in srgb,var(--ac) ${Math.round(v / mx * 100)}%,var(--card2))"></i>`).join('')).join('')}</div>`;
}
function yearHeat(year, cm) {
  const j1 = dnOf(`${year}-01-01`), st = j1 - ((j1 + 4) % 7); let mx = 1; cm.forEach(v => { mx = Math.max(mx, v); }); let o = '';
  for (let w = 0; w < 53; w++)for (let d = 0; d < 7; d++) { const ds = dstr(st + w * 7 + d); if (ds.slice(0, 4) !== String(year)) continue; const v = cm.get(ds) || 0; o += `<rect x="${26 + w * 13}" y="${d * 13 + 14}" width="11" height="11" rx="2" class="h${v ? Math.ceil(v / mx * 4) : 0}"><title>${ds}: ${v}件</title></rect>`; }
  const ml = [...Array(12)].map((_, m) => `<text x="${26 + Math.floor((dnOf(`${year}-${String(m + 1).padStart(2, '0')}-01`) - st) / 7) * 13}" y="9" class="ax">${m + 1}月</text>`).join('');
  return `<svg viewBox="0 0 730 112" class="chart cal">${ml}${'日月火水木金土'.split('').map((c, i) => i % 2 ? `<text x="0" y="${i * 13 + 24}" class="ax">${c}</text>` : '').join('')}${o}</svg>`;
}
const card = (t, h) => `<section class="card">${t ? `<h3>${t}</h3>` : ''}${h}</section>`;
const tbl = (hd, rows) => `<div style="overflow-x:auto"><table><tr>${hd.map(x => `<th>${x}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(x => `<td class="${/^[\d.,:%h]+$/.test(String(x)) ? 'n' : ''}">${x}</td>`).join('')}</tr>`).join('')}</table></div>`;
const kcs = a => `<div class="kcs">${a.map(([l, v]) => `<div class="kc"><span>${l}</span><b>${v}</b></div>`).join('')}</div>`;
const vurl = r => r.kind === 'search' ? `https://www.youtube.com/results?search_query=${encodeURIComponent(r.title)}` : /^[\w-]{11}$/.test(r.id) && r.kind === 'watch' ? `https://www.youtube.com/watch?v=${r.id}` : `https://www.youtube.com/post/${r.id}`;
const vlink = r => `<a href="${esc(vurl(r))}" target="_blank" rel="noreferrer">${esc(r.title)}</a>`;
const vcell = r => `<div class="vc">${r.kind === 'watch' && /^[\w-]{11}$/.test(r.id) ? `<img loading="lazy" src="https://i.ytimg.com/vi/${r.id}/mqdefault.jpg" alt="">` : ''}<div>${vlink(r)}<div class="sub">${esc(r.ch)}</div></div></div>`;
const pill = g => g ? `<span class="pill" style="background:${GCOL[g] || '#888'}">${esc(g)}</span>` : '';
const rangeBar = () => { const sp = span(); return `<div class="rb">${[['7', '7日'], ['28', '28日'], ['90', '90日'], ['365', '365日'], ['all', '全期間'], ['custom', '期間指定']].map(([v, l]) => `<button class="chip ${S.range === v ? 'on' : ''}" data-a="range" data-v="${v}">${l}</button>`).join('')}${S.range === 'custom' ? `<input type="date" data-a="from" value="${S.from || dstr(sp.a)}"> – <input type="date" data-a="to" value="${S.to || dstr(sp.b)}">` : ''}<span class="mut">${dstr(sp.a)} 〜 ${dstr(sp.b)}(${sp.L}日間)</span></div>`; };
const genreSel = k => `<select data-a="ovr" data-k="${esc(k)}"><option value="">自動(${esc(S.chg.get(k) || 'その他')})</option>${GENRES.map(g => `<option ${S.ov[k] === g ? 'selected' : ''}>${g}</option>`).join('')}</select>`;
const empty = () => (typeof G2 !== 'undefined' && G2.empty ? G2.empty() : empty0());
const empty0 = () => `<div class="card empty"><h2>履歴データがありません</h2><p class="sub">Googleマイアクティビティを保存した .mhtml をここにドラッグ&ドロップ(複数可)するか、下のボタンから選んでください。</p><button class="pri" data-a="pick">mhtmlを読み込む</button></div>`;

/* ===== views ===== */
const V = {};
V.dash = () => {
  const sp = span(), R = sel(S.raw, sp.a, sp.b), P = sel(S.raw, sp.pa, sp.pb), k = kpi(R), p = kpi(P);
  const M = [['views', '視聴回数', k.views, p.views, num], ['secs', '再生時間(動画長)', k.secs, p.secs, hrs], ['uniq', 'ユニーク動画', k.uniq, p.uniq, num], ['chs', 'チャンネル数', k.chs, p.chs, num], ['q', '検索回数', k.q, p.q, num]];
  const se = series(R, sp, S.metric), gc = cnt(k.W, r => r.g), tc = new Map(), tv = new Map();
  k.W.forEach(r => { const c = tc.get(ck(r)) || { n: r.ch, c: 0 }; c.c++; tc.set(ck(r), c); const v = tv.get(r.id) || { r, c: 0 }; v.c++; tv.set(r.id, v); });
  return rangeBar() + `<div class="kcs">${M.map(([id, l, c, pv, f]) => `<div class="kc ${S.metric === id ? 'on' : ''}" data-a="metric" data-v="${id}"><span>${l}</span><b>${f(c)}</b>${delta(c, pv)}</div>`).join('')}</div>` +
    card(M.find(m => m[0] === S.metric)[1] + (se.mode === 'd' ? '(日別)' : se.mode === 'w' ? '(週別)' : '(月別)'), lineChart(se.keys, se.vals)) +
    `<div class="g2">${card('ジャンル別 視聴回数', bars(topN(gc, 10), l => GCOL[l]))}${card('よく見たチャンネル', bars([...tc.values()].sort((a, b) => b.c - a.c).slice(0, 8).map(o => [o.n, o.c])))}</div>` +
    `<div class="g2">${card('時間帯 × 曜日', hw(R))}${card('よく見た動画', tbl(['動画', '回'], [...tv.values()].sort((a, b) => b.c - a.c).slice(0, 6).map(o => [vcell(o.r), o.c])))}</div>` +
    card('最近の履歴', tbl(['日時', '内容', 'ジャンル'], R.slice(-8).reverse().map(r => [`${r.d} ${r.t}`, vcell(r), pill(r.g)])));
};
function drawContent() {
  const sp = span(), f = S.f, q = f.q.toLowerCase(); let L = sel(S.raw, sp.a, sp.b).filter(r => (!f.kind || r.kind === f.kind) && (!f.g || r.g === f.g) && (!q || (r.title + ' ' + r.ch).toLowerCase().includes(q)));
  const so = { new: (a, b) => (b.d + b.t).localeCompare(a.d + a.t), old: (a, b) => (a.d + a.t).localeCompare(b.d + b.t), long: (a, b) => (b.dur || 0) - (a.dur || 0), prog: (a, b) => (b.pr || 0) - (a.pr || 0) }[f.sort];
  L = L.slice().sort(so); const PS = 50, pages = Math.max(1, Math.ceil(L.length / PS)); f.page = Math.min(f.page, pages - 1);
  $('#ct').innerHTML = `<p class="sub">${num(L.length)}件</p>` + tbl(['日時', '内容', 'ジャンル', '長さ', '進捗'], L.slice(f.page * PS, f.page * PS + PS).map(r => [`${r.d}<br>${r.t}`, vcell(r), pill(r.g), r.dur != null ? hm(r.dur) : '', r.pr != null ? `<div class="pb"><i style="width:${r.pr}%"></i></div>` : ''])) +
    `<div class="rb" style="margin-top:12px"><button data-a="page" data-v="${Math.max(0, f.page - 1)}">← 前</button><span class="mut">${f.page + 1} / ${pages}</span><button data-a="page" data-v="${Math.min(pages - 1, f.page + 1)}">次 →</button></div>`;
}
V.content = () => { const f = S.f; return rangeBar() + `<div class="rb"><input data-a="q" placeholder="タイトル・チャンネルで検索" value="${esc(f.q)}" size="32"><select data-a="fkind">${[['watch', '視聴'], ['search', '検索'], ['view', '投稿表示'], ['', 'すべて']].map(([v, l]) => `<option value="${v}" ${f.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select><select data-a="fg"><option value="">全ジャンル</option>${GENRES.map(g => `<option ${f.g === g ? 'selected' : ''}>${g}</option>`).join('')}</select><select data-a="fsort">${[['new', '新しい順'], ['old', '古い順'], ['long', '長い順'], ['prog', '進捗順']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="card" id="ct"></div>`; };
V.channels = () => {
  const sp = span(), R = sel(S.W, sp.a, sp.b), m = new Map();
  R.forEach(r => { const k = ck(r) || '(不明)', o = m.get(k) || { k, n: r.ch || k, c: 0, s: 0, v: new Set(), f: r.d, l: r.d, pn: 0, ps: 0 }; o.c++; o.s += r.dur || 0; o.v.add(r.id); if (r.d < o.f) o.f = r.d; if (r.d > o.l) o.l = r.d; if (r.pr != null) { o.pn++; o.ps += r.pr; } m.set(k, o); });
  const L = [...m.values()].sort((a, b) => b.c - a.c || b.s - a.s).slice(0, 200);
  return rangeBar() + card(`チャンネル(${m.size}件中 上位200)`, `<p class="sub">ジャンルは自動判定です。プルダウンで修正すると、そのチャンネルの全動画に反映されます。</p>` + tbl(['チャンネル', 'ジャンル', '視聴', '動画', '時間', '平均進捗', '初回', '最終'], L.map(o => [`<a href="#" data-a="chan" data-v="${esc(o.k)}">${esc(o.n)}</a>`, genreSel(o.k), num(o.c), num(o.v.size), hrs(o.s), o.pn ? Math.round(o.ps / o.pn) + '%' : '-', o.f, o.l])));
};
V.channel = () => {
  const sp = span(), all = S.W.filter(r => ck(r) === S.ch); if (!all.length) return card('', '見つかりません');
  const R = sel(all, sp.a, sp.b), k = kpi(R), { ks, lab, m } = mLabels(R), tv = new Map(); R.forEach(r => { const o = tv.get(r.id) || { r, c: 0 }; o.c++; tv.set(r.id, o); });
  return `<p><a href="#" data-a="nav" data-v="channels">← チャンネル一覧</a></p>` + rangeBar() + `<h2>${esc(all[all.length - 1].ch || S.ch)}<small>${esc(S.chg.get(S.ch) || '')} / 初回 ${all[0].d} / 全期間 ${num(all.length)}回</small></h2>` + kcs([['視聴(期間内)', num(k.views)], ['ユニーク動画', num(k.uniq)], ['再生時間', hrs(k.secs)]]) +
    card('月別視聴', cols(lab, ks.map(x => m.get(x)))) + card('動画', tbl(['動画', '回', '長さ', '最終視聴'], [...tv.values()].sort((a, b) => b.c - a.c).slice(0, 50).map(o => [vcell(o.r), o.c, hm(o.r.dur), o.r.d])));
};
const GEX = {
  '配信・切り抜き': W => { const f = [['切り抜き', /切り抜き/], ['ダイジェスト', /ダイジェスト/], ['雑談', /雑談/], ['生配信・ライブ', /生配信|ライブ|配信/]], m = new Map(); W.forEach(r => { const k = (f.find(([, re]) => re.test(r.title + r.ch)) || ['その他'])[0], o = m.get(k) || { n: 0, s: 0 }; o.n++; o.s += r.dur || 0; m.set(k, o); }); return card('形式別', tbl(['形式', '回', '時間'], [...m].sort((a, b) => b[1].n - a[1].n).map(([k, o]) => [k, num(o.n), hrs(o.s)]))); },
  'ゲーム': W => { const m = new Map(); W.forEach(r => { const g = GAMEDB.find(([, re]) => re.test(r.title)); if (g) m.set(g[0], (m.get(g[0]) || 0) + 1); }); return card('ゲームタイトル別(検出分)', bars(topN(m, 12))); },
  'ニュース': W => card('時間帯別', bars([['早朝 5〜9時', 5, 9], ['日中 9〜17時', 9, 17], ['夜 17〜24時', 17, 24], ['深夜 0〜5時', 0, 5]].map(([l, a, z]) => [l, W.filter(r => r.h >= a && r.h < z).length]))),
};
function genreKpis(G) {
  const k = kpi(G), pr = G.filter(r => r.pr != null), sh = G.filter(r => r.dur != null && r.dur <= 60).length;
  return kcs([['視聴回数', num(k.views)], ['ユニーク動画', num(k.uniq)], ['再生時間', hrs(k.secs)], ['平均の長さ', hm(k.secs / Math.max(1, G.filter(r => r.dur != null).length))], ['高進捗率(75%+)', pct(pr.filter(r => r.pr >= 75).length, pr.length)], ['ショート率', pct(sh, G.length)], ['再視聴率', pct(k.views - k.uniq, k.views)]]);
}
V.genres = () => {
  const sp = span(), R = sel(S.W, sp.a, sp.b), gc = cnt(R, r => r.g);
  if (!gc.get(S.genre)) S.genre = [...gc.keys()][0] || S.genre;
  const G = R.filter(r => r.g === S.genre), { ks, lab, m } = mLabels(G), tc = new Map(), tv = new Map(), hr = Array(24).fill(0);
  G.forEach(r => { const c = tc.get(ck(r)) || { n: r.ch, c: 0, s: 0 }; c.c++; c.s += r.dur || 0; tc.set(ck(r), c); const v = tv.get(r.id) || { r, c: 0 }; v.c++; tv.set(r.id, v); hr[r.h]++; });
  return rangeBar() + `<div class="rb">${GENRES.filter(g => gc.get(g)).map(g => `<button class="chip ${S.genre === g ? 'on' : ''}" data-a="genre" data-v="${g}" style="--c:${GCOL[g]}">${g}<small>${gc.get(g)}</small></button>`).join('')}</div>` +
    (S.genre === '音楽' ? `<p class="sub">音楽は専用の詳細分析ページがあります → <a href="#" data-a="nav" data-v="music"><u>音楽</u></a></p>` : '') + genreKpis(G) +
    `<div class="g2">${card('月別', cols(lab, ks.map(x => m.get(x)), GCOL[S.genre]))}${card('時間帯別', cols([...Array(24).keys()].map(String), hr, GCOL[S.genre]))}</div>` +
    (GEX[S.genre] ? GEX[S.genre](G) : '') +
    `<div class="g2">${card('チャンネル TOP15', tbl(['チャンネル', '回', '時間'], [...tc.values()].sort((a, b) => b.c - a.c).slice(0, 15).map(o => [esc(o.n), o.c, hrs(o.s)])))}${card('頻出キーワード', tbl(['語', '回'], terms(G.map(r => r.title), 20).map(([w, c]) => [esc(w), c])))}</div>` +
    card('動画 TOP20', tbl(['動画', '回', '長さ'], [...tv.values()].sort((a, b) => b.c - a.c).slice(0, 20).map(o => [vcell(o.r), o.c, hm(o.r.dur)])));
};
V.music = () => {
  const sp = span(), allM = S.W.filter(r => r.g === '音楽'), M = sel(allM, sp.a, sp.b), RW = sel(S.W, sp.a, sp.b);
  if (!allM.length) return rangeBar() + card('音楽', '<p class="sub">音楽と判定された視聴がありません。タイトルのキーワードで自動判定しています。チャンネル画面でジャンルを「音楽」に修正すると反映されます。</p>');
  const k = kpi(M), first = new Map(); allM.forEach(r => { if (!first.has(r.id)) first.set(r.id, r.m); });
  const { ks, lab, m } = mLabels(M), nw = new Map(); first.forEach(mo => nw.set(mo, (nw.get(mo) || 0) + 1));
  const hr = Array(24).fill(0), wd = Array(7).fill(0), sub = new Map(), tr = new Map(), ar = new Map();
  M.forEach(r => { hr[r.h]++; wd[r.wd]++; const s = musicSub(r.title + ' ' + r.ch), o = sub.get(s) || { n: 0, s: 0 }; o.n++; o.s += r.dur || 0; sub.set(s, o); const t = tr.get(r.id) || { r, c: 0, l: r.d }; t.c++; if (r.d > t.l) t.l = r.d; tr.set(r.id, t); const a = artistOf(r.title, r.ch), x = ar.get(a) || { c: 0, v: new Set() }; x.c++; x.v.add(r.id); ar.set(a, x); });
  const st = streaks([...new Set(M.map(r => r.dn))].sort((a, b) => a - b)), tl = [...tr.values()], long = tl.filter(t => (t.r.dur || 0) >= 1800).sort((a, b) => b.c - a.c).slice(0, 10);
  const qs = cnt(sel(S.raw, sp.a, sp.b).filter(r => r.kind === 'search' && classify(r.title, '') === '音楽'), r => r.title);
  return rangeBar() + `<h2>音楽の分析<small>タイトル・チャンネルのキーワードによる自動判定</small></h2>` +
    kcs([['再生回数', num(k.views)], ['ユニーク曲', num(k.uniq)], ['総再生時間', hrs(k.secs)], ['平均の長さ', hm(k.secs / Math.max(1, M.filter(r => r.dur != null).length))], ['視聴に占める割合(回)', pct(k.views, RW.length)], ['視聴に占める割合(時間)', pct(k.secs, kpi(RW).secs)], ['連続再生日数(最長)', st.longest + '日'], ['リピート率', pct(k.views - k.uniq, k.views)]]) +
    `<div class="g2">${card('月別 再生回数', cols(lab, ks.map(x => m.get(x)), GCOL['音楽']))}${card('月別 新しく聴いた曲数(初登場)', cols(lab, ks.map(x => nw.get(x) || 0), '#12b886'))}</div>` +
    `<div class="g2">${card('時間帯別', cols([...Array(24).keys()].map(String), hr, GCOL['音楽']))}${card('曜日別', cols('日月火水木金土'.split(''), wd, GCOL['音楽']))}</div>` +
    `<div class="g2">${card('サブジャンル', tbl(['種類', '回', '時間'], [...sub].sort((a, b) => b[1].n - a[1].n).map(([s, o]) => [s, num(o.n), hrs(o.s)])))}${card('アーティスト/チャンネル TOP15', tbl(['名前', '回', '曲数'], [...ar].sort((a, b) => b[1].c - a[1].c).slice(0, 15).map(([a, o]) => [esc(a), o.c, o.v.size])))}</div>` +
    card('よく聴いた曲 TOP20', tbl(['曲', '回', '長さ', '最後に聴いた日'], tl.sort((a, b) => b.c - a.c).slice(0, 20).map(t => [vcell(t.r), t.c, hm(t.r.dur), t.l]))) +
    `<div class="g2">${card('ヘビロテ(3回以上)', `<p class="sub">${tl.filter(t => t.c >= 3).length}曲</p>` + tbl(['曲', '回'], tl.filter(t => t.c >= 3).sort((a, b) => b.c - a.c).slice(0, 10).map(t => [vcell(t.r), t.c])))}${card('作業用・長尺(30分以上)', tbl(['動画', '回', '長さ'], long.map(t => [vcell(t.r), t.c, hm(t.r.dur)])))}</div>` +
    card('音楽に関する検索', tbl(['検索語', '回'], topN(qs, 15).map(([q, c]) => [esc(q), c])));
};
V.search = () => {
  const sp = span(), R = sel(S.raw, sp.a, sp.b).filter(r => r.kind === 'search'), m = new Map();
  R.forEach(r => { const o = m.get(r.title) || { q: r.title, c: 0, f: r.d, l: r.d }; o.c++; if (r.d < o.f) o.f = r.d; if (r.d > o.l) o.l = r.d; m.set(r.title, o); });
  const { ks, lab, m: mm } = mLabels(R), days = new Set(R.map(r => r.d)).size;
  return rangeBar() + kcs([['検索回数', num(R.length)], ['ユニーク検索語', num(m.size)], ['1日あたり(検索した日)', (R.length / Math.max(1, days)).toFixed(1)]]) + card('月別 検索回数', cols(lab, ks.map(x => mm.get(x)))) +
    `<div class="g2">${card('検索ワード TOP50', tbl(['検索語', '回', '初回', '最終'], [...m.values()].sort((a, b) => b.c - a.c).slice(0, 50).map(o => [`<a href="${esc(vurl({ kind: 'search', title: o.q }))}" target="_blank" rel="noreferrer">${esc(o.q)}</a>`, o.c, o.f, o.l])))}${card('頻出キーワード', tbl(['語', '回'], terms(R.map(r => r.title), 30).map(([w, c]) => [esc(w), c])))}</div>`;
};
V.calendar = () => {
  const cm = new Map(); S.raw.forEach(r => cm.set(r.d, (cm.get(r.d) || 0) + 1));
  const dns = [...cm.keys()].map(dnOf).sort((a, b) => a - b), st = streaks(dns), ys = [...new Set(S.raw.map(r => +r.d.slice(0, 4)))].sort((a, b) => b - a);
  return kcs([['記録のある日', num(cm.size) + '日'], ['最長連続', st.longest + '日'], ['現在の連続(最新日まで)', st.current + '日'], ['1日あたり(記録日)', (S.raw.length / cm.size).toFixed(1) + '件']]) +
    ys.map(y => card(`${y}年`, yearHeat(y, cm))).join('') + card('最も活動が多かった日', tbl(['日付', '件数'], topN(cm, 10).map(([d, c]) => [d, c])));
};
V.quality = () => {
  const dns = [...new Set(S.raw.map(r => r.dn))].sort((a, b) => a - b), miss = []; let t0 = null;
  for (let i = 1; i < dns.length; i++) if (dns[i] - dns[i - 1] > 1) miss.push([dns[i - 1] + 1, dns[i] - 1]);
  const W = S.W, un = S.W.filter(r => r.g === 'その他'), uc = new Map(); un.forEach(r => { const k = ck(r); const o = uc.get(k) || { n: r.ch, c: 0, k }; o.c++; uc.set(k, o); });
  const prod = cnt(S.raw, r => r.prod || '?'), mn = miss.reduce((s, [a, b]) => s + b - a + 1, 0);
  return kcs([['総件数', num(S.raw.length)], ['期間', S.raw.length ? `${S.raw[0].d}〜${S.raw[S.raw.length - 1].d}` : '-'], ['欠損日(0件の日)', mn + '日'], ['長さ不明の視聴', pct(W.filter(r => r.dur == null).length, W.length)], ['チャンネル不明', pct(W.filter(r => !r.ch).length, W.length)], ['ジャンル「その他」', pct(un.length, W.length)]]) +
    card('取り込み済みファイル', S.files.length ? tbl(['ファイル', '件数', '期間', 'スキップ', '取込日時'], S.files.map(f => [esc(f.name), num(f.n), `${f.from}〜${f.to}`, f.skipped, new Date(f.at).toLocaleString('ja-JP')])) : '<p class="sub">なし</p>') +
    card(`欠損日(${miss.length}区間)`, `<p class="sub">履歴が1件もない日の連続区間です。mhtml保存時に遅延読み込みが途中で止まった/ファイルが足りない可能性があります。単に視聴しなかった日も含みます。</p>` + (miss.length ? tbl(['期間', '日数'], miss.slice(0, 60).map(([a, b]) => [a === b ? dstr(a) : `${dstr(a)}〜${dstr(b)}`, b - a + 1])) : '<p class="sub">なし</p>')) +
    `<div class="g2">${card('製品別', bars(topN(prod, 5)))}${card('ジャンル未分類のチャンネル(修正すると精度が上がります)', tbl(['チャンネル', 'ジャンル', '回'], [...uc.values()].sort((a, b) => b.c - a.c).slice(0, 15).map(o => [esc(o.n), genreSel(o.k), o.c])))}</div>` +
    card('エラーログ', `<pre class="log">${esc(S.errors.join('\n') || 'エラーはありません')}</pre>`);
};
V.settings = () => card('データの取り込み', `<p class="sub">mhtml(複数可)をこの画面か、どこにでもドラッグ&ドロップできます。同じ記録は自動で重複排除されます。</p><div class="rb"><button class="pri" data-a="pick">mhtmlを選択</button></div>`) +
  card('エクスポート', `<div class="rb"><button data-a="export" data-v="csv">CSV</button><button data-a="export" data-v="json">JSON</button><button data-a="export" data-v="sql">SQL(SQLite)</button><button data-a="export" data-v="backup">バックアップ(JSON)</button><button data-a="restore">バックアップから復元</button></div><p class="sub">CSV/JSON/SQLにはジャンル判定も含まれます。</p>`) +
  card('表示', `<div class="rb"><select data-a="theme">${[['auto', '自動'], ['light', 'ライト'], ['dark', 'ダーク']].map(([v, l]) => `<option value="${v}" ${(ls.get('ytha.theme', 'auto')) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`) +
  card('ジャンル設定', `<p class="sub">手動で変更したチャンネル: ${Object.keys(S.ov).length}件</p><div class="rb"><button data-a="resetov">手動設定をすべてリセット</button></div>`) +
  card('危険な操作', `<button class="dng" data-a="clear">保存済みの履歴をすべて削除</button>`);

/* ===== render / events ===== */
const NAV = [['dash', 'ダッシュボード', '▦'], ['content', 'コンテンツ', '▶'], ['channels', 'チャンネル', '◉'], ['genres', 'ジャンル', '◧'], ['music', '音楽', '♪'], ['search', '検索', '⌕'], ['calendar', 'カレンダー', '▤'], ['quality', 'データ品質', '✓'], ['settings', '設定・入出力', '⚙']];
function render() {
  $('#nav').innerHTML = `<div class="logo">▶ 履歴アナライザー</div>` + NAV.map(([id, l, i]) => `<a href="#" class="${S.view === id || (S.view === 'channel' && id === 'channels') ? 'on' : ''}" data-a="nav" data-v="${id}"><i>${i}</i>${l}</a>`).join('') + `<div class="nf">${num(S.raw.length)}件${S.raw.length ? `<br>${S.raw[0].d}〜<br>${S.raw[S.raw.length - 1].d}` : ''}</div>`;
  let h; try { h = !S.raw.length && !['settings', 'quality'].includes(S.view) ? empty() : V[S.view](); } catch (e) { err(e, S.view); h = `<div class="card errb"><h3>この画面の描画でエラーが発生しました</h3><pre class="log">${esc(e && e.stack || e)}</pre></div>`; }
  $('#view').innerHTML = h;
  if (S.view === 'content' && S.raw.length && $('#ct')) try { drawContent(); } catch (e) { err(e, 'content'); }
  ls.set('ytha.ui', { view: S.view === 'channel' ? 'channels' : S.view, range: S.range, metric: S.metric, genre: S.genre });
}
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const q1 = s => "'" + String(s ?? '').replace(/'/g, "''") + "'", n1 = v => v == null ? 'NULL' : v;
function doExport(kind) {
  const R = S.raw; if (!R.length) return toast('データがありません');
  const clean = ({ dn, m, h, wd, bg, ...r }) => r;
  if (kind === 'csv') { const c = s => '"' + String(s ?? '').replace(/"/g, '""') + '"'; download('youtube_history.csv', '\ufeff日付,時刻,種別,ID,タイトル,チャンネル,チャンネルID,長さ(秒),進捗(%),ジャンル,製品\n' + R.map(r => [r.d, r.t, r.kind, r.id, c(r.title), c(r.ch), r.chid, r.dur ?? '', r.pr ?? '', r.g, r.prod || ''].join(',')).join('\n'), 'text/csv'); }
  else if (kind === 'json') download('youtube_history.json', JSON.stringify(R.map(r => ({ ...clean(r) })), null, 1), 'application/json');
  else if (kind === 'backup') download('ytha_backup.json', JSON.stringify(R.map(r => { const o = clean(r); delete o.g; return o; })), 'application/json');
  else if (kind === 'sql') {
    const ch = new Map(), vd = new Map(); R.forEach(r => { if (r.chid) ch.set(r.chid, r.ch); if (r.kind === 'watch') vd.set(r.id, [r.title, r.dur, r.chid, r.g]); });
    download('youtube_history.sql', `BEGIN;\nCREATE TABLE IF NOT EXISTS channel(id TEXT PRIMARY KEY,name TEXT);\nCREATE TABLE IF NOT EXISTS video(id TEXT PRIMARY KEY,title TEXT,duration_sec INT,channel_id TEXT,genre TEXT);\nCREATE TABLE IF NOT EXISTS activity(date TEXT,time TEXT,kind TEXT,target_id TEXT,query TEXT,progress_pct REAL,product TEXT,UNIQUE(date,time,kind,target_id));\n` +
      [...ch].map(([i, n]) => `INSERT OR REPLACE INTO channel VALUES(${q1(i)},${q1(n)});`).join('\n') + '\n' + [...vd].map(([i, [t, d, c, g]]) => `INSERT OR REPLACE INTO video VALUES(${q1(i)},${q1(t)},${n1(d)},${q1(c)},${q1(g)});`).join('\n') + '\n' +
      R.map(r => `INSERT OR IGNORE INTO activity VALUES(${q1(r.d)},${q1(r.t)},${q1(r.kind)},${q1(r.id)},${r.kind === 'search' ? q1(r.title) : 'NULL'},${n1(r.pr)},${q1(r.prod || '')});`).join('\n') + '\nCOMMIT;\n', 'application/sql');
  }
}
async function restore(file) {
  try { const a = JSON.parse(await file.text()); if (!Array.isArray(a)) throw new Error('配列ではありません'); const ok = a.filter(r => r && r.k && r.d && r.t && r.kind); if (!ok.length) throw new Error('有効な行がありません'); busy('復元中…', .5); await putMany('acts', ok); busy(''); await load(); toast(`${num(ok.length)}件を復元しました`); }
  catch (e) { busy(''); err(e, '復元'); }
}
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-a]'); if (!t || t.tagName === 'SELECT' || t.tagName === 'INPUT') return; const a = t.dataset.a, v = t.dataset.v; e.preventDefault();
  try {
    if (a === 'nav') { S.view = v; S.ch = null; window.scrollTo(0, 0); }
    else if (a === 'range') { if (v === 'custom') { const sp = span(); S.from = dstr(sp.a); S.to = dstr(sp.b); } S.range = v; }
    else if (a === 'metric') S.metric = v; else if (a === 'genre') S.genre = v;
    else if (a === 'chan') { S.ch = v; S.view = 'channel'; window.scrollTo(0, 0); }
    else if (a === 'page') { S.f.page = +v; }
    else if (a === 'export') { doExport(v); return; }
    else if (a === 'pick') { $('#file').click(); return; } else if (a === 'restore') { $('#rfile').click(); return; }
    else if (a === 'resetov') { if (!confirm('手動で設定したジャンルをすべて元に戻します。')) return; S.ov = {}; ls.set('ytha.ov', S.ov); prep(); }
    else if (a === 'clear') { if (!confirm('保存済みの履歴をすべて削除します。元に戻せません。(先にバックアップ推奨)')) return; await clearAll(); await load(); toast('削除しました'); return; }
    render();
  } catch (x) { err(x, a); }
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
  try {
    if (a === 'ovr') { if (t.value) S.ov[t.dataset.k] = t.value; else delete S.ov[t.dataset.k]; ls.set('ytha.ov', S.ov); prep(); render(); }
    else if (a === 'from' || a === 'to') { S[a] = t.value; render(); }
    else if (a === 'fkind') { S.f.kind = t.value; S.f.page = 0; drawContent(); } else if (a === 'fg') { S.f.g = t.value; S.f.page = 0; drawContent(); } else if (a === 'fsort') { S.f.sort = t.value; drawContent(); }
    else if (a === 'theme') { ls.set('ytha.theme', t.value); document.documentElement.dataset.t = t.value === 'auto' ? '' : t.value; }
  } catch (x) { err(x, a); }
});
document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.a === 'q') { S.f.q = t.value; S.f.page = 0; try { drawContent(); } catch (x) { err(x, 'search'); } } });
let dragN = 0;
addEventListener('dragenter', e => { e.preventDefault(); dragN++; $('#drop').hidden = false; });
addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; $('#drop').hidden = true; } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', async e => {
  e.preventDefault(); dragN = 0; $('#drop').hidden = true; const fs = [], items = [...e.dataTransfer.items || []].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean), plain = [...e.dataTransfer.files];
  const walk = async en => { if (en.isFile) fs.push(await new Promise((r, j) => en.file(r, j))); else if (en.isDirectory) { const rd = en.createReader(); let b; do { b = await new Promise((r, j) => rd.readEntries(r, j)); for (const x of b) await walk(x); } while (b.length); } };
  try { for (const en of items) await walk(en); } catch (x) { err(x, 'drop'); }
  ingest(fs.length ? fs : plain);
});
$('#file').onchange = e => { ingest(e.target.files); e.target.value = ''; };
$('#rfile').onchange = e => { if (e.target.files[0]) restore(e.target.files[0]); e.target.value = ''; };
addEventListener('error', e => err(e.error || e.message, 'JS'));
addEventListener('unhandledrejection', e => err(e.reason, 'Promise'));
async function init() {
  S.ov = ls.get('ytha.ov', {}); const ui = ls.get('ytha.ui', {}); Object.assign(S, { view: V[ui.view] ? ui.view : 'dash', range: ui.range || '28', metric: ui.metric || 'views', genre: ui.genre || '音楽' });
  const th = ls.get('ytha.theme', 'auto'); if (th !== 'auto') document.documentElement.dataset.t = th;
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { }
  await load();
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init); else init();
window.__app = { S, V, ingest, load, go(v) { S.view = v; render(); }, putMany, render };
