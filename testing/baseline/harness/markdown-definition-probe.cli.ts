// Markdown definition probe — what does the narrator do with syntax it is told exists but not when to use?
// Sedge Landing, six actions: calm (idle, inner), dialogue (talk), pivot (threat, find, name).
//
// `default` runs the Default preset as shipped, with the Thinking-off user message.
//
// Arms, paired by seed, on the Experimental preset: `definitions` (the shipped `<MARKDOWN GUIDANCE>`),
// `shape` (the first definitions, display shape only), `emphasis` (meaning definitions, bold as "emphasis"),
// `force` (bold as force "said or felt"), `long` / `short` (bold as volume, italics as source, with and
// without examples),
// `highlights` (meaning definitions plus both highlight
// lines), `none` (Markdown Formatting off,
// so the Formatting section is absent). Every other byte of the prompt is shared.
//
// Per reply it counts each defined syntax, prints every colored highlight and its key, and counts the
// false-positive guards: block syntax (never defined), unknown color keys, and unbalanced `==` markers.
//
// Usage: npx vite-node testing/baseline/harness/markdown-definition-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--token T] [--runs 3] [--max 600] [--only idle,talk]
//          [--arms default,definitions,shape,none] [--show] [--dump]
//          [--reasoning none|auto|low|medium|high] [--show-thought]
// With --reasoning on, it also reports each reply's thought length and how often the thought names formatting.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { experimentalSystemPrompt } from '@/components/game/ExperimentalPrompts';
import { defaultNarrationUserPrompt, defaultSystemPrompt, markdownGuidance } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { HIGHLIGHT_COLORS } from '@/lib/markdownToolbar';
import { parsePromptTemplate, renderPromptTemplate, serializeSegments } from '@/lib/promptTemplate';
import { baseToken, splitToken } from '@/lib/promptVariables';
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
const armNames = argVal('--arms', 'default,definitions,shape,none').split(',');
// `none` sends reasoning off; `auto` sends no field (Model Default); a level sends that level.
const reasoning = argVal('--reasoning', 'none');
const SEED = 515151;

const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'markdown-definition-cases.json'), 'utf8')) as {
  cases: Array<{ id: string; kind: string; action: string }>;
};

// The first definitions: display shape only, with no meaning sentences.
const SHAPE_ONLY = `- \`**text**\` displays text in bold.
- \`*text*\` displays text in italics.
- \`~~text~~\` displays text struck through.
- \`==text==\` displays text highlighted.
- \`=r=text==\` displays text highlighted in a color. The letter between the first two \`=\` sets the color: ${HIGHLIGHT_COLORS.map((c) => `${c.key} ${c.label.toLowerCase()}`).join(', ')}.
- \`"text"\` displays text as spoken dialogue.`;

/** The Experimental template with the Markdown chip rendered in place around a fixed value. */
function withFixedDefinitions(value: string): string {
  return serializeSegments(parsePromptTemplate(experimentalSystemPrompt).map((segment) => {
    if (segment.type !== 'variable' || baseToken(segment.token) !== '<MARKDOWN GUIDANCE>') return segment;
    return { type: 'text', value: renderPromptTemplate(segment.token, { [splitToken(segment.token)!.key]: value }) };
  }));
}

// The meaning definitions with the two highlight lines.
const MEANING_WITH_HIGHLIGHTS = `- \`**text**\` displays text in bold. Bold text means emphasis: the words are thicker and stand out within their sentence.
- \`*text*\` displays text in italics. Italic text means a voice apart from the narration, such as a thought, a sound, or a foreign word.
- \`~~text~~\` displays text struck through. Struck-through text means words written and then withdrawn.
- \`==text==\` displays text highlighted. Highlighted text means the words carry the most weight on the page: a band of color marks them out from the whole passage.
- \`=r=text==\` displays text highlighted in a color. The letter between the first two \`=\` sets the color: ${HIGHLIGHT_COLORS.map((c) => `${c.key} ${c.label.toLowerCase()}`).join(', ')}. Color-highlighted text means the same, plus whatever that color suggests.
- \`"text"\` displays text as spoken dialogue. Quoted text means words spoken aloud.`;

