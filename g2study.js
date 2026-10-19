'use strict';
/* ===== 勉強タブ: 間隔反復の復習 / 直近の振り返り / 教材づくり / 学習状況 ===== */
NAV.splice(2, 0, ['study', '勉強', '🎓']);
G2.IV = [1, 3, 7, 14, 30, 60, 120];
G2.sub = ls.get('ytha.studysub', 'review'); G2.rscope = 'study'; G2.rs = null;
G2.ms = { range: '30', genre: 'study', group: 'topic', memo: 0, star: 0 }; G2.mat = null;
const inStudy = v => G2.cfg.studyGenres.includes(v.g);
G2.after = d => new Date(Date.now() + d * 864e5).toLocaleDateString('sv-SE');
G2.dueList = () => [...G2.meta.values()].filter(m => m.rv && m.rv.due <= G2.today()).sort((a, b) => a.rv.due.localeCompare(b.rv.due));
G2.rate = async (id, q) => {
  const m = G2.getMeta(id), rv = { lv: 0, hist: [], ...m.rv }; let days;
  if (q === 'good') { rv.lv = Math.min(6, rv.lv + 1); days = G2.IV[rv.lv]; } else if (q === 'fuzzy') days = Math.max(1, Math.ceil(G2.IV[rv.lv] / 2)); else { rv.lv = 0; days = 1; }
  rv.due = G2.after(days); rv.hist = [...rv.hist, { d: G2.today(), q }].slice(-40); await G2.setMeta(id, { rv });
};
G2.reviewDays = () => { const s = new Set(); G2.meta.forEach(m => m.rv && m.rv.hist.forEach(h => s.add(h.d))); return s; };
G2.streak = set => { let n = 0; for (let i = 0; i < 400; i++) { const d = G2.after(-i); if (set.has(d)) n++; else if (i > 0) break; } return n; };
G2.candidates = (days = 14) => { const last = S.raw.length ? S.raw[S.raw.length - 1].dn : 0; return [...G2.videos().values()].filter(v => inStudy(v) && !G2.getMeta(v.id).rv && dnOf(v.first) >= last - days && (v.dur == null || v.dur >= 180)).sort((a, b) => b.first.localeCompare(a.first)); };
G2.throwbacks = () => { const t = dnOf(G2.today()), out = []; [1, 3, 7, 14, 30].forEach(d => { const L = [...G2.videos().values()].filter(v => inStudy(v) && !G2.getMeta(v.id).rv && t - dnOf(v.first) === d); if (L.length) out.push([d, L]); }); return out; };
const vrow = v => `<div class="vc">${vthumb(v)}<div><a href="#" data-g="vopen" data-v="${v.id}">${esc(v.title)}</a><div class="sub">${esc(v.ch)} ・ ${v.first}</div></div></div>`;

V.study = () => `<div class="tabs">${[['review', '今日の復習'], ['recent', '直近の振り返り'], ['material', '教材づくり'], ['stats', '学習状況']].map(([v, l]) => gchip(l, 'ssub', v, G2.sub)).join('')}</div>` + G2.studyViews[G2.sub]();
G2.acts.ssub = v => { G2.sub = v; ls.set('ytha.studysub', v); render(); };

