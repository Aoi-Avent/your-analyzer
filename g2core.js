'use strict';
/* ===== 第2世代: 共通基盤(メモ/復習/プレイリスト・同期・動画詳細・コンテンツ強化) ===== */
const G2 = {
  meta: new Map(), lists: [], listsAll: [], vc: null, sc: null, acts: {}, chg: {}, inp: {}, studyViews: {}, syncing: false,
  cfg: Object.assign({ autosync: true, syncHours: 3, studyGenres: ['学習・解説', 'テック・ガジェット'], goalH: 5 }, ls.get('ytha.cfg', {})),
  lastSync: ls.get('ytha.lastSync', 0), cmode: ls.get('ytha.cmode', 'log'), vf: { q: '', g: '', chip: '', sort: 'n', page: 0, scope: 'range' }
};
G2.ext = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
G2.saveCfg = () => { G2.cfg.t = Date.now(); ls.set('ytha.cfg', G2.cfg); if (G2.schedule) G2.schedule(); };
G2.today = () => new Date().toLocaleDateString('sv-SE');
G2.ago = t => { if (!t) return '未実施'; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'たった今' : m < 60 ? m + '分前' : m < 1440 ? Math.round(m / 60) + '時間前' : Math.round(m / 1440) + '日前'; };
G2.loadMeta = async () => { try { const [m, l] = await Promise.all([getAll('vmeta'), getAll('lists')]); G2.meta = new Map((m || []).map(x => [x.id, x])); G2.listsAll = l || []; G2.lists = G2.listsAll.filter(x => !x.del).sort((a, b) => a.created - b.created); } catch (e) { err(e, 'メタデータ'); } G2.vc = G2.sc = null; };
G2.getMeta = id => G2.meta.get(id) || { id, star: 0, note: '', tags: [], music: null, rv: null };
G2.setMeta = async (id, patch) => { const m = { ...G2.getMeta(id), ...patch, upd: Date.now() }; G2.meta.set(id, m); G2.sc = null; await putMany('vmeta', [m]); if (G2.schedule) G2.schedule(); return m; };
G2.videos = () => {
  if (G2.vc) return G2.vc; const m = new Map();
  for (const r of S.W) { let v = m.get(r.id); if (!v) { v = { id: r.id, title: r.title, ch: r.ch, chid: r.chid, dur: r.dur, g: r.g, n: 0, first: r.d, last: r.d, dates: [], prs: [], secs: 0 }; m.set(r.id, v); } v.n++; v.title = r.title; if (r.ch) { v.ch = r.ch; v.chid = r.chid; } if (r.dur != null) v.dur = r.dur; v.g = r.g; v.last = r.d; v.dates.push(r.d + ' ' + r.t); if (r.pr != null) v.prs.push(r.pr); v.secs += r.dur || 0; }
  m.forEach(v => { v.pmax = v.prs.length ? Math.max(...v.prs) : null; }); return G2.vc = m;
};
G2.isMusic = v => { const x = G2.meta.get(v.id); return x && x.music === true || (!(x && x.music === false) && v.g === '音楽'); };
const _prep = prep; prep = function () { _prep(); G2.vc = G2.sc = null; };
const _render = render; render = function () { _render(); G2.post(); };
const thumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const isVid = id => /^[\w-]{11}$/.test(id || '');
const vthumb = v => isVid(v.id) ? `<img loading="lazy" src="${thumb(v.id)}" alt="">` : '';
const stars = id => `<button class="star ${G2.getMeta(id).star ? 'on' : ''}" data-g="star" data-v="${id}" title="お気に入り">★</button>`;
const rvBtn = id => `<button class="rvb ${G2.getMeta(id).rv ? 'on' : ''}" data-g="rv" data-v="${id}" title="復習リストに追加/解除">📚</button>`;
const gchip = (l, key, val, cur, extra = '') => `<button class="chip ${cur === val ? 'on' : ''}" data-g="${key}" data-v="${val}" ${extra}>${l}</button>`;
G2.dl = (name, text, type) => download(name, text, type);
G2.csv = (head, rows) => '\ufeff' + head.join(',') + '\n' + rows.map(r => r.map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');

/* ----- 同期 ----- */
G2.syncBox = () => (G2.ext ? `<div class="syn"><button class="pri" data-g="sync">⟳ 最新の履歴を同期</button><div class="sub">最終同期: ${G2.ago(G2.lastSync)}</div></div>` : '') + (G2.devBox ? G2.devBox() : '');
G2.sync = async (o = {}) => {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return toast('拡張機能として開いた画面でのみ同期できます');
  if (G2.syncing) return; G2.syncing = true; const before = S.raw.length, last = S.raw.length ? S.raw[S.raw.length - 1].d : null;
  busy('Googleマイアクティビティから最新の履歴を取得中…(タブが一時的に開きます)', .3);
  try {
    const res = await chrome.runtime.sendMessage({ type: 'sync', since: o.days ? null : (last || null), days: o.days || null });
    if (!res || !res.ok) throw new Error(res && res.error || '応答がありません');
    G2.lastSync = Date.now(); ls.set('ytha.lastSync', G2.lastSync); busy(''); await load(); toast(`同期完了: ${num(res.n)}件を取得 → 新規${num(S.raw.length - before)}件`);
  } catch (e) { busy(''); err(e, '同期'); } finally { G2.syncing = false; }
};
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) chrome.runtime.onMessage.addListener(m => { if (m.type === 'sync-progress' && G2.syncing) busy(`履歴を読み込み中… ${num(m.n)}件`, .5); if (m.type === 'synced' && !G2.syncing) load(); });
G2.acts.sync = () => G2.sync({});
G2.acts.syncd = v => G2.sync({ days: +v });

