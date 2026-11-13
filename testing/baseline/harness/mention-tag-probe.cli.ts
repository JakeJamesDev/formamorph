// Mention-tag probe: can the narrator mark every reference to a cast member (name, pronoun, descriptor)
// inline with that character's handle? Arms: `control` (real prompt, no tags), `brace` ({words|handle}),
// `link` ([words](@handle)), `rider` (brace plus a user-turn reminder). Scenes hold 2-3 present characters; the pronoun mix (two of one gender, a
// they/them) makes pronoun attribution checkable. The system prompt is the app's own, built on Sedge Landing.
//
// Usage:  npx vite-node testing/baseline/harness/mention-tag-probe.cli.ts -- [--endpoint URL] [--model default]
//         [--runs 3] [--arms control,brace,link] [--only <case>] [--max 600] [--quiet] [--dump-system]

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultNarrationUserPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { scannedEntries } from '@/lib/testBench/triggers';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { Entity, World } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string): string => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '3'));
const maxTokens = Number(argVal('--max', '600'));
const only = argVal('--only', '');
const arms = argVal('--arms', 'control,brace,link,rider').split(',') as Arm[];
const quiet = args.includes('--quiet');
const dumpSystem = args.includes('--dump-system');

// `rider` is the brace arm plus a one-line reminder on the user turn.
type Arm = 'control' | 'brace' | 'link' | 'rider';
type Shape = 'brace' | 'link';
const shapeOf = (arm: Exclude<Arm, 'control'>): Shape => (arm === 'link' ? 'link' : 'brace');
const RIDER = '\n\nMark every name, pronoun, and description of a listed character as {words|handle}.';
type Pronouns = 'he/him' | 'she/her' | 'they/them';
interface CastMember { handle: string; name: string; pronouns: Pronouns; description: string }
interface Case { name: string; locationId: string; cast: CastMember[]; prevNarration: string; action: string }

const CASES: Case[] = [
  {
    name: 'alehouse-pair',
    locationId: 'loc-sedge',
    cast: [
      { handle: 'tomas', name: 'Tomas', pronouns: 'he/him', description: 'The keeper of the dockside alehouse, broad and slow-spoken, wiping mugs behind the counter.' },
      { handle: 'nell', name: 'Nell', pronouns: 'she/her', description: 'A courier drying her boots by the fire, quick-tongued and impatient, carrying a sealed satchel.' },
    ],
    prevNarration: 'The dockside alehouse is low and warm. Behind the counter {Tomas|tomas} works a rag around a mug, and by the hearth {a courier|nell} sits with {her|nell} boots steaming on the fender, a sealed satchel across {her|nell} knees.',
    action: "I ask the keeper whether the courier's road from the north is still open.",
  },
  {
    name: 'two-sisters',
    locationId: 'loc-sedge',
    cast: [
      { handle: 'ilse', name: 'Ilse', pronouns: 'she/her', description: 'The elder of two sisters who mend boats at the landing; stern, keeps the ledger.' },
      { handle: 'maren', name: 'Maren', pronouns: 'she/her', description: 'The younger sister; cheerful, tarring an upturned skiff and singing under her breath.' },
    ],
    prevNarration: 'Pitch smoke drifts over the dock. {Ilse|ilse} sits on a crate with a ledger open on {her|ilse} knee, while {Maren|maren} kneels beside an upturned skiff, brushing tar along its seams.',
    action: 'I tell them I need a boat by the end of the week and ask what it will cost.',
  },
  {
    // Observation turn: third-person prose about two she/her characters, the pronoun-attribution stress case.
    name: 'sisters-watch',
    locationId: 'loc-sedge',
    cast: [
      { handle: 'ilse', name: 'Ilse', pronouns: 'she/her', description: 'The elder of two sisters who mend boats at the landing; stern, keeps the ledger.' },
      { handle: 'maren', name: 'Maren', pronouns: 'she/her', description: 'The younger sister; cheerful, tarring an upturned skiff and singing under her breath.' },
    ],
    prevNarration: 'Pitch smoke drifts over the dock. {Ilse|ilse} sits on a crate with a ledger open on {her|ilse} knee, while {Maren|maren} kneels beside an upturned skiff, brushing tar along its seams.',
    action: 'I lean on a post and watch the two of them work for a while.',
  },
  {
    name: 'ferry-stranger',
    locationId: 'loc-sedge',
    cast: [
      { handle: 'ferryman', name: 'the ferryman', pronouns: 'he/him', description: 'The rope-ferry operator; one-armed, dry, has not given the player his name.' },
      { handle: 'ash', name: 'Ash', pronouns: 'they/them', description: 'A traveling tinker waiting for the crossing, chatty, laden with clinking pots.' },
    ],
    prevNarration: 'The ferry rocks as {Ash|ash} climbs aboard behind you, pots clanking. {The ferryman|ferryman} waits at the rope, watching the pale water, and says nothing yet.',
    action: "I ask the tinker where they're headed, then ask the ferryman how long the crossing takes.",
  },
  {
    name: 'green-trio',
    locationId: 'loc-green',
    cast: [
      { handle: 'pell', name: 'Pell', pronouns: 'he/him', description: 'A wiry fruit-seller, loud, fussy about his stacked apples.' },
      { handle: 'dorrit', name: 'Dorrit', pronouns: 'she/her', description: "A rival seller at the next stall, sharp-eyed, undercutting Pell's prices." },
      { handle: 'kit', name: 'Kit', pronouns: 'they/them', description: 'A street kid hovering between the stalls, eyeing the apples.' },
    ],
    prevNarration: 'The green is thinning toward dusk. {Pell|pell} straightens {his|pell} apple pyramid while {Dorrit|dorrit}, one stall over, calls a lower price just loud enough for {him|pell} to hear. {A child named Kit|kit} drifts between them, hands in pockets.',
    action: 'I buy an apple from Pell and toss it to Kit.',
  },
];

