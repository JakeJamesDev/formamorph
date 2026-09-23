// Markdown definition probe — what does the narrator do with syntax it is told exists but not when to use?
// Sedge Landing, six actions: calm (idle, inner), dialogue (talk), pivot (threat, find, name).
//
// Arms, paired by seed, on the Experimental preset: `definitions` (the shipped `<MARKDOWN GUIDANCE|definitions>`),
// `guidance` (the same chip slot carrying Default's usage-directed Markdown text), `none` (Markdown Formatting off,
// so the Formatting section is absent). Every other byte of the prompt is shared.
//
// Per reply it counts each defined syntax, prints every colored highlight and its key, and counts the
// false-positive guards: block syntax (never defined), unknown color keys, and unbalanced `==` markers.
//
// Usage: npx vite-node testing/baseline/harness/markdown-definition-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--token T] [--runs 3] [--max 600] [--only idle,talk]
//          [--arms definitions,guidance,none] [--show] [--dump]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { experimentalSystemPrompt } from '@/components/game/ExperimentalPrompts';
import { authoredPreviewValues } from '@/lib/authoredPreviewValues';
import { HIGHLIGHT_COLORS } from '@/lib/markdownToolbar';
import { NONE_PLACEHOLDER } from '@/lib/promptFallbacks';
import { parsePromptTemplate, serializeSegments } from '@/lib/promptTemplate';
import { baseToken, joinToken, splitToken } from '@/lib/promptVariables';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'http://127.0.0.1:1234/v1/chat/completions');
const token = argVal('--token', process.env.PROBE_TOKEN ?? '');
const runs = Number(argVal('--runs', '3'));
const maxTokens = Number(argVal('--max', '600'));
const only = argVal('--only', '');
const armNames = argVal('--arms', 'definitions,guidance,none').split(',');
const SEED = 515151;

const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'markdown-definition-cases.json'), 'utf8')) as {
  cases: Array<{ id: string; kind: string; action: string }>;
};

/** The Experimental template with the Markdown chip on its usage-directed variant, under the same Header. */
function withGuidanceVariant(): string {
  return serializeSegments(parsePromptTemplate(experimentalSystemPrompt).map((segment) => {
    if (segment.type !== 'variable' || baseToken(segment.token) !== '<MARKDOWN GUIDANCE>') return segment;
    const parts = splitToken(segment.token);
    return parts ? { ...segment, token: joinToken({ ...parts, variantId: undefined, pre: '' }) } : segment;
  }));
}

const ARMS: Record<string, { template: string; markdownOutput: boolean }> = {
  definitions: { template: experimentalSystemPrompt, markdownOutput: true },
  guidance: { template: withGuidanceVariant(), markdownOutput: true },
  none: { template: experimentalSystemPrompt, markdownOutput: false },
};

