// Entity location probe: does the turn's entity location request pick the right reply for each character?
// Emberwatch, in two scenes, at 14:00 on day one:
//   tavern  The Cinder and Crown: Sylvie and Corvin free to come along, Albus already following
//   keep    Emberwatch Keep: Captain Blackwell on his Wander over the keep, the wall and the watchtower
//
// Every case sends the app's own request, built by the real pass record over the world's chip values, with the
// pinned samplers and the reply schema:
//   batch    the shipped request: one call for every character, one schema field each
//   base     with --base <module>, the same request over that module's `prompt` (and `userPrompt`, if any): the
//            in-batch control for the prompt text
//   control  with --control <module>, another set of pass records (its `TURN_PASSES`, `prompt`, `userPrompt`)
//            sent once per subject when they fan out: the in-batch control for the request's form
// A case dispatches all of them together, so drift lands on every arm.
//
// Cases carry a `source`: `action` cases run the auto request (action only); `narration` cases run the suggest
// request, where the narration says how long a follower waits. The `named` cases are the one-named bar: the
// action names one character, two others are present, and only the named one may move.
//
// Per arm: accuracy, false move (a move where gold keeps put), wrong wait length, unmatched, mean turn ms (the
// slowest of an arm's calls in a case, since they go out together), and the named-only rate.
//
// Usage: npx vite-node testing/baseline/harness/entity-location-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 8] [--only id,id] [--base .scratch/entityPromptBase.ts]
//          [--control .scratch/control/index.ts] [--show] [--dump]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultEntityLocationPrompt, defaultEntityLocationUserPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { castRoutines } from '@/lib/entityKind';
import { entitiesInPlay } from '@/lib/entityPresence';
import { entityMoveCandidates, entityMoveLabel, entityMoveRequests, isEntityMove, isEntityReply, type EntityMove } from '@/lib/entityFollowing';
import { navigableDestinations } from '@/lib/locationContext';
import { placeAll, positionWorld } from '@/lib/positionPlay';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { responseFormat, type ResponseSchema } from '@/lib/aiRequest/responseSchema';
import { TURN_PASSES } from '@/lib/turnPipeline/turnPasses';
import {
  emptyTurnMaterial, type TurnMaterial, type TurnPassId, type TurnPassRecord, type TurnPassRequest, type TurnPassSubject, type TurnPlanInput,
} from '@/lib/turnPipeline/turnPlan';
import { testInput, TEST_PROMPTS } from '@/lib/turnPipeline/turnTestInputs';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Entity, GameLocation } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '8'));
const only = argVal('--only', '');
const basePath = argVal('--base', '');
const controlPath = argVal('--control', '');
const show = args.includes('--show');

const world = migrateWorld(JSON.parse(readFileSync(path.resolve('src/defaultworlds/emberwatch.json'), 'utf8')));
const connections = world.connections ?? [];
const byName = (name: string): Entity => {
  const found = world.entities.find((entity: Entity) => entity.name === name);
  if (!found) throw new Error(`Emberwatch has no ${name}`);
  return found as Entity;
};
const placeNamed = (name: string): GameLocation => {
  const found = world.locations.find((location) => location.name === name);
  if (!found) throw new Error(`Emberwatch has no ${name}`);
  return found;
};
const tavern = placeNamed('The Cinder and Crown');
const keep = placeNamed('Emberwatch Keep');
// Companions: one Start at the tavern, an empty schedule, Anywhere. Blackwell keeps his migrated Wander.
const companion = (name: string): Entity => ({
  ...byName(name), kind: 'unique', starts: [{ id: 'probe', place: tavern.id, weight: 1, schedule: [] }], traversable: 'anywhere', locations: [tavern.id],
});
const sylvie = companion('Sylvie Thornwhistle');
const corvin = companion('Corvin Vale');
const albus = companion('Albus');
// Blackwell ships as a Generic entity; the probe makes him a Unique entity on an all-day Wander over his three places.
const captain = byName('Captain Orrin Blackwell');
const blackwell: Entity = {
  ...captain, kind: 'unique', traversable: [],
  starts: [{
    id: 'probe', place: keep.id, weight: 1,
    schedule: [{ id: 'w', time: 'allDay', action: { kind: 'wander', places: (captain.locations ?? []).map((place) => ({ place, weight: 1 })), idle: 240 } }],
  }],
};
const entities = world.entities.map((entity: Entity) => [sylvie, corvin, albus, blackwell].find((e) => e.id === entity.id) ?? entity);

