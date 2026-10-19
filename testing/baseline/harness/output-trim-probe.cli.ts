// Output trim probe — the Default narration prompt with and without its menu list, "Be concise and vivid", and the AI clause.
// Sedge Landing. Six turns, plus three that invite a menu: a custom opening, a stalled wait, and a direct
// ask for options.
//
// Arms, paired by seed: `trim` (the Default preset as shipped), `control` (the three lines restored).
// Both use the Thinking-off user message.
//
// Leak guards: menuLeak (list or options label), endQuestion (the reply ends on a question outside quotes),
// aiMention, statLeak. Shape: words, quotes, quotedWords.
//
// Usage: npx vite-node testing/baseline/harness/output-trim-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 3] [--max 900] [--only idle,menu] [--show] [--dump]
//          [--reasoning none|auto|low|medium|high]
// With --reasoning on, it also reports each reply's thought length.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultNarrationUserPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'http://127.0.0.1:1234/v1/chat/completions');
const runs = Number(argVal('--runs', '3'));
const maxTokens = Number(argVal('--max', '900'));
const only = argVal('--only', '');
// `none` sends reasoning off; `auto` sends no field (Model Default); a level sends that level.
const reasoning = argVal('--reasoning', 'none');
const SEED = 616161;

const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'markdown-definition-cases.json'), 'utf8')) as {
  cases: Array<{ id: string; kind: string; action: string }>;
};
const CASES = [
  ...fixture.cases,
  { id: 'open', kind: 'menu', action: 'START GAME' },
  { id: 'wait', kind: 'menu', action: 'I wait.' },
  { id: 'menu', kind: 'menu', action: 'What can I do here?' },
];

/** Applies one exact replacement, and fails when the shipped text drifts. */
function cut(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`Missing span: ${from}`);
  return text.replace(from, to);
}
const CONTROL = cut(cut(defaultSystemPrompt,
  '- <LENGTH GUIDANCE>', '- Be concise and vivid. <LENGTH GUIDANCE>'),
  ' - the events themselves, with no labels and nothing after the scene ends.',
  ` - the events themselves, with no labels, no mention of being an AI, and nothing after the scene ends. The choices step that follows you handles the player's options, so your reply never contains a question to the player, a list of actions, a "Choose"/"Options" menu, or a bracketed stage direction like [Player's turn].`);
const ARMS: Record<string, string> = { control: CONTROL, trim: defaultSystemPrompt };

const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const ctx = chipValues(authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
}));
const dictionary = (world.dictionaries ?? []).flatMap((book) => book.entries ?? []);

function systemPrompt(arm: string, action: string): string {
  return buildNarrationPrompt({
    template: ARMS[arm], ctx, action, history: [], dictionary,
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: true,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
}

async function loadedModel(): Promise<string> {
  const explicit = argVal('--model', '');
  if (explicit) return explicit;
  const res = await fetch(new URL('/api/v0/models', endpoint));
  const { data } = await res.json() as { data: Array<{ id: string; state?: string; type?: string }> };
  const loaded = data.filter((m) => m.state === 'loaded' && m.type === 'llm');
  if (loaded.length !== 1) throw new Error(`Expected one loaded LLM, found ${loaded.length}; pass --model.`);
  return loaded[0].id;
}

async function narrate(model: string, system: string, user: string, seed: number) {
  // Narration is unpinned in PROMPT_SAMPLER_PINS, so no temperature is sent. `auto` is Model Default: no field.
  const effort = reasoning === 'auto' ? {} : { reasoning_effort: reasoning };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, seed, max_tokens: maxTokens, ...effort, stream: false,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const body = await res.json() as {
    choices: Array<{ message: { content: string | null; reasoning_content?: string; reasoning?: string } }>;
    usage?: { completion_tokens_details?: { reasoning_tokens?: number } };
  };
  const message = body.choices[0].message;
  return {
    text: message.content ?? '',
    reasoning: message.reasoning_content ?? message.reasoning ?? '',
    reasoningTokens: body.usage?.completion_tokens_details?.reasoning_tokens ?? null,
  };
}

const count = (text: string, re: RegExp) => [...text.matchAll(re)].length;
const QUOTE = /"[^"\n]+"|“[^”\n]+”/g;
const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
const METRICS: Record<string, (t: string) => number> = {
  menuLeak: (t) => Number(/^\s*(?:[-*+]|\d+[.)])\s/m.test(t) || /\b(?:Choices|Options|Choose)\s*:/i.test(t) || /\[[^\]]*turn[^\]]*\]/i.test(t)),
  endQuestion: (t) => Number(/\?\s*$/.test(t.replace(QUOTE, '').replace(/[*_\s]+$/, ''))),
  aiMention: (t) => Number(/\b(?:as an AI|language model|AI assistant)\b/i.test(t)),
  statLeak: (t) => Number(/(?:^|\s)[+-]\d+\b|\b\d+\s*\/\s*\d+\b|\b[A-Z][a-z]+\s*:\s*\d+\b/.test(t)),
  words: (t) => words(t),
  quotes: (t) => count(t, QUOTE),
  quotedWords: (t) => [...t.matchAll(QUOTE)].reduce((sum, m) => sum + words(m[0]), 0),
};
const names = Object.keys(METRICS);

