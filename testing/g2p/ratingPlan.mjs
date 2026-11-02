// Decides which clips a rating page needs, tallies each arm, and writes the page. `arms` maps an arm name to word-to-phonemes.

const said = (table, word) => table[word] ?? table[word.toLowerCase()];

/** Each word's distinct unrated strings, in a blind order that hides which arm said what. */
export function planClips(arms, words, ratings, seed = 20261102) {
  let state = seed;
  const coin = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const plan = [];
  for (const word of words) {
    const key = word.toLowerCase();
    const strings = new Set();
    for (const table of Object.values(arms)) {
      const phonemes = said(table, word);
      if (phonemes !== undefined && ratings[key]?.[phonemes] === undefined) strings.add(phonemes);
    }
    const clips = [...strings].map((phonemes) => [coin(), phonemes]).sort((a, b) => a[0] - b[0]).map(([, phonemes]) => phonemes);
    if (clips.length) plan.push({ word, clips });
  }
  return plan;
}

/** Counts each arm's acceptable words; a string rated once counts for every arm that said it. */
export function tally(arms, words, ratings) {
  const result = {};
  for (const [arm, table] of Object.entries(arms)) {
    const row = { acceptable: 0, rejected: 0, unrated: [] };
    for (const word of words) {
      const verdict = ratings[word.toLowerCase()]?.[said(table, word)];
      if (verdict === true) row.acceptable++;
      else if (verdict === false) row.rejected++;
      else row.unrated.push(word);
    }
    result[arm] = row;
  }
  return result;
}

/** Adds a page's results to the store. A later verdict on the same string replaces the earlier one. */
export function mergeRatings(ratings, results) {
  const merged = structuredClone(ratings);
  for (const [word, strings] of Object.entries(results)) {
    const key = word.toLowerCase();
    merged[key] = { ...merged[key], ...strings };
  }
  return merged;
}

const PAGE_STYLE = `:root{color-scheme:light dark}body{font:16px system-ui;margin:0 auto;max-width:760px;padding:16px;background:Canvas;color:CanvasText}section{margin:0 0 12px;border-bottom:1px solid color-mix(in srgb,CanvasText 20%,transparent);padding-bottom:8px}h3{margin:0 0 4px}.clip{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0}audio{flex:1;min-width:220px}label{display:inline-flex;gap:4px}#bar{position:sticky;top:0;background:Canvas;padding:4px 0}button{font:inherit;padding:6px 12px}`;

// An unanswered clip stays out of the results, so a part-done page never reads as rejections.
const PAGE_SCRIPT = (storageKey) => `
const key = ${JSON.stringify(storageKey)};
const inputs = [...document.querySelectorAll('input')];
let saved = {};
try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
const count = document.getElementById('count');
const clips = new Set(inputs.map((x) => x.name)).size;
function collectRatings() {
  const out = {};
  for (const x of inputs) if (x.checked) (out[x.dataset.w] ??= {})[x.dataset.p] = x.value === 'ok';
  return out;
}
function show() { count.textContent = inputs.filter((x) => x.checked).length + ' of ' + clips + ' clips answered'; }
for (const x of inputs) {
  x.checked = saved[x.name] === x.value;
  x.onchange = () => {
    saved[x.name] = x.value;
    try { localStorage.setItem(key, JSON.stringify(saved)); } catch {}
    show();
  };
}
show();
document.getElementById('download').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(collectRatings())], { type: 'application/json' }));
  a.download = 'ratings.json';
  a.click();
};
`;

/** `rows` holds `{ word, clips: [{ phonemes, file }] }`. */
export function pageHtml(title, rows, intro = 'Each clip says "The road to ___ was closed."') {
  let n = 0;
  const sections = rows.map((row) => `<section><h3>${row.word}</h3>${row.clips.map((clip) => {
    const data = `name="c${n++}" data-w="${row.word}" data-p="${clip.phonemes}"`;
    return `<div class=clip><audio controls preload=none src="${clip.file}"></audio><label><input type=radio ${data} value=ok> OK</label><label><input type=radio ${data} value=no> No</label></div>`;
  }).join("")}</section>`).join("");
  return `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${title}</title><style>${PAGE_STYLE}</style><h1>${title}</h1><p>${intro} Answer each clip you hear. Your answers save on reload, and clips you skip stay unrated.</p><div id=bar><button id=download>Download Ratings</button> <span id=count></span></div><hr>${sections}<script>${PAGE_SCRIPT(`ratings-${title}`)}</script>`;
}
