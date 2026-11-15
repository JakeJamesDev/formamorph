/**
 * RoBERTa byte-level BPE over pre-split words, as the Hugging Face fast tokenizer encodes
 * `is_split_into_words` input with `add_prefix_space`: each word gets a leading space, splits on the GPT-2
 * pattern, and merges by rank. Reads a model's `tokenizer.json`.
 */

/** The parts of a `tokenizer.json` the encoder reads. */
export interface TokenizerJson {
  model: { type: string; vocab: Record<string, number>; merges: (string | [string, string])[] };
}

/** Ids for a word sequence: `<s>`, each word's pieces, `</s>`. `wordIds[i]` is the word index of `ids[i]`,
 *  -1 for the two special tokens. */
export interface Encoding {
  ids: number[];
  wordIds: number[];
}

const CLS = 0;
const SEP = 2;

// Rust regex \s: the Unicode White_Space property.
const WHITE_SPACE = [9, 10, 11, 12, 13, 0x20, 0x85, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004,
  0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000];
const WS = WHITE_SPACE.map((c) => `\\u{${c.toString(16)}}`).join('');
export const PIECE_RE = new RegExp(
  `'s|'t|'re|'ve|'m|'ll|'d| ?\\p{L}+| ?\\p{N}+| ?[^${WS}\\p{L}\\p{N}]+|[${WS}]+(?![^${WS}])|[${WS}]+`, 'gu');

// GPT-2's byte → printable character table.
export const BYTE_CHARS: string[] = (() => {
  const keep: number[] = [];
  for (let b = 33; b <= 126; b++) keep.push(b);
  for (let b = 161; b <= 172; b++) keep.push(b);
  for (let b = 174; b <= 255; b++) keep.push(b);
  const table: string[] = [];
  let extra = 0;
  for (let b = 0; b < 256; b++) table[b] = String.fromCodePoint(keep.includes(b) ? b : 256 + extra++);
  return table;
})();

const utf8 = new TextEncoder();

/** A word-sequence encoder for one model's tokenizer. */
export function createBpeEncoder(json: TokenizerJson): (words: readonly string[]) => Encoding {
  if (json.model.type !== 'BPE') throw new Error(`Unsupported tokenizer model: ${json.model.type}`);
  const vocab = new Map(Object.entries(json.model.vocab));
  const ranks = new Map<string, number>();
  json.model.merges.forEach((m, i) => {
    const [a, b] = typeof m === 'string' ? m.split(' ') : m;
    ranks.set(`${a} ${b}`, i);
  });
  const cache = new Map<string, number[]>();

  const bpe = (piece: string): number[] => {
    const hit = cache.get(piece);
    if (hit) return hit;
    let parts = [...utf8.encode(piece)].map((b) => BYTE_CHARS[b]);
    while (parts.length > 1) {
      let best = -1;
      let bestRank = Infinity;
      for (let i = 0; i < parts.length - 1; i++) {
        const r = ranks.get(`${parts[i]} ${parts[i + 1]}`);
        if (r !== undefined && r < bestRank) {
          bestRank = r;
          best = i;
        }
      }
      if (best < 0) break;
      const a = parts[best];
      const b = parts[best + 1];
      const merged: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        if (i < parts.length - 1 && parts[i] === a && parts[i + 1] === b) {
          merged.push(a + b);
          i++;
        } else {
          merged.push(parts[i]);
        }
      }
      parts = merged;
    }
    const ids = parts.map((p) => {
      const id = vocab.get(p);
      if (id === undefined) throw new Error(`BPE piece missing from the vocab: ${p}`);
      return id;
    });
    cache.set(piece, ids);
    return ids;
  };

  return (words) => {
    const ids = [CLS];
    const wordIds = [-1];
    words.forEach((word, w) => {
      const spaced = word.startsWith(' ') ? word : ` ${word}`;
      for (const m of spaced.matchAll(PIECE_RE)) {
        for (const id of bpe(m[0])) {
          ids.push(id);
          wordIds.push(w);
        }
      }
    });
    ids.push(SEP);
    wordIds.push(-1);
    return { ids, wordIds };
  };
}
