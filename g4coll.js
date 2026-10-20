'use strict';
/* ===== 第4世代: コレクション(高評価 / 後で見る / 自作リスト)を分析対象に ===== */
NAV.splice(NAV.findIndex(n => n[0] === 'channels'), 0, ['colls', 'コレクション', '♥']);
G2.colls = []; G2.collsAll = []; G2.csel = null; G2.cf = { mode: '', sort: 'added', page: 0 }; G2.cidx = null; G2.cvc = null;
G2.loadColls = async () => { try { G2.collsAll = (await getAll('coll')) || []; } catch (e) { err(e, 'コレクション'); G2.collsAll = []; } G2.colls = G2.collsAll.filter(x => !x.del).sort((a, b) => ({ liked: 0, later: 1, custom: 2 }[a.kind] - { liked: 0, later: 1, custom: 2 }[b.kind]) || (a.name || '').localeCompare(b.name || '')); G2.cidx = G2.cvc = null; G2.sc = null; };
const _lm4 = G2.loadMeta; G2.loadMeta = async () => { await _lm4(); await G2.loadColls(); if (G2.loadLyrics) await G2.loadLyrics(); };
G2.cindex = () => { if (G2.cidx) return G2.cidx; const m = new Map(); G2.colls.forEach(c => c.items.forEach(it => { (m.get(it.id) || m.set(it.id, []).get(it.id)).push(c); })); return G2.cidx = m; };
G2.inColl = (id, kind) => (G2.cindex().get(id) || []).some(c => !kind || kind === 'any' || c.kind === kind);
G2.cv = () => {
  if (G2.cvc) return G2.cvc; const m = new Map();
  G2.cindex().forEach((cs, id) => { const it = cs[0].items.find(x => x.id === id) || {}, key = it.chid || it.ch || '', added = cs.map(c => (c.items.find(x => x.id === id) || {}).added).filter(Boolean).sort()[0] || '';
    m.set(id, { id, title: it.title || id, ch: it.ch || '', chid: it.chid || '', dur: it.dur ?? null, g: S.ov[key] || classify(it.title || '', it.ch || ''), n: 0, first: '', last: '', dates: [], prs: [], secs: 0, pmax: null, added, coll: true }); });
  return G2.cvc = m;
};
G2.cvinfo = id => G2.cv().get(id);
G2.cbadge = id => { const cs = G2.cindex().get(id); if (!cs) return ''; return [...new Set(cs.map(c => c.kind))].map(k => `<span title="${esc(cs.filter(c => c.kind === k).map(c => c.name).join(', '))}">${{ liked: '👍', later: '🕒', custom: '📁' }[k]}</span>`).join(''); };
G2.collSongs = () => { if (G2.cfg.libColl === false) return []; const vm = G2.videos(), out = []; G2.cv().forEach(v => { if (vm.has(v.id)) return; const mt = (G2.meta.get(v.id) || {}).music; if (mt === false || (mt !== true && v.g !== '音楽')) return; out.push({ ...v, artist: artistOf(v.title, v.ch), sub: musicSub(v.title + ' ' + v.ch) }); }); return out; };
// 動画詳細に所属コレクションを表示
const _ov = G2.openVideo; G2.openVideo = id => { _ov(id); const cs = G2.cindex().get(id); const h = $('#modal .vc.big'); if (cs && h) h.insertAdjacentHTML('afterend', `<div class="rb">${cs.map(c => { const it = c.items.find(x => x.id === id) || {}; return `<span class="pill" style="background:${{ liked: '#e5322d', later: '#3b9eff', custom: '#7c5cff' }[c.kind]}">${{ liked: '👍', later: '🕒', custom: '📁' }[c.kind]} ${esc(c.name)}${it.added ? ' ・ ' + it.added : ''}</span>`; }).join(' ')}</div>`); };

