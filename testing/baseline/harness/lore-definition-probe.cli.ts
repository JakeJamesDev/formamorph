// Lore definition probe — do the Experimental preset's Background/Foreground Lore definitions change how
// the narrator treats each block? Two planted entries in Sedge Landing: a constant Background fact (salt,
// never coin) and a keyword-triggered Foreground detail (a cracked, flat-ringing bell).
//
// Arms, paired by seed: `current` (the definitions in ExperimentalPrompts.ts), `previous` (the near-identical
// pair they replaced), `none` (no definition on either lore chip). Every other byte of the prompt is shared.
//
// Checks (both directions):
//   background-uptake / -contradiction — fare (invited) and market (uninvited) settle in salt, not coin
//   foreground-uptake / -mention       — bell (named) and departure (unnamed) carry the bell and its flat ring
//   background-intrusion / foreground-intrusion — the idle case drags in salt / the bell (false-positive guard)
//
// Usage: npx vite-node testing/baseline/harness/lore-definition-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 3] [--max 600] [--only fare,market] [--arms current,previous,none]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { experimentalSystemPrompt } from '@/components/game/ExperimentalPrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { parsePromptTemplate, serializeSegments } from '@/lib/promptTemplate';
import { baseToken, joinToken, splitToken } from '@/lib/promptVariables';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { DictionaryEntry } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'http://127.0.0.1:1234/v1/chat/completions');
const runs = Number(argVal('--runs', '3'));
const maxTokens = Number(argVal('--max', '600'));
const only = argVal('--only', '');
const armNames = argVal('--arms', 'current,previous,none').split(',');
const SEED = 424242;

const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'lore-definition-cases.json'), 'utf8')) as {
  entries: DictionaryEntry[];
  cases: Array<{ id: string; action: string; checks: string[] }>;
};

const PREVIOUS = {
  before: 'Authored information about the world, its concepts, and its terminology.\n\n',
  after: 'Additional authored information about the world, its concepts, and its terminology.\n\n',
};

/** The Experimental template with each lore chip's Prepend replaced; `null` keeps the source text. */
function withLorePre(pre: { before: string; after: string } | null): string {
  if (!pre) return experimentalSystemPrompt;
  return serializeSegments(parsePromptTemplate(experimentalSystemPrompt).map((segment) => {
    if (segment.type !== 'variable' || baseToken(segment.token) !== '<DICTIONARY>') return segment;
    const parts = splitToken(segment.token);
    if (!parts) return segment;
    return { ...segment, token: joinToken({ ...parts, pre: parts.variantId === 'before' ? pre.before : pre.after }) };
  }));
}

const ARMS: Record<string, string> = {
  current: withLorePre(null),
  previous: withLorePre(PREVIOUS),
  none: withLorePre({ before: '', after: '' }),
};

const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/);
// Metal names are left out: the persona's silver hair would score as payment.
const COIN = /\b(coins?|pennies|penny|money)\b/i;
const NEGATED = /\b(no|not|never|nor|unheard|without|instead|rather|rarely|isn't|doesn't|don't)\b/i;
const BELL_DETAIL = /\b(crack(ed|s)?|flat|sour)\b/i;

const CHECKS: Record<string, { test: (text: string) => boolean; want: boolean }> = {
  'background-uptake': { test: (t) => /\bsalt\b/i.test(t), want: true },
  // A coin paid or named as currency; "coin is not used here" restates the fact.
  'background-contradiction': { test: (t) => sentences(t).some((s) => COIN.test(s) && !NEGATED.test(s)), want: false },
  'foreground-uptake': { test: (t) => sentences(t).some((s) => /\bbell\b/i.test(s) && BELL_DETAIL.test(s)), want: true },
  'foreground-mention': { test: (t) => /\bbell\b/i.test(t), want: true },
  'background-intrusion': { test: (t) => /\bsalt\b/i.test(t), want: false },
  'foreground-intrusion': { test: (t) => /\bbell\b/i.test(t), want: false },
};

const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const ctx = chipValues(authoredChipScene(world, {
    location,
    activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
    resolve: (text: string) => text,
  }));
const dictionary = [...(world.dictionaries ?? []).flatMap((book) => book.entries ?? []), ...fixture.entries];

function systemPrompt(template: string, action: string): string {
  return buildNarrationPrompt({
    template, ctx, action, history: [], dictionary,
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
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
    headers: { 'Content-Type': 'application/json' },
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
for (const c of cases) {
  const lore = systemPrompt(ARMS.current, c.action);
  const active = fixture.entries.filter((e) => lore.includes(e.value)).map((e) => e.name);
  console.log(`\n## ${c.id} — active planted lore: ${active.join(', ') || 'none'}`);
}
if (args.includes('--dump')) {
  for (const arm of armNames) {
    const lines = systemPrompt(ARMS[arm], cases[0].action).split('\n');
    console.log(`\n--- ${arm} lore sections`);
    for (const [i, line] of lines.entries()) if (/^## .*Lore$/.test(line)) console.log(lines.slice(i, i + 3).join(' ⏎ '));
  }
}

const totals: Record<string, Record<string, number>> = {};
for (const arm of armNames) {
  totals[arm] = {};
  for (const c of cases) {
    const system = systemPrompt(ARMS[arm], c.action);
    for (let i = 0; i < runs; i++) {
      const text = await narrate(model, system, c.action, SEED + i);
      const hits = c.checks.map((check) => `${check}=${CHECKS[check].test(text) ? 1 : 0}`);
      for (const check of c.checks) {
        const key = `${c.id}:${check}`;
        totals[arm][key] = (totals[arm][key] ?? 0) + (CHECKS[check].test(text) ? 1 : 0);
      }
      console.log(`[${arm}] ${c.id} #${i} ${hits.join(' ')} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    }
  }
}

console.log(`\nTOTALS (of ${runs} per case check; ↑/↓ = direction wanted)`);
for (const c of cases) {
  for (const check of c.checks) {
    const row = armNames.map((arm) => `${arm} ${totals[arm][`${c.id}:${check}`] ?? 0}/${runs}`).join('  ·  ');
    console.log(`${`${c.id} ${check}`.padEnd(36)} ${CHECKS[check].want ? '↑' : '↓'}  ${row}`);
  }
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
