'use strict';
/* ===== 第3世代: 完成度向上(初回案内・検索パレット・ハイライト・年間まとめ・診断・データ管理・アクセシビリティ) ===== */
NAV.splice(NAV.findIndex(n => n[0] === 'quality'), 0, ['report', 'まとめ', '★']);
G2.ver = () => { try { return G2.ext ? chrome.runtime.getManifest().version : 'web'; } catch { return '?'; } };

/* ----- 初回案内(履歴が空のとき) ----- */
G2.empty = () => {
  const box = (ic, t, d, btn) => `<div class="card" style="text-align:left"><h3>${ic} ${t}</h3><p class="sub">${d}</p>${btn || ''}</div>`;
  return `<div class="empty"><h2>ようこそ ― まず履歴を取り込みましょう</h2><p class="sub">データはすべてこの端末のブラウザ内に保存され、外部サーバーへは送信されません。</p></div><div class="g2">` +
    (G2.ext ? box('⟳', '自動で取り込む(おすすめ)', 'Googleにログイン済みなら、マイアクティビティを自動で開いて直近の履歴を取り込みます。', '<button class="pri" data-g="syncd" data-v="90">過去90日を取り込む</button> <button data-g="syncd" data-v="365">過去1年</button>') : '') +
    box('📄', 'mhtmlファイルから', 'マイアクティビティ(YouTube)を開き、下までスクロールして「名前を付けて保存 → ウェブページ、単一ファイル(.mhtml)」。保存したファイルをここにドラッグ&ドロップ(複数可)。', '<button class="pri" data-a="pick">ファイルを選ぶ</button>') +
    box('📦', 'Google Takeout(公式のエクスポート)', 'takeout.google.com → 「YouTube と YouTube Music」→「履歴」をJSON形式で書き出し → watch-history.json を選択。全期間を一括で取り込めます(動画の長さ・進捗は含まれません)。', '<button data-a="pick">watch-history.json を選ぶ</button>') +
    box('⇄', '他の端末で使っている場合', '他の端末で書き出した同期ファイル(.ytha)を読み込みます。以後は同期フォルダ/ファイルで共有できます。', '<button data-g="fimp">同期ファイルを読み込む</button>') + `</div>`;
};

/* ----- コマンドパレット(Ctrl/⌘+K) ----- */
G2.acts.palette = () => { G2.modal('<input id="palq" data-g="palq" placeholder="画面・動画・チャンネルを検索…(Esc で閉じる)" style="width:100%;font-size:16px" autocomplete="off" aria-label="検索"><div id="palr"></div>'); $('#palq').focus(); G2.palDraw(''); };
G2.palDraw = q => {
  q = q.toLowerCase().trim(); const out = [];
  NAV.filter(([id, l]) => !q || l.toLowerCase().includes(q) || id.includes(q)).forEach(([id, l, i]) => out.push(`<a href="#" data-g="palgo" data-v="${id}">${i} ${l}</a>`));
  if (q.length >= 2) {
    let n = 0; const chs = new Map();
    for (const v of G2.videos().values()) {
      const hit = (v.title + ' ' + v.ch).toLowerCase().includes(q); if (hit && n < 8) { out.push(`<a href="#" data-g="vopen" data-v="${v.id}">▶ ${esc(v.title)} <span class="sub">${esc(v.ch)} ・ ${v.n}回</span></a>`); n++; }
      if (v.ch && v.ch.toLowerCase().includes(q)) { const c = chs.get(v.chid || v.ch) || { n: v.ch, c: 0 }; c.c += v.n; chs.set(v.chid || v.ch, c); }
    }
    [...chs].sort((a, b) => b[1].c - a[1].c).slice(0, 5).forEach(([k, c]) => out.push(`<a href="#" data-g="palch" data-v="${esc(k)}">◉ ${esc(c.n)} <span class="sub">${c.c}回</span></a>`));
  }
  $('#palr').innerHTML = out.slice(0, 22).join('') || '<p class="sub">見つかりません</p>';
};
G2.inp.palq = t => G2.palDraw(t.value);
G2.acts.palgo = v => { G2.acts.mclose(); S.view = v; S.ch = null; render(); window.scrollTo(0, 0); };
G2.acts.palch = v => { G2.acts.mclose(); S.ch = v; S.view = 'channel'; render(); window.scrollTo(0, 0); };
G2.acts.help = () => G2.modal(`<h3>ショートカット</h3>${tbl(['キー', '動作'], [['Ctrl/⌘ + K', '画面・動画・チャンネルを検索'], ['?', 'このヘルプ'], ['Esc', '閉じる'], ['Space', '再生/一時停止(プレーヤー表示中)'], ['N / P', '次の曲 / 前の曲']])}<h3 style="margin-top:12px">ヒント</h3><ul class="sub"><li>動画名をクリックすると、視聴日・メモ・★・復習・プレイリスト追加ができます</li><li>チャンネル画面のプルダウンでジャンルを直すと、そのチャンネル全体に反映されます</li><li>「勉強」タブで復習を続けると、記憶が定着するタイミングで思い出せます</li></ul>`);
const typing = e => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); G2.acts.palette(); } else if (e.key === '?' && !typing(e)) G2.acts.help(); });