/* ----- モーダル ----- */
G2.modal = h => { const m = $('#modal'); m.innerHTML = `<div class="mbox"><button class="mx" data-g="mclose">✕</button>${h}</div>`; m.hidden = false; };
G2.acts.mclose = () => { $('#modal').hidden = true; };
G2.openVideo = id => {
  const v = G2.videos().get(id) || { id, title: id, ch: '', n: 0, dates: [], first: '-', last: '-', g: '' }, m = G2.getMeta(id), ds = [...new Set(v.dates.map(x => x.slice(0, 10)))].map(dnOf).sort((a, b) => a - b);
  const gap = ds.length > 1 ? Math.round((ds[ds.length - 1] - ds[0]) / (ds.length - 1)) + '日' : '-', mo = cnt(v.dates, x => x.slice(0, 7)), ks = [...mo.keys()].sort();
  G2.modal(`<div class="vc big">${vthumb(v)}<div><h3>${esc(v.title)}</h3><div class="sub">${esc(v.ch)} ${pill(v.g)}</div></div></div>` +
    kcs([['通算視聴回数', v.n + '回'], ['初回', v.first], ['最終', v.last], ['平均間隔', gap], ['最大進捗', v.pmax != null ? v.pmax + '%' : '-'], ['長さ', v.dur != null ? hm(v.dur) : '-']]) +
    (ks.length > 1 ? card('月別の視聴', cols(ks.map(k => k.slice(2)), ks.map(k => mo.get(k)))) : '') +
    `<div class="rb">${stars(id)}${rvBtn(id)}<button data-g="music" data-v="${id}">音楽: ${m.music === true ? '音楽として扱う' : m.music === false ? '音楽ではない' : '自動'}</button><button data-g="pladd" data-v="${id}">＋プレイリスト</button><button data-g="qadd" data-v="${id}">＋キュー</button><a href="https://www.youtube.com/watch?v=${esc(id)}" target="_blank" rel="noreferrer"><button>YouTubeで開く</button></a></div>` +
    `<h3>メモ(学んだこと・感想)</h3><textarea rows="4" data-g="note" data-v="${id}" placeholder="要点を自分の言葉で書いておくと復習で思い出しやすくなります">${esc(m.note)}</textarea>` +
    `<h3 style="margin-top:10px">タグ(カンマ区切り)</h3><input data-g="tags" data-v="${id}" value="${esc((m.tags || []).join(', '))}" style="width:100%">` +
    `<h3 style="margin-top:12px">視聴日時(新しい順・最大30件)</h3><div class="sub">${v.dates.slice(-30).reverse().join(' / ') || 'なし'}</div>`);
};
G2.acts.vopen = id => G2.openVideo(id);
G2.acts.star = async id => { await G2.setMeta(id, { star: G2.getMeta(id).star ? 0 : 1 }); if (!$('#modal').hidden) G2.openVideo(id); render(); };
G2.acts.rv = async id => { const m = G2.getMeta(id); await G2.setMeta(id, { rv: m.rv ? null : { lv: 0, due: new Date(Date.now() + 864e5).toLocaleDateString('sv-SE'), hist: [] } }); if (!$('#modal').hidden) G2.openVideo(id); render(); };
G2.acts.music = async id => { const x = G2.getMeta(id).music; await G2.setMeta(id, { music: x == null ? true : x === true ? false : null }); G2.openVideo(id); render(); };
G2.chg.note = t => G2.setMeta(t.dataset.v, { note: t.value });
G2.chg.tags = t => G2.setMeta(t.dataset.v, { tags: t.value.split(/[,、]/).map(x => x.trim()).filter(Boolean) });

