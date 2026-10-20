'use strict';
/* ===== 第4世代: UI/UX改善(アイコン・設定のタブ化・スマホのスクロール/はみ出し対策・更新) ===== */
G2.mobile = () => typeof matchMedia === 'function' && matchMedia('(max-width:800px)').matches;
G2.scrollTop = () => { if (G2.mobile()) { const m = $('#main'); if (m && m.scrollTo) m.scrollTo(0, 0); } else window.scrollTo(0, 0); };
/* ----- アイコン(OS依存の絵文字/記号をやめ、統一したSVGに) ----- */
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
G2.ICON = {
  dash: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  content: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>'),
  study: svg('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>'),
  colls: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
  channels: svg('<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>'),
  genres: svg('<path d="M12 3v9h9a9 9 0 1 1-9-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>'),
  music: svg('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  report: svg('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/>'),
  quality: svg('<path d="M4 12.5l5 5L20 6.5"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>')
};
NAV.forEach(n => { if (G2.ICON[n[0]]) n[2] = G2.ICON[n[0]]; });
/* ----- 設定をタブに整理 ----- */
G2.setGroups = { 'データ': ['データの取り込み', 'エクスポート', 'コレクション', 'データ管理', 'メモ・復習', 'ジャンル設定', '危険な操作'], '同期': ['最新履歴の同期', 'デバイス間同期', 'クラウド同期'], '再生・歌詞': ['プレーヤー', '歌詞'], '表示・その他': ['表示', '更新', 'プライバシー', 'サポート'] };
G2.ssub = ls.get('ytha.ssub', 'データ');
const _setBase = V.settings;
const _setAll = () => _setBase() + card('更新', G2.updCardAny());
V.settings = () => {
  const cards = _setAll().split(/(?=<section class="card">)/).filter(Boolean), groups = Object.entries(G2.setGroups);
  const gOf = c => { const t = ((c.match(/<h3>(.*?)<\/h3>/) || [])[1] || '').replace(/<[^>]+>/g, ''), g = groups.find(([, a]) => a.some(k => t.startsWith(k))); return g ? g[0] : '表示・その他'; };
  const cur = groups.some(([k]) => k === G2.ssub) ? G2.ssub : 'データ';
  return `<div class="tabs">${groups.map(([k]) => gchip(k, 'ssetg', k, cur)).join('')}</div>` + cards.filter(c => gOf(c) === cur).join('');
};
G2.acts.ssetg = v => { G2.ssub = v; ls.set('ytha.ssub', v); render(); };
/* ----- 更新(PC拡張機能 / スマホWebアプリ) ----- */
G2.extUpdCard = () => `<p class="sub">バージョン: <b>${esc(G2.ver())}</b>。Chromeウェブストア版は自動で更新されます。</p>`;
G2.webUpdCard = () => `<p class="sub">バージョン: <b>${esc(G2.ver())}</b>。新しい版が公開されると、画面上部に「今すぐ更新」が表示されます(データはそのまま残ります)。</p><div class="rb"><button data-g="webupd">更新を確認する</button></div>`;
G2.acts.webupd = async () => { if (window.__pwaUpdate) return window.__pwaUpdate(); toast('この環境では更新確認はできません(ブラウザで再読み込みしてください)'); };
G2.updCardAny = () => G2.ext ? G2.extUpdCard() : G2.webUpdCard();