G2.reviewCard = () => {
  const r = G2.rs, id = r.q[r.i], v = G2.videos().get(id) || { id, title: id, ch: '', first: '', g: '' }, m = G2.getMeta(id);
  return card(`復習 ${r.i + 1} / ${r.q.length}`, `<div class="rc"><div class="vc">${vthumb(v)}<div style="text-align:left"><b>${esc(v.title)}</b><div class="sub">${esc(v.ch)} ・ 初回視聴 ${v.first} ・ ${v.n || 0}回視聴</div></div></div><p class="big2">この動画の要点を思い出せますか？</p><p class="sub">まず頭の中(または紙)で「何を学んだか」を3つ挙げてみましょう。</p>` +
    (r.show ? `<div style="text-align:left"><h3>あなたのメモ</h3><textarea rows="4" data-g="note" data-v="${id}" placeholder="メモがありません。今の理解を書き留めておくと次回の復習に役立ちます">${esc(m.note)}</textarea><div class="rb" style="justify-content:center;margin-top:12px"><button class="dng" data-g="rate" data-v="forgot">😵 忘れた(明日)</button><button data-g="rate" data-v="fuzzy">🤔 あやふや</button><button class="pri" data-g="rate" data-v="good">😀 覚えている</button></div></div>` : `<div class="rb" style="justify-content:center"><button class="pri" data-g="reveal">答え(メモ)を見る</button></div>`) +
    `<div class="rb" style="justify-content:center"><a href="https://www.youtube.com/watch?v=${esc(id)}" target="_blank" rel="noreferrer"><button>もう一度見る</button></a><button data-g="rskip">スキップ</button><button data-g="rend">終了</button></div></div>`);
};
G2.studyViews.review = () => {
  const due = G2.dueList(), all = [...G2.meta.values()].filter(m => m.rv), lvc = Array(7).fill(0); all.forEach(m => lvc[m.rv.lv]++);
  const rd = G2.reviewDays(), c = G2.candidates(14), tb = G2.throwbacks(), up = all.filter(m => m.rv.due > G2.today()).length;
  const d14 = [...Array(14).keys()].reverse().map(i => { const d = G2.after(-i); let n = 0; G2.meta.forEach(m => m.rv && m.rv.hist.forEach(h => { if (h.d === d) n++; })); return [d.slice(5), n]; });
  return kcs([['今日の復習', due.length + '本'], ['復習中の動画', all.length + '本'], ['先の予定', up + '本'], ['習得済み(Lv5〜)', all.filter(m => m.rv.lv >= 5).length + '本'], ['連続復習日数', G2.streak(rd) + '日']]) +
    (G2.rs ? G2.reviewCard() : card('今日の復習', due.length ? `<div class="rb"><button class="pri" data-g="rstart">▶ 復習を始める(${due.length}本)</button></div>` + tbl(['動画', '期限', 'レベル'], due.slice(0, 30).map(m => { const v = G2.videos().get(m.id) || { id: m.id, title: m.id, ch: '', first: '' }; return [vrow(v), m.rv.due, 'Lv' + m.rv.lv]; })) : `<p class="sub">今日の復習はありません 🎉 下の候補から復習に追加できます。</p>`)) +
    `<div class="g2">${card('直近14日の復習回数', cols(d14.map(x => x[0]), d14.map(x => x[1])))}${card('定着レベル', bars(lvc.map((n, i) => ['Lv' + i + ` (${G2.IV[i]}日後)`, n])))}</div>` +
    (tb.length ? card('🧠 思い出しタイミング(1・3・7・14・30日前に初めて見た学習動画)', tb.map(([d, L]) => `<h3>${d}日前</h3>` + tbl(['動画', ''], L.slice(0, 8).map(v => [vrow(v), rvBtn(v.id)]))).join('')) : '') +
    card(`復習に追加できる最近の学習動画(${c.length}本)`, `<p class="sub">学習ジャンル(${G2.cfg.studyGenres.join('・')})で直近14日に初めて見た3分以上の動画です。</p>` + (c.length ? `<div class="rb"><button data-g="radd-all">すべて復習に追加</button></div>` + tbl(['動画', ''], c.slice(0, 20).map(v => [vrow(v), rvBtn(v.id)])) : '<p class="sub">候補はありません。</p>'));
};
G2.acts.rstart = () => { const q = G2.dueList().map(m => m.id); if (!q.length) return toast('今日の復習はありません'); G2.rs = { q, i: 0, show: false }; render(); };
G2.acts.reveal = () => { G2.rs.show = true; render(); };
const rnext = () => { const r = G2.rs; r.i++; r.show = false; if (r.i >= r.q.length) { G2.rs = null; toast('今日の復習が完了しました 🎉'); } render(); };
G2.acts.rate = async v => { await G2.rate(G2.rs.q[G2.rs.i], v); rnext(); };
G2.acts.rskip = () => rnext(); G2.acts.rend = () => { G2.rs = null; render(); };
G2.acts['radd-all'] = async () => { const c = G2.candidates(14), due = G2.after(1); await putMany('vmeta', c.map(v => { const m = { ...G2.getMeta(v.id), rv: { lv: 0, due, hist: [] }, upd: Date.now() }; G2.meta.set(v.id, m); return m; })); toast(`${c.length}本を復習に追加しました`); render(); };

G2.studyViews.recent = () => {
  const last = S.raw.length ? S.raw[S.raw.length - 1].dn : 0, days = [];
  for (let i = 0; i < 7; i++) { const d = dstr(last - i), vs = new Map(); S.W.filter(r => r.d === d).forEach(r => { if (G2.rscope === 'study' && !G2.cfg.studyGenres.includes(r.g)) return; const o = vs.get(r.id) || { ...r, n: 0 }; o.n++; vs.set(r.id, o); }); days.push([d, [...vs.values()]]); }
  return `<div class="rb">${gchip('学習ジャンルのみ', 'rscope', 'study', G2.rscope)}${gchip('すべて', 'rscope', 'all', G2.rscope)}<span class="mut">データ最終日 ${dstr(last)} から7日間 / ★やメモを付けておくと復習しやすくなります</span></div>` +
    days.map(([d, L]) => card(`${d}(${L.length}本)`, L.length ? tbl(['動画', 'ジャンル', '回', '', 'メモ'], L.map(r => [vrow({ ...r, first: r.t }), pill(r.g), r.n, stars(r.id) + rvBtn(r.id), esc((G2.getMeta(r.id).note || '').slice(0, 60))])) : '<p class="sub">なし</p>')).join('');
};
G2.acts.rscope = v => { G2.rscope = v; render(); };

