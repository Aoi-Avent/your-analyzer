'use strict';
/* ===== 第3世代: デバイス間同期 =====
   PC同士(Windows/Mac): 各PCが同じクラウドフォルダ(iCloud/Google Drive/OneDrive/Dropbox)を「同期フォルダ」に指定 → 自動で同期
   スマホ: 同期ファイル(.ytha)を共有/読み込み。PC側はフォルダを見るだけで取り込める。 */
const guessName = () => { const u = navigator.userAgent || ''; return (/iPhone|iPad/.test(u) ? 'iPhone/iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Win/.test(u) ? 'Windows' : 'PC') + (G2.ext ? ' (拡張機能)' : ' (Web)'); };
G2.dev = ls.get('ytha.dev', null) || (() => { const d = { id: Math.random().toString(36).slice(2, 10), name: guessName() }; ls.set('ytha.dev', d); return d; })();
G2.fsOK = () => typeof window.showDirectoryPicker === 'function';
G2.syncOn = () => !!ls.get('ytha.syncOn', 0);
G2.peers = () => ls.get('ytha.peers', {});

/* --- 端末内の変更を検出してジャンル修正(ov)に更新時刻を付ける --- */
G2.ovStamp = () => { const snap = ls.get('ytha.ovsnap', {}), ovt = ls.get('ytha.ovt', {}); new Set([...Object.keys(S.ov), ...Object.keys(snap)]).forEach(k => { if (S.ov[k] !== snap[k]) ovt[k] = Date.now(); }); ls.set('ytha.ovt', ovt); ls.set('ytha.ovsnap', { ...S.ov }); return ovt; };
G2.localState = () => { const ovt = G2.ovStamp(), ov = {}; Object.keys(ovt).forEach(k => { ov[k] = [S.ov[k] ?? null, ovt[k]]; }); return { device: G2.dev, acts: S.raw, vmeta: [...G2.meta.values()], lists: G2.listsAll, ov, cfg: { t: G2.cfg.t || 0, studyGenres: G2.cfg.studyGenres, goalH: G2.cfg.goalH } }; };
G2.sig = () => [S.raw.length, S.raw.length ? S.raw[S.raw.length - 1].k : '', G2.meta.size, [...G2.meta.values()].reduce((m, x) => Math.max(m, x.upd || 0), 0), G2.listsAll.length, G2.listsAll.reduce((m, x) => Math.max(m, x.upd || 0), 0), Object.values(G2.ovStamp()).reduce((m, x) => Math.max(m, x), 0), G2.cfg.t || 0].join('|');

/* --- 他端末のデータを取り込む(履歴=和集合 / その他=更新が新しい方) --- */
G2.apply = async b => {
  G2.ovStamp(); const st = { rows: 0, meta: 0, lists: 0, ov: 0, cfg: 0 };
  const have = new Set(S.raw.map(r => r.k)), nr = (b.acts || []).filter(r => r && r.k && r.d && !have.has(r.k)); if (nr.length) { await putMany('acts', nr); st.rows = nr.length; }
  const nm = YS.newer(G2.meta, b.vmeta); if (nm.length) { await putMany('vmeta', nm); st.meta = nm.length; }
  const nl = YS.newer(new Map(G2.listsAll.map(x => [x.id, x])), b.lists); if (nl.length) { await putMany('lists', nl); st.lists = nl.length; }
  const ovt = ls.get('ytha.ovt', {}); Object.entries(b.ov || {}).forEach(([k, v]) => { if (Array.isArray(v) && v[1] > (ovt[k] || 0)) { if (v[0] == null) delete S.ov[k]; else S.ov[k] = v[0]; ovt[k] = v[1]; st.ov++; } });
  if (st.ov) { ls.set('ytha.ov', S.ov); ls.set('ytha.ovt', ovt); ls.set('ytha.ovsnap', { ...S.ov }); }
  if (b.cfg && b.cfg.t > (G2.cfg.t || 0)) { G2.cfg.studyGenres = b.cfg.studyGenres || G2.cfg.studyGenres; G2.cfg.goalH = b.cfg.goalH || G2.cfg.goalH; G2.cfg.t = b.cfg.t; ls.set('ytha.cfg', G2.cfg); st.cfg = 1; }
  if (b.device && b.device.id) { const p = G2.peers(); p[b.device.id] = { name: b.device.name, at: b.at }; ls.set('ytha.peers', p); }
  return st;
};
const changed = st => st.rows || st.meta || st.lists || st.ov || st.cfg;
const sumSt = (a, b) => { Object.keys(b).forEach(k => { a[k] = (a[k] || 0) + b[k]; }); return a; };
const describe = st => [st.rows && `履歴${num(st.rows)}件`, st.meta && `メモ/復習${num(st.meta)}件`, st.lists && `プレイリスト${st.lists}件`, st.ov && `ジャンル修正${st.ov}件`].filter(Boolean).join('・') || '変更なし';

/* --- 同期ファイルの書き出し/読み込み(全端末で使える方式) --- */
G2.exportFile = async share => {
  const bytes = await YS.encode(YS.build(G2.localState())), name = `ytha-${G2.dev.id}.ytha`, file = new File([bytes], name, { type: 'application/octet-stream' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: '履歴アナライザー 同期ファイル' }); return toast('共有しました。保存先をクラウドフォルダにすると他の端末で読み込めます'); } catch (e) { if (e.name === 'AbortError') return; } }
  G2.dl(name, bytes, 'application/octet-stream'); toast('同期ファイルを保存しました');
};
G2.importFiles = async files => {
  const tot = {}; let ok = 0, ng = 0; busy('同期ファイルを読み込み中…', .3); await tick();
  for (const f of files) { try { tot && sumSt(tot, await G2.apply(await YS.decode(await f.arrayBuffer()))); ok++; } catch (e) { ng++; err(e, f.name); } await tick(); }
  busy(''); await load(); toast(`${ok}ファイル取り込み${ng ? `(${ng}ファイル失敗)` : ''}: ${describe(tot)}`);
};
$('#rfile3').onchange = e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) G2.importFiles(f); };
G2.acts.fexp = () => G2.exportFile(true); G2.acts.fimp = () => $('#rfile3').click();

