'use strict';
/* ===== 音楽タブ強化: 全曲リスト / プレイリスト / キュー / アプリ内プレーヤー ===== */
G2.msub = ls.get('ytha.msub', 'analysis'); G2.plSel = null;
G2.lf = { q: '', sort: 'n', sub: '', artist: '', chip: '', page: 0 };
const P = G2.P = Object.assign({ q: [], i: 0, repeat: 'all', shuffle: false, vol: 80, rate: 1 }, ls.get('ytha.player', {}));
Object.assign(P, { playing: false, t: 0, dur: 0, ready: false, init: false, last: -1, big: false, loopA: null, loopB: null, sl: 0 });
if (!Array.isArray(P.q)) P.q = []; P.i = Math.min(Math.max(0, P.i | 0), Math.max(0, P.q.length - 1));
G2.pSave = () => ls.set('ytha.player', { q: P.q.slice(0, 2000), i: P.i, repeat: P.repeat, shuffle: P.shuffle, vol: P.vol, rate: P.rate });
const pinfo = id => G2.videos().get(id) || { id, title: id, ch: '', dur: null };
G2.songs = () => { if (G2.sc) return G2.sc; const a = []; G2.videos().forEach(v => { if (!G2.isMusic(v)) return; v.artist = artistOf(v.title, v.ch); v.sub = musicSub(v.title + ' ' + v.ch); a.push(v); }); return G2.sc = a.concat(G2.collSongs ? G2.collSongs() : []); };
const ytUrl = id => `https://www.youtube.com/watch?v=${id}`;