/* ----- ダッシュボード: ハイライト / N年前の今日 ----- */
G2.insights = () => {
  const sp = span(), R = sel(S.raw, sp.a, sp.b), P = sel(S.raw, sp.pa, sp.pb), k = kpi(R), p = kpi(P), L = []; if (!k.views) return '';
  if (p.views) { const d = Math.round((k.views - p.views) / p.views * 100); L.push(`視聴回数は前の期間より <b>${d >= 0 ? '+' : ''}${d}%</b>(${num(p.views)} → ${num(k.views)})`); }
  const gc = topN(cnt(k.W, r => r.g), 1)[0]; if (gc) L.push(`いちばん多かったジャンルは <b>${esc(gc[0])}</b>(${pct(gc[1], k.views)})`);
  const prev = new Set(); S.W.forEach(r => { if (r.dn < sp.a) prev.add(ck(r)); }); const nw = new Set(k.W.map(ck).filter(c => c && !prev.has(c))); if (nw.size && prev.size) L.push(`初めて見たチャンネルが <b>${nw.size}</b> 件`);
  const night = k.W.filter(r => r.h < 5).length; if (night / k.views > .15) L.push(`深夜(0〜5時)の視聴が ${pct(night, k.views)} あります`);
  const rw = k.views - k.uniq; if (rw / k.views > .2) L.push(`視聴の ${pct(rw, k.views)} は再視聴です`);
  return L.length ? card('📈 ハイライト', `<ul style="margin:0;padding-left:20px">${L.map(x => `<li>${x}</li>`).join('')}</ul>`) : '';
};
G2.onThisDay = () => {
  const t = new Date(), md = `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`, out = [];
  for (let y = t.getFullYear() - 1; y >= t.getFullYear() - 6; y--) { const m = new Map(); S.W.forEach(r => { if (r.d === `${y}-${md}`) { const o = m.get(r.id) || { r, c: 0 }; o.c++; m.set(r.id, o); } }); if (m.size) out.push(`<h3>${t.getFullYear() - y}年前の今日(${y}-${md})</h3>` + tbl(['動画', '回'], [...m.values()].sort((a, b) => b.c - a.c).slice(0, 4).map(o => [vcell(o.r), o.c]))); }
  return out.length ? card('🕰 思い出', out.join('')) : '';
};
const _dash = V.dash; V.dash = () => { const a = _dash(); return G2.insights() + a + G2.onThisDay(); };

