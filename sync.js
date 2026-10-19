'use strict';
/* デバイス間同期の共通部品(DOM非依存)。拡張機能とスマホWebアプリで同一のものを使う。
   方針: 端末ごとに自分専用の同期ファイル(ytha-<端末ID>.ytha)だけを書き、他端末のファイルは読むだけ。
         → 同時に使っても上書き衝突が起きない。履歴は和集合、メモ/プレイリスト/設定は更新時刻が新しい方を採用。 */
const YS = {
  AK: ['k', 'd', 't', 'kind', 'id', 'title', 'ch', 'chid', 'dur', 'pr', 'prod', 'sh'],
  clean(r) { const o = {}; for (const k of YS.AK) if (r[k] !== undefined) o[k] = r[k]; return o; },
  build(s) { return { fmt: 'ytha-sync', v: 1, at: Date.now(), device: s.device, acts: s.acts.map(YS.clean), vmeta: s.vmeta, lists: s.lists, ov: s.ov, cfg: s.cfg }; },
  newer(localMap, arr) { return (arr || []).filter(r => r && r.id && (!localMap.has(r.id) || (r.upd || 0) > (localMap.get(r.id).upd || 0))); },
  async gz(str) {
    if (typeof CompressionStream === 'undefined' || typeof Blob === 'undefined' || !Blob.prototype.stream) return new TextEncoder().encode(str);
    return new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  },
  async ungz(buf) {
    const u = new Uint8Array(buf);
    if (u[0] === 0x1f && u[1] === 0x8b) { if (typeof DecompressionStream === 'undefined') throw new Error('このブラウザは圧縮された同期ファイルを読めません'); return await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
    return new TextDecoder().decode(u);
  },
  encode(b) { return YS.gz(JSON.stringify(b)); },
  async decode(buf) {
    let b; try { b = JSON.parse(await YS.ungz(buf)); } catch (e) { throw new Error('同期ファイルとして読めません(' + e.message + ')'); }
    if (!b || b.fmt !== 'ytha-sync') throw new Error('履歴アナライザーの同期ファイルではありません');
    if (b.v > 1) throw new Error('新しい形式の同期ファイルです。アプリを最新版に更新してください');
    return b;
  }
};
if (typeof module !== 'undefined') module.exports = { YS };