/* ----- 全曲リスト ----- */
G2.libList = () => {
  const f = G2.lf, q = f.q.toLowerCase();
  const L = G2.songs().filter(v => {
    const m = G2.meta.get(v.id) || {}, c = f.chip;
    if (f.sub && v.sub !== f.sub) return false; if (f.artist && v.artist !== f.artist) return false; if (q && !(v.title + ' ' + v.ch + ' ' + v.artist).toLowerCase().includes(q)) return false;
    if (c === 'star' && !m.star) return false; if (c === 'heavy' && v.n < 3) return false; if (c === 'song' && (v.dur || 0) >= 1800) return false; if (c === 'mix' && !((v.dur || 0) >= 1800)) return false; if (c === 'noemb' && !m.noembed) return false; if (c === 'liked' && !(G2.inColl && G2.inColl(v.id, 'liked'))) return false; if (c === 'later' && !(G2.inColl && G2.inColl(v.id, 'later'))) return false; return true;
  });
  const cd = (k, d) => (a, b) => (!a[k] && !b[k]) ? 0 : !a[k] ? 1 : !b[k] ? -1 : d * a[k].localeCompare(b[k]);   // 履歴のない曲(コレクションのみ)は常に末尾
  const so = { n: (a, b) => b.n - a.n || (b.last || '').localeCompare(a.last || ''), na: (a, b) => a.n - b.n || (a.last || '').localeCompare(b.last || ''), last: cd('last', -1), lasta: cd('last', 1), first: cd('first', 1), firstd: cd('first', -1), title: (a, b) => a.title.localeCompare(b.title, 'ja'), artist: (a, b) => a.artist.localeCompare(b.artist, 'ja') || b.n - a.n, dur: (a, b) => (b.dur || 0) - (a.dur || 0) }[f.sort];
  return L.sort(so);
};
G2.libView = () => {
  const all = G2.songs(); if (!all.length) return card('全曲リスト', '<p class="sub">音楽と判定された曲がありません。コンテンツ→動画別→動画をクリック→「音楽: 自動」を押すと、その動画を音楽として扱えます。</p>');
  const f = G2.lf, ar = new Map(); all.forEach(v => ar.set(v.artist, (ar.get(v.artist) || 0) + v.n));
  const yr = G2.today().slice(0, 4), first = all.reduce((a, v) => v.first && (!a || v.first < a) ? v.first : a, '');
  return kcs([['累計の曲数', num(all.length)], ['累計再生回数', num(all.reduce((s, v) => s + v.n, 0))], ['アーティスト/チャンネル', num(ar.size)], ['総再生時間', hrs(all.reduce((s, v) => s + v.secs, 0))], ['最初に聴いた日', first], [`${yr}年に初めて聴いた曲`, num(all.filter(v => v.first.slice(0, 4) === yr).length)], ...(ENG() === 'embed' ? [['アプリ内で再生可', num(all.filter(v => (G2.meta.get(v.id) || {}).emb === 1).length)], ['⚠再生不可', num(all.filter(v => blocked(v.id)).length)]] : [])]) +
    `<div class="rb"><input data-g="lq" placeholder="曲名・アーティストで検索" value="${esc(f.q)}" size="28"><select data-g="lsub"><option value="">全サブジャンル</option>${[...MSUB.map(x => x[0]), 'その他'].map(s => `<option ${f.sub === s ? 'selected' : ''}>${s}</option>`).join('')}</select><select data-g="lart"><option value="">全アーティスト</option>${topN(ar, 80).map(([a, n]) => `<option value="${esc(a)}" ${f.artist === a ? 'selected' : ''}>${esc(a)} (${n})</option>`).join('')}</select><select data-g="lsort">${[['n', '再生回数が多い順'], ['na', '再生回数が少ない順'], ['last', '最近聴いた順'], ['lasta', '最後に聴いたのが古い順'], ['first', '初めて聴いた順(古い順)'], ['firstd', '初めて聴いた順(新しい順)'], ['title', '曲名順'], ['artist', 'アーティスト順'], ['dur', '長い順']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` +
    `<div class="rb">${[['', 'すべて'], ['star', '★'], ['heavy', 'ヘビロテ(3回〜)'], ['song', '通常の曲(30分未満)'], ['mix', '長尺ミックス(30分〜)'], ['noemb', '⚠再生不可'], ...(G2.colls && G2.colls.length ? [['liked', '👍高評価'], ['later', '🕒後で見る']] : [])].map(([v, l]) => gchip(l, 'lchip', v, f.chip)).join('')}<span style="flex:1"></span><button class="pri" data-g="lplay">▶ この一覧を再生</button>${ENG() === 'embed' ? `<button data-g="lchk" title="埋め込み再生できる曲かを事前に判定します">再生可否チェック</button><span id="chkst" class="mut"></span>` : ''}<button data-g="lshuf">🔀 シャッフル</button><button data-g="lcsv">CSV</button><button data-g="lurls">URL一覧</button></div><div class="card" id="lt"></div>`;
};
G2.drawLib = () => {
  const el = $('#lt'); if (!el) return; const f = G2.lf, L = G2.libList(), PS = 100, pages = Math.max(1, Math.ceil(L.length / PS)); f.page = Math.min(f.page, pages - 1); const s0 = f.page * PS;
  el.innerHTML = `<p class="sub">${num(L.length)}曲</p>` + tbl(['#', '曲', 'アーティスト', '種類', '回', '初回', '最終', '長さ', ''], L.slice(s0, s0 + PS).map((v, i) => [s0 + i + 1, `<div class="vc">${vthumb(v)}<div><a href="#" data-g="vopen" data-v="${v.id}">${esc(v.title)}</a>${(G2.meta.get(v.id) || {}).noembed ? ' ⚠' : ''} ${G2.cbadge ? G2.cbadge(v.id) : ''}</div></div>`, esc(v.artist), v.sub, `<b>${v.n}</b>`, v.first, v.last, v.dur != null ? hm(v.dur) : '', `<button data-g="play" data-v="${v.id}" data-src="lib">▶</button><button data-g="qadd" data-v="${v.id}" title="キューに追加">＋Q</button><button data-g="pladd" data-v="${v.id}" title="プレイリストに追加">＋PL</button>${stars(v.id)}`])) +
    `<div class="rb" style="margin-top:12px"><button data-g="lpage" data-v="${Math.max(0, f.page - 1)}">← 前</button><span class="mut">${f.page + 1} / ${pages}</span><button data-g="lpage" data-v="${Math.min(pages - 1, f.page + 1)}">次 →</button></div>`;
};
G2.acts.lchip = v => { G2.lf.chip = v; G2.lf.page = 0; render(); }; G2.acts.lpage = v => { G2.lf.page = +v; G2.drawLib(); };
G2.inp.lq = t => { G2.lf.q = t.value; G2.lf.page = 0; G2.drawLib(); };
['lsub:sub', 'lart:artist', 'lsort:sort'].forEach(x => { const [a, k] = x.split(':'); G2.chg[a] = t => { G2.lf[k] = t.value; G2.lf.page = 0; G2.drawLib(); }; });
G2.acts.lplay = () => { const L = G2.libList().slice(0, 1000).map(v => v.id); G2.qSet(L, 0); };
G2.acts.lshuf = () => { const L = G2.libList().slice(0, 1000).map(v => v.id); P.shuffle = true; G2.qSet(L, Math.floor(Math.random() * Math.max(1, L.length))); };
G2.acts.lcsv = () => G2.dl('music_library.csv', G2.csv(['曲名', 'アーティスト', 'チャンネル', '種類', '再生回数', '初回', '最終', '長さ(秒)', 'URL'], G2.libList().map(v => [v.title, v.artist, v.ch, v.sub, v.n, v.first, v.last, v.dur ?? '', ytUrl(v.id)])), 'text/csv');
G2.acts.lurls = async () => { await navigator.clipboard.writeText(G2.libList().map(v => ytUrl(v.id)).join('\n')); toast('URL一覧をコピーしました'); };
G2.acts.play = (id, t) => {
  if (blocked(id)) { window.open(ytUrl(id), '_blank'); return toast('埋め込み再生できない曲のため、YouTubeで開きました'); }
  const src = t.dataset.src; let ids = [id]; if (src === 'lib') ids = G2.libList().map(v => v.id); else if (src && src.startsWith('pl:')) { const p = G2.lists.find(x => x.id === src.slice(3)); if (p) ids = p.items; }
  let i = ids.indexOf(id); if (i < 0) { ids = [id]; i = 0; } if (ids.length > 1000) { const s = Math.max(0, i - 100); ids = ids.slice(s, s + 1000); i = ids.indexOf(id); } G2.qSet(ids, i);
};
G2.acts.qadd = id => G2.qAdd([id]);