/* ----- 年間まとめ ----- */
G2.ry = null;
G2.reportData = y => {
  const R = S.raw.filter(r => r.d.startsWith(y)), W = R.filter(r => r.kind === 'watch'), k = kpi(R), ds = [...new Set(R.map(r => r.dn))].sort((a, b) => a - b), st = streaks(ds);
  const ch = new Map(), vid = new Map(), gen = cnt(W, r => r.g), mon = new Array(12).fill(0), seenBefore = new Set(), wd = new Array(7).fill(0), hr = new Array(24).fill(0), day = cnt(R, r => r.d);
  S.W.forEach(r => { if (r.d < y) seenBefore.add(ck(r)); });
  W.forEach(r => { const c = ch.get(ck(r)) || { n: r.ch, c: 0, s: 0 }; c.c++; c.s += r.dur || 0; ch.set(ck(r), c); const v = vid.get(r.id) || { r, c: 0 }; v.c++; vid.set(r.id, v); mon[+r.d.slice(5, 7) - 1] += (r.dur || 0) / 3600; wd[r.wd]++; hr[r.h]++; });
  const music = new Map(); vid.forEach((o, id) => { const v = G2.videos().get(id); if (v && G2.isMusic(v)) music.set(id, { v, c: o.c }); });
  const fresh = [...ch].filter(([key]) => key && !seenBefore.has(key)).sort((a, b) => b[1].c - a[1].c).slice(0, 5);
  return { R, W, k, st, ds, ch, vid, gen, mon, wd, hr, day, music, fresh };
};
V.report = () => {
  const ys = [...new Set(S.raw.map(r => +r.d.slice(0, 4)))].sort((a, b) => b - a); if (!G2.ry || !ys.includes(G2.ry)) G2.ry = ys[0];
  const y = String(G2.ry), D = G2.reportData(y), { k, st } = D, bw = Object.entries(D.day).length, bd = topN(D.day, 1)[0], wdN = '日月火水木金土';
  const art = new Map(); D.music.forEach(o => { const a = artistOf(o.v.title, o.v.ch); art.set(a, (art.get(a) || 0) + o.c); });
  return `<div class="tabs">${ys.map(v => gchip(v + '年', 'ryear', v, G2.ry)).join('')}</div>` +
    card(`🎉 ${y}年の振り返り`, kcs([['視聴回数', num(k.views)], ['合計の長さ', `${num(k.secs / 3600)}時間(約${(k.secs / 86400).toFixed(1)}日)`], ['ユニーク動画', num(k.uniq)], ['チャンネル数', num(k.chs)], ['検索回数', num(k.q)], ['見た日数', num(D.ds.length) + '日'], ['最長連続', st.longest + '日'], ['最も多い日', bd ? `${bd[0]}(${bd[1]}件)` : '-']]) + `<div class="rb"><button data-g="rcopy">共有用テキストをコピー</button><button data-g="rhtml">HTMLで保存</button></div>`) +
    `<div class="g2">${card('よく見たチャンネル TOP10', bars([...D.ch.values()].sort((a, b) => b.c - a.c).slice(0, 10).map(o => [o.n, o.c])))}${card('ジャンル', bars(topN(D.gen, 10), l => GCOL[l]))}</div>` +
    `<div class="g2">${card('月別の視聴時間(h)', cols('123456789101112'.match(/1[0-2]|[1-9]/g), D.mon.map(x => +x.toFixed(1))))}${card('曜日 / 時間帯', cols(wdN.split(''), D.wd) + cols([...Array(24).keys()].map(String), D.hr))}</div>` +
    `<div class="g2">${card('繰り返し見た動画 TOP10', tbl(['動画', '回'], [...D.vid.values()].sort((a, b) => b.c - a.c).slice(0, 10).map(o => [vcell(o.r), o.c])))}${card('この年に出会った新しいチャンネル', D.fresh.length ? tbl(['チャンネル', '回'], D.fresh.map(([, c]) => [esc(c.n), c.c])) : '<p class="sub">なし</p>')}</div>` +
    (D.music.size ? `<div class="g2">${card('♪ よく聴いた曲 TOP10', tbl(['曲', '回'], [...D.music.values()].sort((a, b) => b.c - a.c).slice(0, 10).map(o => [vcell(o.v), o.c])))}${card('♪ アーティスト TOP10', bars(topN(art, 10)))}</div>` : '');
};
G2.acts.ryear = v => { G2.ry = +v; render(); };
G2.acts.rcopy = async () => { const D = G2.reportData(String(G2.ry)), tc = [...D.ch.values()].sort((a, b) => b.c - a.c).slice(0, 3).map(o => o.n), tg = topN(D.gen, 3).map(x => x[0]); await navigator.clipboard.writeText(`【${G2.ry}年のYouTube振り返り】\n視聴 ${num(D.k.views)}回 / 合計 ${num(D.k.secs / 3600)}時間\nよく見たチャンネル: ${tc.join('、')}\nよく見たジャンル: ${tg.join('、')}\n最長連続 ${D.st.longest}日\n#履歴アナライザー`); toast('コピーしました'); };
G2.acts.rhtml = () => G2.dl(`youtube_${G2.ry}.html`, `<!doctype html><meta charset="utf-8"><title>${G2.ry}年の振り返り</title><body style="font:15px/1.7 system-ui;max-width:760px;margin:30px auto;padding:0 16px">${$('#view').innerHTML.replace(/<button[\s\S]*?<\/button>/g, '')}</body>`, 'text/html');