const NOW = 14 * 60; // day one, 14:00, afternoon
const short = (entity: Entity) => entity.name.split(' ').at(-1)!;

/** The book with everyone placed for `playerAt`, Albus following there. */
function bookAt(playerAt: string) {
  const w = positionWorld(castRoutines(entities), NOW, playerAt, world.locations, connections, () => 0);
  const rolled = placeAll({ positions: { [sylvie.id]: tavern.id, [corvin.id]: tavern.id, [albus.id]: tavern.id }, uniques: {} }, w);
  // Blackwell's Wander may roll him anywhere on it; the keep scenes stand him at the keep.
  const placed = { ...rolled, positions: { ...rolled.positions, [blackwell.id]: keep.id } };
  const follows = playerAt === tavern.id ? { [albus.id]: { ...placed.uniques[albus.id], follow: { mode: 'following' as const } } } : {};
  return { w, book: { ...placed, uniques: { ...placed.uniques, ...follows } } };
}

interface Scene { location: GameLocation }
const SCENES: Record<'tavern' | 'keep', Scene> = { tavern: { location: tavern }, keep: { location: keep } };

// Gold lines, by surname. At 14:00 the waits end at 15:00, at 17:02 when evening begins, and at 19:55 when night begins.
const HOUR = entityMoveLabel('waitHour', NOW);
const THIS = entityMoveLabel('waitThisDaypart', NOW);
const NEXT = entityMoveLabel('waitNextDaypart', NOW);
const ANY_WAIT = 'any wait';
interface Case { id: string; scene: keyof typeof SCENES; source: 'action' | 'narration'; action: string; narration?: string; named?: boolean; gold: Record<string, string> }
const STILL = { Thornwhistle: 'Stay', Vale: 'Stay', Tallow: 'Stay' };
const CASES: Case[] = [
  // Wait lengths read from the action.
  { id: 'hour', scene: 'tavern', source: 'action', action: 'Albus, wait here for an hour. I head out to the square alone.', gold: { ...STILL, Albus: HOUR } },
  { id: 'evening', scene: 'tavern', source: 'action', action: 'Albus, wait here until evening. I head out to the square alone.', gold: { ...STILL, Albus: THIS } },
  { id: 'nightfall', scene: 'tavern', source: 'action', action: 'Albus, wait for me here until nightfall. I head out to the square alone.', gold: { ...STILL, Albus: NEXT } },
  { id: 'long', scene: 'tavern', source: 'action', action: 'Albus, wait here for me, as long as it takes. I head out to the square alone.', gold: { ...STILL, Albus: NEXT } },
  { id: 'plain', scene: 'tavern', source: 'action', action: 'Albus, wait here. I head out to the square alone.', gold: { ...STILL, Albus: ANY_WAIT } },
  { id: 'part', scene: 'tavern', source: 'action', action: 'Albus, this is where we part ways. Go home. I head out to the square alone.', gold: { ...STILL, Albus: 'Part ways' } },
  // Wait lengths read from the narration.
  { id: 'n-hour', scene: 'tavern', source: 'narration', action: 'Albus, wait here for me.', narration: 'Albus settles onto the bench. "One hour," he says. "After that I am gone."', gold: { ...STILL, Albus: HOUR } },
  { id: 'n-evening', scene: 'tavern', source: 'narration', action: 'Albus, wait here for me.', narration: 'Albus nods. "I will keep this seat until evening comes, no longer."', gold: { ...STILL, Albus: THIS } },
  { id: 'n-night', scene: 'tavern', source: 'narration', action: 'Albus, wait here for me.', narration: 'Albus shrugs. "I will be here through the evening, until night falls."', gold: { ...STILL, Albus: NEXT } },
  // Ordinary turns: the control on non-followers and on a follower who keeps following.
  { id: 'leave', scene: 'tavern', source: 'action', action: 'I finish my drink and walk out into the square.', gold: { ...STILL, Albus: 'Keep following' } },
  { id: 'stay', scene: 'tavern', source: 'action', action: 'I order another ale and ask Wenna what she knows about the barrow.', gold: { ...STILL, Albus: 'Keep following' } },
  { id: 'all', scene: 'tavern', source: 'action', action: 'Come on, all of you. We go to the square together.', gold: { Thornwhistle: 'Come along', Vale: 'Come along', Tallow: 'Come along|Stay', Albus: 'Keep following' } },
  // The batching bar: one character named, two others present.
  { id: 'named-corvin', scene: 'tavern', source: 'action', named: true, action: 'Corvin, come with me. We are heading out to the square.', gold: { Thornwhistle: 'Stay', Vale: 'Come along', Tallow: 'Stay', Albus: 'Keep following' } },
  { id: 'named-sylvie', scene: 'tavern', source: 'action', named: true, action: 'I take Sylvie by the arm and lead her out into the square.', gold: { Thornwhistle: 'Come along', Vale: 'Stay', Tallow: 'Stay', Albus: 'Keep following' } },
  { id: 'named-albus', scene: 'tavern', source: 'action', named: true, action: 'Albus, wait here for an hour while I check the square.', gold: { ...STILL, Albus: HOUR } },
  // A free character walking alone to an allowed place.
  { id: 'post', scene: 'keep', source: 'action', action: 'Captain, go up to the watchtower and keep watch tonight. I will stay here in the keep.', gold: { Blackwell: 'The Old Watchtower' } },
  { id: 'escort', scene: 'keep', source: 'action', action: 'Captain Blackwell, walk with me to the watchtower.', gold: { Blackwell: 'Come along' } },
  { id: 'ask', scene: 'keep', source: 'action', action: 'I ask Captain Blackwell what he saw from the watchtower last night.', gold: { Blackwell: 'Stay' } },
];