/* ----- プレイリスト ----- */
G2.plSave = async pl => { pl.upd = Date.now(); const i = G2.listsAll.findIndex(x => x.id === pl.id); if (i < 0) G2.listsAll.push(pl); else G2.listsAll[i] = pl; G2.lists = G2.listsAll.filter(x => !x.del).sort((a, b) => a.created - b.created); await putMany('lists', [pl]); if (G2.schedule) G2.schedule(); };
G2.plNew = async (name, items = []) => { const pl = { id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, items: [...new Set(items)], created: Date.now() }; await G2.plSave(pl); return pl; };
G2.auto = {
  top: ['よく聴いた曲 TOP50', S0 => S0.sort((a, b) => b.n - a.n).slice(0, 50)], recent: ['最近聴いた30曲', S0 => S0.sort((a, b) => b.last.localeCompare(a.last)).slice(0, 30)],
  heavy: ['ヘビロテ(3回以上)', S0 => S0.filter(v => v.n >= 3).sort((a, b) => b.n - a.n)], forgot: ['忘れかけの名曲(昔よく聴いた)', S0 => S0.filter(v => v.n >= 3 && dnOf(v.last) < dnOf(G2.today()) - 90).sort((a, b) => b.n - a.n)],
  star: ['★お気に入り', S0 => S0.filter(v => G2.getMeta(v.id).star)], mix: ['作業用・長尺ミックス', S0 => S0.filter(v => (v.dur || 0) >= 1800).sort((a, b) => b.n - a.n)],
  year: ['今年初めて聴いた曲', S0 => S0.filter(v => v.first.slice(0, 4) === G2.today().slice(0, 4)).sort((a, b) => b.n - a.n)]
};
const plTime = p => p.items.reduce((s, id) => s + (pinfo(id).dur || 0), 0);
G2.plView = () => {
  const sel = G2.lists.find(x => x.id === G2.plSel);
  return `<div class="rb"><button class="pri" data-g="plnew">＋ 新規プレイリスト</button><select data-g="plauto"><option value="">自動プレイリストを作る…</option>${Object.entries(G2.auto).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('')}${MSUB.map(([n]) => `<option value="sub:${n}">サブジャンル: ${n}</option>`).join('')}</select></div>` +
    (G2.lists.length ? `<div class="rb">${G2.lists.map(p => gchip(`${esc(p.name)} <small>${p.items.length}</small>`, 'plsel', p.id, G2.plSel)).join('')}</div>` : '<p class="sub">プレイリストはまだありません。「自動プレイリスト」で一発作成できます。</p>') + (sel ? G2.plDetail(sel) : '');
};
G2.plDetail = p => card(`<input data-g="plname" data-v="${p.id}" value="${esc(p.name)}" style="font-size:16px;font-weight:600;width:min(420px,100%)"> <span class="sub">${p.items.length}曲 ・ ${hrs(plTime(p))}</span>`,
  `<div class="rb"><button class="pri" data-g="plplay" data-v="${p.id}">▶ 再生</button><button data-g="plshuf" data-v="${p.id}">🔀</button><button data-g="plq" data-v="${p.id}">キューに追加</button><button data-g="plyt" data-v="${p.id}">YouTubeで開く(先頭50曲)</button><button data-g="plcopy" data-v="${p.id}">URLコピー</button><button data-g="plm3u" data-v="${p.id}">M3U保存</button><button class="dng" data-g="pldel" data-v="${p.id}">削除</button></div>` +
  `<div class="rb"><input data-g="plsearch" placeholder="曲を検索して追加…" size="30"></div><div id="plres"></div>` +
  (p.items.length ? tbl(['#', '曲', '長さ', ''], p.items.map((id, i) => { const v = pinfo(id); return [i + 1, `<a href="#" data-g="vopen" data-v="${id}">${esc(v.title)}</a><div class="sub">${esc(v.ch)}</div>`, v.dur != null ? hm(v.dur) : '', `<button data-g="play" data-v="${id}" data-src="pl:${p.id}">▶</button><button data-g="plup" data-v="${p.id}:${i}">▲</button><button data-g="pldn" data-v="${p.id}:${i}">▼</button><button data-g="plrm" data-v="${p.id}:${i}">✕</button>`]; })) : '<p class="sub">曲がありません。上の検索か、全曲リストの「＋PL」で追加してください。</p>'));