// The meaning definitions without highlights, bold still defined as "emphasis".
const EMPHASIS_BOLD = MEANING_WITH_HIGHLIGHTS.split('\n').filter((line) => !line.includes('==')).join('\n');
// The same, with bold as force "said or felt".
const FORCE_BOLD = EMPHASIS_BOLD.replace(
  'Bold text means emphasis: the words are thicker and stand out within their sentence.',
  'Bold text means words that land harder than the rest of the sentence, as if said or felt with more force.',
);

/** The shipped definitions with the bold and italic lines replaced. */
function withBoldItalic(bold: string, italic: string): string {
  return markdownGuidance(true).split('\n').map((line) => {
    if (line.startsWith('- `**text**`')) return `- \`**text**\` displays text in bold. ${bold}`;
    if (line.startsWith('- `*text*`')) return `- \`*text*\` displays text in italics. ${italic}`;
    return line;
  }).join('\n');
}

// Bold as volume, italics as source: a long form with examples, and a short form without.
const LONG = withBoldItalic(
  'Bold text means words said or heard louder than the rest of the sentence, such as a shouted word or a word hit with heavy stress.',
  'Italic text means words from outside the narration, such as a thought, a foreign word, or a sound written as it is heard.',
);
const SHORT = withBoldItalic(
  'Bold text means the words are louder.',
  'Italic text means the words come from outside the narration.',
);

/** The Default narration user message, as the app sends it with Thinking off. */
const defaultUser = (action: string) => defaultNarrationUserPrompt.replace('<PLAYER ACTION>', action);

const ARMS: Record<string, { template: string; markdownOutput: boolean; user?: (action: string) => string }> = {
  default: { template: defaultSystemPrompt, markdownOutput: true, user: defaultUser },
  long: { template: withFixedDefinitions(LONG), markdownOutput: true },
  short: { template: withFixedDefinitions(SHORT), markdownOutput: true },
  definitions: { template: experimentalSystemPrompt, markdownOutput: true },
  shape: { template: withFixedDefinitions(SHAPE_ONLY), markdownOutput: true },
  emphasis: { template: withFixedDefinitions(EMPHASIS_BOLD), markdownOutput: true },
  force: { template: withFixedDefinitions(FORCE_BOLD), markdownOutput: true },
  highlights: { template: withFixedDefinitions(MEANING_WITH_HIGHLIGHTS), markdownOutput: true },
  none: { template: experimentalSystemPrompt, markdownOutput: false },
};

const KEYS = new Set<string>(HIGHLIGHT_COLORS.map((c) => c.key));
const count = (text: string, re: RegExp) => [...text.matchAll(re)].length;
// Colored highlights first, then plain ones with the colored spans removed.
const COLORED = /=([a-z])=([^=\n]+?)==/g;
// Names the context sections print in bold; a model that repeats one is copying a label, not emphasizing.
const LABELS = new Set([...world.entities, ...world.locations, ...world.stats, ...world.traits]
  .map((item) => item.name.trim().toLowerCase()));