const SHAPES: Record<Shape, string> = { brace: '{words|handle}', link: '[words](@handle)' };
const mentionSection = (shape: string) => `

## Character Mentions
Every reference to a character from the entities list is marked inline as ${shape}: "words" is the exact text the reader sees (a name, a pronoun, or a description such as a title), and "handle" is that character's handle from the entities list. Mark each reference separately, every time it appears, including pronouns and possessives. The player ("you") is never marked. All other text is plain prose.`;

const fixture = migrateWorld(JSON.parse(readFileSync(path.join(process.cwd(), 'testing', 'baseline', 'sedge-landing.json'), 'utf8'))) as World;

function caseWorld(c: Case): World {
  const entities: Entity[] = c.cast.map((m) => ({
    ...fixture.entities[0],
    id: `ent-${m.handle}`,
    name: m.name,
    pronouns: m.pronouns,
    playerDescription: m.description,
    aiDescription: m.description,
    aiSummary: m.description,
  }));
  return {
    ...fixture,
    entities,
    locations: fixture.locations.map((l) => ({ ...l, entities: l.id === c.locationId ? entities.map((e) => e.id) : [] })),
  };
}

function systemFor(c: Case, arm: Arm): string {
  const world = caseWorld(c);
  const location = world.locations.find((l) => l.id === c.locationId);
  if (!location) throw new Error(`missing ${c.locationId}`);
  const ctx = chipValues(authoredChipScene(world, {
    location,
    activeTraitIds: world.traits.filter((t) => t.isDefault).map((t) => t.id),
    resolve: (text: string) => text,
  }));
  let system = buildNarrationPrompt({
    template: defaultSystemPrompt, ctx, action: c.action, history: [], dictionary: scannedEntries(world),
    actionVec: null, semanticLore: false, embedVectors: new Map(), language: 'English', paragraphLimit: 'auto',
    maxTokens: undefined, markdownOutput: true, sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  if (arm === 'control') return system;
  for (const m of c.cast) {
    const head = `- **${m.name}**`;
    if (!system.includes(head)) throw new Error(`entity line not found for ${m.name}`);
    system = system.replace(head, `${head}\n  - **handle:** ${m.handle}`);
  }
  return system + mentionSection(SHAPES[shapeOf(arm)]);
}

// Prior turns are written in brace shape; a tagged arm sees its own shape, the control sees plain prose.
const PRIOR_TAG = /\{([^{}|]+)\|([^{}|]+)\}/g;
const priorTurn = (text: string, arm: Arm): string =>
  arm === 'brace' || arm === 'rider' ? text : text.replace(PRIOR_TAG, (_m, words: string, handle: string) => (arm === 'link' ? `[${words}](@${handle})` : words));

async function call(system: string, c: Case, arm: Arm): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: maxTokens, reasoning_effort: 'none', stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'assistant', content: priorTurn(c.prevNarration, arm) },
        { role: 'user', content: renderPromptTemplate(defaultNarrationUserPrompt, { '<PLAYER ACTION>': c.action }) + (arm === 'rider' ? RIDER : '') },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = await res.json() as { choices?: { message?: { content?: string } }[] };
  return (json.choices?.[0]?.message?.content ?? '').trim();
}