/* ----- コンテンツタブ強化(動画別 視聴回数) ----- */
const _vc = V.content;
V.content = () => `<div class="tabs">${gchip('履歴(時系列)', 'cmode', 'log', G2.cmode)}${gchip('動画別 視聴回数', 'cmode', 'videos', G2.cmode)}</div>` + (G2.cmode === 'log' ? _vc() : G2.videosView());
G2.acts.cmode = v => { G2.cmode = v; ls.set('ytha.cmode', v); render(); };
G2.vlist = () => {
  const sp = span(), f = G2.vf, q = f.q.toLowerCase(), inR = cnt(sel(S.W, sp.a, sp.b), r => r.id), out = [], base = [];
  G2.videos().forEach(v => {
    v.r = inR.get(v.id) || 0; if (f.scope === 'range' && !v.r) return; base.push(v);
    const m = G2.meta.get(v.id) || {}, c = f.chip;
    if (f.g && v.g !== f.g) return; if (q && !(v.title + ' ' + v.ch).toLowerCase().includes(q)) return;
    if (c === 'rw' && v.n < 2) return; if (c === 'rw5' && v.n < 5) return; if (c === 'unf' && !(v.pmax != null && v.pmax < 50)) return; if (c === 'long' && !(v.dur >= 1800)) return;
    if (c === 'star' && !m.star) return; if (c === 'memo' && !m.note) return; if (c === 'rv' && !m.rv) return; out.push(v);
  });
  const so = { n: (a, b) => b.n - a.n || b.last.localeCompare(a.last), r: (a, b) => b.r - a.r || b.n - a.n, last: (a, b) => b.last.localeCompare(a.last), first: (a, b) => a.first.localeCompare(b.first), secs: (a, b) => b.secs - a.secs, prog: (a, b) => (b.pmax || 0) - (a.pmax || 0) }[f.sort];
  return { out: out.sort(so), base };
};
G2.videosView = () => {
  const f = G2.vf, { base } = G2.vlist(), rw = base.filter(v => v.n >= 2), mx = base.reduce((a, v) => v.n > (a ? a.n : 0) ? v : a, null);
  const dist = [['1回', 1, 1], ['2回', 2, 2], ['3回', 3, 3], ['4〜5回', 4, 5], ['6〜10回', 6, 10], ['11回〜', 11, 1e9]].map(([l, a, z]) => [l, base.filter(v => v.n >= a && v.n <= z).length]);
  const extra = rw.reduce((s, v) => s + (v.n - 1) * (v.dur || 0), 0);
  return rangeBar() + kcs([['動画数', num(base.length)], ['再視聴した動画(2回〜)', `${num(rw.length)} (${pct(rw.length, base.length)})`], ['最多視聴', mx ? mx.n + '回' : '-'], ['平均視聴回数', base.length ? (base.reduce((s, v) => s + v.n, 0) / base.length).toFixed(2) : '-'], ['再視聴に使った時間', hrs(extra)]]) +
    `<div class="g2">${card('視聴回数の分布', bars(dist))}${card('最も繰り返し見た動画 TOP10', bars(base.slice().sort((a, b) => b.n - a.n).slice(0, 10).map(v => [v.title, v.n])))}</div>` +
    `<div class="rb"><input data-g="vq" placeholder="タイトル・チャンネルで検索" value="${esc(f.q)}" size="30"><select data-g="vg"><option value="">全ジャンル</option>${GENRES.map(g => `<option ${f.g === g ? 'selected' : ''}>${g}</option>`).join('')}</select><select data-g="vsort">${[['n', '通算回数順'], ['r', '期間内回数順'], ['last', '最近見た順'], ['first', '初めて見た順'], ['secs', '総再生時間順'], ['prog', '進捗順']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${gchip(f.scope === 'range' ? '対象: 期間内' : '対象: 全期間', 'vscope', f.scope === 'range' ? 'all' : 'range', '')}<button data-g="vcsv">CSV</button></div>` +
    `<div class="rb">${[['', 'すべて'], ['rw', '再視聴(2回〜)'], ['rw5', '5回以上'], ['unf', '未完(進捗50%未満)'], ['long', '長尺(30分〜)'], ['star', '★'], ['memo', 'メモあり'], ['rv', '復習中']].map(([v, l]) => gchip(l, 'vchip', v, f.chip)).join('')}</div><div class="card" id="vt"></div>`;
};
G2.drawVideos = () => {
  const el = $('#vt'); if (!el) return; const f = G2.vf, { out } = G2.vlist(), PS = 50, pages = Math.max(1, Math.ceil(out.length / PS)); f.page = Math.min(f.page, pages - 1);
  el.innerHTML = `<p class="sub">${num(out.length)}本</p>` + tbl(['動画', 'ジャンル', '通算', '期間内', '初回', '最終', '最大進捗', ''], out.slice(f.page * PS, f.page * PS + PS).map(v => [`<div class="vc">${vthumb(v)}<div><a href="#" data-g="vopen" data-v="${v.id}">${esc(v.title)}</a><div class="sub">${esc(v.ch)}</div></div></div>`, pill(v.g), `<b>${v.n}回</b>`, v.r + '回', v.first, v.last, v.pmax != null ? `<div class="pb"><i style="width:${v.pmax}%"></i></div>` : '', stars(v.id) + rvBtn(v.id)])) +
    `<div class="rb" style="margin-top:12px"><button data-g="vpage" data-v="${Math.max(0, f.page - 1)}">← 前</button><span class="mut">${f.page + 1} / ${pages}</span><button data-g="vpage" data-v="${Math.min(pages - 1, f.page + 1)}">次 →</button></div>`;
};
G2.acts.vchip = v => { G2.vf.chip = v; G2.vf.page = 0; render(); }; G2.acts.vscope = v => { G2.vf.scope = v; G2.vf.page = 0; render(); }; G2.acts.vpage = v => { G2.vf.page = +v; G2.drawVideos(); };
G2.acts.vcsv = () => { const { out } = G2.vlist(); G2.dl('videos.csv', G2.csv(['動画ID', 'タイトル', 'チャンネル', 'ジャンル', '通算回数', '期間内回数', '初回', '最終', '最大進捗', '長さ(秒)'], out.map(v => [v.id, v.title, v.ch, v.g, v.n, v.r, v.first, v.last, v.pmax ?? '', v.dur ?? ''])), 'text/csv'); };
G2.inp.vq = t => { G2.vf.q = t.value; G2.vf.page = 0; G2.drawVideos(); };
G2.chg.vg = t => { G2.vf.g = t.value; G2.vf.page = 0; G2.drawVideos(); }; G2.chg.vsort = t => { G2.vf.sort = t.value; G2.drawVideos(); };