const plOf = id => G2.lists.find(x => x.id === id);
G2.acts.plnew = async () => { const n = prompt('プレイリスト名'); if (!n || !n.trim()) return; G2.plSel = (await G2.plNew(n.trim())).id; render(); };
G2.chg.plauto = async t => { const k = t.value; if (!k) return; let name, L; if (k.startsWith('sub:')) { name = 'サブジャンル: ' + k.slice(4); L = G2.songs().filter(v => v.sub === k.slice(4)).sort((a, b) => b.n - a.n); } else { name = G2.auto[k][0]; L = G2.auto[k][1](G2.songs().slice()); } if (!L.length) { t.value = ''; return toast('該当する曲がありません'); } G2.plSel = (await G2.plNew(`${name} ${G2.today()}`, L.map(v => v.id))).id; render(); toast(`${L.length}曲のプレイリストを作成しました`); };
G2.acts.plsel = v => { G2.plSel = v; render(); };
G2.chg.plname = async t => { const p = plOf(t.dataset.v); if (p && t.value.trim()) { p.name = t.value.trim(); await G2.plSave(p); render(); } };
G2.acts.plplay = v => G2.qSet(plOf(v).items.slice(0, 2000), 0); G2.acts.plshuf = v => { const p = plOf(v); P.shuffle = true; G2.qSet(p.items.slice(0, 2000), Math.floor(Math.random() * Math.max(1, p.items.length))); };
G2.acts.plq = v => G2.qAdd(plOf(v).items.slice());
G2.acts.plyt = v => { const ids = plOf(v).items.slice(0, 50); if (ids.length) window.open(`https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}`, '_blank'); };
G2.acts.plcopy = async v => { await navigator.clipboard.writeText(plOf(v).items.map(ytUrl).join('\n')); toast('URLをコピーしました'); };
G2.acts.plm3u = v => { const p = plOf(v); G2.dl(`${p.name}.m3u8`, '#EXTM3U\n' + p.items.map(id => { const x = pinfo(id); return `#EXTINF:${x.dur || -1},${artistOf(x.title, x.ch)} - ${x.title}\n${ytUrl(id)}`; }).join('\n') + '\n', 'audio/x-mpegurl'); };
G2.acts.pldel = async v => { if (!confirm('このプレイリストを削除します。')) return; const p = plOf(v); await G2.plSave({ ...p, del: 1, items: [] }); G2.plSel = null; render(); };
const plMove = async (v, d) => { const [id, i] = v.split(':'), p = plOf(id), a = +i, b = a + d; if (!p || b < 0 || b >= p.items.length) return; [p.items[a], p.items[b]] = [p.items[b], p.items[a]]; await G2.plSave(p); render(); };
G2.acts.plup = v => plMove(v, -1); G2.acts.pldn = v => plMove(v, 1);
G2.acts.plrm = async v => { const [id, i] = v.split(':'), p = plOf(id); p.items.splice(+i, 1); await G2.plSave(p); render(); };
G2.inp.plsearch = t => {
  const p = plOf(G2.plSel), q = t.value.toLowerCase(), el = $('#plres'); if (!p || !el) return; if (!q) { el.innerHTML = ''; return; }
  const L = G2.songs().filter(v => !p.items.includes(v.id) && (v.title + ' ' + v.artist).toLowerCase().includes(q)).sort((a, b) => b.n - a.n).slice(0, 8);
  el.innerHTML = L.length ? tbl(['曲', ''], L.map(v => [esc(v.title) + `<div class="sub">${esc(v.artist)} ・ ${v.n}回</div>`, `<button data-g="pladd2" data-v="${v.id}">＋追加</button>`])) : '<p class="sub">該当なし</p>';
};
G2.acts.pladd2 = async v => { const p = plOf(G2.plSel); if (!p || p.items.includes(v)) return; p.items.push(v); await G2.plSave(p); const q = $('[data-g=plsearch]'), val = q && q.value; render(); const q2 = $('[data-g=plsearch]'); if (q2 && val) { q2.value = val; G2.inp.plsearch(q2); q2.focus(); } };
G2.acts.pladd = (id, t) => {
  const ids = (t.dataset.ids || id).split(',');
  G2.modal(`<h3>プレイリストに追加(${ids.length}曲)</h3>` + (G2.lists.length ? `<div class="rb">${G2.lists.map(p => `<button data-g="plpick" data-v="${p.id}" data-ids="${ids.join(',')}">${esc(p.name)} <small>${p.items.length}</small></button>`).join('')}</div>` : '') + `<div class="rb"><button class="pri" data-g="plpick" data-v="new" data-ids="${ids.join(',')}">＋ 新規プレイリストに追加</button></div>`);
};
G2.acts.plpick = async (v, t) => {
  const ids = t.dataset.ids.split(','); let p; if (v === 'new') { const n = prompt('新しいプレイリスト名'); if (!n || !n.trim()) return; p = await G2.plNew(n.trim(), ids); } else { p = plOf(v); p.items = [...new Set([...p.items, ...ids])]; await G2.plSave(p); }
  G2.acts.mclose(); toast(`「${p.name}」に追加しました`); render();
};