interface PromptModule { prompt: string; userPrompt?: string; TURN_PASSES?: TurnPassRecord[] }
const load = async (file: string) => (file ? await import(pathToFileURL(path.resolve(file)).href) as PromptModule : null);
const baseModule = await load(basePath);
const controlModule = await load(controlPath);
const inputWith = (entityLocation: string, entityLocationUser = defaultEntityLocationUserPrompt) => testInput(
  { prompts: { ...TEST_PROMPTS, entityLocation, entityLocationUser } },
  { thinkingMode: 'off', entityLocationTextPass: false },
);

/** One arm: the pass records it builds from, and the input it builds over. */
interface Arm { name: string; passes: readonly TurnPassRecord[]; input: TurnPlanInput }
const arms: Arm[] = [
  { name: 'batch', passes: TURN_PASSES, input: inputWith(defaultEntityLocationPrompt) },
  ...(baseModule ? [{ name: 'base', passes: TURN_PASSES, input: inputWith(baseModule.prompt, baseModule.userPrompt) }] : []),
  ...(controlModule?.TURN_PASSES ? [{ name: 'control', passes: controlModule.TURN_PASSES, input: inputWith(controlModule.prompt, controlModule.userPrompt) }] : []),
];
const passOf = (arm: Arm, id: TurnPassId) => {
  const record = arm.passes.find((p) => p.id === id);
  if (!record) throw new Error(`no pass ${id} in arm ${arm.name}`);
  return record;
};

/** Each scene's chip values, destinations and subjects, built once. */
const prepared = Object.fromEntries(Object.entries(SCENES).map(([id, scene]) => {
  const { w, book } = bookAt(scene.location.id);
  const cast = entitiesInPlay(entities, book.positions);
  const ctx = chipValues(authoredChipScene({ ...world, entities: cast }, { location: scene.location, resolve: (text) => text }));
  const destinations = navigableDestinations(scene.location, world.locations, connections).map((l) => l.name);
  const subjects: TurnPassSubject[] = entityMoveRequests(cast, entities, book, scene.location.id, w, world.locations, connections);
  return [id, { ctx, destinations, subjects }];
})) as Record<keyof typeof SCENES, { ctx: Record<string, string>; destinations: string[]; subjects: TurnPassSubject[] }>;

