// Entity location probe — does each entity's location request pick the right reply, and how much does the
// fan-out add to the player's location request it rides beside? Emberwatch, in two scenes:
//   tavern  The Cinder and Crown, with Sylvie and Corvin able to follow and Albus already following
//   keep    Emberwatch Keep, with Captain Blackwell moving between the Keep and The Old Watchtower
//
// Every case sends the app's own requests, built by the real pass records over the world's chip values:
//   control  the player's location request (locationAuto), graded against the case's destination or NONE
//   entity   one entity location request per tracked entity (entityLocationAuto), graded against its gold reply
//   base     with --base <module>, the same entity requests over that module's `prompt`, in the same dispatch
// A case dispatches all of them together, as a parallel turn does, so drift lands on every arm.
//
// Per arm: accuracy, false move (any reply but stay or keep following where the gold keeps it put), missed
// move, empty or unmatched replies, mean and p95 request ms. `stage` is the wall-clock of the whole dispatch
// against the control request alone: the wait the fan-out adds.
//
// Usage: npx vite-node testing/baseline/harness/entity-location-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 6] [--only invite,post] [--base .scratch/entityPromptBase.ts]
//          [--serial] [--show] [--dump]
// --serial sends the requests one at a time, for a local engine with a single slot.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  defaultEntityLocationPrompt, defaultEntityLocationUserPrompt, defaultLocationChangePrompt, defaultLocationChangeUserPrompt,
} from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { entitiesInPlay } from '@/lib/entityPresence';
import { ENTITY_MOVE_LABELS, entityMoveOffers, type EntityMove } from '@/lib/entityFollowing';
import { navigableDestinations } from '@/lib/locationContext';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { TURN_PASSES } from '@/lib/turnPipeline/turnPasses';
import { emptyTurnMaterial, type TurnPassSubject } from '@/lib/turnPipeline/turnPlan';
import { testInput, TEST_PROMPTS } from '@/lib/turnPipeline/turnTestInputs';
import { migrateWorld } from '@/lib/version';
import type { Entity, EntityPositions, GameLocation } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '6'));
const only = argVal('--only', '');
const basePath = argVal('--base', '');
const serial = args.includes('--serial');
const show = args.includes('--show');

const world = migrateWorld(JSON.parse(readFileSync(path.resolve('src/defaultworlds/emberwatch.json'), 'utf8')));
const connections = world.connections ?? [];
const byName = (name: string) => {
  const found = world.entities.find((entity: Entity) => entity.name === name);
  if (!found) throw new Error(`Emberwatch has no ${name}`);
  return found as Entity;
};
const placeNamed = (name: string) => {
  const found = world.locations.find((location) => location.name === name);
  if (!found) throw new Error(`Emberwatch has no ${name}`);
  return found;
};
const tavern = placeNamed('The Cinder and Crown');
const keep = placeNamed('Emberwatch Keep');
const sylvie = { ...byName('Sylvie Thornwhistle'), movement: 'follow' as const, presence: 'random' as const };
const corvin = { ...byName('Corvin Vale'), movement: 'follow' as const, presence: 'random' as const };
const albus = { ...byName('Albus'), movement: 'follow' as const, presence: 'random' as const };
const blackwell = { ...byName('Captain Orrin Blackwell'), movement: 'between' as const, presence: 'random' as const };
const tracked = [sylvie, corvin, albus, blackwell];
const positions: EntityPositions = { [sylvie.id]: tavern.id, [corvin.id]: tavern.id, [albus.id]: tavern.id, [blackwell.id]: keep.id };
const followers = [albus.id];
const cast = entitiesInPlay(
  world.entities.map((entity: Entity) => tracked.find((e) => e.id === entity.id) ?? entity),
  positions,
);

/** One place the player stands, with the tracked entities there. */
interface Scene { location: GameLocation; movers: Entity[] }
const SCENES: Record<'tavern' | 'keep', Scene> = {
  tavern: { location: tavern, movers: [sylvie, corvin, albus] },
  keep: { location: keep, movers: [blackwell] },
};
const short = (entity: Entity) => entity.name.split(' ').at(-1)!;