/* ----- 設定へ追加 ----- */
const _set = V.settings;
V.settings = () => _set() +
  (G2.ext ? card('最新履歴の同期(Google マイアクティビティ)', `<p class="sub">mhtmlを保存しなくても、マイアクティビティを自動で開いて最新の履歴を取り込みます(Googleにログイン済みであること)。マイアクティビティを自分で開いたときも、右下の「取り込む」パネルから取り込めます。</p><div class="rb"><button class="pri" data-g="sync">差分を同期(前回以降)</button><button data-g="syncd" data-v="30">過去30日</button><button data-g="syncd" data-v="90">過去90日</button><button data-g="syncd" data-v="365">過去1年</button></div><div class="rb"><label><input type="checkbox" data-g="cfg" data-k="autosync" ${G2.cfg.autosync ? 'checked' : ''}> アプリを開いたとき、前回から</label><input type="number" min="1" max="72" style="width:64px" data-g="cfg" data-k="syncHours" value="${G2.cfg.syncHours}">時間以上たっていれば自動で同期する</div>`) : '') +
  card('メモ・復習・プレイリスト・設定', `<div class="rb"><button data-g="bk2">バックアップ(JSON)</button><button data-g="rs2">復元</button><button class="dng" data-g="clr2">メモ・復習・プレイリストを全削除</button></div><p class="sub">「履歴の全削除」では消えません(別管理)。メモ ${G2.meta.size}件 / プレイリスト ${G2.lists.length}件。</p>`);