const linesOf = (subject: TurnPassSubject) => entityMoveCandidates(subject.moves ?? [], subject.destinations ?? [], subject.moveClock ?? NOW);
/** The line a parsed move stands for. */
const lineOf = (move: EntityMove | null, subject: TurnPassSubject): string | null =>
  move === null ? null : linesOf(subject).find(([, m]) => JSON.stringify(m) === JSON.stringify(move))?.[0] ?? null;
const KEEPS_PUT = new Set(['Stay', 'Keep following']);
const isWait = (line: string | null) => !!line?.startsWith('Wait here');
const fits = (line: string | null, want: string) => (want === ANY_WAIT ? isWait(line) : want.split('|').includes(line ?? ''));

/** One request an arm sends this case, and the subject it answers for when the pass fans out. */
interface Planned { request: TurnPassRequest<ChatMessage>; subject?: TurnPassSubject }

/** What `arm` sends for this case: one request, or one per subject when its pass fans out. */
function planned(arm: Arm, id: TurnPassId, material: TurnMaterial): Planned[] {
  const record = passOf(arm, id);
  const subjects = material.subjects?.[id] ?? [];
  if (!record.fanOut) return [{ request: record.buildRequest(arm.input, material) }];
  return subjects.map((subject) => ({ subject, request: record.buildRequest(arm.input, { ...material, subject }) }));
}

/** Each subject's line from an arm's replies, by entity id. */
function linesBy(arm: Arm, id: TurnPassId, material: TurnMaterial, sent: Planned[], raws: string[]): Map<string, string | null> {
  const record = passOf(arm, id);
  const lines = new Map<string, string | null>();
  sent.forEach(({ subject }, i) => {
    const parsed: unknown = record.parseResponse(raws[i], { ...material, subject });
    if (subject?.entity) {
      lines.set(subject.entity.id, lineOf(isEntityMove(parsed) ? parsed : null, subject));
      return;
    }
    for (const reply of Array.isArray(parsed) ? parsed : []) {
      if (!isEntityReply(reply)) continue;
      const own = material.subjects?.[id]?.find((s) => s.entity?.id === reply.entity.id);
      if (own) lines.set(reply.entity.id, lineOf(reply.move, own));
    }
  });
  return lines;
}

async function post(systemPrompt: string, messages: ChatMessage[], maxTokens: number | null, schema?: ResponseSchema) {
  const pins = PROMPT_SAMPLER_PINS.entityLocation ?? {};
  const started = Date.now();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: maxTokens, temperature: pins.temperature, repetition_penalty: pins.repetitionPenalty, reasoning_effort: 'none', stream: false,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      ...(schema && { response_format: responseFormat(schema) }),
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
  return { raw: body.choices[0].message.content ?? '', ms: Date.now() - started };
}
const send = (request: TurnPassRequest<ChatMessage>) => post(request.systemPrompt, request.messages, request.maxTokens, request.responseSchema);

const tally = () => ({ n: 0, right: 0, falseMove: 0, wrongWait: 0, unmatched: 0, ms: [] as number[], namedCases: 0, namedOnly: 0 });
const tallies: Record<string, ReturnType<typeof tally>> = Object.fromEntries(arms.map((arm) => [arm.name, tally()]));
const bySource: Record<string, { n: number; right: number }> = {};
const misses: string[] = [];
const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
console.log(`model ${model} · runs ${runs} · cases ${cases.length} · arms ${arms.map((arm) => arm.name).join(', ')}`);
const passIdOf = (c: Case): TurnPassId => (c.source === 'action' ? 'entityLocationAuto' : 'entityLocationSuggest');
const materialOf = (c: Case): TurnMaterial => {
  const { ctx, destinations, subjects } = prepared[c.scene];
  return {
    ...emptyTurnMaterial({ action: c.action, effectiveAction: c.action, turnId: 'probe', baseCtx: ctx, destinations }),
    ctx, narration: c.narration ?? '', subjects: { [passIdOf(c)]: subjects },
  };
};
for (const [id, { subjects }] of Object.entries(prepared)) {
  const material = materialOf({ ...CASES[0], scene: id as keyof typeof SCENES });
  const counts = arms.map((arm) => `${arm.name} ${planned(arm, 'entityLocationAuto', material).length}`).join(' · ');
  console.log(`requests per turn at ${id} (${subjects.map((s) => short(s.entity!)).join(', ')}): ${counts}`);
}
if (args.includes('--dump')) {
  const c = cases[0];
  for (const arm of arms) {
    const { request } = planned(arm, passIdOf(c), materialOf(c)).at(-1)!;
    console.log(`=== ${arm.name}\n--- system\n${request.systemPrompt}\n--- user\n${request.messages[0].content}\n--- cap ${request.maxTokens}`);
  }
  process.exit(0);
}
const begun = Date.now();