const TAG_RE: Record<Shape, RegExp> = { brace: /\{([^{}|\n]+)\|([^{}|\n]+)\}/g, link: /\[([^\]\n]+)\]\(@([^)\s]+)\)/g };
const STRAY_RE: Record<Shape, RegExp> = { brace: /[{}|]/g, link: /\(@/g };
const PRONOUN_SETS: Record<Pronouns, RegExp> = {
  'he/him': /^(he|him|his|himself)$/i,
  'she/her': /^(she|her|hers|herself)$/i,
  'they/them': /^(they|them|their|theirs|themself|themselves)$/i,
};
const ANY_PRONOUN = /^(he|him|his|himself|she|her|hers|herself|they|them|their|theirs|themself|themselves)$/i;
const GENDERED = /^(he|him|his|himself|she|her|hers|herself)$/i;
const GENDERED_WORDS = /\b(he|him|his|himself|she|her|hers|herself)\b/gi;
const PLAYER_WORD = /^(you|your|yours|yourself)$/i;
const QUOTE_RE = /"[^"]{3,}"|“[^”]{3,}”/g;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countWords = (s: string) => (s.match(/\S+/g) ?? []).length;

const METRICS = ['words', 'quotes', 'tags', 'unknown', 'playerTagged', 'nameTags', 'pronTags', 'gendTags', 'pronWrong', 'descTags', 'stray', 'untaggedNames', 'untaggedGendered'] as const;
type Score = Record<(typeof METRICS)[number], number>;

function score(out: string, c: Case, arm: Arm): Score {
  const s = Object.fromEntries(METRICS.map((k) => [k, 0])) as Score;
  if (arm === 'control') {
    s.words = countWords(out);
    s.quotes = (out.match(QUOTE_RE) ?? []).length;
    s.untaggedGendered = (out.match(GENDERED_WORDS) ?? []).length;
    return s;
  }
  const byHandle = new Map(c.cast.map((m) => [m.handle, m]));
  const shape = shapeOf(arm);
  const tags = [...out.matchAll(TAG_RE[shape])].map((m) => ({ text: m[1].trim(), handle: m[2].trim().toLowerCase() }));
  const plain = out.replace(TAG_RE[shape], (_match, words: string) => words);
  const outside = out.replace(TAG_RE[shape], ' ');
  s.tags = tags.length;
  s.stray = (plain.match(STRAY_RE[shape]) ?? []).length;
  s.words = countWords(plain);
  s.quotes = (plain.match(QUOTE_RE) ?? []).length;
  for (const t of tags) {
    const m = byHandle.get(t.handle);
    if (!m) { s.unknown++; continue; }
    if (PLAYER_WORD.test(t.text)) s.playerTagged++;
    else if (ANY_PRONOUN.test(t.text)) {
      s.pronTags++;
      if (GENDERED.test(t.text)) s.gendTags++;
      if (!PRONOUN_SETS[m.pronouns].test(t.text)) s.pronWrong++;
    } else if (t.text.toLowerCase().includes(m.name.replace(/^the /i, '').toLowerCase())) s.nameTags++;
    else s.descTags++;
  }
  s.untaggedNames = c.cast.filter((m) => !m.name.startsWith('the '))
    .reduce((n, m) => n + (outside.match(new RegExp(`\\b${escapeRe(m.name)}\\b`, 'g')) ?? []).length, 0);
  s.untaggedGendered = (outside.match(GENDERED_WORDS) ?? []).length;
  return s;
}

