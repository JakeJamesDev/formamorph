// Visual Novel format probe — can the narrator hold a VN paragraph format over a multi-turn session?
// Sedge Landing, a scripted session of player actions (vn-format-cases.json), history fed back each turn.
//
// The VN format: every paragraph is either narration (no spoken words) or a speech line,
// `Name: "words"` and nothing else. Action and tone belong to the portrait, never to the speech line.
//
// Arms, paired by seed, on the Default preset with the Thinking-off user message:
//   `prose`   the prompt as shipped (control: dialogue volume and the natural mixed-paragraph rate)
//   `chip`    the shipped prompt plus a VN block in the Formatting section only (can a chip alone do it?)
//   `rewrite` the chip plus the dialogue Guideline, closing contract and user rider reworded for speech lines
//
// Per reply: paragraphs, speech lines (NPC / You), narration paragraphs, mixed paragraphs (quotes outside
// the speech shape = violation), speech lines whose speaker is not on the roster, and quoted spans.
// A turn complies when it has no mixed paragraph and no unknown speaker. Drift = compliance by session third.
//
// Usage: npx vite-node testing/baseline/harness/vn-format-probe.cli.ts --
//          [--profile gemma4-e4b-cloud] [--endpoint URL --model ID --token T] [--runs 3] [--turns 16]
//          [--arms prose,chip,rewrite] [--max 700] [--serial] [--show] [--dump]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { defaultNarrationUserPrompt, defaultSystemPrompt, markdownGuidance } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { parsePromptTemplate, renderPromptTemplate, serializeSegments } from '@/lib/promptTemplate';
import { baseToken, splitToken } from '@/lib/promptVariables';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASELINE = path.resolve('testing/baseline');
const profiles = JSON.parse(readFileSync(path.join(BASELINE, 'harness/profiles.json'), 'utf8')) as {
  endpointUrl?: string; apiToken?: string;
  models: Array<{ label: string; endpointUrl?: string; modelName?: string; apiToken?: string }>;
};
const profile = profiles.models.find((m) => m.label === argVal('--profile', 'gemma4-e4b-cloud'));
const endpoint = argVal('--endpoint', profile?.endpointUrl ?? profiles.endpointUrl ?? '');
const model = argVal('--model', profile?.modelName ?? profile?.label ?? '');
const token = argVal('--token', profile?.apiToken ?? profiles.apiToken ?? process.env.PROBE_TOKEN ?? '');
const runs = Number(argVal('--runs', '3'));
const maxTokens = Number(argVal('--max', '700'));
const armNames = argVal('--arms', 'prose,chip,rewrite').split(',');
const SEED = 616161;

const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'vn-format-cases.json'), 'utf8')) as {
  turns: string[]; aliases: Record<string, string[]>; introducedAt: Record<string, number>;
};
/** A name in narration (speech labels excluded) before the turn whose action asks for it. */
const leaks = (text: string, turn: number) => {
  const narration = text.split(/\n+/).filter((p) => !SPEECH.test(p.trim())).join('\n');
  return Object.entries(fixture.introducedAt)
    .filter(([name, at]) => turn < at && new RegExp(`\\b${name}\\b`).test(narration)).map(([name]) => name);
};
const turns = fixture.turns.slice(0, Number(argVal('--turns', String(fixture.turns.length))));

const VN_BLOCK = `Each paragraph of your reply is one of two kinds. The game shows each paragraph on its own screen, over the scene art and the speaker's portrait.
- A narration paragraph tells what happens, what can be seen, and what can be heard. It holds no spoken words.
- A speech paragraph is one speaker's spoken words and nothing else: the name the player knows the speaker by, a colon, then the words in quotation marks. The player's own speech paragraphs use the name You.
The portrait shows the speaker's face and tone, so a speech paragraph carries no action, gesture, or tone of voice. What a speaker does goes in a narration paragraph before or after their speech paragraph.`;