// Gold is the line the entity should answer. Albus follows in every tavern case, so his gold is Keep following
// unless the action parts with him.
interface Case { id: string; scene: keyof typeof SCENES; action: string; go: string | null; gold: Record<string, string> }
const CASES: Case[] = [
  { id: 'invite', scene: 'tavern', action: 'Sylvie, come with me. We are heading out to the square.', go: 'Ashford Square', gold: { Thornwhistle: 'Come along', Vale: 'Stay', Albus: 'Keep following' } },
  { id: 'leave', scene: 'tavern', action: 'I finish my drink and walk out into the square.', go: 'Ashford Square', gold: { Thornwhistle: 'Stay', Vale: 'Stay', Albus: 'Keep following' } },
  { id: 'wait', scene: 'tavern', action: 'Albus, wait here for me. I head out to the square alone.', go: 'Ashford Square', gold: { Thornwhistle: 'Stay', Vale: 'Stay', Albus: 'Stay here' } },
  { id: 'all', scene: 'tavern', action: 'Come on, all of you. We go to the square together.', go: 'Ashford Square', gold: { Thornwhistle: 'Come along', Vale: 'Come along', Albus: 'Keep following' } },
  { id: 'lead', scene: 'tavern', action: 'I take Corvin by the arm and lead him out into the square.', go: 'Ashford Square', gold: { Thornwhistle: 'Stay', Vale: 'Come along', Albus: 'Keep following' } },
  { id: 'stay', scene: 'tavern', action: 'I order another ale and ask Wenna what she knows about the barrow.', go: null, gold: { Thornwhistle: 'Stay', Vale: 'Stay', Albus: 'Keep following' } },
  { id: 'talk', scene: 'tavern', action: 'I tell Sylvie that Corvin plans to go to the square tonight.', go: null, gold: { Thornwhistle: 'Stay', Vale: 'Stay', Albus: 'Keep following' } },
  { id: 'later', scene: 'tavern', action: 'I tell Sylvie to meet me at the square tomorrow, then I leave for the square.', go: 'Ashford Square', gold: { Thornwhistle: 'Stay', Vale: 'Stay', Albus: 'Keep following' } },
  { id: 'post', scene: 'keep', action: 'Captain, go up to the watchtower and keep watch tonight. I will stay here in the keep.', go: null, gold: { Blackwell: 'The Old Watchtower' } },
  { id: 'escort', scene: 'keep', action: 'Captain Blackwell, walk with me to the watchtower.', go: 'The Old Watchtower', gold: { Blackwell: 'Come along' } },
  { id: 'alone', scene: 'keep', action: 'I nod to the captain and head down to the square on my own.', go: 'Ashford Square', gold: { Blackwell: 'Stay' } },
  { id: 'ask', scene: 'keep', action: 'I ask Captain Blackwell what he saw from the watchtower last night.', go: null, gold: { Blackwell: 'Stay' } },
  { id: 'guard', scene: 'keep', action: 'Captain, hold the keep while I climb to the watchtower.', go: 'The Old Watchtower', gold: { Blackwell: 'Stay' } },
  { id: 'square', scene: 'keep', action: 'Come with me, captain. We go down to the square together.', go: 'Ashford Square', gold: { Blackwell: 'Come along' } },
];

const baseEntityPrompt = basePath ? (await import(pathToFileURL(path.resolve(basePath)).href) as { prompt: string }).prompt : null;
const inputWith = (entityLocation: string) => testInput(
  { prompts: { ...TEST_PROMPTS, locationChange: defaultLocationChangePrompt, locationChangeUser: defaultLocationChangeUserPrompt, entityLocation, entityLocationUser: defaultEntityLocationUserPrompt } },
  { thinkingMode: 'off' },
);
const input = inputWith(defaultEntityLocationPrompt);
const baseInput = baseEntityPrompt === null ? null : inputWith(baseEntityPrompt);
const pass = (id: string) => {
  const record = TURN_PASSES.find((p) => p.id === id);
  if (!record) throw new Error(`no pass ${id}`);
  return record;
};
const control = pass('locationAuto');
const mover = pass('entityLocationAuto');

/** Each scene's chip values, destinations and entity subjects, built once. */
const prepared = Object.fromEntries(Object.entries(SCENES).map(([id, scene]) => {
  const ctx = chipValues(authoredChipScene({ ...world, entities: cast }, { location: scene.location, resolve: (text) => text }));
  const destinations = navigableDestinations(scene.location, world.locations, connections).map((l) => l.name);
  const subjects: TurnPassSubject[] = scene.movers.map((entity) => ({
    name: entity.name,
    entity,
    ...entityMoveOffers(entity, followers.includes(entity.id), scene.location.id, world.locations, connections),
  }));
  return [id, { ctx, destinations, subjects }];
})) as Record<keyof typeof SCENES, { ctx: Record<string, string>; destinations: string[]; subjects: TurnPassSubject[] }>;

/** The line a parsed move stands for. */
const lineOf = (move: EntityMove | null, subject: TurnPassSubject): string | null => {
  if (move === null) return null;
  if (typeof move === 'string') return ENTITY_MOVE_LABELS[move];
  return subject.destinations?.find((place) => place.id === move.goTo)?.name ?? null;
};
const KEEPS_PUT = new Set(['Stay', 'Keep following']);

async function send(request: ReturnType<typeof control.buildRequest>) {
  const temperature = PROMPT_SAMPLER_PINS[request.type]?.temperature;
  const started = Date.now();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: request.maxTokens, temperature, reasoning_effort: 'none', stream: false,
      messages: [{ role: 'system', content: request.systemPrompt }, ...request.messages],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
  return { raw: body.choices[0].message.content ?? '', ms: Date.now() - started };
}

