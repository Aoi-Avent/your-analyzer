'use strict';
/* ===== 第4世代: 歌詞 / Now Playing(Apple Musicの歌詞挙動を再現) / 動画の全画面 =====
   再現: 時間同期ハイライト・現在行を中央付近に固定・距離に応じたぼかし・行タップでシーク・間奏の3ドット・
         手動スクロール中は自動スクロール停止→再開・単語単位ハイライト(拡張LRC)・全画面表示・アートワーク色の背景
   歌詞データ: LRCLIB(オープンな歌詞DB・利用者が有効化したときのみ通信) / 手動貼り付け(LRC・プレーンテキスト) */
{ let _t = P.t || 0; Object.defineProperty(P, 't', { get() { return _t; }, set(v) { _t = v; P.tAt = performance.now(); }, configurable: true, enumerable: true }); P.tAt = performance.now(); }
G2.curT = () => P.t + (P.playing && P.tAt ? (performance.now() - P.tAt) / 1000 * (P.rate || 1) : 0);
G2.vinfo = id => G2.videos().get(id) || (G2.cvinfo && G2.cvinfo(id)) || { id, title: id, ch: '', dur: null };
const LRC = {
  parse(text) {
    const lines = [], tre = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, fr = x => (x ? +('0.' + x.padEnd(3, '0').slice(0, 3)) : 0); let synced = false;
    for (const ln of (text || '').replace(/\r/g, '').split('\n')) {
      if (/^\[(ar|ti|al|by|offset|length|re|ve):/i.test(ln)) continue;
      const ts = [...ln.matchAll(tre)]; if (!ts.length) { if (ln.trim()) lines.push({ t: null, text: ln.trim() }); continue; }
      synced = true; let body = ln.replace(tre, '').trim(), words = null;
      if (/<\d{1,3}:\d{2}/.test(body)) { words = []; const w = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>([^<]*)/g; let m; while ((m = w.exec(body))) words.push({ t: +m[1] * 60 + +m[2] + fr(m[3]), w: m[4] }); body = body.replace(/<[^>]*>/g, '').trim(); }
      ts.forEach(m => lines.push({ t: +m[1] * 60 + +m[2] + fr(m[3]), text: body, words }));
    }
    return synced ? { synced: true, lines: lines.filter(l => l.t != null).sort((a, b) => a.t - b.t) } : { synced: false, lines: lines.map(l => ({ t: null, text: l.text })) };
  }
};
G2.LRC = LRC;
/* ----- 保存 ----- */
G2.lyr = new Map();
G2.loadLyrics = async () => { try { G2.lyr = new Map(((await getAll('lyrics')) || []).map(x => [x.id, x])); } catch (e) { err(e, '歌詞'); } };
G2.lyrList = () => [...G2.lyr.values()];
G2.lyrSave = async rec => { const m = { offset: 0, ...(G2.lyr.get(rec.id) || {}), ...rec, upd: Date.now() }; G2.lyr.set(m.id, m); await putMany('lyrics', [m]); if (G2.schedule) G2.schedule(); return m; };
/* ----- LRCLIB ----- */
G2.lyrQuery = v => {
  const cl = s => s.replace(/[【\[(（][^】\])）]*[】\])）]/g, ' ').replace(/\b(Official (Music )?Video|Official Audio|Music Video|Lyric Video|MV|PV)\b/gi, ' ').replace(/\s*feat\.?.*$/i, '').replace(/\s+/g, ' ').trim();
  let track = v.title || '', artist = artistOf(v.title || '', v.ch || ''), m = track.match(/^(.{1,40}?)\s[-–—]\s(.+)$/);
  if (m) { artist = m[1]; track = m[2]; } else if ((m = track.match(/^(.+?)\s*[\/／]\s*(.+)$/))) { track = m[1]; artist = m[2]; }
  return { track: cl(track) || cl(v.title || ''), artist: cl(artist), dur: v.dur || 0 };
};
G2.lyrSearch = async (track, artist) => {
  const get = async p => { const r = await fetch('https://lrclib.net/api/search?' + p); if (!r.ok) throw new Error('LRCLIB ' + r.status); return r.json(); };
  let L = await get(new URLSearchParams({ track_name: track, artist_name: artist })); if (!L.length) L = await get(new URLSearchParams({ q: (track + ' ' + artist).trim() })); if (!L.length && artist) L = await get(new URLSearchParams({ q: track })); return L;
};
const pickBest = (L, dur) => L.slice().sort((a, b) => ((b.syncedLyrics ? 2 : 0) + (dur && Math.abs(b.duration - dur) <= 3 ? 1 : 0)) - ((a.syncedLyrics ? 2 : 0) + (dur && Math.abs(a.duration - dur) <= 3 ? 1 : 0)))[0];
const fromItem = (id, it) => ({ id, lrc: it.syncedLyrics || '', plain: it.plainLyrics || '', src: 'lrclib', title: it.trackName, artist: it.artistName, inst: !!it.instrumental });
G2.lyrAuto = async id => { const v = G2.vinfo(id), q = G2.lyrQuery(v), L = await G2.lyrSearch(q.track, q.artist); if (!L.length) return null; return G2.lyrSave(fromItem(id, pickBest(L, v.dur))); };