/** The template with the Markdown chip rendered in place around a fixed value. */
function withFormatting(template: string, value: string): string {
  return serializeSegments(parsePromptTemplate(template).map((segment) => {
    if (segment.type !== 'variable' || baseToken(segment.token) !== '<MARKDOWN GUIDANCE>') return segment;
    return { type: 'text', value: renderPromptTemplate(segment.token, { [splitToken(segment.token)!.key]: value }) };
  }));
}

/** `text` with `from` replaced, failing loudly when the shipped wording moved. */
function swap(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`Shipped wording not found: ${from.slice(0, 60)}…`);
  return text.replaceAll(from, to);
}

const DIALOGUE_LINE = 'Characters speak through what they do: their actual words land as quoted dialogue woven into their movements,';
const DIALOGUE_VN = 'Characters speak often: their actual words land as speech paragraphs,';
const RIDER = "an action that speaks reaches the page as the player's own quoted sentences, carrying the feeling the action names, and then the character answers in their own quoted voice with something of their own.";
const RIDER_VN = "an action that speaks reaches the page as the player's own speech paragraphs, carrying the feeling the action names, and then the character answers with a speech paragraph that says something of their own.";

const NO_LABELS = 'with no labels and nothing after the scene ends';
const NO_HEADINGS = 'with no headings and nothing after the scene ends';
// The Output contract's lead sentence, replaced by the VN contract with the speech shape spelled out.
const OUTPUT_LEAD = 'Output only the story prose - the events themselves, with no labels and nothing after the scene ends.';
const OUTPUT_VN = 'Output only the story, as paragraphs separated by blank lines, with nothing after the scene ends. Each paragraph is narration or one speech line. A narration paragraph tells what happens and holds no spoken words. A speech line is one speaker\'s words and nothing else, written as `Speaker: "words"`, where Speaker is the name the player knows them by, or You for the player. What a speaker does goes in narration, never in their speech line.';
const RIDER_SHAPE = "an action that speaks reaches the page as the player's own speech line, `You: \"words\"`, carrying the feeling the action names, and then the character answers with a speech line that says something of their own.";
const SHAPE_CUE = 'Write every spoken line as its own `Speaker: "words"` paragraph.';
// The chip's On state labels speakers by their entry name, so the UI can match the entity and show the known name.
const OUTPUT_VN_REAL = OUTPUT_VN.replace('where Speaker is the name the player knows them by', "where Speaker is the speaker's name as their entry gives it");

const withVN =markdownGuidance(true) + '\n\n' + VN_BLOCK;
const defaultUser = (action: string) => defaultNarrationUserPrompt.replace('<PLAYER ACTION>', action);
const ARMS: Record<string, { template: string; user: (action: string) => string }> = {
  prose: { template: defaultSystemPrompt, user: defaultUser },
  chip: { template: withFormatting(defaultSystemPrompt, withVN), user: defaultUser },
  rewrite: {
    template: withFormatting(swap(swap(swap(defaultSystemPrompt, DIALOGUE_LINE, DIALOGUE_VN), RIDER, RIDER_VN), NO_LABELS, NO_HEADINGS), withVN),
    user: (action) => swap(defaultUser(action), RIDER, RIDER_VN),
  },
  output: {
    template: withFormatting(swap(swap(swap(defaultSystemPrompt, DIALOGUE_LINE, DIALOGUE_VN), RIDER, RIDER_SHAPE), OUTPUT_LEAD, OUTPUT_VN), withVN),
    user: (action) => swap(defaultUser(action), RIDER, RIDER_SHAPE),
  },
  rider: {
    template: withFormatting(swap(swap(swap(defaultSystemPrompt, DIALOGUE_LINE, DIALOGUE_VN), RIDER, RIDER_SHAPE), OUTPUT_LEAD, OUTPUT_VN), withVN),
    user: (action) => `${swap(defaultUser(action), RIDER, RIDER_SHAPE)}\n\n${SHAPE_CUE}`,
  },
  // What an On/Off chip would render: the three VN placements swapped in, nothing in Formatting.
  chipOn: {
    template: swap(swap(swap(defaultSystemPrompt, DIALOGUE_LINE, DIALOGUE_VN), RIDER, RIDER_SHAPE), OUTPUT_LEAD, OUTPUT_VN_REAL),
    user: (action) => `${swap(defaultUser(action), RIDER, RIDER_SHAPE)}\n\n${SHAPE_CUE}`,
  },
};