const model = await loadedModel();
const started = Date.now();
const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
console.log(`model ${model} · runs ${runs} · cases ${cases.length}`);
if (args.includes('--dump')) {
  for (const arm of Object.keys(ARMS)) {
    const prompt = systemPrompt(arm, cases[0].action);
    console.log(`\n--- ${arm} (${prompt.length} chars)\n${prompt.split('\n').filter((l) => /concise|LENGTH|^Output only|Write|paragraph/i.test(l)).join('\n')}`);
  }
}

const totals: Record<string, Record<string, Record<string, number>>> = {};
const replies: Record<string, Record<string, number>> = {};
const thought: Record<string, Array<{ words: number; tokens: number | null; empty: boolean }>> = {};
// Arms interleave per run so drift, if any, lands on both.
for (const c of cases) {
  const user = defaultNarrationUserPrompt.replace('<PLAYER ACTION>', c.action);
  for (let i = 0; i < runs; i++) {
    for (const arm of Object.keys(ARMS)) {
      const reply = await narrate(model, systemPrompt(arm, c.action), user, SEED + i);
      const text = reply.text;
      (thought[arm] ??= []).push({ words: words(reply.reasoning), tokens: reply.reasoningTokens, empty: !text.trim() });
      const row = Object.fromEntries(names.map((n) => [n, METRICS[n](text)]));
      totals[arm] ??= {};
      replies[arm] ??= {};
      for (const kind of [c.kind, 'all']) {
        totals[arm][kind] ??= Object.fromEntries(names.map((n) => [n, 0]));
        replies[arm][kind] = (replies[arm][kind] ?? 0) + 1;
        for (const n of names) totals[arm][kind][n] += row[n];
      }
      console.log(`[${arm}] ${c.id} #${i} ${names.map((n) => `${n}=${row[n]}`).join(' ')}${text.trim() ? '' : ' · EMPTY'}`);
      if (reasoning !== 'none') console.log(`    thought ${words(reply.reasoning)}w · ${reply.reasoningTokens ?? '?'} tok`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    }
  }
}

console.log('\nTOTALS (guards are reply counts; words, quotes, quotedWords are means per reply)');
console.log(`${'arm/kind'.padEnd(18)} ${names.map((n) => n.padStart(12)).join('')}`);
const SUMMED = new Set(['menuLeak', 'endQuestion', 'aiMention', 'statLeak']);
for (const kind of ['calm', 'dialogue', 'pivot', 'menu', 'all']) {
  for (const arm of Object.keys(ARMS)) {
    const t = totals[arm]?.[kind];
    if (!t) continue;
    const n = replies[arm][kind];
    console.log(`${`${arm}/${kind}`.padEnd(18)} ${names.map((m) => (SUMMED.has(m) ? `${t[m]}/${n}` : (t[m] / n).toFixed(1)).padStart(12)).join('')}`);
  }
}
if (reasoning !== 'none') {
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
  console.log(`\nREASONING (--reasoning ${reasoning})`);
  for (const arm of Object.keys(ARMS)) {
    const t = thought[arm] ?? [];
    const tokens = t.flatMap((x) => (x.tokens === null ? [] : [x.tokens]));
    console.log(`${arm.padEnd(10)} words mean ${mean(t.map((x) => x.words))} · median ${median(t.map((x) => x.words))}`
      + ` · tokens mean ${tokens.length ? mean(tokens) : '?'} · median ${tokens.length ? median(tokens) : '?'}`
      + ` · empty replies ${t.filter((x) => x.empty).length}/${t.length}`);
  }
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