/* ----- 教材づくり ----- */
G2.buildMaterial = () => {
  const o = G2.ms, sp = (() => { const l = S.raw.length ? S.raw[S.raw.length - 1].dn : 0; return o.range === 'all' ? [0, l] : [l - (+o.range) + 1, l]; })();
  let L = [...G2.videos().values()].filter(v => dnOf(v.last) >= sp[0] && dnOf(v.first) <= sp[1] && (o.genre === 'all' || (o.genre === 'study' ? inStudy(v) : v.g === o.genre)));
  if (o.memo) L = L.filter(v => G2.getMeta(v.id).note); if (o.star) L = L.filter(v => G2.getMeta(v.id).star);
  L.sort((a, b) => a.first.localeCompare(b.first)); const total = L.length, cut = total > 1500; if (cut) L = L.slice(-1500);
  const kw = terms(L.map(v => v.title), 12), groups = new Map();
  L.forEach(v => { let k = '全体'; if (o.group === 'channel') k = v.ch || '(不明)'; else if (o.group === 'week') k = bk(dnOf(v.first), 'w') + ' の週'; else { const t = kw.find(([w]) => v.title.toLowerCase().includes(w)); k = t ? t[0] : 'その他'; } (groups.get(k) || groups.set(k, []).get(k)).push(v); });
  const gs = [...groups].sort((a, b) => b[1].length - a[1].length), secs = L.reduce((s, v) => s + (v.dur || 0), 0), title = `${o.genre === 'study' ? '学習' : o.genre === 'all' ? 'すべて' : o.genre}教材(${o.range === 'all' ? '全期間' : '直近' + o.range + '日'})`;
  const url = id => `https://www.youtube.com/watch?v=${id}`, note = v => G2.getMeta(v.id).note;
  let md = `# ${title}\n\n${cut ? `※該当${total}本のうち新しい1500本のみ掲載\n\n` : ''}生成日: ${G2.today()} ／ 動画 ${L.length}本 ／ 合計 ${hrs(secs)} ／ チャンネル ${new Set(L.map(v => v.ch)).size}\n\n`;
  md += `## キーワード\n${kw.map(([w, c]) => `${w}(${c})`).join('、') || '-'}\n\n## ${o.group === 'topic' ? 'トピック' : o.group === 'channel' ? 'チャンネル' : '週'}別まとめ\n`;
  let html = `<h1>${esc(title)}</h1>${cut ? `<p><b>※該当${total}本のうち新しい1500本のみ掲載</b></p>` : ''}<p>生成日: ${G2.today()} / 動画 ${L.length}本 / 合計 ${hrs(secs)}</p><h2>キーワード</h2><p>${esc(kw.map(([w, c]) => `${w}(${c})`).join('、') || '-')}</p><h2>${o.group === 'topic' ? 'トピック' : o.group === 'channel' ? 'チャンネル' : '週'}別まとめ</h2>`;
  gs.forEach(([k, vs]) => {
    md += `\n### ${k}(${vs.length}本)\n`; html += `<h3>${esc(k)}(${vs.length}本)</h3><ul>`;
    vs.forEach(v => { const n = note(v), meta = `${v.ch} / 初回${v.first} / ${v.n}回視聴 / ${v.dur != null ? hm(v.dur) : '-'}${G2.getMeta(v.id).star ? ' / ★' : ''}`; md += `- [${v.title}](${url(v.id)}) — ${meta}\n${n ? n.split('\n').map(x => '  - メモ: ' + x).join('\n') + '\n' : ''}`; html += `<li><a href="${url(v.id)}">${esc(v.title)}</a> — ${esc(meta)}${n ? `<br><i>メモ: ${esc(n).replace(/\n/g, '<br>')}</i>` : ''}</li>`; });
    html += '</ul>';
  });
  md += `\n## 復習チェックリスト\n${L.slice(-30).map(v => `- [ ] ${v.title}`).join('\n')}\n`; html += `<h2>復習チェックリスト</h2><ul style="list-style:none">${L.slice(-30).map(v => `<li>☐ ${esc(v.title)}</li>`).join('')}</ul>`;
  return { md, html, n: L.length, title };
};
G2.studyViews.material = () => {
  const o = G2.ms; G2.mat = G2.buildMaterial(); const sel2 = (k, opts) => `<select data-g="msel" data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(o[k]) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return card('教材の条件', `<div class="rb">期間 ${sel2('range', [['7', '直近7日'], ['30', '直近30日'], ['90', '直近90日'], ['365', '直近1年'], ['all', '全期間']])} ジャンル ${sel2('genre', [['study', '学習ジャンル設定'], ['all', 'すべて'], ...GENRES.map(g => [g, g])])} まとめ方 ${sel2('group', [['topic', 'トピック(キーワード)'], ['channel', 'チャンネル'], ['week', '週']])}<label><input type="checkbox" data-g="mchk" data-k="memo" ${o.memo ? 'checked' : ''}> メモありのみ</label><label><input type="checkbox" data-g="mchk" data-k="star" ${o.star ? 'checked' : ''}> ★のみ</label></div><div class="rb"><button class="pri" data-g="mcopy">Markdownをコピー</button><button data-g="mmd">.mdを保存</button><button data-g="mhtml">HTMLで保存(印刷→PDF可)</button><button data-g="mweek">今週のふりかえりレポート</button></div>`) + card(`プレビュー(${G2.mat.n}本)`, `<div class="md">${G2.mat.html}</div>`);
};
G2.chg.msel = t => { G2.ms[t.dataset.k] = t.value; render(); }; G2.chg.mchk = t => { G2.ms[t.dataset.k] = t.checked ? 1 : 0; render(); };
G2.acts.mcopy = async () => { await navigator.clipboard.writeText(G2.mat.md); toast('コピーしました'); };
G2.acts.mmd = () => G2.dl(`教材_${G2.today()}.md`, G2.mat.md, 'text/markdown');
G2.acts.mhtml = () => G2.dl(`教材_${G2.today()}.html`, `<!doctype html><meta charset="utf-8"><title>${esc(G2.mat.title)}</title><body style="font:15px/1.7 system-ui;max-width:800px;margin:30px auto;padding:0 16px">${G2.mat.html}</body>`, 'text/html');
G2.acts.mweek = () => { Object.assign(G2.ms, { range: '7', genre: 'all', group: 'channel' }); render(); toast('直近7日・すべてのジャンルに設定しました'); };

/* ----- 学習状況 ----- */
G2.studyViews.stats = () => {
  const W = S.W.filter(r => G2.cfg.studyGenres.includes(r.g)), wk = new Map(), ch = new Map(), gsec = new Map(), days = new Set();
  W.forEach(r => { const k = bk(r.dn, 'w'); wk.set(k, (wk.get(k) || 0) + (r.dur || 0)); const c = ch.get(ck(r)) || { n: r.ch, c: 0, s: 0 }; c.c++; c.s += r.dur || 0; ch.set(ck(r), c); gsec.set(r.g, (gsec.get(r.g) || 0) + (r.dur || 0)); days.add(r.dn); });
  const last = S.raw.length ? S.raw[S.raw.length - 1].dn : 0, keys = []; for (let i = 25; i >= 0; i--) keys.push(bk(last - i * 7, 'w'));
  const cur = (wk.get(bk(last, 'w')) || 0) / 3600, goal = G2.cfg.goalH, ds = [...days].sort((a, b) => a - b), st = streaks(ds);
  return kcs([['今週の学習時間', cur.toFixed(1) + 'h'], ['週の目標', goal + 'h'], ['達成率', pct(cur, goal)], ['学習した日(累計)', days.size + '日'], ['最長連続', st.longest + '日'], ['学習動画(累計)', num(W.length) + '回']]) +
    card('週別の学習時間(動画の長さ合計・直近26週)', cols(keys.map(k => k.slice(5)), keys.map(k => +((wk.get(k) || 0) / 3600).toFixed(1)))) +
    card('学習設定', `<p class="sub">学習として数えるジャンル(復習の候補・教材・この画面に使われます)</p><div class="rb">${GENRES.map(g => `<label><input type="checkbox" data-g="sg" data-k="${g}" ${G2.cfg.studyGenres.includes(g) ? 'checked' : ''}> ${g}</label>`).join(' ')}</div><div class="rb">週の目標 <input type="number" min="1" max="100" style="width:70px" data-g="cfg" data-k="goalH" value="${goal}"> 時間</div>`) +
    `<div class="g2">${card('学習ジャンル別の時間', bars([...gsec].sort((a, b) => b[1] - a[1]).map(([g, s]) => [g, s]), l => GCOL[l], hrs))}${card('学習チャンネル TOP10', tbl(['チャンネル', '回', '時間'], [...ch.values()].sort((a, b) => b.s - a.s).slice(0, 10).map(c => [esc(c.n), c.c, hrs(c.s)])))}</div>`;
};
G2.chg.sg = t => { const s = new Set(G2.cfg.studyGenres); t.checked ? s.add(t.dataset.k) : s.delete(t.dataset.k); G2.cfg.studyGenres = [...s]; G2.saveCfg(); render(); };