/* ----- 設定: データ管理 / プライバシー / サポート ----- */
G2.diag = () => { const gc = cnt(S.W, r => r.g), at = S.raw.length ? `${S.raw[0].d}〜${S.raw[S.raw.length - 1].d}` : '-'; return ['履歴アナライザー 診断情報(個人の視聴内容は含みません)', `版: ${G2.ver()} / 環境: ${G2.ext ? '拡張機能' : 'Web'} / ${navigator.userAgent}`, `件数: ${S.raw.length} / 期間: ${at} / 取込ファイル: ${S.files.length}`, `メモ: ${G2.meta.size} / プレイリスト: ${G2.lists.length} / 端末ID: ${G2.dev.id}`, `ジャンル: ${[...gc].map(([g, n]) => g + ':' + n).join(', ')}`, `同期: ${G2.syncOn() ? '設定済み' : '未設定'} / 再生方式: ${typeof ENG === 'function' ? ENG() : '-'}`, `エラー(直近): ${S.errors.slice(-10).join(' | ') || 'なし'}`].join('\n'); };
G2.acts.diag = async () => { await navigator.clipboard.writeText(G2.diag()); toast('診断情報をコピーしました'); };
G2.acts.rdel = async () => {
  const a = $('[data-g=dfrom]').value, b = $('[data-g=dto]').value; if (!a || !b || a > b) return toast('期間を正しく指定してください');
  const keys = S.raw.filter(r => r.d >= a && r.d <= b).map(r => r.k); if (!keys.length) return toast('該当する履歴はありません');
  if (!confirm(`${a} 〜 ${b} の履歴 ${num(keys.length)} 件を削除します。元に戻せません。\n(同期中の他の端末には残ります。必要なら他の端末でも削除してください)`)) return;
  busy('削除中…', .5); await run('acts', 'readwrite', s => { keys.forEach(k => s.delete(k)); }); busy(''); await load(); toast(`${num(keys.length)}件を削除しました`);
};
const _set4 = V.settings;
V.settings = () => _set4() +
  card('データ管理', `<p class="sub">指定した期間の履歴を、この端末から削除します(メモ・復習・プレイリストは残ります)。</p><div class="rb"><input type="date" data-g="dfrom" aria-label="開始日"> 〜 <input type="date" data-g="dto" aria-label="終了日"><button class="dng" data-g="rdel">この期間を削除</button></div>`) +
  card('プライバシー', `<ul class="sub"><li>履歴・メモ・設定は<b>すべてこの端末のブラウザ内(IndexedDB)</b>に保存されます。開発者のサーバーへ送信することはありません。</li><li>外部との通信は、①サムネイル画像(i.ytimg.com)の表示 ②YouTubeでの再生${G2.ext ? ' ③(任意)マイアクティビティの読み取り' : ''} ${G2.ext ? '④' : '③'}(任意)あなた自身のクラウドフォルダへの同期ファイル保存、のみです。</li><li>解析・広告・トラッキングは一切ありません。</li><li>ブラウザの拡張機能を削除すると、保存データも削除されます(先にバックアップを)。</li></ul>`) +
  card('サポート', `<div class="rb"><button data-g="diag">診断情報をコピー</button><button data-g="help">ショートカット(?)</button><button data-g="palette">検索(Ctrl/⌘+K)</button></div><p class="sub">バージョン: ${esc(G2.ver())} ／ 不具合報告には「診断情報」を貼り付けてください(視聴内容は含まれません)。</p>`);

/* ----- 復習バッジ / アクセシビリティ ----- */
G2.badge = () => { if (G2.ext) try { chrome.runtime.sendMessage({ type: 'badge' }).catch(() => { }); } catch { } };
const _sm = G2.setMeta; G2.setMeta = async (id, p) => { const r = await _sm(id, p); if (p && 'rv' in p) G2.badge(); return r; };
if (G2.acts['radd-all']) { const _ra = G2.acts['radd-all']; G2.acts['radd-all'] = async (...a) => { await _ra(...a); G2.badge(); }; }
G2.labels = { prev: '前の曲', pp: '再生/一時停止', next: '次の曲', shuf: 'シャッフル', rep: 'リピート', ab: 'A-Bリピート', vbig: '映像/再生ウィンドウ', qtoggle: '再生キュー', dkclose: 'プレーヤーを閉じる', dkopen: 'YouTubeで開く', mclose: '閉じる', qup: '上へ', qdn: '下へ', qrm: '削除', plup: '上へ', pldn: '下へ', plrm: '削除', star: 'お気に入り', rv: '復習リストに追加/解除' };
const _post2 = G2.post; G2.post = () => { _post2(); document.querySelectorAll('button[data-g]:not([aria-label])').forEach(b => { const l = G2.labels[b.dataset.g]; if (l) b.setAttribute('aria-label', l); }); };
document.documentElement.lang = 'ja';