/* --- 同期フォルダ(PC版Chrome) --- */
const sdb = () => new Promise((res, rej) => { const r = indexedDB.open('ythasync', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const sget = async k => { const d = await sdb(); return new Promise(res => { const q = d.transaction('h').objectStore('h').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); };
const sset = async (k, v) => { const d = await sdb(); return new Promise((res, rej) => { const t = d.transaction('h', 'readwrite'); t.objectStore('h').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
G2.perm = async ask => { const h = G2.folder || (G2.folder = await sget('dir')); if (!h) return 'none'; let p = await h.queryPermission({ mode: 'readwrite' }); if (p !== 'granted' && ask) p = await h.requestPermission({ mode: 'readwrite' }); return p; };
G2.writeOwn = async dir => {
  const sig = G2.sig(), name = `ytha-${G2.dev.id}.ytha`; let exists = true; try { await dir.getFileHandle(name); } catch { exists = false; }
  if (exists && ls.get('ytha.wsig', '') === sig) return false;
  const bytes = await YS.encode(YS.build(G2.localState())), w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(bytes); await w.close(); ls.set('ytha.wsig', sig); return true;
};
G2.syncFolder = async (ask = false) => {
  if (G2.sbusy) return; G2.sbusy = true; const tot = {}; let files = 0, wrote = false;
  try {
    const p = await G2.perm(ask); if (p === 'none') return; if (p !== 'granted') { G2.sstat = 'permission'; return; }
    const dir = G2.folder, seen = ls.get('ytha.seen', {});
    for await (const [name, h] of dir.entries()) {
      if (h.kind !== 'file' || !/^ytha-[\w-]+\.ytha$/.test(name) || name === `ytha-${G2.dev.id}.ytha`) continue;
      const f = await h.getFile(), sg = f.lastModified + ':' + f.size; if (seen[name] === sg) continue;
      sumSt(tot, await G2.apply(await YS.decode(await f.arrayBuffer()))); seen[name] = sg; files++;
    }
    ls.set('ytha.seen', seen); if (changed(tot)) { G2.nosched = true; try { await load(); } finally { G2.nosched = false; } }
    wrote = await G2.writeOwn(dir); G2.sstat = 'ok'; G2.slast = Date.now(); ls.set('ytha.slast', G2.slast); ls.set('ytha.sres', { text: describe(tot), files, wrote });
  } catch (e) { G2.sstat = 'error'; ls.set('ytha.sres', { text: 'エラー: ' + (e.message || e), files, wrote }); err(e, 'デバイス同期'); }
  finally { G2.sbusy = false; if (S.view === 'settings') render(); else G2.dockSync && G2.dockSync(); }
  return { ...tot, files, wrote };
};
G2.schedule = () => { if (G2.nosched || !G2.fsOK() || !G2.syncOn() || !S.raw.length) return; clearTimeout(G2.st); G2.st = setTimeout(() => G2.syncFolder(false), 4000); };
G2.acts.fpick = async () => { try { const h = await showDirectoryPicker({ id: 'ytha-sync', mode: 'readwrite' }); await sset('dir', h); G2.folder = h; ls.set('ytha.syncOn', 1); ls.set('ytha.seen', {}); await G2.syncFolder(true); toast('同期フォルダを設定しました'); render(); } catch (e) { if (e.name !== 'AbortError') err(e, 'フォルダ選択'); } };
G2.acts.fsync = () => G2.syncFolder(true);
G2.acts.foff = async () => { if (!confirm('同期フォルダの設定を解除します(フォルダ内のファイルは削除されません)。')) return; ls.set('ytha.syncOn', 0); G2.folder = null; await sset('dir', null); render(); };
G2.chg.devname = t => { G2.dev.name = t.value.trim() || guessName(); ls.set('ytha.dev', G2.dev); };
G2.devBox = () => !G2.fsOK() && !G2.syncOn() ? '' : `<div class="syn"><button data-g="${G2.syncOn() ? 'fsync' : 'nav'}" data-v="settings">⇄ デバイス同期</button><div class="sub">${G2.syncOn() ? (G2.sstat === 'permission' ? '⚠ 許可が必要(押して再開)' : G2.sbusy ? '同期中…' : `最終: ${G2.ago(ls.get('ytha.slast', 0))}`) : '未設定'}</div></div>`;
G2.acts.nav = v => { S.view = v; S.ch = null; render(); };

/* --- 設定画面 --- */
G2.syncCard = () => {
  const on = G2.syncOn(), res = ls.get('ytha.sres', null), peers = Object.entries(G2.peers()).filter(([id]) => id !== G2.dev.id);
  return `<p class="sub">履歴・メモ・復習・プレイリスト・ジャンル修正を、複数のパソコン/スマホで共有します。データは<b>あなたのクラウドフォルダ</b>(iCloud Drive / Google Drive / OneDrive / Dropbox など)に「端末ごとの同期ファイル」として置かれるだけで、このアプリが外部サーバーへ送信することはありません。</p>
  <div class="rb">この端末の名前 <input data-g="devname" value="${esc(G2.dev.name)}" size="22" aria-label="端末名"> <span class="mut">ID: ${esc(G2.dev.id)}</span></div>` +
    (G2.fsOK() ? `<h3 style="margin-top:12px">① パソコン同士(自動)</h3><p class="sub">全パソコンで、<b>同じクラウドフォルダ</b>を「同期フォルダ」に指定してください。アプリを開いたとき・変更後・5分ごとに自動で同期します。</p><div class="rb"><button class="pri" data-g="fpick">${on ? '同期フォルダを変更' : '同期フォルダを選ぶ'}</button>${on ? `<button data-g="fsync">今すぐ同期</button><button data-g="foff">解除</button>` : ''}</div>` +
      (on ? `<p class="sub">${G2.sstat === 'permission' ? '⚠ ブラウザ再起動後はフォルダへのアクセス許可が必要です。<button data-g="fsync">許可して同期</button>' : `フォルダ: <b>${esc(G2.folder ? G2.folder.name : '(設定済み)')}</b> ／ 最終同期: ${G2.ago(ls.get('ytha.slast', 0))}${res ? ` ／ ${esc(res.text)}${res.wrote ? '・自分のデータを書き出しました' : ''}` : ''}`}</p>` : '') : '') +
    `<h3 style="margin-top:12px">${G2.fsOK() ? '② スマホ・その他の端末(ファイル)' : '同期ファイル'}</h3><p class="sub">スマホ等は「書き出す」→ クラウドフォルダに保存。パソコンはそのフォルダを同期フォルダにしておけば自動で取り込みます。逆(パソコン→スマホ)は、スマホで同期ファイルを「読み込む」(クラウドから選択)。</p><div class="rb"><button data-g="fexp">同期ファイルを書き出す</button><button data-g="fimp">同期ファイルを読み込む(複数選択可)</button></div>` +
    (peers.length ? `<p class="sub">これまでに同期した端末: ${peers.map(([, p]) => `${esc(p.name)}(${G2.ago(p.at)})`).join(' / ')}</p>` : '') +
    `<details><summary class="sub">同期のルール</summary><ul class="sub"><li>履歴:各端末のデータの<b>和集合</b>(重複は自動で除去)</li><li>メモ・★・復習・プレイリスト・ジャンル修正:<b>更新時刻が新しい方</b>を採用。プレイリスト削除も伝わります</li><li>履歴の削除は他の端末には伝わりません(全端末で削除、または同期ファイルを削除してください)</li><li>各端末は自分のファイル(ytha-端末ID.ytha)にだけ書き込むため、同時に使っても上書きされません</li></ul></details>`;
};
const _set3 = V.settings; V.settings = () => _set3() + card('デバイス間同期', G2.syncCard());

/* --- 自動トリガー --- */
setInterval(() => { if (document.visibilityState === 'visible' && G2.syncOn() && G2.fsOK() && S.raw.length) G2.syncFolder(false); }, 5 * 60e3);
addEventListener('DOMContentLoaded', () => setTimeout(() => { if (G2.syncOn() && G2.fsOK()) G2.syncFolder(false); }, 2500));
const _load = load; load = async function () { await _load(); G2.schedule(); };