function score(arm: string, c: Case, subject: TurnPassSubject, line: string | null, raw: string) {
  const want = c.gold[short(subject.entity!)];
  const t = tallies[arm];
  t.n++;
  const key = `${arm} ${c.source}`;
  bySource[key] ??= { n: 0, right: 0 };
  bySource[key].n++;
  if (line === null) t.unmatched++;
  const ok = fits(line, want);
  if (ok) {
    t.right++;
    bySource[key].right++;
  } else {
    if (line !== null && !KEEPS_PUT.has(line) && want.split('|').every((w) => KEEPS_PUT.has(w))) t.falseMove++;
    if (isWait(line) && (isWait(want) || want === ANY_WAIT)) t.wrongWait++;
    misses.push(`${arm} ${short(subject.entity!)} ${c.id}: ${JSON.stringify(raw)} (want ${want})`);
  }
  if (show) console.log(`  ${arm} ${c.id} ${short(subject.entity!)} → ${JSON.stringify(raw)}`);
  return ok;
}

for (let run = 0; run < runs; run++) {
  for (const c of cases) {
    const { subjects } = prepared[c.scene];
    const id = passIdOf(c);
    const material = materialOf(c);
    const sent = arms.map((arm) => ({ arm, planned: planned(arm, id, material) }));
    const answers = await Promise.all(sent.map(({ planned: each }) => Promise.all(each.map(({ request }) => send(request)))));

    sent.forEach(({ arm, planned: each }, a) => {
      const raws = answers[a].map((answer) => answer.raw);
      const lines = linesBy(arm, id, material, each, raws);
      tallies[arm.name].ms.push(Math.max(...answers[a].map((answer) => answer.ms)));
      const oks = subjects.map((subject, s) => {
        const raw = each.length === subjects.length ? raws[s] : raws[0];
        return score(arm.name, c, subject, lines.get(subject.entity!.id) ?? null, raw);
      });
      if (c.named) {
        tallies[arm.name].namedCases++;
        if (oks.every(Boolean)) tallies[arm.name].namedOnly++;
      }
    });
    process.stdout.write(`run ${run + 1} ${c.id}\n`);
  }
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length));
const pct = (right: number, n: number) => `${Math.round((100 * right) / Math.max(1, n))}%`;
console.log('\narm      n   right  falseMove  wrongWait  unmatched  turnMs  namedOnly');
for (const [name, t] of Object.entries(tallies)) {
  console.log(`${name.padEnd(8)} ${String(t.n).padStart(3)}  ${pct(t.right, t.n).padStart(5)}  ${String(t.falseMove).padStart(9)}  ${String(t.wrongWait).padStart(9)}  ${String(t.unmatched).padStart(9)}  ${String(mean(t.ms)).padStart(6)}  ${t.namedCases ? `${t.namedOnly}/${t.namedCases}` : '-'}`);
}
console.log(`by source ${Object.entries(bySource).map(([key, t]) => `${key} ${pct(t.right, t.n)} (${t.n})`).join(' · ')}`);
if (misses.length) console.log(`\nmisses:\n  ${misses.join('\n  ')}`);
console.log(`\nwall ${Math.round((Date.now() - begun) / 1000)}s`);
