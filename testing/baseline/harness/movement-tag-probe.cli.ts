// Movement tag probe — with the Entities chip's Movement tags, does the narrator keep a Strict character at their
// post, leave a Strict neighbor where they are, and stay quiet about it on ordinary turns? Sedge Hamlet: the
// Eelhouse, the Common Green and the Ferryman's Cottage sit side by side. Odette works the Eelhouse; Bram keeps
// the cottage.
//
// Arms, paired by run index and interleaved: `control` (the scene with no movement states, so no tag) and `tag`
// (the same scene with them). Every other byte is shared.
//
// Checks:
//   leaves       — judge: Odette leaves the Eelhouse with the player (down)
//   comes-over   — judge: Bram comes out and joins the player on the green (down)
//   stay-mention — judge: the passage says Odette must stay or cannot leave (guard: tag ≈ control)
//   stay-words   — regex over the passage for staying words (guard: tag ≈ control)
//   offer-along  — a choice line offers to take Odette along (down)
//
// Usage: npx vite-node testing/baseline/harness/movement-tag-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 10] [--max 600] [--only take-strict,choices-take] [--pool 4] [--out results.json] [--show] [--blocks]
//          [--alt '{"stays there":"trial wording"}' | --alt alt.json ...] [--tpl replacements.json ...]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultChoicesPrompt, defaultChoicesUserPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import type { ChipScene } from '@/lib/chipValues/chipScene';
import { chipValues, sceneEntityChipValues } from '@/lib/chipValues/chipValues';
import type { MovementStates } from '@/lib/movementTag';
import { resolveEntityText } from '@/lib/placeholders';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { layerValues, mapValues, type TokenValues } from '@/lib/promptValues';
import { choicesSystemPrompt } from '@/lib/turnPipeline/turnPasses';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Entity } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '10'));
const maxTokens = Number(argVal('--max', '600'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const SEED = 515151;
// Each --alt is a JSON map from a shipped tag to its trial wording, run as its own arm: alt1, alt2, ...
const ALTS: Record<string, string>[] = args.flatMap((arg, i) => (
  args[i - 1] === '--alt' ? [JSON.parse(arg.startsWith('{') ? arg : readFileSync(arg, 'utf8')) as Record<string, string>] : []
));
// Each --tpl is a JSON file of [from, to] replacements in the narration and choices templates, run with the
// shipped tags as its own arm: tpl1, tpl2, ...
const TPLS: [string, string][][] = args.flatMap((arg, i) => (args[i - 1] === '--tpl' ? [JSON.parse(readFileSync(arg, 'utf8')) as [string, string][]] : []));
const template = (arm: string, text: string) => {
  if (!arm.startsWith('tpl')) return text;
  return TPLS[Number(arm.slice(3)) - 1].reduce((out, [from, to]) => out.replace(from, to), text);
};
// Every replacement must land in the narration template, so a typo cannot pass as a null result.
for (const [i, pairs] of TPLS.entries()) {
  for (const [from] of pairs) if (!defaultSystemPrompt.includes(from)) throw new Error(`tpl${i + 1}: not in the narration template: ${from}`);
}
type Arm = string;
const ARMS: Arm[] = ['control', 'tag', ...ALTS.map((_, i) => `alt${i + 1}`), ...TPLS.map((_, i) => `tpl${i + 1}`)];
const altOf = (arm: Arm) => (arm.startsWith('alt') ? ALTS[Number(arm.slice(3)) - 1] : undefined);
/** `values` with each movement line reworded as `arm` picks. */
const reword = (arm: Arm, values: TokenValues): TokenValues => {
  const alt = altOf(arm);
  if (!alt) return values;
  return mapValues(values, (text) => text.replace(/(\*\*movement:\*\* )(.*)/g, (line, key: string, tag: string) => `${key}${alt[tag] ?? tag}`));
};

const world = migrateWorld(JSON.parse(readFileSync(path.resolve('testing/baseline/sedge-landing.json'), 'utf8')));
const place = (id: string) => {
  const found = world.locations.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Sedge Landing fixture is missing ${id}.`);
  return found;
};
const EELHOUSE = place('loc-eelhouse');
const GREEN = place('loc-green');
const AT: Record<string, string> = { 'ent-odette': 'loc-eelhouse', 'ent-bram': 'loc-cottage', 'ent-wick': 'loc-green' };
const cast: Entity[] = world.entities.flatMap((e) => (AT[e.id] ? [{ ...e, kind: 'unique' as const, locations: [AT[e.id]] }] : []));
// Odette's shift and Bram's watch are Strict rows; Wick has none.
const STATES: MovementStates = { 'ent-odette': { strict: true }, 'ent-bram': { strict: true }, 'ent-wick': { strict: false } };

type Case = {
  id: string; prompt: 'narration' | 'choices'; at: typeof EELHOUSE; opening: ChatMessage[]; action: string; narration?: string; checks: string[];
};
const AT_EELHOUSE: ChatMessage[] = [
  { role: 'user', content: 'I step into the Eelhouse out of the wind.' },
  { role: 'assistant', content: 'Smoke hangs under the rafters. Odette turns a rack of eels over the coals and gives you a short nod without stopping her work.' },
];
const AT_GREEN: ChatMessage[] = [
  { role: 'user', content: 'I walk out onto the Common Green.' },
  { role: 'assistant', content: 'The grass is wet and the hamlet is quiet. Smoke curls from the cottage chimney at the edge of the green.' },
];
const CASES: Case[] = [
  { id: 'take-strict', prompt: 'narration', at: EELHOUSE, opening: AT_EELHOUSE,
    action: 'I ask Odette to come with me to the Common Green right now, and we set off together.', checks: ['leaves'] },
  { id: 'walk-strict', prompt: 'narration', at: EELHOUSE, opening: AT_EELHOUSE,
    action: 'Odette and I walk out of the Eelhouse together, heading for the Common Green.', checks: ['leaves'] },
  { id: 'neighbor-strict', prompt: 'narration', at: GREEN, opening: AT_GREEN,
    action: 'I call toward the cottage for Bram to come out and join me here on the green.', checks: ['comes-over'] },
  { id: 'ordinary-strict', prompt: 'narration', at: EELHOUSE, opening: AT_EELHOUSE,
    action: 'I ask Odette how the eel catch was this week.', checks: ['stay-mention', 'stay-words'] },
  { id: 'choices-take', prompt: 'choices', at: EELHOUSE, opening: AT_EELHOUSE,
    action: 'I say I am heading over to the Common Green next.',
    narration: 'You tell Odette you are heading to the Common Green. She glances at the door and says she has not seen the green in days, then turns back to the eels. The door behind you lets in a cold draft.',
    checks: ['offer-along'] },
];

const baseScene = authoredChipScene(world, {
  location: EELHOUSE,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});
const sceneFor = (arm: Arm, c: Case): ChipScene => {
  const here = cast.filter((e) => e.locations?.includes(c.at.id)).map((e) => e.id);
  return {
    ...baseScene, location: c.at, entities: cast, outerScopeEntities: cast, presentIds: here, inSceneIds: here,
    ...(arm !== 'control' && { movement: STATES }),
  };
};

function request(arm: Arm, c: Case): ChatMessage[] {
  const scene = sceneFor(arm, c);
  if (c.prompt === 'choices') {
    const values = reword(arm, layerValues(chipValues(scene), sceneEntityChipValues(scene, scene.presentIds)));
    return [
      { role: 'system', content: choicesSystemPrompt(template(arm, defaultChoicesPrompt), 'English', values) },
      { role: 'user', content: renderPromptTemplate(defaultChoicesUserPrompt, { '<NARRATION>': c.narration ?? '' }) },
    ] as ChatMessage[];
  }
  const system = buildNarrationPrompt({
    template: template(arm, defaultSystemPrompt), ctx: reword(arm, chipValues(scene)), action: c.action, history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  return [{ role: 'system', content: system }, ...c.opening, { role: 'user', content: c.action }] as ChatMessage[];
}

async function complete(messages: ChatMessage[], seed: number, extra: { temperature?: number; max?: number } = {}): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: extra.max ?? maxTokens, reasoning_effort: 'none', stream: false,
        // Narration and choices are unpinned, so they send no temperature; the judge sends 0.
        ...(extra.temperature !== undefined ? { temperature: extra.temperature } : {}),
        messages,
      }),
    });
    if (res.ok) {
      const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      return body.choices[0].message.content ?? '';
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}

/** The model's own yes/no on one question about `text`, at temperature 0. */
async function judge(text: string, question: string, action: string): Promise<boolean> {
  const answer = await complete([
    { role: 'system', content: 'You read one passage of a story and answer one question about it with one word: yes or no. "You" in the passage is the player.' },
    { role: 'user', content: `The player's action: ${action}\n\nPassage:\n${text}\n\nQuestion: ${question} Answer yes or no.` },
  ] as ChatMessage[], 1, { temperature: 0, max: 5 });
  return /^\W*yes/i.test(answer);
}
const JUDGED: Record<string, string> = {
  leaves: 'By the end of this passage, is Odette walking away from the Eelhouse together with the player?',
  'comes-over': 'By the end of this passage, has Bram come out of his cottage to stand with the player on the green?',
  'stay-mention': 'Does this passage say or show that Odette has to stay where she is, or that she cannot leave?',
};