G2.chg.cfg = t => { G2.cfg[t.dataset.k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? +t.value : t.value; G2.saveCfg(); };
G2.acts.cfg = () => { };
G2.acts.bk2 = () => G2.dl('ytha_notes_backup.json', JSON.stringify({ v: 2, vmeta: [...G2.meta.values()], lists: G2.lists, cfg: G2.cfg, ov: S.ov }), 'application/json');
G2.acts.rs2 = () => $('#rfile2').click();
G2.acts.clr2 = async () => { if (!confirm('メモ・復習・プレイリストをすべて削除します。元に戻せません。')) return; await Promise.all(['vmeta', 'lists'].map(s => run(s, 'readwrite', x => x.clear()))); await load(); toast('削除しました'); };
$('#rfile2').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (!d || !Array.isArray(d.vmeta) || !Array.isArray(d.lists)) throw new Error('バックアップ形式ではありません'); await putMany('vmeta', d.vmeta); await putMany('lists', d.lists); if (d.cfg) { Object.assign(G2.cfg, d.cfg); G2.saveCfg(); } if (d.ov) { S.ov = { ...S.ov, ...d.ov }; ls.set('ytha.ov', S.ov); } await load(); toast('復元しました'); } catch (x) { err(x, '復元'); }
};

/* ----- 描画後フック / モーダルなど共通DOM / イベント ----- */
G2.post = () => {
  const nav = $('#nav'); if (nav) nav.insertAdjacentHTML('beforeend', G2.syncBox());
  if (!$('#modal')) document.body.insertAdjacentHTML('beforeend', '<div id="modal" hidden></div>');
  if (G2.ext && S.view === 'dash' && S.raw.length && Date.now() - G2.lastSync > 864e5 && !G2.cfg.autosync && $('#view')) $('#view').insertAdjacentHTML('afterbegin', `<div class="bn">最新の履歴を同期していません(最終: ${G2.ago(G2.lastSync)})。<button class="pri" data-g="sync">今すぐ同期</button></div>`);
  if (S.view === 'content' && G2.cmode === 'videos') G2.drawVideos();
  if (G2.dockSync) G2.dockSync();
};
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-g]'); if (!t) { if (e.target.id === 'modal') G2.acts.mclose(); return; }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return; e.preventDefault();
  try { const f = G2.acts[t.dataset.g]; if (f) await f(t.dataset.v, t, e); } catch (x) { err(x, t.dataset.g); }
});
document.addEventListener('change', e => { const t = e.target.closest('[data-g]'); if (t && G2.chg[t.dataset.g]) try { G2.chg[t.dataset.g](t); } catch (x) { err(x, t.dataset.g); } });
document.addEventListener('input', e => { const t = e.target.closest('[data-g]'); if (t && G2.inp[t.dataset.g]) try { G2.inp[t.dataset.g](t); } catch (x) { err(x, t.dataset.g); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal') && !$('#modal').hidden) G2.acts.mclose(); });
G2.autoSync = () => { if (G2.ext && G2.cfg.autosync && S.raw.length && Date.now() - G2.lastSync > G2.cfg.syncHours * 36e5) G2.sync({}); };
addEventListener('DOMContentLoaded', () => setTimeout(G2.autoSync, 1500));
