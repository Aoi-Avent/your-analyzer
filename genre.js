'use strict';
const GENRES = ['音楽', '配信・切り抜き', 'ゲーム', 'ニュース', 'テック・ガジェット', '学習・解説', '料理・生活', 'アニメ・エンタメ', 'スポーツ', 'その他'];
const GCOL = { '音楽': '#ff4e8c', '配信・切り抜き': '#ff9f1a', 'ゲーム': '#7c5cff', 'ニュース': '#3b9eff', 'テック・ガジェット': '#12b886', '学習・解説': '#e0b000', '料理・生活': '#a0b43c', 'アニメ・エンタメ': '#e64980', 'スポーツ': '#20c997', 'その他': '#8a8f98' };
const RULES = [
  ['音楽', /\bMV\b|Music Video|Official (Audio|Video)|オルゴール|ボカロ|ボーカロイド|VOCALOID|初音ミク|BGM|歌ってみた|弾いてみた|叩いてみた|演奏|ピアノ|ギター|軽音|カラオケ|プレイリスト|playlist|作業用|lo-?fi|ローファイ|インスト|楽曲|主題歌|クラシック|交響曲|SHOWCASE LIVE|ライブ映像|\bcover\b|カバー|\bfeat\.|Remix|リミックス|[♪♫🎵🎶]|\bSong\b|サウンドトラック|\bOST\b|Acoustic|Music Walker/i],
  ['配信・切り抜き', /切り抜き|ダイジェスト|生配信|ライブ配信|アーカイブ|雑談|ロードショー|配信/],
  ['ゲーム', /ゲーム|実況|マリオ|マインクラフト|Minecraft|GTA|スプラトゥーン|ポケモン|ゼルダ|APEX|VALORANT|ヴァロ|フォートナイト|マリカ|\bRTA\b|攻略|スマブラ|\bFPS\b|ドット絵バトル|ぶいすぽ|プレイ|Steam|PS5|Switch|ゲーミング|モンハン|エルデン|ELDEN/i],
  ['ニュース', /ニュース|NEWS|速報|逮捕|容疑|事件|事故|火災|地震|台風|首相|大統領|政府|国会|選挙|警察|裁判|記者|報道|住民|知事|NHK|日テレ|TBS|FNN|ANN|JNN|読売|朝日新聞|毎日新聞|共同通信|時事|\bCNN\b|BBC|Reuters|放送/i],
  ['テック・ガジェット', /ThinkPad|MacBook|iPhone|iPad|Android|Pixel|Galaxy|GPU|グラボ|\bCPU\b|\bPC\b|パソコン|自作|ガジェット|レビュー|\bAI\b|ChatGPT|Gemini|Claude|Opus|\bLLM\b|Adobe|Photoshop|プログラミング|Linux|Windows|\bMac\b|E Ink|スマホ|Raspberry|Arduino|ESP32|3Dプリンタ|電子工作|\badb\b|Huawei|Apple|Samsung|Xiaomi|Nvidia|RTX|\bSSD\b|ノートPC|キーボード|Phone|Laptop|Tech|Chrome|拡張機能|アプリ開発|Swift|Python|JavaScript|モルタルプリンター/i],
  ['学習・解説', /解説|講座|入門|勉強|学び|仕組み|歴史|経済|投資|ビジネス|インタビュー|講演|対談|哲学|科学|教養|授業|論破|ひろゆき|成田悠輔|起業|創業|マーケティング|心理学|大学|なぜ|理由/],
  ['料理・生活', /料理|レシピ|グルメ|ラーメン|カフェ|弁当|掃除|収納|ルーティン|Vlog|暮らし|ひとり暮らし|旅行|キャンプ|釣り|ペット|エリンギ|焼くだけ|節約|ホテル|旅/i],
  ['アニメ・エンタメ', /アニメ|漫画|マンガ|ちいかわ|ホロライブ|にじさんじ|VTuber|声優|映画|ドラマ|予告|ミーム|爆笑|お笑い|漫才|コント|芸人|バラエティ|ドッキリ|きさらぎ駅|怖い話|ホラー|都市伝説|おもしろ|ネタ/i],
  ['スポーツ', /野球|サッカー|NBA|MLB|大谷|ゴルフ|テニス|相撲|格闘技|UFC|RIZIN|筋トレ|ワークアウト|バスケ|バレー|マラソン|\bF1\b|オリンピック|ボクシング/i],
];
function classify(title, ch) { const t = `${title || ''} ${ch || ''}`; for (const [g, re] of RULES) if (re.test(t)) return g; return 'その他'; }
const MSUB = [['ボカロ', /ボカロ|VOCALOID|ボーカロイド|初音ミク/i], ['オルゴール', /オルゴール/], ['BGM・作業用', /BGM|作業用|lo-?fi|ローファイ|睡眠|ヒーリング/i], ['歌ってみた・カバー', /歌ってみた|カバー|\bcover\b|カラオケ/i], ['ライブ・演奏', /ライブ|\bLIVE\b|演奏|弾いてみた|叩いてみた|ピアノ|ギター|軽音|SHOWCASE/i], ['MV・公式', /\bMV\b|Music Video|Official|公式/i], ['クラシック', /クラシック|交響曲|ベートーヴェン|モーツァルト|ショパン|バッハ|カノン/]];
const musicSub = t => (MSUB.find(([, re]) => re.test(t)) || ['その他'])[0];
function artistOf(title, ch) {
  const m = title.match(/^(.{1,30}?)\s[-–—]\s/); if (m) return m[1].trim();
  return (ch || '不明').replace(/\s*-\s*Topic$|\s*(Official|公式)(チャンネル|Channel)?$/i, '').trim() || '不明';
}
const GAMEDB = [['マリオカート', /マリオカート|マリカ/], ['スーパーマリオメーカー', /マリオメーカー/], ['マインクラフト', /マインクラフト|Minecraft/i], ['GTA', /GTA/i], ['ポケモン', /ポケモン/], ['スプラトゥーン', /スプラ/], ['APEX', /APEX/i], ['VALORANT', /VALORANT|ヴァロ/i], ['プラネットズー', /プラネットズー/], ['めっちゃカメレオン', /カメレオン/], ['エルデンリング', /エルデン|ELDEN/i], ['モンハン', /モンハン|モンスターハンター/], ['スマブラ', /スマブラ/], ['フォートナイト', /フォートナイト|Fortnite/i]];
const STOP = new Set(['ダイジェスト', '切り抜き', 'shorts', 'short', 'youtube', 'official', 'video', 'the', 'and', 'for', 'with', 'this', 'that', 'you', 'from', 'new', 'こと', 'これ', 'それ', 'ため', 'よう', 'さん', 'です', 'ます', 'する', 'した', 'から', 'まで', 'ので', 'という', 'fyp']);
function terms(titles, n = 40) {
  titles = [...new Set(titles)]; if (titles.length > 3000) titles = titles.slice(-3000);
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ja', { granularity: 'word' }) : null, m = new Map();
  for (const t of titles) {
    const s0 = t.replace(/https?:\/\/\S+/g, ''), seen = new Set();
    const ws = seg ? [...seg.segment(s0)].filter(x => x.isWordLike).map(x => x.segment) : s0.split(/[\s\u3000【】「」『』()（）\[\]｜|/／、。!！?？#・:：-]+/);
    for (let w of ws) { w = w.toLowerCase(); if (w.length < 2 || /^\d+$/.test(w) || STOP.has(w) || seen.has(w)) continue; seen.add(w); m.set(w, (m.get(w) || 0) + 1); }
  }
  return [...m].filter(x => x[1] > 1 || titles.length < 30).sort((a, b) => b[1] - a[1]).slice(0, n);
}
if (typeof module !== 'undefined') module.exports = { classify, musicSub, artistOf, terms, GENRES };