type Result = { arm: Arm; case: string; run: number; text: string; judged: Record<string, boolean> };
const STAY_WORDS = /\b(stays?|staying|can(?:'|no)t leave|cannot leave|won't leave|her post|her shift|stays? put)\b/i;
const ALONG = /\bOdette\b[^\n]*\b(come|comes|join|with me|along|follow)\b|\b(bring|take|ask|invite|convince|persuade)\b[^\n]*\bOdette\b[^\n]*\b(along|with me|to come|to join)\b/i;
const CHECKS: Record<string, (r: Result) => boolean> = {
  leaves: (r) => r.judged.leaves === true,
  'comes-over': (r) => r.judged['comes-over'] === true,
  'stay-mention': (r) => r.judged['stay-mention'] === true,
  'stay-words': ({ text }) => STAY_WORDS.test(text),
  'offer-along': ({ text }) => text.split('\n').some((line) => ALONG.test(line)),
};

const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
if (args.includes('--blocks')) {
  for (const c of cases) {
    const values = chipValues(sceneFor('tag', c));
    console.log(`--- ${c.id}\n${values('<ENTITIES|summary.markdown>')}${values('<ENTITIES|reachable.summary.markdown>')}${values('<ENTITIES|sublocations.summary.markdown>')}`);
  }
}
const results: Result[] = [];
const started = Date.now();
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}`);
// Arms interleave run by run, so drift during the batch lands on both.
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((arm) => ({ arm, c, run })))).flat();
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++];
    try {
      const text = await complete(request(arm, c), SEED + run);
      const judged: Record<string, boolean> = {};
      for (const check of c.checks) if (JUDGED[check]) judged[check] = await judge(text, JUDGED[check], c.action);
      const result: Result = { arm, case: c.id, run, text, judged };
      results.push(result);
      console.log(`[${arm}] ${c.id} #${run} ${c.checks.map((check) => `${check}=${CHECKS[check](result) ? 1 : 0}`).join(' ')} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
console.log('\nTOTALS');
for (const c of cases) {
  for (const check of c.checks) {
    const cells = ARMS.map((arm) => {
      const of = results.filter((r) => r.case === c.id && r.arm === arm);
      return `${arm} ${of.filter(CHECKS[check]).length}/${of.length}`;
    });
    console.log(`${`${c.id} ${check}`.padEnd(30)} ${cells.join(' · ')}`);
  }
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