/* ----- 再生可否チェック(YouTube oEmbed: 埋め込み禁止なら401) ----- */
const ENG = () => G2.cfg.engine === 'embed' ? 'embed' : (G2.ext ? 'tab' : 'link');
const blocked = id => ENG() === 'embed' && !!(G2.meta.get(id) || {}).noembed;
G2.embedCheck = async (ids, o = {}) => {
  const todo = [...new Set(ids)].filter(id => isVid(id) && (G2.meta.get(id) || {}).emb == null);
  if (G2.chk) return o.silent ? 0 : toast('チェック実行中です'); if (!todo.length) return o.silent ? 0 : toast('チェック済みです');
  const st = G2.chk = { done: 0, total: todo.length, ok: 0, ng: 0, err: 0 }, out = []; let idx = 0, stop = false;
  const ui = () => { const e = $('#chkst'); if (e) e.textContent = `チェック中 ${st.done}/${st.total}(再生可 ${st.ok} / 不可 ${st.ng})`; };
  const flush = async () => { if (!out.length) return; const b = out.splice(0); b.forEach(m => G2.meta.set(m.id, m)); G2.sc = null; await putMany('vmeta', b); };
  const work = async () => {
    while (!stop && idx < todo.length) {
      const id = todo[idx++];
      try {
        const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(ytUrl(id))}`, { credentials: 'omit' });
        if (r.status === 429) stop = true; else if (r.ok) { out.push({ ...G2.getMeta(id), emb: 1, noembed: 0, upd: Date.now() }); st.ok++; } else if ([401, 403, 404].includes(r.status)) { out.push({ ...G2.getMeta(id), emb: 0, noembed: 1, upd: Date.now() }); st.ng++; } else st.err++;
      } catch { if (++st.err > 5) stop = true; }
      st.done++; ui(); if (out.length >= 50) await flush();
    }
  };
  try { await Promise.all([...Array(6)].map(work)); await flush(); } catch (e) { err(e, '再生可否チェック'); } finally { G2.chk = null; }
  ui(); if (!o.silent) { toast(stop ? 'チェックを中断しました(通信制限またはネットワークエラー)。しばらくして再実行してください' : `チェック完了: 再生可 ${st.ok}曲 / 不可 ${st.ng}曲`); if (st.ok === 0 && st.ng >= 20) toast('ほぼ全曲が再生不可と判定されました。YouTube側の制限か環境の問題の可能性があります(設定→アプリ内プレーヤー)'); if (S.view === 'music') render(); }
};
G2.acts.lchk = () => G2.embedCheck(G2.libList().map(v => v.id));
G2.acts.dkopen = () => { const id = P.q[P.i]; if (id) window.open(ytUrl(id), '_blank'); };

/* ----- キュー / プレーヤー ----- */
G2.queueHtml = () => {
  if (!P.q.length) return '<p class="sub">キューは空です。曲の ▶ や ＋Q から追加してください。</p>';
  const st = Math.max(0, Math.min(P.i - 10, P.q.length - 300));
  return P.q.slice(st, st + 300).map((id, k) => { const i = st + k, v = pinfo(id); return `<div class="qi ${i === P.i ? 'cur' : ''}"><span class="sub">${i + 1}</span><a href="#" data-g="qplay" data-v="${i}">${blocked(id) ? '⚠ ' : ''}${esc(v.title)}<div class="sub">${esc(v.ch)} ${v.dur != null ? hm(v.dur) : ''}</div></a><span><button data-g="qup" data-v="${i}">▲</button><button data-g="qdn" data-v="${i}">▼</button><button data-g="qrm" data-v="${i}">✕</button></span></div>`; }).join('') + `<div class="rb" style="margin-top:8px"><button data-g="qclear">キューを空にする</button><button data-g="qsave">プレイリストとして保存</button></div>`;
};
G2.queueView = () => card(`再生キュー(${P.q.length}曲)`, `<p class="sub">動画は画面下のプレーヤーで再生されます(Space: 再生/停止、N: 次、P: 前)。⛶で映像を大きく表示できます。⚠は埋め込み再生できない曲で、自動的に飛ばされます。</p><div id="qv">${G2.queueHtml()}</div>`) +
  card('ご注意', `<p class="sub">再生にはYouTubeの埋め込みを使います。権利者が埋め込みを禁止している動画や、YouTube側の仕様変更で再生できない場合は、自動でスキップして⚠を付けます(その場合は「YouTubeで開く」をご利用ください)。</p>`);
const _vm = V.music; G2.libMsg = null;
V.music = () => `<div class="tabs">${[['analysis', '分析'], ['library', '全曲リスト'], ['lists', 'プレイリスト'], ['queue', 'キュー・プレーヤー']].map(([v, l]) => gchip(l, 'msub', v, G2.msub)).join('')}</div>` + ({ analysis: _vm, library: G2.libView, lists: G2.plView, queue: G2.queueView }[G2.msub] || _vm)();
G2.acts.msub = v => { G2.msub = v; ls.set('ytha.msub', v); render(); };
const _post = G2.post; G2.post = () => { _post(); if (S.view === 'music' && G2.msub === 'library') G2.drawLib(); };

const embedSend = (func, args) => { const f = $('#ytf'); if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*'); };
const TCMD = { playVideo: 'play', pauseVideo: 'pause', seekTo: 'seek', setVolume: 'vol', setPlaybackRate: 'rate' };
const tabSend = (func, args) => { if (!P.tabId || typeof chrome === 'undefined' || !chrome.tabs || !TCMD[func]) return; chrome.tabs.sendMessage(P.tabId, { type: 'yt-cmd', cmd: TCMD[func], a: (args || [])[0] }).catch(() => { }); };
const ytSend = (func, args) => ENG() === 'embed' ? embedSend(func, args) : ENG() === 'tab' ? tabSend(func, args) : 0;
G2.linkOpen = id => { if (!id) return; window.open(`https://www.youtube.com/watch?v=${id}`, '_blank', 'noopener'); P.note = 'YouTubeで開きました'; G2.dockUI(); };
const clock = s => hm(s || 0);
G2.dockInit = () => {
  if ($('#dock')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="dock" hidden><div class="dkv" id="dkv"><iframe id="ytf" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" title="プレーヤー"></iframe><img id="dkimg" data-g="vbig" alt="" title="再生ウィンドウを前面に出す" style="display:none;width:100%;height:100%;object-fit:cover;cursor:pointer"></div><div class="dkm"><b id="dkt">-</b><span id="dka"></span></div>
<div class="dkc"><button data-g="prev">⏮</button><button class="pp" data-g="pp" id="dkpp">▶</button><button data-g="next">⏭</button><button data-g="shuf" id="dksh" title="シャッフル">🔀</button><button data-g="rep" id="dkrp" title="リピート">🔁</button></div>
<div class="dks"><span id="dkc">0:00</span><input type="range" id="dksk" min="0" max="1000" value="0"><span id="dkd">0:00</span></div>
<div class="dko"><span>🔊</span><input type="range" id="dkvl" min="0" max="100"><select id="dkrt" title="速度">${[.75, 1, 1.25, 1.5, 2].map(x => `<option value="${x}">${x}x</option>`).join('')}</select><select id="dksl" title="スリープタイマー"><option value="0">⏲ なし</option><option value="15">15分</option><option value="30">30分</option><option value="60">60分</option><option value="90">90分</option></select><button data-g="ab" id="dkab" title="A-Bリピート">A-B</button><button data-g="dkopen" title="YouTubeで開く">↗</button><button data-g="vbig" title="映像を拡大">⛶</button><button data-g="qtoggle">☰</button><button data-g="dkclose" title="プレーヤーを閉じる">✕</button></div></div><div id="qd" hidden></div>`);
  const sk = $('#dksk'); sk.oninput = () => { P.seeking = true; $('#dkc').textContent = clock(P.dur * sk.value / 1000); }; sk.onchange = () => { ytSend('seekTo', [P.dur * sk.value / 1000, true]); P.seeking = false; };
  $('#dkvl').oninput = e => { P.vol = +e.target.value; ytSend('setVolume', [P.vol]); G2.pSave(); };
  $('#dkrt').onchange = e => { P.rate = +e.target.value; ytSend('setPlaybackRate', [P.rate]); G2.pSave(); };
  $('#dksl').onchange = e => { clearTimeout(P.sl); const m = +e.target.value; if (m) { P.sl = setTimeout(() => { ytSend('pauseVideo'); P.playing = false; G2.dockUI(); toast('スリープタイマー: 停止しました'); }, m * 6e4); toast(`${m}分後に停止します`); } };
};
G2.dockSync = () => { G2.dockInit(); $('#dock').hidden = !P.q.length; document.body.classList.toggle('hasdock', !!P.q.length); G2.dockUI(); };
G2.dockUI = () => {
  if (!$('#dock')) return; const id = P.q[P.i], v = id ? pinfo(id) : null;
  $('#dkt').textContent = v ? v.title : '-'; $('#dka').textContent = v ? `${artistOf(v.title, v.ch)} ・ ${P.i + 1}/${P.q.length}${P.note ? ' ・ ' + P.note : ''}` : '';
  const em = ENG() === 'embed'; $('#ytf').style.display = em ? '' : 'none'; $('#dkimg').style.display = em ? 'none' : 'block'; if (!em && id && isVid(id) && $('#dkimg').getAttribute('src') !== thumb(id)) $('#dkimg').src = thumb(id);
  $('#dkpp').textContent = P.playing ? '⏸' : '▶'; $('#dksh').classList.toggle('on2', P.shuffle); $('#dkrp').textContent = P.repeat === 'one' ? '🔂' : '🔁'; $('#dkrp').classList.toggle('on2', P.repeat !== 'off');
  $('#dkvl').value = P.vol; $('#dkrt').value = String(P.rate); $('#dkab').classList.toggle('on2', P.loopA != null); $('#dkv').classList.toggle('big', P.big);
  if (!$('#qd').hidden) $('#qd').innerHTML = G2.queueHtml(); if ($('#qv')) $('#qv').innerHTML = G2.queueHtml(); G2.dockTime();
};
G2.dockTime = () => { if (!$('#dock') || P.seeking) return; $('#dkc').textContent = clock(P.t); $('#dkd').textContent = clock(P.dur); $('#dksk').value = P.dur ? Math.round(P.t / P.dur * 1000) : 0; };
G2.media = () => {
  try { const v = pinfo(P.q[P.i]); if (!navigator.mediaSession) return; navigator.mediaSession.metadata = new MediaMetadata({ title: v.title, artist: artistOf(v.title, v.ch), artwork: isVid(v.id) ? [{ src: thumb(v.id), sizes: '320x180', type: 'image/jpeg' }] : [] });
    [['play', () => G2.acts.pp()], ['pause', () => G2.acts.pp()], ['previoustrack', () => G2.prev()], ['nexttrack', () => G2.next()]].forEach(([a, f]) => navigator.mediaSession.setActionHandler(a, f)); } catch { }
};
G2.playIdx = (i, auto = true) => {
  if (!P.q.length) return; P.i = ((i % P.q.length) + P.q.length) % P.q.length; const id = P.q[P.i];
  Object.assign(P, { t: 0, dur: pinfo(id).dur || 0, ready: false, init: false, last: -1, loopA: null, loopB: null, playing: auto });
  if (ENG() === 'embed') { const f = $('#ytf'); f.onload = G2.listen; f.src = `https://www.youtube.com/embed/${id}?enablejsapi=1&autoplay=${auto ? 1 : 0}&playsinline=1&rel=0&origin=${encodeURIComponent(location.origin)}`; } else if (ENG() === 'tab') G2.tabLoad(id, auto); else if (auto) G2.linkOpen(id);
  G2.pSave(); G2.dockSync(); G2.media();
};
G2.listen = () => { clearInterval(P.hs); let n = 0; P.hs = setInterval(() => { const f = $('#ytf'); if (++n > 40 || P.ready || !f) return clearInterval(P.hs); f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); }, 400); };
G2.next = auto => {
  const n = P.q.length; if (!n) return; if (auto === true && P.repeat === 'one' && !blocked(P.q[P.i])) return G2.playIdx(P.i);
  const cand = []; for (let k = 1; k <= n; k++) { const i = (P.i + k) % n; if (!blocked(P.q[i]) || k === n) cand.push([k, i]); }
  const ok = cand.filter(([k, i]) => !blocked(P.q[i]) && i !== P.i || (k === n && !blocked(P.q[i])));
  if (!ok.length) { P.playing = false; G2.dockUI(); return toast('キュー内に埋め込み再生できる曲がありません'); }
  let i; if (P.shuffle && ok.length > 1) i = ok[Math.floor(Math.random() * ok.length)][1]; else { const f = ok[0]; if (P.repeat === 'off' && auto === true && f[1] <= P.i) { P.playing = false; if (ENG() === 'tab') G2.tabClose(); return G2.dockUI(); } i = f[1]; }
  G2.playIdx(i);
};
G2.prev = () => { if (P.t > 3) return ytSend('seekTo', [0, true]); G2.playIdx(P.i - 1); };
G2.qSet = (ids, i = 0, play = true) => {
  ids = ids.filter(Boolean); const start = ids[i]; let ex = 0;
  if (G2.cfg.playableOnly !== false) { const f = ids.filter(id => !blocked(id)); ex = ids.length - f.length; ids = f; }
  P.q = ids.slice(0, 2000); if (!P.q.length) return toast(ex ? `${ex}曲すべて埋め込み再生できません。「YouTubeで開く」をご利用ください` : '再生できる曲がありません');
  const k = Math.max(0, P.q.indexOf(start)); P.fails = 0; play ? G2.playIdx(k) : (P.i = k, G2.pSave(), G2.dockSync());
  if (ex) toast(`埋め込み再生できない${ex}曲を除外しました`); if (ENG() === 'embed') G2.embedCheck(P.q.slice(P.i, P.i + 60), { silent: true });
};
G2.qAdd = (ids, next) => { const was = P.q.length; if (next) P.q.splice(P.i + 1, 0, ...ids); else P.q.push(...ids); P.q = P.q.slice(0, 2000); G2.pSave(); G2.dockSync(); toast(`${ids.length}曲をキューに追加しました`); if (!was) { P.i = 0; G2.dockUI(); } };
const onState = s => { P.playing = s === 1 || s === 3; if (s === 1) P.fails = 0; if (s === 0 && P.last !== 0) { P.last = 0; return G2.next(true); } P.last = s; G2.dockUI(); };
const onErr = code => {
  const id = P.q[P.i], BLOCK = [100, 101, 150, 152], was = (G2.meta.get(id) || {}).emb === 1; P.fails = (P.fails || 0) + 1;
  if (BLOCK.includes(code) && id) G2.setMeta(id, { noembed: 1, emb: 0 });
  toast(BLOCK.includes(code) ? (was ? `oEmbedでは再生可と判定されたのに失敗しました(エラー${code})。設定の「Referer補完」を切り替えてお試しください` : `この曲は埋め込み再生が許可されていません(エラー${code})。YouTubeで開くか、スキップします`) : `再生エラー(${code})。YouTube側の制限の可能性があります`);
  if (P.fails >= 5) { P.playing = false; G2.dockUI(); return toast('連続して5曲再生できませんでした。「全曲リスト→再生可否チェック」で再生できる曲だけに絞ってください'); }
  if (P.q.length > 1) setTimeout(() => G2.next('skip'), 700); else { P.playing = false; G2.dockUI(); }
};
G2.tabUrl = (id, auto) => `https://www.youtube.com/watch?v=${id}&ytha=1${auto ? '&hauto=1' : ''}`;
G2.tabLoad = async (id, auto) => {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.windows) return toast('拡張機能として開いた画面でのみ再生できます');
  const url = G2.tabUrl(id, auto); P.note = '';
  try {
    if (P.tabId) { try { await chrome.tabs.get(P.tabId); await chrome.tabs.update(P.tabId, { url }); return; } catch { P.tabId = null; } }
    const w = await chrome.windows.create({ url, type: 'popup', width: 480, height: 330, focused: false }); P.tabId = w.tabs[0].id; P.winId = w.id;
  } catch (e) { err(e, '再生ウィンドウ'); }
};
G2.tabClose = () => { if (P.tabId && typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.remove(P.tabId).catch(() => { }); P.tabId = null; };
G2.onTab = m => {
  const cur = P.q[P.i]; if (!cur || (m.id && m.id !== cur)) return;
  if (m.ev === 'error') { P.fails = (P.fails || 0) + 1; toast('この動画は再生できません(削除・非公開・年齢制限など)。スキップします'); if (P.fails >= 5) { P.playing = false; G2.dockUI(); return toast('連続して5曲再生できませんでした'); } return void setTimeout(() => G2.next('skip'), 700); }
  if (m.ev === 'blocked') { P.playing = false; P.note = '自動再生がブロックされました'; G2.dockUI(); if (P.winId && chrome.windows) chrome.windows.update(P.winId, { focused: true }).catch(() => { }); return toast('自動再生がブロックされました。再生ウィンドウを一度クリックしてください'); }
  P.note = m.ad ? '広告を再生中…' : '';
  if (!m.ad) { P.t = m.t || 0; if (m.dur) P.dur = m.dur; }
  P.playing = !m.paused && !m.ended; if (P.playing && !m.ad) P.fails = 0;
  if (!m.ad && P.loopB != null && P.t >= P.loopB) tabSend('seekTo', [P.loopA || 0]);
  const known = pinfo(cur).dur, real = !m.ad && m.dur > 0 && m.t >= m.dur - 1.5 && (!known || Math.abs(m.dur - known) <= Math.max(5, known * .05));
  if (m.ev === 'ended' && real && P.last !== 0) { P.last = 0; return G2.next(true); }
  G2.dockUI();
};
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) chrome.runtime.onMessage.addListener((m, s) => { if (m && m.type === 'yt-state' && s && s.tab && s.tab.id === P.tabId) G2.onTab(m); });
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onRemoved) chrome.tabs.onRemoved.addListener(id => { if (id === P.tabId) { P.tabId = null; P.playing = false; P.note = '再生ウィンドウが閉じられました(▶で再開)'; G2.dockUI(); } });
addEventListener('message', e => {
  const f = $('#ytf'); if (e.origin !== 'https://www.youtube.com' || !f || e.source !== f.contentWindow) return; let d; try { d = JSON.parse(e.data); } catch { return; }
  P.ready = true; if (!P.init) { P.init = true; ytSend('setVolume', [P.vol]); ytSend('setPlaybackRate', [P.rate]); }
  const i = d.info; if (d.event === 'infoDelivery' && i) { if (i.currentTime != null) P.t = i.currentTime; if (i.duration) P.dur = i.duration; if (i.playerState != null && i.playerState !== P.last) onState(i.playerState); if (P.loopB != null && P.t >= P.loopB) ytSend('seekTo', [P.loopA || 0, true]); G2.dockTime(); }
  else if (d.event === 'onStateChange' && i !== P.last) onState(i); else if (d.event === 'onError') onErr(i);
});
G2.acts.pp = () => { const f = $('#ytf'); if (!P.q.length) return; if (ENG() === 'link') return G2.linkOpen(P.q[P.i]); if (ENG() === 'embed' ? !f.getAttribute('src') : !P.tabId) return G2.playIdx(P.i); ytSend(P.playing ? 'pauseVideo' : 'playVideo'); P.playing = !P.playing; G2.dockUI(); };
G2.acts.next = () => G2.next(); G2.acts.prev = () => G2.prev();
G2.acts.shuf = () => { P.shuffle = !P.shuffle; G2.pSave(); G2.dockUI(); }; G2.acts.rep = () => { P.repeat = { all: 'one', one: 'off', off: 'all' }[P.repeat]; G2.pSave(); G2.dockUI(); };
G2.acts.ab = () => { if (P.loopA == null) P.loopA = P.t; else if (P.loopB == null && P.t > P.loopA + 1) P.loopB = P.t; else P.loopA = P.loopB = null; toast(P.loopA == null ? 'A-Bリピート解除' : P.loopB == null ? `A地点 ${clock(P.loopA)} を設定。B地点でもう一度押してください` : `${clock(P.loopA)}〜${clock(P.loopB)} をリピート`); G2.dockUI(); };
G2.acts.vbig = () => { if (ENG() === 'link') return G2.linkOpen(P.q[P.i]); if (ENG() === 'tab') { if (P.winId && typeof chrome !== 'undefined' && chrome.windows) chrome.windows.update(P.winId, { focused: true }).catch(() => { }); return; } P.big = !P.big; G2.dockUI(); }; G2.acts.dkclose = () => { ytSend('pauseVideo'); G2.tabClose(); const f = $('#ytf'); f.removeAttribute('src'); P.q = []; P.playing = false; G2.pSave(); $('#qd').hidden = true; G2.dockSync(); };
G2.acts.qtoggle = () => { const q = $('#qd'); q.hidden = !q.hidden; G2.dockUI(); };
G2.acts.qplay = v => G2.playIdx(+v);
G2.acts.qrm = v => { const i = +v, cur = i === P.i; P.q.splice(i, 1); if (!P.q.length) return G2.acts.dkclose(); if (i < P.i) P.i--; if (cur) return G2.playIdx(Math.min(i, P.q.length - 1), P.playing); G2.pSave(); G2.dockUI(); if (S.view === 'music') render(); };
const qMove = (v, d) => { const a = +v, b = a + d; if (b < 0 || b >= P.q.length) return; [P.q[a], P.q[b]] = [P.q[b], P.q[a]]; if (P.i === a) P.i = b; else if (P.i === b) P.i = a; G2.pSave(); G2.dockUI(); if (S.view === 'music') render(); };
G2.acts.qup = v => qMove(v, -1); G2.acts.qdn = v => qMove(v, 1);
G2.acts.qclear = () => G2.acts.dkclose();
G2.acts.qsave = async () => { const n = prompt('保存するプレイリスト名', `キュー ${G2.today()}`); if (!n || !n.trim()) return; G2.plSel = (await G2.plNew(n.trim(), P.q)).id; G2.msub = 'lists'; render(); };
document.addEventListener('keydown', e => {
  if (!P.q.length || e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target.tagName)) return;
  if (e.key === ' ') { e.preventDefault(); G2.acts.pp(); } else if (e.key === 'n') G2.next(); else if (e.key === 'p') G2.prev();
});

const _set2 = V.settings;
V.settings = () => _set2() + card('プレーヤー', G2.ext
  ? `<p class="sub">曲はYouTubeの再生ウィンドウ(小さなウィンドウ)で再生され、このアプリの下部バーから操作します。広告が入る場合は終了後に次の曲へ進みます。再生した曲はYouTubeの視聴履歴にも残ります。</p>`
  : `<div class="rb">再生方式 <select data-g="engine"><option value="link" ${ENG() === 'link' ? 'selected' : ''}>YouTubeアプリ/サイトで開く(推奨)</option><option value="embed" ${ENG() === 'embed' ? 'selected' : ''}>アプリ内に埋め込み(埋め込み禁止の曲は再生不可)</option></select></div><p class="sub">スマホでは、曲を押すとYouTubeが開きます。埋め込み方式は一部の動画で再生できず、画面ロック中は止まることがあります。</p>`);
G2.chg.engine = t => { G2.cfg.engine = t.value; G2.saveCfg(); ytSend('pauseVideo'); G2.tabClose(); const f = $('#ytf'); if (f) f.removeAttribute('src'); P.playing = false; P.note = ''; G2.dockUI(); toast('再生方式を切り替えました'); };
