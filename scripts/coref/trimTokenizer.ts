// Writes src/lib/coref/__fixtures__/tokenizer.json: a model tokenizer cut down to the merges and vocab the
// fixture passages use. BPE only ever applies merges it picks, so dropping unpicked ones leaves these
// passages' ids unchanged; the host test checks that against the Python ids.
//   npx vite-node scripts/coref/trimTokenizer.ts <tokenizer.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { wordTokenize } from '@/lib/coref/wordTokenizer';
import { BYTE_CHARS, PIECE_RE, type TokenizerJson } from '@/lib/coref/bpe';

const FIX = 'src/lib/coref/__fixtures__';
const full = JSON.parse(readFileSync(process.argv[2], 'utf8')) as TokenizerJson & Record<string, unknown>;
const passages = (JSON.parse(readFileSync(`${FIX}/passages.json`, 'utf8')) as { passages: { text: string }[] }).passages;

const merges = full.model.merges.map((m) => (typeof m === 'string' ? m.split(' ') : m) as [string, string]);
const rank = new Map(merges.map(([a, b], i) => [`${a} ${b}`, i]));
const usedMerges = new Set<number>();
const usedVocab = new Set<string>(['<s>', '<pad>', '</s>', '<unk>']);

for (const { text } of passages) {
  for (const { text: word } of wordTokenize(text)) {
    for (const m of (word.startsWith(' ') ? word : ` ${word}`).matchAll(PIECE_RE)) {
      let parts = [...new TextEncoder().encode(m[0])].map((b) => BYTE_CHARS[b]);
      for (;;) {
        let best = -1;
        let bestRank = Infinity;
        for (let i = 0; i < parts.length - 1; i++) {
          const r = rank.get(`${parts[i]} ${parts[i + 1]}`);
          if (r !== undefined && r < bestRank) [best, bestRank] = [i, r];
        }
        if (best < 0) break;
        usedMerges.add(bestRank);
        const [a, b] = merges[bestRank];
        const next: string[] = [];
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === a && parts[i + 1] === b) next.push(a + parts[++i]);
          else next.push(parts[i]);
        }
        parts = next;
      }
      parts.forEach((p) => usedVocab.add(p));
    }
  }
}
const trimmed = {
  note: 'RoBERTa BPE (roberta-base vocab, MIT) cut down to the fixture passages.',
  model: {
    type: 'BPE',
    vocab: Object.fromEntries(Object.entries(full.model.vocab).filter(([t]) => usedVocab.has(t))),
    merges: [...usedMerges].sort((x, y) => x - y).map((i) => merges[i]),
  },
};
writeFileSync(`${FIX}/tokenizer.json`, `${JSON.stringify(trimmed)}\n`);
console.log(`${usedMerges.size} merges, ${usedVocab.size} vocab`);