const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const ctx = chipValues(authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
}));
const dictionary = (world.dictionaries ?? []).flatMap((book) => book.entries ?? []);

function systemPrompt(arm: string, action: string, history: ChatMessage[]): string {
  return buildNarrationPrompt({
    template: ARMS[arm].template, ctx, action, history, dictionary,
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'medium', maxTokens: 1024, markdownOutput: true,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
}

// Speaker labels the UI could match: every entity name, plus You. Descriptive labels for strangers count
// separately, through the case file's aliases.
const NAMES = new Set<string>(['you', ...world.entities.map((entity) => entity.name.trim().toLowerCase())]);
const ALIASES = Object.values(fixture.aliases).flat().map((alias) => alias.toLowerCase());
const speakerKind = (label: string): 'name' | 'alias' | 'unknown' => {
  const key = label.trim().toLowerCase();
  if ([...NAMES].some((name) => key === name || key.split(/\s+/).includes(name))) return 'name';
  return ALIASES.some((alias) => key.includes(alias)) ? 'alias' : 'unknown';
};

const QUOTE = /["“”]/;
const QUOTED = /"[^"\n]+"|“[^”\n]+”/g;
// Whole paragraph: optional bold, a short label, a colon, then one quoted run and nothing after it.
const SPEECH = /^\*{0,2}([^:"“\n]{1,48}?)\*{0,2}\s*:\s*\*{0,2}\s*["“]([\s\S]+)["”]\s*\*{0,2}$/;

interface Score {
  paragraphs: number; npc: number; you: number; narration: number; mixed: number; unknown: number; alias: number;
  quotes: number; labels: string[]; unknownLabels: string[]; mixedSamples: string[];
}
function score(text: string): Score {
  const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const s: Score = { paragraphs: paras.length, npc: 0, you: 0, narration: 0, mixed: 0, unknown: 0, alias: 0,
    quotes: [...text.matchAll(QUOTED)].length, labels: [], unknownLabels: [], mixedSamples: [] };
  for (const p of paras) {
    const m = SPEECH.exec(p);
    if (m && !QUOTE.test(m[1])) {
      const label = m[1].trim();
      s.labels.push(label);
      if (label.toLowerCase() === 'you') s.you++;
      else s.npc++;
      const kind = speakerKind(label);
      if (kind === 'alias') s.alias++;
      if (kind === 'unknown') { s.unknown++; s.unknownLabels.push(label); }
    } else if (QUOTE.test(p)) {
      s.mixed++;
      s.mixedSamples.push(p.slice(0, 110));
    } else s.narration++;
  }
  return s;
}

async function narrate(system: string, history: ChatMessage[], user: string, seed: number): Promise<string> {
  // Narration is unpinned in PROMPT_SAMPLER_PINS, so no temperature is sent.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        model, seed, max_tokens: maxTokens, reasoning_effort: 'none', stream: false,
        messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: user }],
      }),
    });
    if (res.ok) {
      const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      return body.choices[0].message.content ?? '';
    }
    if (attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

if (args.includes('--dump')) {
  for (const arm of armNames) {
    console.log(`\n===== ${arm} SYSTEM =====\n${systemPrompt(arm, turns[0], [])}\n===== ${arm} USER =====\n${ARMS[arm].user(turns[0])}`);
  }
  process.exit(0);
}

interface TurnRow { arm: string; run: number; turn: number; action: string; text: string; s: Score }
const rows: TurnRow[] = [];

async function session(arm: string, run: number): Promise<void> {
  const history: ChatMessage[] = [];
  for (let t = 0; t < turns.length; t++) {
    const action = turns[t];
    const text = await narrate(systemPrompt(arm, action, history), history, ARMS[arm].user(action), SEED + run * 100 + t);
    const s = score(text);
    rows.push({ arm, run, turn: t, action, text, s });
    const ok = s.mixed === 0 && s.unknown === 0;
    console.log(`[${arm} r${run} t${String(t).padStart(2)}] ${ok ? 'OK  ' : 'FAIL'} p=${s.paragraphs} npc=${s.npc} you=${s.you} narr=${s.narration} mixed=${s.mixed} unk=${s.unknown} q=${s.quotes}${leaks(text, t).length ? ` LEAK=${leaks(text, t).join('+')}` : ''}`
      + (s.unknownLabels.length ? ` labels=${JSON.stringify(s.unknownLabels)}` : ''));
    if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    // History stores the bare action, as the app does.
    history.push({ role: 'user', content: action } as ChatMessage, { role: 'assistant', content: text } as ChatMessage);
  }
}

const started = Date.now();
console.log(`endpoint ${endpoint} · model ${model} · runs ${runs} · turns ${turns.length} · arms ${armNames.join(', ')}`);
const jobs = armNames.flatMap((arm) => Array.from({ length: runs }, (_, run) => () => session(arm, run)));
if (args.includes('--serial')) for (const job of jobs) await job();
else await Promise.all(jobs.map((job) => job()));

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '-');
console.log('\nTOTALS per arm (turn = one reply; comply = no mixed paragraph and no unknown speaker)');
console.log('arm       turns  comply  t1/3  t2/3  t3/3  mixed/turn  npc/turn  you/turn  narr/turn  quotes/turn  npcTurns  unk  leakTurns');
for (const arm of armNames) {
  const r = rows.filter((row) => row.arm === arm);
  const comply = (xs: TurnRow[]) => xs.filter((x) => x.s.mixed === 0 && x.s.unknown === 0).length;
  const third = (k: number) => r.filter((x) => Math.floor((3 * x.turn) / turns.length) === k);
  const avg = (f: (s: Score) => number) => (r.length ? (r.reduce((a, x) => a + f(x.s), 0) / r.length).toFixed(2) : '-');
  console.log(`${arm.padEnd(9)} ${String(r.length).padStart(5)}  ${pct(comply(r), r.length).padStart(6)}  ${[0, 1, 2].map((k) => pct(comply(third(k)), third(k).length).padStart(4)).join('  ')}`
    + `  ${avg((s) => s.mixed).padStart(10)}  ${avg((s) => s.npc).padStart(8)}  ${avg((s) => s.you).padStart(8)}  ${avg((s) => s.narration).padStart(9)}`
    + `  ${avg((s) => s.quotes).padStart(11)}  ${pct(r.filter((x) => x.s.npc > 0).length, r.length).padStart(8)}  ${String(r.reduce((a, x) => a + x.s.unknown, 0)).padStart(3)}`
    + `  ${pct(r.filter((x) => leaks(x.text, x.turn).length).length, r.filter((x) => x.turn < Math.max(...Object.values(fixture.introducedAt))).length).padStart(9)}`);
}
for (const arm of armNames) {
  const tally = new Map<string, number>();
  for (const row of rows.filter((x) => x.arm === arm)) for (const l of row.s.labels) tally.set(l, (tally.get(l) ?? 0) + 1);
  if (tally.size) console.log(`${arm} speaker labels: ${[...tally].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l}×${n}`).join(', ')}`);
  const unknown = [...new Set(rows.filter((x) => x.arm === arm).flatMap((x) => x.s.unknownLabels))];
  if (unknown.length) console.log(`${arm} unknown labels: ${unknown.join(', ')}`);
}
for (const arm of armNames.filter((a) => a !== 'prose')) {
  const samples = rows.filter((row) => row.arm === arm).flatMap((row) => row.s.mixedSamples).slice(0, 4);
  if (samples.length) console.log(`${arm} mixed samples:\n  ${samples.join('\n  ')}`);
}
const outDir = path.join(BASELINE, 'runs');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `vn-format-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(out, JSON.stringify({ endpoint, model, runs, turns, rows }, null, 2));
console.log(`dump ${path.relative(process.cwd(), out)}`);
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