/* ----- Now Playing ----- */
G2.npOn = false; G2._items = []; G2._ai = -2; G2._lead = 0; G2._tried = new Set();
G2.npInit = () => {
  if ($('#np')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="np" class="np" data-tab="art" hidden role="dialog" aria-label="再生画面"><div class="np-bg"></div>
<div class="np-top"><button data-g="npclose" aria-label="閉じる">⌄ 閉じる</button><span class="np-tabs"><button data-g="nptab" data-v="art">曲</button><button data-g="nptab" data-v="lyr">歌詞</button></span><button data-g="npfs" aria-label="全画面">⛶</button></div>
<div class="np-body"><section class="np-l"><img id="npimg" alt=""><div class="np-meta"><b id="npt"></b><span id="npa"></span></div>
<div class="np-seek"><span id="npc">0:00</span><input type="range" id="npsk" min="0" max="1000" value="0" aria-label="再生位置"><span id="npd">0:00</span></div>
<div class="np-ctl"><button data-g="shuf" aria-label="シャッフル">🔀</button><button data-g="prev" aria-label="前の曲">⏮</button><button class="pp" id="nppp" data-g="pp" aria-label="再生/一時停止">▶</button><button data-g="next" aria-label="次の曲">⏭</button><button data-g="rep" aria-label="リピート">🔁</button></div>
<div class="np-sub"><button data-g="vfs">📺 動画を全画面</button><button data-g="qtoggle">☰ キュー</button></div></section>
<section class="np-r"><div class="np-lh" id="nplh"></div><div id="lyr" class="lyr"></div></section></div></div>`);
  const sk = $('#npsk'); sk.oninput = () => { P.seeking = true; $('#npc').textContent = hm(P.dur * sk.value / 1000); }; sk.onchange = () => { ytSend('seekTo', [P.dur * sk.value / 1000, true]); P.t = P.dur * sk.value / 1000; P.seeking = false; };
  const lyr = $('#lyr'); ['wheel', 'touchmove', 'pointerdown'].forEach(ev => lyr.addEventListener(ev, () => { G2._user = Date.now() + 3500; }, { passive: true }));
};
G2.acts.npopen = () => { if (!P.q.length) return toast('再生中の曲がありません'); G2.npInit(); G2.npOn = true; $('#np').hidden = false; document.body.classList.add('np-open'); G2._ai = -2; G2.npSync(true); requestAnimationFrame(G2.npLoop); };
G2.acts.npclose = () => { G2.npOn = false; const n = $('#np'); if (n) n.hidden = true; document.body.classList.remove('np-open'); if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); };
G2.acts.nptab = v => { $('#np').dataset.tab = v; };
G2.acts.npfs = () => { const n = $('#np'); if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); else if (n.requestFullscreen) n.requestFullscreen().catch(() => toast('このブラウザでは全画面にできません')); };
G2.npSync = force => {
  if (!G2.npOn) return; const id = P.q[P.i], v = G2.vinfo(id);
  $('#npt').textContent = v.title; $('#npa').textContent = artistOf(v.title, v.ch); $('#nppp').textContent = P.playing ? '⏸' : '▶';
  if (force || G2._npid !== id) { G2._npid = id; if (isVid(id)) { $('#npimg').src = thumb(id); G2.npColor(id); } G2._ai = -2; G2.npLyrics(); }
};
G2.npColor = id => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; if (l > 90 && l < 690) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } } if (n) $('#np').style.setProperty('--c1', `rgb(${Math.round(r / n * .75)},${Math.round(g / n * .75)},${Math.round(b / n * .75)})`); } catch { } }; img.src = thumb(id); };
G2.npLyrics = async () => {
  const id = P.q[P.i], box = $('#lyr'), head = $('#nplh'), rec = G2.lyr.get(id); G2._items = []; G2._synced = false;
  const msg = (h, btns = '') => { box.innerHTML = `<div class="ly plain" style="font-size:18px">${h}</div><div class="rb">${btns}</div>`; head.innerHTML = ''; };
  if (!rec) {
    if (!G2.cfg.lyricsOn) return msg('歌詞を表示するには、曲名とアーティスト名を歌詞データベース(lrclib.net)に送って検索します。', '<button data-g="lyon">有効にして検索する</button><button data-g="lyedit">自分で貼り付ける</button>');
    if (!G2._tried.has(id)) { G2._tried.add(id); msg('歌詞を検索中…'); try { const r = await G2.lyrAuto(id); if (P.q[P.i] !== id) return; if (r) return G2.npLyrics(); } catch (e) { if (P.q[P.i] !== id) return; return msg('歌詞を取得できませんでした(' + esc(e.message) + ')', '<button data-g="lysearch">検索し直す</button><button data-g="lyedit">自分で貼り付ける</button>'); } }
    return msg('この曲の歌詞は見つかりませんでした。', '<button data-g="lysearch">検索して選ぶ</button><button data-g="lyedit">自分で貼り付ける</button>');
  }
  if (rec.inst && !rec.lrc && !rec.plain) return msg('インストゥルメンタル(歌詞なし)', '<button data-g="lysearch">別の候補を探す</button>');
  const p = LRC.parse(rec.lrc || rec.plain), lead = rec.offset || 0; G2._lead = lead; G2._synced = p.synced && (ENG() !== 'link');
  head.innerHTML = `<span>${p.synced ? '' : 'テキスト歌詞(時間同期なし)'}${ENG() === 'link' && p.synced ? '※この再生方式では再生位置を取得できないため自動スクロールできません' : ''}</span><span style="flex:1"></span>${p.synced ? `<button data-g="lyoff" data-v="-0.5" aria-label="0.5秒遅く">◀ 遅く</button><span id="lyoffv">${lead > 0 ? '+' : ''}${lead.toFixed(1)}s</span><button data-g="lyoff" data-v="0.5" aria-label="0.5秒早く">早く ▶</button>` : ''}<button data-g="lyedit">編集</button><button data-g="lysearch">検索</button>`;
  const items = []; let html = '';
  if (p.synced) {
    const L = p.lines, dl = i => Math.min(5, (L[i].text || '').length * .28 + 1.5);
    if (L.length && L[0].t > 6) { html += `<div class="ly dots" data-k="0"><i></i><i></i><i></i></div>`; items.push({ t: 1, e: L[0].t, dots: true }); }
    L.forEach((l, i) => { html += `<div class="ly" data-g="lyseek" data-t="${l.t}">${l.words ? l.words.map(w => `<span class="w" data-t="${w.t}">${esc(w.w)}</span>`).join('') : esc(l.text) || '♪'}</div>`; items.push({ t: l.t, words: !!l.words }); const nx = L[i + 1]; if (nx && l.text && nx.t - l.t > 8) { html += `<div class="ly dots" data-k="0"><i></i><i></i><i></i></div>`; items.push({ t: l.t + dl(i), e: nx.t - .3, dots: true }); } });
  } else html = p.lines.map(l => `<div class="ly plain">${esc(l.text)}</div>`).join('');
  box.innerHTML = html; const els = [...box.querySelectorAll('.ly')]; items.forEach((it, i) => { it.el = els[i]; }); G2._items = items; G2._ai = -2; box.scrollTop = 0;
};
G2.npLoop = () => {
  if (!G2.npOn) return; const n = $('#np');
  if (!P.seeking) { const t = G2.curT(); $('#npc').textContent = hm(t); $('#npd').textContent = hm(P.dur); $('#npsk').value = P.dur ? Math.round(Math.min(1, t / P.dur) * 1000) : 0; }
  const items = G2._items;
  if (G2._synced && items.length) {
    const now = G2.curT() + (G2._lead || 0); let lo = 0, hi = items.length - 1, idx = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (items[m].t <= now) { idx = m; lo = m + 1; } else hi = m - 1; }
    if (idx >= 0 && items[idx].dots && now >= items[idx].e && items[idx + 1]) idx = Math.min(items.length - 1, idx + 1);
    if (idx !== G2._ai) {
      G2._ai = idx; items.forEach((it, i) => { it.el.classList.toggle('act', i === idx); it.el.style.setProperty('--d', Math.min(6, Math.abs(i - idx))); });
      if (idx >= 0 && Date.now() > (G2._user || 0)) { const box = $('#lyr'), el = items[idx].el; box.scrollTo({ top: el.offsetTop - box.clientHeight * .36 + el.clientHeight / 2, behavior: 'smooth' }); }
    }
    const it = items[idx]; if (it) { if (it.dots) it.el.dataset.k = String(Math.min(3, 1 + Math.floor((now - it.t) / Math.max(.1, it.e - it.t) * 3))); else if (it.words) it.el.querySelectorAll('.w').forEach(w => w.classList.toggle('on', now >= +w.dataset.t)); }
    if (G2._user && Date.now() > G2._user && idx >= 0 && G2._resume !== G2._user) { G2._resume = G2._user; const box = $('#lyr'), el = items[idx].el; box.scrollTo({ top: el.offsetTop - box.clientHeight * .36 + el.clientHeight / 2, behavior: 'smooth' }); }
  }
  requestAnimationFrame(G2.npLoop);
};
const _du = G2.dockUI; G2.dockUI = () => { _du(); if (G2.npOn) G2.npSync(); };
const _ds4 = G2.dockSync; G2.dockSync = () => { _ds4(); const d = $('#dock'); if (d && !d.dataset.g4) { d.dataset.g4 = 1; const m = d.querySelector('.dkm'); m.dataset.g = 'npopen'; m.style.cursor = 'pointer'; d.querySelector('.dko').insertAdjacentHTML('afterbegin', '<button data-g="npopen" title="再生画面(歌詞)" aria-label="再生画面(歌詞)">♪</button><button data-g="vfs" title="動画を全画面" aria-label="動画を全画面">📺</button>'); } G2.npInit(); };
/* ----- 歌詞の操作 ----- */
G2.acts.lyseek = (v, t) => { const sec = Math.max(0, +t.dataset.t - (G2._lead || 0)); if (ENG() === 'link') return toast('この再生方式ではシークできません'); ytSend('seekTo', [sec, true]); P.t = sec; G2._user = 0; };
G2.acts.lyoff = async v => { const id = P.q[P.i], r = G2.lyr.get(id); if (!r) return; await G2.lyrSave({ id, offset: Math.round(((r.offset || 0) + +v) * 10) / 10 }); G2.npLyrics(); };
G2.acts.lyon = () => { G2.cfg.lyricsOn = true; G2.saveCfg(); G2._tried.delete(P.q[P.i]); G2.npLyrics(); };
G2.acts.lyedit = () => { const id = P.q[P.i], r = G2.lyr.get(id) || {}; G2.modal(`<h3>歌詞を編集</h3><p class="sub">LRC形式(<code>[01:23.45]歌詞</code>)なら時間同期されます。単語単位は <code>&lt;01:23.45&gt;単語</code>。タイムスタンプなしのテキストも貼れます。</p><textarea id="lyta" rows="14" style="font-family:ui-monospace,monospace">${esc(r.lrc || r.plain || '')}</textarea><div class="rb"><button class="pri" data-g="lysave">保存</button>${r.id ? '<button class="dng" data-g="lydel">削除</button>' : ''}</div>`); };
G2.acts.lysave = async () => { const id = P.q[P.i], t = $('#lyta').value, sy = /\[\d{1,3}:\d{2}/.test(t); await G2.lyrSave({ id, lrc: sy ? t : '', plain: sy ? '' : t, src: 'manual', inst: false }); G2.acts.mclose(); G2.npLyrics(); };
G2.acts.lydel = async () => { const id = P.q[P.i]; G2.lyr.delete(id); await run('lyrics', 'readwrite', s => s.delete(id)); G2._tried.add(id); G2.acts.mclose(); G2.npLyrics(); };
G2.acts.lysearch = () => { const v = G2.vinfo(P.q[P.i]), q = G2.lyrQuery(v); G2.modal(`<h3>歌詞を検索(lrclib.net)</h3><div class="rb"><input id="lyq1" value="${esc(q.track)}" placeholder="曲名" size="22"><input id="lyq2" value="${esc(q.artist)}" placeholder="アーティスト" size="18"><button class="pri" data-g="lygo">検索</button></div><div id="lyres"></div>`); };
G2.acts.lygo = async () => { const el = $('#lyres'); el.innerHTML = '<p class="sub">検索中…</p>'; try { G2._lres = (await G2.lyrSearch($('#lyq1').value.trim(), $('#lyq2').value.trim())).slice(0, 10); el.innerHTML = G2._lres.length ? tbl(['曲', 'アーティスト', '長さ', '同期', ''], G2._lres.map((r, i) => [esc(r.trackName), esc(r.artistName), hm(r.duration), r.syncedLyrics ? '✔' : '-', `<button data-g="lypick" data-v="${i}">使う</button>`])) : '<p class="sub">見つかりませんでした</p>'; } catch (e) { el.innerHTML = `<p class="sub">検索に失敗しました: ${esc(e.message)}</p>`; } };
G2.acts.lypick = async v => { const id = P.q[P.i]; await G2.lyrSave(fromItem(id, G2._lres[+v])); G2.acts.mclose(); G2.npLyrics(); };
/* ----- 動画の全画面(PC) ----- */
G2.acts.vfs = async () => {
  if (ENG() === 'link') return G2.linkOpen(P.q[P.i]);
  if (ENG() === 'embed') { const k = $('#dkv'); P.big = true; G2.dockUI(); if (k.requestFullscreen) k.requestFullscreen().catch(() => { }); return; }
  if (!P.tabId || !P.winId) return toast('再生ウィンドウが開いていません(▶で再生してください)');
  const on = !P.vfs; try { await chrome.windows.update(P.winId, { state: on ? 'fullscreen' : 'normal', focused: true }); } catch { try { await chrome.windows.update(P.winId, { state: on ? 'maximized' : 'normal', focused: true }); } catch (e) { return err(e, '全画面'); } }
  P.vfs = on; chrome.tabs.sendMessage(P.tabId, { type: 'yt-cmd', cmd: 'immersive', a: on }).catch(() => { }); toast(on ? '動画を全画面にしました(Escで戻る)' : '全画面を解除しました');
};
const _ot = G2.onTab; G2.onTab = m => { if (m.ev === 'esc') { if (P.vfs) G2.acts.vfs(); return; } _ot(m); };
const _tu = G2.tabUrl; G2.tabUrl = (id, auto) => _tu(id, auto) + (P.vfs ? '&himm=1' : '');
const _tc = G2.tabClose; G2.tabClose = () => { P.vfs = false; _tc(); };
document.addEventListener('keydown', e => {
  if (typing && typing(e)) return;
  if (e.key === 'Escape' && G2.npOn && !document.fullscreenElement) G2.acts.npclose();
  else if (G2.npOn && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && ENG() !== 'link') { const t = Math.max(0, G2.curT() + (e.key === 'ArrowRight' ? 5 : -5)); ytSend('seekTo', [t, true]); P.t = t; }
  else if (e.key === 'f' && P.q.length && !G2.npOn) G2.acts.vfs();
});
/* ----- 設定: 歌詞 ----- */
const _set6 = V.settings; V.settings = () => _set6() + card('歌詞', `<div class="rb"><label><input type="checkbox" data-g="cfg" data-k="lyricsOn" ${G2.cfg.lyricsOn ? 'checked' : ''}> 歌詞を自動で検索する(曲名・アーティスト名を lrclib.net に送信します)</label></div><p class="sub">保存済みの歌詞: ${G2.lyr.size}曲(端末内に保存され、同期にも含まれます)。歌詞はオープンな歌詞データベース(LRCLIB)の提供データです。権利者の許諾を得た歌詞が必要な場合は、手動で貼り付けてください。再生画面(♪)から検索・編集・タイミング調整ができます。</p><div class="rb"><button data-g="lyclear" class="dng">保存済みの歌詞を全削除</button></div>`);
G2.acts.lyclear = async () => { if (!confirm('保存済みの歌詞をすべて削除します。')) return; G2.lyr = new Map(); await run('lyrics', 'readwrite', s => s.clear()); render(); };