const KEYS = new Set<string>(HIGHLIGHT_COLORS.map((c) => c.key));
const count = (text: string, re: RegExp) => [...text.matchAll(re)].length;
// Colored highlights first, then plain ones with the colored spans removed.
const COLORED = /=([a-z])=([^=\n]+?)==/g;
const METRICS: Record<string, (text: string) => number> = {
  bold: (t) => count(t, /\*\*[^*\n]+?\*\*/g),
  italic: (t) => count(t.replace(/\*\*[^*\n]+?\*\*/g, ''), /(?<![*\w])\*[^*\n]+?\*(?![*\w])/g),
  strike: (t) => count(t, /~~[^~\n]+?~~/g),
  highlight: (t) => count(t.replace(COLORED, ''), /==[^=\n]+?==/g),
  colored: (t) => count(t, COLORED),
  quote: (t) => count(t, /"[^"\n]+"|“[^”\n]+”/g),
  // Guards: none of these is defined, so each is a false positive.
  block: (t) => count(t, /^(#{1,6} |\s*[-*+] |\s*\d+\. |>|\||```)/gm),
  badKey: (t) => [...t.matchAll(COLORED)].filter((m) => !KEYS.has(m[1])).length,
  unbalanced: (t) => (count(t.replace(COLORED, ''), /==/g) % 2),
};

const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const ctx = {
  ...authoredPreviewValues(world, {
    location,
    activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
    resolve: (text: string) => text,
  }),
  '<NOTES>': NONE_PLACEHOLDER,
  '<TIME>': NONE_PLACEHOLDER,
};
const dictionary = (world.dictionaries ?? []).flatMap((book) => book.entries ?? []);

function systemPrompt(arm: string, action: string): string {
  const { template, markdownOutput } = ARMS[arm];
  return buildNarrationPrompt({
    template, ctx, action, history: [], dictionary,
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
}

async function loadedModel(): Promise<string> {
  const explicit = argVal('--model', '');
  if (explicit) return explicit;
  const res = await fetch(new URL('/api/v0/models', endpoint));
  const { data } = await res.json() as { data: Array<{ id: string; state?: string; type?: string }> };
  const loaded = data.find((m) => m.state === 'loaded' && m.type === 'llm');
  if (!loaded) throw new Error('No LLM is loaded; pass --model.');
  return loaded.id;
}

async function narrate(model: string, system: string, action: string, seed: number): Promise<string> {
  // Narration is unpinned in PROMPT_SAMPLER_PINS, so no temperature is sent.
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      model, seed, max_tokens: maxTokens, reasoning_effort: 'none', stream: false,
      messages: [{ role: 'system', content: system }, { role: 'user', content: action }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
  return body.choices[0].message.content ?? '';
}

const model = await loadedModel();
const started = Date.now();
console.log(`model ${model} · runs ${runs} · arms ${armNames.join(', ')}`);
const cases = fixture.cases.filter((c) => !only || only.split(',').includes(c.id));
if (args.includes('--dump')) {
  for (const arm of armNames) {
    const lines = systemPrompt(arm, cases[0].action).split('\n');
    const at = lines.findIndex((line) => line === '## Formatting');
    console.log(`\n--- ${arm}: ${at < 0 ? 'no Formatting section' : lines.slice(at, at + 10).join(' ⏎ ')}`);
  }
}

const names = Object.keys(METRICS);
const totals: Record<string, Record<string, Record<string, number>>> = {};
const replies: Record<string, number> = {};
for (const arm of armNames) {
  totals[arm] = {};
  replies[arm] = 0;
  for (const c of cases) {
    const system = systemPrompt(arm, c.action);
    for (let i = 0; i < runs; i++) {
      const text = await narrate(model, system, c.action, SEED + i);
      const row = Object.fromEntries(names.map((n) => [n, METRICS[n](text)]));
      for (const kind of [c.kind, 'all']) {
        totals[arm][kind] ??= Object.fromEntries(names.map((n) => [n, 0]));
        for (const n of names) totals[arm][kind][n] += row[n];
      }
      replies[arm]++;
      const colored = [...text.matchAll(COLORED)].map((m) => `${m[1]}:"${m[2]}"`).join(' ');
      console.log(`[${arm}] ${c.id} #${i} ${names.map((n) => `${n}=${row[n]}`).join(' ')} · ${text.split(/\s+/).length}w${colored ? ` · ${colored}` : ''}`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    }
  }
}

console.log(`\nTOTALS (counts summed per kind; block, badKey, unbalanced are false positives)`);
console.log(`${'arm/kind'.padEnd(22)} ${names.map((n) => n.padStart(10)).join('')}`);
for (const arm of armNames) {
  for (const kind of ['calm', 'dialogue', 'pivot', 'all']) {
    const t = totals[arm][kind];
    if (t) console.log(`${`${arm}/${kind}`.padEnd(22)} ${names.map((n) => String(t[n]).padStart(10)).join('')}`);
  }
}
console.log(`replies per arm: ${armNames.map((arm) => `${arm} ${replies[arm]}`).join(' · ')}`);
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
