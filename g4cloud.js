'use strict';
/* ===== 第4世代: クラウド同期(自分のCloudflare Worker + KV / 端末側でAES-GCM暗号化) =====
   各端末が「自分のデータ」を暗号化してアップロードし、他端末のデータを取得して統合する。サーバー側は暗号文しか持たない。 */
const B64 = { enc: b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), dec: s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) };
G2.cloudCfg = () => ls.get('ytha.cloud', null); G2.cloudOn = () => { const c = G2.cloudCfg(); return !!(c && c.u && c.t && c.k && c.on); };
G2.ckey = c => crypto.subtle.importKey('raw', B64.dec(c.k), 'AES-GCM', false, ['encrypt', 'decrypt']);
G2.cenc = async (bytes, c) => { const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await G2.ckey(c), bytes)), o = new Uint8Array(15 + ct.length); o.set([0x59, 0x45, 1]); o.set(iv, 3); o.set(ct, 15); return o; };
G2.cdec = async (bytes, c) => { if (bytes[0] !== 0x59 || bytes[1] !== 0x45) throw new Error('暗号化形式が不明です'); try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(3, 15) }, await G2.ckey(c), bytes.slice(15))); } catch { throw new Error('復号できません(別の端末と暗号キーが違います。設定コードを入れ直してください)'); } };
G2.cfetch = async (path, o = {}, c = G2.cloudCfg()) => {
  let r; try { r = await fetch(c.u.replace(/\/+$/, '') + path, { ...o, headers: { authorization: 'Bearer ' + c.t, ...(o.headers || {}) } }); } catch { throw new Error('クラウドに接続できません(URLとネットワークを確認)'); }
  if (r.status === 401) throw new Error('トークンが一致しません(Workerの SYNC_TOKEN を確認)'); if (!r.ok && r.status !== 404) throw new Error('クラウドエラー ' + r.status); return r;
};
G2.cloudSync = async () => {
  const c = G2.cloudCfg(); if (!G2.cloudOn() || G2.cbusy) return; G2.cbusy = true; const tot = {}; let up = false;
  try {
    const idx = await (await G2.cfetch('/v1/index')).json(), seen = ls.get('ytha.cseen', {});
    for (const d of idx) { if (d.id === G2.dev.id) continue; const sg = d.at + ':' + d.size; if (seen[d.id] === sg) continue; const r = await G2.cfetch('/v1/dev/' + d.id); if (r.status === 404) continue; sumSt(tot, await G2.apply(await YS.decode(await G2.cdec(new Uint8Array(await r.arrayBuffer()), c)))); seen[d.id] = sg; }
    ls.set('ytha.cseen', seen); if (changed(tot)) { G2.nosched = true; try { await load(); } finally { G2.nosched = false; } }
    const sig = G2.sig(); if (ls.get('ytha.csig', '') !== sig) { await G2.cfetch('/v1/dev/' + G2.dev.id, { method: 'PUT', body: await G2.cenc(await YS.encode(YS.build(G2.localState())), c), headers: { 'x-ytha-name': encodeURIComponent(G2.dev.name) } }); ls.set('ytha.csig', sig); up = true; }
    ls.set('ytha.cslast', Date.now()); ls.set('ytha.cres', { ok: true, text: describe(tot), up });
  } catch (e) { ls.set('ytha.cres', { ok: false, text: e.message || String(e) }); err(e, 'クラウド同期'); }
  finally { G2.cbusy = false; if (S.view === 'settings') render(); }
  return { ...tot, up };
};
const _sch = G2.schedule; G2.schedule = () => { _sch(); if (G2.cloudOn() && !G2.nosched && S.raw.length) { clearTimeout(G2.ct); G2.ct = setTimeout(() => G2.cloudSync(), 30000); } };
setInterval(() => { if (document.visibilityState === 'visible' && G2.cloudOn()) G2.cloudSync(); }, 5 * 60e3);
addEventListener('DOMContentLoaded', () => setTimeout(() => { G2.pairFromHash(); if (G2.cloudOn()) G2.cloudSync(); }, 3000));
const _db4 = G2.devBox; G2.devBox = () => _db4() + (G2.cloudOn() ? `<div class="syn"><button data-g="csyncnow">☁ クラウド同期</button><div class="sub">${G2.cbusy ? '同期中…' : '最終: ' + G2.ago(ls.get('ytha.cslast', 0))}</div></div>` : '');
G2.acts.csyncnow = () => G2.cloudSync();
/* ----- ペアリング(設定コード / スマホ用リンク) ----- */
G2.pairCode = () => { const c = G2.cloudCfg(); return B64.enc(new TextEncoder().encode(JSON.stringify({ u: c.u, t: c.t, k: c.k }))); };
G2.phoneUrl = () => G2.ext ? (G2.cfg.phoneUrl || '') : location.origin + location.pathname;
G2.applyCode = async code => { let o; try { o = JSON.parse(new TextDecoder().decode(B64.dec(code.trim().replace(/^.*#pair=/, '')))); } catch { throw new Error('設定コードを読み取れません'); } if (!o.u || !o.t || !o.k) throw new Error('設定コードが不完全です'); const c = { u: o.u, t: o.t, k: o.k, on: 1 }; await G2.cfetch('/v1/ping', {}, c); ls.set('ytha.cloud', c); ls.set('ytha.cseen', {}); ls.set('ytha.csig', ''); };
G2.pairFromHash = async () => { if (!/^#pair=/.test(location.hash)) return; const code = location.hash.slice(6); history.replaceState(null, '', location.pathname + location.search); if (!confirm('クラウド同期の設定を読み込みます。この端末をあなたのクラウドに接続してよろしいですか?')) return; try { await G2.applyCode(code); toast('クラウド同期を設定しました'); await G2.cloudSync(); render(); } catch (e) { err(e, 'ペアリング'); } };
G2.acts.cgen = () => { const d = ls.get('ytha.cdraft', null) || { t: B64.enc(crypto.getRandomValues(new Uint8Array(24))), k: B64.enc(crypto.getRandomValues(new Uint8Array(32))) }; ls.set('ytha.cdraft', d); render(); };
G2.acts.ccopyt = async () => { await navigator.clipboard.writeText(ls.get('ytha.cdraft').t); toast('トークンをコピーしました。WorkerのSYNC_TOKENに設定してください'); };
G2.acts.ccopyw = async () => { await navigator.clipboard.writeText(G2.WORKER_SRC); toast('Workerのコードをコピーしました'); };
G2.acts.cconnect = async () => {
  const d = ls.get('ytha.cdraft'), u = ($('[data-g=curl]').value || '').trim(); if (!d) return toast('先にトークンを生成してください'); if (!/^https:\/\//.test(u)) return toast('WorkerのURL(https://…)を入力してください');
  try { const c = { u, t: d.t, k: d.k, on: 1 }; await G2.cfetch('/v1/ping', {}, c); ls.set('ytha.cloud', c); ls.set('ytha.cseen', {}); ls.set('ytha.csig', ''); ls.set('ytha.cdraft', null); toast('接続しました。同期します…'); render(); await G2.cloudSync(); } catch (e) { err(e, '接続'); }
};
G2.acts.capply = async () => { try { await G2.applyCode($('[data-g=ccode]').value); toast('設定コードを適用しました'); render(); G2.cloudSync(); } catch (e) { err(e, '設定コード'); } };
G2.acts.ccopylink = async () => { const u = G2.phoneUrl(); if (!u) return toast('先に「スマホアプリのURL」を入力してください'); await navigator.clipboard.writeText(u.replace(/#.*$/, '') + '#pair=' + G2.pairCode()); toast('スマホ用リンクをコピーしました。スマホに送って開いてください(リンクの中に暗号キーが含まれます。他人に共有しないでください)'); };
G2.acts.ccopycode = async () => { await navigator.clipboard.writeText(G2.pairCode()); toast('設定コードをコピーしました(他人に共有しないでください)'); };
G2.acts.coff = () => { if (!confirm('この端末のクラウド同期を解除します(クラウド上のデータは残ります)。')) return; const c = G2.cloudCfg(); ls.set('ytha.cloud', { ...c, on: 0 }); render(); };
G2.acts.cdelcloud = async () => { if (!confirm('クラウド上の「この端末のデータ」を削除します。')) return; try { await G2.cfetch('/v1/dev/' + G2.dev.id, { method: 'DELETE' }); ls.set('ytha.csig', ''); toast('削除しました'); } catch (e) { err(e, 'クラウド削除'); } };
G2.chg.cphone = t => { G2.cfg.phoneUrl = t.value.trim(); G2.saveCfg(); };
G2.cloudCard = () => {
  const c = G2.cloudCfg(), res = ls.get('ytha.cres', null);
  if (G2.cloudOn()) return `<p class="sub">接続中: <b>${esc(c.u)}</b> ／ 最終同期: ${G2.ago(ls.get('ytha.cslast', 0))}${res ? ` ／ ${res.ok ? '✔ ' : '⚠ '}${esc(res.text)}${res.up ? '・自分のデータをアップロードしました' : ''}` : ''}</p><p class="sub">データは端末側で暗号化されてから保存されます(サーバーは中身を読めません)。変更があると約30秒後に自動で同期し、アプリを開いている間は5分ごとに確認します。</p>
<div class="rb"><button class="pri" data-g="csyncnow">今すぐ同期</button><button data-g="coff">解除</button><button data-g="cdelcloud" class="dng">クラウド上のこの端末のデータを削除</button></div>
<h3 style="margin-top:12px">他の端末をつなぐ</h3>${G2.ext ? `<div class="rb">スマホアプリのURL <input data-g="cphone" value="${esc(G2.cfg.phoneUrl || '')}" placeholder="https://…(公開したスマホ用Webアプリ)" size="34"></div>` : ''}<div class="rb"><button data-g="ccopylink">スマホ用リンクをコピー(タップするだけで接続)</button><button data-g="ccopycode">設定コードをコピー</button></div>`;
  const d = ls.get('ytha.cdraft', null);
  return `<p class="sub">あなた自身のクラウド(Cloudflare・無料枠)に暗号化データを置き、PCとスマホを<b>自動で</b>同期します。最初に一度だけ設定が必要です(約10分)。</p>
<ol class="sub"><li><button data-g="cgen">${d ? '生成済み' : 'トークンを生成'}</button> ${d ? `<code>${esc(d.t)}</code> <button data-g="ccopyt">コピー</button>` : ''}</li><li>Cloudflare にログイン → Workers &amp; Pages → 「Worker を作成」→ <button data-g="ccopyw">Workerのコードをコピー</button> を貼り付けて保存</li><li>KV を作成して Worker に変数名 <code>YTHA_KV</code> でバインド、設定 → 変数とシークレットに <code>SYNC_TOKEN</code> = ①のトークン を追加してデプロイ</li><li>Worker のURLを入力 → 接続: <input data-g="curl" placeholder="https://xxxx.workers.dev" size="30"> <button class="pri" data-g="cconnect">接続して有効化</button></li></ol>
<div class="rb">すでに他の端末で設定済みなら: <input data-g="ccode" placeholder="設定コード" size="26"><button data-g="capply">適用</button></div>`;
};
const _set7 = V.settings; V.settings = () => _set7() + card('クラウド同期(自動)', G2.cloudCard());