/* ----- 保存・取得 ----- */
G2.collSave = async rec => { const prev = G2.collsAll.find(x => x.id === rec.id), m = YS.mergeColl(prev, rec, G2.today()); const i = G2.collsAll.findIndex(x => x.id === m.id); if (i < 0) G2.collsAll.push(m); else G2.collsAll[i] = m; await putMany('coll', [m]); await G2.loadColls(); if (G2.schedule) G2.schedule(); return m; };
G2.csvRows = text => { const rows = []; let row = [], f = '', q = false; text = text.replace(/^\ufeff/, ''); for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c; } if (f || row.length) { row.push(f); rows.push(row); } return rows; };
G2.collKind = name => { const n = name.replace(/\.csv$/i, '').replace(/-videos$/i, '').trim(); if (/^(liked videos|高く評価した動画|高評価した動画|高評価)$/i.test(n)) return { kind: 'liked', name: '高評価した動画', id: 'LL' }; if (/^(watch later|後で見る)$/i.test(n)) return { kind: 'later', name: '後で見る', id: 'WL' }; return { kind: 'custom', name: n, id: 'PL:csv-' + n }; };
G2.fillItem = it => { const v = G2.videos().get(it.id); return { ...it, title: it.title || (v && v.title) || '', ch: it.ch || (v && v.ch) || '', chid: it.chid || (v && v.chid) || '', dur: it.dur ?? (v && v.dur) ?? null }; };
G2.importCsv = async files => {
  let ok = 0; const fails = [];
  for (const f of files) {
    try {
      const rows = G2.csvRows(await f.text()); if (rows.length < 2) throw new Error('空のファイルです'); const h = rows[0].map(x => x.toLowerCase()), ci = h.findIndex(x => /video id|動画 ?id/.test(x)), ti = h.findIndex(x => /timestamp|タイムスタンプ|creation/.test(x));
      if (ci < 0 && !/^[\w-]{11}$/.test((rows[1][0] || '').trim())) throw new Error('再生リストのCSV(動画ID列)ではありません'); const c0 = ci < 0 ? 0 : ci, t0 = ti < 0 ? 1 : ti, k = G2.collKind(f.name);
      const items = rows.slice(1).filter(r => /^[\w-]{11}$/.test((r[c0] || '').trim())).map(r => { const d = r[t0] ? new Date(r[t0]) : null; return G2.fillItem({ id: r[c0].trim(), title: '', ch: '', chid: '', dur: null, added: d && !isNaN(d) ? d.toLocaleDateString('sv-SE') : null }); });
      if (!items.length) throw new Error('動画が見つかりません'); await G2.collSave({ id: k.id, name: k.name, kind: k.kind, items, src: 'takeout' }); ok++;
    } catch (e) { fails.push(`${f.name}: ${e.message}`); }
  }
  render(); toast(`${ok}件のリストを取り込みました${fails.length ? `(失敗: ${fails.join(' / ')})` : ''}`); if (ok) G2.fillTitles(true);
};
G2.parseIds = text => { const out = []; for (const t of text.split(/[\s,;]+/)) { if (!t) continue; let id = null; if (/^[\w-]{11}$/.test(t)) id = t; else { try { const u = new URL(t.startsWith('http') ? t : 'https://' + t); id = u.searchParams.get('v') || (u.hostname.includes('youtu.be') ? u.pathname.slice(1) : (u.pathname.match(/\/(?:shorts|embed)\/([\w-]{11})/) || [])[1]); } catch { } } if (id && /^[\w-]{11}$/.test(id) && !out.includes(id)) out.push(id); } return out; };
G2.fillTitles = async silent => {
  const need = new Set(); G2.colls.forEach(c => c.items.forEach(it => { if (!it.title || it.title === it.id) need.add(it.id); })); if (!need.size) return silent ? 0 : toast('補完が必要な動画はありません'); if (G2.fill) return; G2.fill = true;
  const ids = [...need].slice(0, 3000), got = new Map(); let i = 0, stop = false;
  const work = async () => { while (!stop && i < ids.length) { const id = ids[i++]; try { const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`, { credentials: 'omit' }); if (r.status === 429) stop = true; else if (r.ok) { const j = await r.json(); got.set(id, { title: j.title, ch: j.author_name, chid: (j.author_url || '').split('/').pop() }); } } catch { stop = true; } } };
  try { await Promise.all([...Array(5)].map(work)); for (const c of G2.colls) { let ch = false; const items = c.items.map(it => { const g = got.get(it.id); if (g && (!it.title || it.title === it.id)) { ch = true; return { ...it, ...g }; } return it; }); if (ch) await G2.collSave({ ...c, items }); } if (!silent || got.size) toast(`タイトルを補完しました(${got.size}/${ids.length}本)${stop ? ' ※通信制限/ブロックで途中終了' : ''}`); }
  finally { G2.fill = false; render(); }
};
G2.syncColls = async (o = {}) => {
  if (!G2.ext) return toast('この機能は拡張機能版でのみ使えます(スマホはCSV/貼り付けで取り込めます)'); const lists = o.lists || G2.cfg.track || []; if (!lists.length) return toast('取得するリストがありません');
  if (G2.csyncing) return; G2.csyncing = true; if (!o.silent) busy('YouTubeからリストを取得中…(タブが一時的に開きます)', .3);
  try { const r = await chrome.runtime.sendMessage({ type: 'coll-sync', lists }); busy(''); await load(); if (!r || !r.ok) throw new Error(r && r.error || '応答なし'); (r.errs || []).forEach(e => S.errors.push('コレクション ' + e)); if (!o.silent || (r.errs || []).length) toast(`取得: ${(r.res || []).map(x => x.n + '本').join(' / ') || 'なし'}${(r.errs || []).length ? `(失敗: ${r.errs.join(', ')})` : ''}`); }
  catch (e) { busy(''); err(e, 'コレクション取得'); } finally { G2.csyncing = false; }
};
const _s4 = G2.sync; G2.sync = async o => { await _s4(o); if (G2.ext && G2.cfg.collAuto !== false && (G2.cfg.track || []).length) await G2.syncColls({ silent: true }); };
G2.acts.cquick = async () => { G2.cfg.track = [{ id: 'LL', name: '高評価した動画', kind: 'liked' }, { id: 'WL', name: '後で見る', kind: 'later' }, ...(G2.cfg.track || []).filter(x => x.id !== 'LL' && x.id !== 'WL')]; G2.saveCfg(); G2.acts.mclose(); await G2.syncColls({}); };
G2.acts.cdisc = async () => {
  if (!G2.ext) return; busy('YouTubeのプレイリスト一覧を取得中…', .3);
  try { const r = await chrome.runtime.sendMessage({ type: 'coll-index' }); busy(''); if (!r || !r.ok) throw new Error(r && r.error || '応答なし'); const tr = new Set((G2.cfg.track || []).map(x => x.id));
    G2.modal(`<h3>追跡するプレイリストを選択</h3><p class="sub">「後で見る v2」のような自作リストにチェックを入れてください。${r.lists.length ? '' : '一覧を検出できませんでした。YouTubeの再生リスト画面を開き、右下の取り込みパネルをお使いください。'}</p><div id="clist">${r.lists.map(l => `<label style="display:block;margin:6px 0"><input type="checkbox" data-id="${esc(l.id)}" data-n="${esc(l.name)}" ${tr.has(l.id) ? 'checked' : ''}> ${esc(l.name || l.id)}</label>`).join('')}</div><div class="rb"><label><input type="checkbox" id="cll" checked> 高評価・後で見るも取得する</label></div><button class="pri" data-g="ctrkgo">選択したリストを取得</button>`); }
  catch (e) { busy(''); err(e, 'プレイリスト一覧'); }
};
G2.acts.ctrkgo = async () => {
  const sel2 = [...document.querySelectorAll('#clist input:checked')].map(i => ({ id: i.dataset.id, name: i.dataset.n, kind: 'custom' })), base = $('#cll').checked ? [{ id: 'LL', name: '高評価した動画', kind: 'liked' }, { id: 'WL', name: '後で見る', kind: 'later' }] : [];
  G2.cfg.track = [...base, ...sel2]; G2.saveCfg(); G2.acts.mclose(); await G2.syncColls({});
};
G2.acts.collAdd = () => G2.modal(`<h3>コレクションを取り込む</h3>${G2.ext ? `<div class="card"><b>① 自動で取得(おすすめ)</b><p class="sub">YouTubeにログイン済みなら、タブが一時的に開いて自動で読み取ります。</p><div class="rb"><button class="pri" data-g="cquick">高評価・後で見るを取得</button><button data-g="cdisc">自作プレイリストを選ぶ…</button></div></div>` : ''}<div class="card"><b>${G2.ext ? '②' : '①'} Google Takeout のCSV</b><p class="sub">takeout.google.com →「YouTube と YouTube Music」→ 再生リスト → <code>…-videos.csv</code>(複数選択可)。タイトルは履歴または公開情報から補完します。</p><button data-g="ccsv">CSVを選ぶ</button></div><div class="card"><b>${G2.ext ? '③' : '②'} URL/動画IDを貼り付け</b><div class="rb"><input data-g="pname" placeholder="リスト名(例: 後で見る v2)" size="26"><select data-g="pkind"><option value="custom">自作リスト</option><option value="later">後で見る</option><option value="liked">高評価</option></select></div><textarea data-g="ptext" rows="4" placeholder="動画のURLまたは動画IDを改行/スペース区切りで"></textarea><div class="rb"><button data-g="pgo">取り込む</button></div></div>`);
G2.acts.ccsv = () => { G2.acts.mclose(); $('#rfile4').click(); };
G2.acts.pgo = async () => { const ids = G2.parseIds($('[data-g=ptext]').value), kind = $('[data-g=pkind]').value, name = $('[data-g=pname]').value.trim() || ({ liked: '高評価した動画', later: '後で見る', custom: '自作リスト' }[kind]); if (!ids.length) return toast('動画のURLまたはIDが見つかりません'); await G2.collSave({ id: kind === 'liked' ? 'LL' : kind === 'later' ? 'WL' : 'PL:paste-' + name, name, kind, items: ids.map(id => G2.fillItem({ id, title: '', ch: '', chid: '', dur: null, added: null })), src: 'paste' }); G2.acts.mclose(); G2.csel = kind === 'liked' ? 'LL' : kind === 'later' ? 'WL' : 'PL:paste-' + name; render(); G2.fillTitles(true); };
document.body.insertAdjacentHTML('beforeend', '<input id="rfile4" type="file" accept=".csv,text/csv" multiple hidden>'); $('#rfile4').onchange = e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) G2.importCsv(f); };
G2.acts.csel = v => { G2.csel = v; G2.cf.page = 0; render(); };
G2.acts.cdel = async () => { const c = G2.colls.find(x => x.id === G2.csel); if (!c || !confirm(`「${c.name}」をこの端末から削除します(同期中の他端末からも消えます)。`)) return; await G2.collSave({ ...c, del: 1, items: [] }); G2.cfg.track = (G2.cfg.track || []).filter(x => x.id !== c.id && 'PL:' + x.id !== c.id); G2.saveCfg(); G2.csel = null; render(); };
G2.acts.cre = () => { const c = G2.colls.find(x => x.id === G2.csel); if (!c) return; const id = c.id.replace(/^PL:/, ''); if (/^(csv|paste)-/.test(id)) return toast('このリストは手動で取り込んだものです(再取得できません)'); G2.syncColls({ lists: [{ id, name: c.name, kind: c.kind }] }); };
G2.acts.ccsvx = () => { const c = G2.colls.find(x => x.id === G2.csel); if (c) G2.dl(`${c.name}.csv`, G2.csv(['動画ID', 'タイトル', 'チャンネル', '長さ(秒)', '追加日', 'URL'], c.items.map(it => [it.id, it.title, it.ch, it.dur ?? '', it.added || '', 'https://www.youtube.com/watch?v=' + it.id])), 'text/csv'); };
G2.acts.cmode = v => { G2.cf.mode = v; G2.cf.page = 0; render(); }; G2.acts.cpage = v => { G2.cf.page = +v; render(); };
G2.chg.csort = t => { G2.cf.sort = t.value; G2.cf.page = 0; render(); };

/* ----- 分析 ----- */
G2.cstat = c => {
  const vm = G2.videos(), gc = new Map(), ch = new Map(), mon = new Map(), gaps = []; let watched = 0, secs = 0, known = 0; const unwatched = [];
  c.items.forEach(it => { const v = vm.get(it.id), dur = it.dur != null ? it.dur : v && v.dur != null ? v.dur : null; if (dur != null) { secs += dur; known++; }
    const g = v ? v.g : (S.ov[it.chid || it.ch] || classify(it.title, it.ch)); gc.set(g, (gc.get(g) || 0) + 1); const k = it.chid || it.ch || '?', o = ch.get(k) || { n: it.ch || '(不明)', c: 0 }; o.c++; ch.set(k, o);
    if (it.added) mon.set(it.added.slice(0, 7), (mon.get(it.added.slice(0, 7)) || 0) + 1);
    if (v) { watched++; if (it.added) { const d = dnOf(v.first) - dnOf(it.added); if (d >= 0) gaps.push(d); } } else unwatched.push(it); });
  gaps.sort((a, b) => a - b); return { n: c.items.length, watched, unwatched, secs, known, gc, ch, mon, med: gaps.length ? gaps[gaps.length >> 1] : null };
};
G2.collEmpty = () => `<div class="empty"><h2>コレクション ― 高評価・後で見る・自作プレイリストも分析</h2><p class="sub">視聴履歴に加えて、YouTubeの「高評価した動画」「後で見る」、自分で作ったプレイリスト(例: 後で見る v2)を取り込むと、積み残し・好みの傾向・追加から視聴までの日数などを分析できます。</p></div><div class="card" style="max-width:520px;margin:0 auto"><div class="rb">${G2.ext ? '<button class="pri" data-g="cquick">高評価・後で見るを自動取得</button><button data-g="cdisc">自作プレイリストを選ぶ</button>' : ''}<button ${G2.ext ? '' : 'class="pri"'} data-g="collAdd">CSV / URL貼り付けで取り込む</button></div></div>`;
V.colls = () => {
  if (!G2.colls.length) return G2.collEmpty();
  const c = G2.colls.find(x => x.id === G2.csel) || (G2.csel = G2.colls[0].id, G2.colls[0]), st = G2.cstat(c), f = G2.cf, vm = G2.videos(), IC = { liked: '👍', later: '🕒', custom: '📁' };
  let L = c.items.map(it => ({ ...it, v: vm.get(it.id) })).filter(x => !f.mode || (f.mode === 'un' ? !x.v : !!x.v));
  L.sort({ added: (a, b) => (b.added || '').localeCompare(a.added || ''), addedo: (a, b) => (a.added || '9').localeCompare(b.added || '9'), dur: (a, b) => (b.dur ?? b.v?.dur ?? 0) - (a.dur ?? a.v?.dur ?? 0), n: (a, b) => (b.v?.n || 0) - (a.v?.n || 0), title: (a, b) => a.title.localeCompare(b.title, 'ja') }[f.sort]);
  const PS = 50, pages = Math.max(1, Math.ceil(L.length / PS)); f.page = Math.min(f.page, pages - 1);
  const mk = [...st.mon.keys()].sort(), oldest = st.unwatched.filter(x => x.added).sort((a, b) => a.added.localeCompare(b.added))[0];
  let extra = '';
  if (c.kind === 'liked') {
    const wc = new Map(); vm.forEach(v => { const k = v.chid || v.ch; wc.set(k, (wc.get(k) || 0) + 1); });
    const rate = [...st.ch].map(([k, o]) => [o.n, o.c, wc.get(k) || 0]).filter(r => r[2] >= 5).map(r => [r[0], r[1], r[2], r[1] / r[2]]).sort((a, b) => b[3] - a[3]).slice(0, 10), all = cnt(S.W, r => r.g), tot = S.W.length;
    extra = `<div class="g2">${card('高評価しやすいチャンネル(高評価数 ÷ 見た動画数)', rate.length ? tbl(['チャンネル', '高評価', '視聴動画', '率'], rate.map(r => [esc(r[0]), r[1], r[2], Math.round(Math.min(1, r[3]) * 100) + '%'])) : '<p class="sub">見た動画が5本以上のチャンネルがありません</p>')}${card('ジャンル: 視聴の割合 vs 高評価の割合', tbl(['ジャンル', '視聴', '高評価', '差'], [...new Set([...all.keys(), ...st.gc.keys()])].filter(Boolean).sort((a, b) => (st.gc.get(b) || 0) - (st.gc.get(a) || 0)).slice(0, 8).map(g => { const a = tot ? (all.get(g) || 0) / tot * 100 : 0, b = st.n ? (st.gc.get(g) || 0) / st.n * 100 : 0; return [pill(g), a.toFixed(0) + '%', b.toFixed(0) + '%', `<span class="${b >= a ? 'up' : 'dn'}">${b >= a ? '+' : ''}${(b - a).toFixed(0)}pt</span>`]; })))}</div>`;
  } else extra = card(`積み残し(未視聴 ${num(st.unwatched.length)}本・古い順)`, st.unwatched.length ? tbl(['動画', '追加日', '長さ', ''], st.unwatched.slice().sort((a, b) => (a.added || '9').localeCompare(b.added || '9')).slice(0, 15).map(it => [`<div class="vc">${isVid(it.id) ? `<img loading="lazy" src="${thumb(it.id)}" alt="">` : ''}<div><a href="#" data-g="vopen" data-v="${it.id}">${esc(it.title || it.id)}</a><div class="sub">${esc(it.ch)}</div></div></div>`, it.added || '-', it.dur != null ? hm(it.dur) : '-', rvBtn(it.id)])) : '<p class="sub">すべて視聴済みです 🎉</p>');
  const ov = [...G2.cindex()].filter(([, cs]) => cs.length > 1).length;
  return `<div class="tabs">${G2.colls.map(x => gchip(`${IC[x.kind]} ${esc(x.name)} <small>${x.items.length}</small>`, 'csel', x.id, c.id)).join('')}<button class="chip" data-g="collAdd">＋ 取り込み</button></div>` +
    `<h2>${IC[c.kind]} ${esc(c.name)}<small>${c.src === 'scrape' ? 'YouTubeから取得' : c.src === 'takeout' ? 'Takeout' : '貼り付け'} ・ ${G2.ago(c.upd)}に更新${ov ? ` ・ 他のリストと重複 ${ov}本` : ''}</small></h2>` +
    kcs([['動画数', num(st.n)], ['合計の長さ', st.known ? hrs(st.secs) + (st.known < st.n ? '+' : '') : '-'], ['視聴済み', `${num(st.watched)}(${pct(st.watched, st.n)})`], ['未視聴', num(st.unwatched.length)], ['追加→初視聴(中央値)', st.med == null ? '-' : st.med + '日'], ['最古の未視聴', oldest ? oldest.added : '-']]) +
    `<div class="rb"><button data-g="cre">再取得</button><button data-g="ccsvx">CSV</button><button data-g="fill">タイトル補完</button><button class="dng" data-g="cdel">このリストを削除</button></div>` + extra +
    `<div class="g2">${card('月別 追加数', mk.length ? cols(mk.map(k => k.slice(2)), mk.map(k => st.mon.get(k))) : '<p class="sub">追加日の情報がありません(スクレイピング/Takeoutで追加日が付きます)</p>')}${card('ジャンル', bars(topN(st.gc, 8), l => GCOL[l]))}</div>` +
    card('チャンネル TOP10', bars([...st.ch.values()].sort((a, b) => b.c - a.c).slice(0, 10).map(o => [o.n, o.c]))) +
    card(`動画一覧(${num(L.length)}本)`, `<div class="rb">${[['', 'すべて'], ['un', '未視聴'], ['w', '視聴済み']].map(([v, l]) => gchip(l, 'cmode', v, f.mode)).join('')}<select data-g="csort" aria-label="並び順">${[['added', '追加が新しい順'], ['addedo', '追加が古い順'], ['dur', '長い順'], ['n', '視聴回数順'], ['title', 'タイトル順']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` +
      tbl(['動画', '追加日', '視聴', '長さ', ''], L.slice(f.page * PS, f.page * PS + PS).map(x => [`<div class="vc">${isVid(x.id) ? `<img loading="lazy" src="${thumb(x.id)}" alt="">` : ''}<div><a href="#" data-g="vopen" data-v="${x.id}">${esc(x.title || x.id)}</a><div class="sub">${esc(x.ch)}</div></div></div>`, x.added || '-', x.v ? `${x.v.n}回` : '<span class="sub">未</span>', x.dur != null ? hm(x.dur) : x.v && x.v.dur != null ? hm(x.v.dur) : '-', stars(x.id) + rvBtn(x.id)])) +
      `<div class="rb" style="margin-top:12px"><button data-g="cpage" data-v="${Math.max(0, f.page - 1)}">← 前</button><span class="mut">${f.page + 1} / ${pages}</span><button data-g="cpage" data-v="${Math.min(pages - 1, f.page + 1)}">次 →</button></div>`);
};
G2.acts.fill = () => G2.fillTitles(false);
// ダッシュボードにコレクションの要約を追加
const _d4 = V.dash; V.dash = () => { let h = _d4(); if (G2.colls.length) { const vm = G2.videos(), L = G2.colls.map(c => { const un = c.items.filter(i => !vm.has(i.id)), old = un.map(i => i.added).filter(Boolean).sort()[0]; return `${{ liked: '👍', later: '🕒', custom: '📁' }[c.kind]} <b>${esc(c.name)}</b>: ${num(c.items.length)}本${c.kind !== 'liked' ? `(未視聴 ${num(un.length)}本${old ? `・最古の追加は${Math.max(0, dnOf(G2.today()) - dnOf(old))}日前` : ''})` : `(うち視聴済み ${pct(c.items.length - un.length, c.items.length)})`}`; }); h += card('♥ コレクション', `<ul style="margin:0;padding-left:20px">${L.map(x => `<li>${x}</li>`).join('')}</ul><div class="rb" style="margin-top:8px"><button data-g="gotoColl">詳しく見る</button></div>`); } return h; };
G2.acts.gotoColl = () => { S.view = 'colls'; render(); G2.scrollTop(); };
/* ----- 設定: コレクション ----- */
const _set5 = V.settings; V.settings = () => _set5() + card('コレクション(高評価・後で見る・自作リスト)', `<p class="sub">取り込み済み: ${G2.colls.length}件${G2.colls.length ? ' (' + G2.colls.map(c => esc(c.name) + ' ' + c.items.length).join(' / ') + ')' : ''}</p><div class="rb"><button class="pri" data-g="collAdd">取り込む</button>${G2.ext && (G2.cfg.track || []).length ? '<button data-g="cnow">追跡中のリストを今すぐ取得</button>' : ''}<button data-g="fill">タイトルを補完</button></div>${G2.ext ? `<div class="rb"><label><input type="checkbox" data-g="cfg" data-k="collAuto" ${G2.cfg.collAuto !== false ? 'checked' : ''}> 「最新の履歴を同期」のときに追跡中のリストも取得する</label></div>` : ''}<div class="rb"><label><input type="checkbox" data-g="cfg" data-k="libColl" ${G2.cfg.libColl !== false ? 'checked' : ''}> 音楽の全曲リストに、コレクション内の曲(未再生)も含める</label></div>`);
G2.acts.cnow = () => G2.syncColls({});
/* ----- 同期(端末間)で共有する拡張データ: コレクション・歌詞 ----- */
G2.applyExtra = async b => { const st = { coll: 0, lyrics: 0 }, nc = YS.newer(new Map(G2.collsAll.map(x => [x.id, x])), b.coll); if (nc.length) { await putMany('coll', nc); st.coll = nc.length; } const nl = YS.newer(G2.lyr || new Map(), b.lyrics); if (nl.length) { await putMany('lyrics', nl); st.lyrics = nl.length; } return st; };
G2.extraSig = () => [G2.collsAll.length, G2.collsAll.reduce((m, x) => Math.max(m, x.upd || 0), 0), G2.lyr ? G2.lyr.size : 0, G2.lyr ? [...G2.lyr.values()].reduce((m, x) => Math.max(m, x.upd || 0), 0) : 0].join(',');