const tally = () => ({ n: 0, right: 0, falseMove: 0, missedMove: 0, unmatched: 0, ms: [] as number[] });
const arms: Record<string, ReturnType<typeof tally>> = { control: tally(), entity: tally(), ...(baseInput && { base: tally() }) };
const byScene: Record<string, { n: number; right: number }> = {};
const stage: { control: number; all: number }[] = [];
const misses: string[] = [];
const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
console.log(`model ${model} · runs ${runs} · cases ${cases.length} · ${serial ? 'serial' : 'parallel'}${baseInput ? ` · base ${basePath}` : ''}`);
if (args.includes('--dump')) {
  const c = cases[0];
  const { ctx, destinations, subjects } = prepared[c.scene];
  const material = { ...emptyTurnMaterial({ action: c.action, effectiveAction: c.action, turnId: 'probe', baseCtx: ctx, destinations }), ctx };
  const request = mover.buildRequest(input, { ...material, subject: subjects[0] });
  console.log(`--- system\n${request.systemPrompt}\n--- user\n${request.messages[0].content}\n--- cap ${request.maxTokens}`);
  process.exit(0);
}
const begun = Date.now();

for (let run = 0; run < runs; run++) {
  for (const c of cases) {
    const { ctx, destinations, subjects } = prepared[c.scene];
    const material = { ...emptyTurnMaterial({ action: c.action, effectiveAction: c.action, turnId: 'probe', baseCtx: ctx, destinations }), ctx };
    const entityArms = [['entity', input] as const, ...(baseInput ? [['base', baseInput] as const] : [])];
    const requests = [
      control.buildRequest(input, material),
      ...entityArms.flatMap(([, armInput]) => subjects.map((subject) => mover.buildRequest(armInput, { ...material, subject }))),
    ];
    const started = Date.now();
    const answers = serial
      ? await requests.reduce<Promise<Awaited<ReturnType<typeof send>>[]>>(async (done, r) => [...await done, await send(r)], Promise.resolve([]))
      : await Promise.all(requests.map(send));
    stage.push({ control: answers[0].ms, all: Date.now() - started });

    const routed = control.parseResponse(answers[0].raw, material) as string | null;
    arms.control.n++;
    arms.control.ms.push(answers[0].ms);
    if (routed === c.go) arms.control.right++;
    else {
      if (routed && !c.go) arms.control.falseMove++;
      if (!routed && c.go) arms.control.missedMove++;
      misses.push(`control ${c.id}: ${JSON.stringify(answers[0].raw)} (want ${c.go ?? 'NONE'})`);
    }

    entityArms.forEach(([arm], a) => subjects.forEach((subject, i) => {
      const answer = answers[1 + a * subjects.length + i];
      const line = lineOf(mover.parseResponse(answer.raw, { ...material, subject }) as EntityMove | null, subject);
      const want = c.gold[short(subject.entity!)];
      const tallied = arms[arm];
      tallied.n++;
      tallied.ms.push(answer.ms);
      const sceneKey = `${arm} ${c.scene}`;
      byScene[sceneKey] ??= { n: 0, right: 0 };
      byScene[sceneKey].n++;
      if (line === null) tallied.unmatched++;
      if (line === want) {
        tallied.right++;
        byScene[sceneKey].right++;
      } else {
        if (line !== null && !KEEPS_PUT.has(line) && KEEPS_PUT.has(want)) tallied.falseMove++;
        if ((line === null || KEEPS_PUT.has(line)) && !KEEPS_PUT.has(want)) tallied.missedMove++;
        misses.push(`${arm} ${short(subject.entity!)} ${c.id}: ${JSON.stringify(answer.raw)} (want ${want})`);
      }
      if (show) console.log(`  ${arm} ${c.id} ${short(subject.entity!)} → ${JSON.stringify(answer.raw)}`);
    }));
    process.stdout.write(`run ${run + 1} ${c.id} · stage ${Date.now() - started}ms\n`);
  }
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length));
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] ?? 0;
const pct = (right: number, n: number) => `${Math.round((100 * right) / Math.max(1, n))}%`;
console.log('\narm      n   right  falseMove  missedMove  unmatched  meanMs  p95Ms');
for (const [name, t] of Object.entries(arms)) {
  console.log(`${name.padEnd(8)} ${String(t.n).padStart(3)}  ${pct(t.right, t.n).padStart(5)}  ${String(t.falseMove).padStart(9)}  ${String(t.missedMove).padStart(10)}  ${String(t.unmatched).padStart(9)}  ${String(mean(t.ms)).padStart(6)}  ${String(p95(t.ms)).padStart(5)}`);
}
console.log(`by scene ${Object.entries(byScene).map(([key, t]) => `${key} ${pct(t.right, t.n)} (${t.n})`).join(' · ')}`);
console.log(`stage    control alone mean ${mean(stage.map((s) => s.control))}ms · whole dispatch mean ${mean(stage.map((s) => s.all))}ms · added ${mean(stage.map((s) => s.all - s.control))}ms`);
if (misses.length) console.log(`\nmisses:\n  ${misses.join('\n  ')}`);
console.log(`\nwall ${Math.round((Date.now() - begun) / 1000)}s`);