const pick = CASES.filter((c) => !only || c.name.includes(only));
if (dumpSystem) { console.log(systemFor(pick[0], arms.find((a) => a !== 'control') ?? 'control')); process.exit(0); }
console.log(`Mention-tag probe · ${endpoint} · "${model}" · arms ${arms.join(',')} · ${pick.length} case(s) · ${runs} run(s)\n`);
const started = performance.now();

const totals = Object.fromEntries(arms.map((a) => [a, { runs: 0, errors: 0, zeroTag: 0, ...Object.fromEntries(METRICS.map((k) => [k, 0])) }])) as Record<Arm, Score & { runs: number; errors: number; zeroTag: number }>;
for (const c of pick) {
  for (let r = 1; r <= runs; r++) {
    // Arms interleave per run so cloud drift hits every arm alike.
    await Promise.all(arms.map(async (arm) => {
      let out: string;
      try { out = await call(systemFor(c, arm), c, arm); } catch (e) {
        totals[arm].errors++;
        console.log(`${c.name} #${r} ${arm}: ERROR ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      const s = score(out, c, arm);
      const t = totals[arm];
      t.runs++;
      for (const k of METRICS) t[k] += s[k];
      if (arm !== 'control' && s.tags === 0) t.zeroTag++;
      const line = arm === 'control'
        ? `words ${s.words} · quotes ${s.quotes} · he/she ${s.untaggedGendered}`
        : `tags ${s.tags} (name ${s.nameTags} · pron ${s.pronTags}, wrong ${s.pronWrong} · desc ${s.descTags}) · unknown ${s.unknown} · you ${s.playerTagged} · stray ${s.stray} · MISSED name ${s.untaggedNames} he/she ${s.untaggedGendered} · words ${s.words} · quotes ${s.quotes}`;
      console.log(`${c.name} #${r} ${arm.padEnd(7)} ${line}${quiet ? '' : `\n${out.split('\n').filter(Boolean).map((l) => `      ${l}`).join('\n')}`}`);
    }));
  }
}

console.log(`\n==== totals per arm (${((performance.now() - started) / 1000).toFixed(0)}s) ====`);
for (const arm of arms) {
  const t = totals[arm];
  const n = t.runs || 1;
  const base = `runs ${t.runs} (err ${t.errors}) · words ${(t.words / n).toFixed(0)}/turn · quotes ${(t.quotes / n).toFixed(1)}/turn`;
  if (arm === 'control') { console.log(`control  ${base} · he/she ${(t.untaggedGendered / n).toFixed(1)}/turn`); continue; }
  const pct = (a: number, b: number) => `${((a / (b || 1)) * 100).toFixed(0)}%`;
  console.log(`${arm.padEnd(8)} ${base} · zero-tag ${t.zeroTag} · name cov ${pct(t.nameTags, t.nameTags + t.untaggedNames)} · he/she cov ${pct(t.gendTags, t.gendTags + t.untaggedGendered)} · pron wrong ${t.pronWrong}/${t.pronTags} · desc ${t.descTags} · unknown ${t.unknown} · you-tagged ${t.playerTagged} · stray ${t.stray}`);
}