const BOLD = /\*\*([^*\n]+?)\*\*/g;
const ITALIC = /(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g;
const spans = (t: string, re: RegExp) => [...t.matchAll(re)].map((m) => m[1].replace(/[:.,!?]+$/, '').trim().toLowerCase());
const italics = (t: string) => spans(t.replace(BOLD, ''), ITALIC);
const METRICS: Record<string, (text: string) => number> = {
  bold: (t) => spans(t, BOLD).filter((s) => !LABELS.has(s)).length,
  italic: (t) => italics(t).filter((s) => !LABELS.has(s)).length,
  labels: (t) => [...spans(t, BOLD), ...italics(t)].filter((s) => LABELS.has(s)).length,
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
const ctx = chipValues(authoredChipScene(world, {
    location,
    activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
    resolve: (text: string) => text,
  }));
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

/** The reply and, with `--reasoning`, the thought behind it. */
interface Narration { text: string; reasoning: string; reasoningTokens: number | null }

async function narrate(model: string, system: string, user: string, seed: number): Promise<Narration> {
  // Narration is unpinned in PROMPT_SAMPLER_PINS, so no temperature is sent. `auto` is Model Default: no field.
  const effort = reasoning === 'auto' ? {} : { reasoning_effort: reasoning };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
// A thought that talks about the formatting rules rather than the scene.
const FORMAT_TALK = /\b(bold(ed|ing)?|italic(s|ize|ized)?|markdown|format(ting)?|emphasi[sz]e?|struck|strikethrough)\b/gi;
const thought: Record<string, Array<{ words: number; tokens: number | null; format: number; empty: boolean }>> =
  Object.fromEntries(armNames.map((arm) => [arm, []]));
const totals: Record<string, Record<string, Record<string, number>>> = {};
const replies: Record<string, number> = {};
for (const arm of armNames) {
  totals[arm] = {};
  replies[arm] = 0;
  for (const c of cases) {
    const system = systemPrompt(arm, c.action);
    const user = ARMS[arm].user?.(c.action) ?? c.action;
    for (let i = 0; i < runs; i++) {
      const reply = await narrate(model, system, user, SEED + i);
      const text = reply.text;
      const row = Object.fromEntries(names.map((n) => [n, METRICS[n](text)]));
      thought[arm].push({ words: words(reply.reasoning), tokens: reply.reasoningTokens, format: count(reply.reasoning, FORMAT_TALK), empty: !text.trim() });
      for (const kind of [c.kind, 'all']) {
        totals[arm][kind] ??= Object.fromEntries(names.map((n) => [n, 0]));
        for (const n of names) totals[arm][kind][n] += row[n];
      }
      replies[arm]++;
      const colored = [...text.matchAll(COLORED)].map((m) => `${m[1]}:"${m[2]}"`).join(' ');
      console.log(`[${arm}] ${c.id} #${i} ${names.map((n) => `${n}=${row[n]}`).join(' ')} · ${text.split(/\s+/).length}w${colored ? ` · ${colored}` : ''}`);
      if (reasoning !== 'none') {
        const last = thought[arm].at(-1)!;
        console.log(`    thought ${last.words}w · ${last.tokens ?? '?'} tok · format mentions ${last.format}${last.empty ? ' · EMPTY REPLY' : ''}`);
      }
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
      if (args.includes('--show-thought') && reply.reasoning) console.log(`    THOUGHT: ${reply.reasoning.replace(/\n+/g, ' ¶ ')}`);
    }
  }
}

console.log(`\nTOTALS (counts summed per kind; bold and italic skip context names, which labels counts; block, badKey, unbalanced are false positives)`);
console.log(`${'arm/kind'.padEnd(22)} ${names.map((n) => n.padStart(10)).join('')}`);
for (const arm of armNames) {
  for (const kind of ['calm', 'dialogue', 'pivot', 'all']) {
    const t = totals[arm][kind];
    if (t) console.log(`${`${arm}/${kind}`.padEnd(22)} ${names.map((n) => String(t[n]).padStart(10)).join('')}`);
  }
}
console.log(`replies per arm: ${armNames.map((arm) => `${arm} ${replies[arm]}`).join(' · ')}`);
if (reasoning !== 'none') {
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
  console.log(`\nREASONING (--reasoning ${reasoning})`);
  for (const arm of armNames) {
    const t = thought[arm];
    const tokens = t.flatMap((x) => (x.tokens === null ? [] : [x.tokens]));
    console.log(`${arm.padEnd(14)} words mean ${mean(t.map((x) => x.words))} · median ${median(t.map((x) => x.words))}`
      + ` · tokens mean ${tokens.length ? mean(tokens) : '?'} · format mentions ${t.reduce((a, x) => a + x.format, 0)}`
      + ` in ${t.filter((x) => x.format > 0).length}/${t.length} · empty replies ${t.filter((x) => x.empty).length}`);
  }
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
