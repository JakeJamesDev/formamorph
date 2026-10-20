// Entity location probe — does each entity's location request pick the right reply, and how much does the
// fan-out add to the player's location request it rides beside? Emberwatch, at The Cinder and Crown, with
// Sylvie and Corvin able to follow and Albus already following.
//
// Every case sends the app's own requests, built by the real pass records over the world's chip values:
//   control  the player's location request (locationAuto), graded against the case's destination or NONE
//   entity   one entity location request per tracked entity (entityLocationAuto), graded against its gold reply
// A case dispatches all of them together, as a parallel turn does, so drift lands on both.
//
// Per arm: accuracy, false come-along (come along or stay here where the gold keeps it put), missed
// come-along, empty or unmatched replies, mean and p95 request ms. `stage` is the wall-clock of the whole
// dispatch against the control request alone: the wait the fan-out adds.
//
// Usage: npx vite-node testing/baseline/harness/entity-location-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 6] [--only invite,wait] [--serial] [--show]
// --serial sends the requests one at a time, for a local engine with a single slot.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  defaultEntityLocationPrompt, defaultEntityLocationUserPrompt, defaultLocationChangePrompt, defaultLocationChangeUserPrompt,
} from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { entitiesInPlay } from '@/lib/entityPresence';
import { ENTITY_MOVE_LABELS, entityMoveOptions, type EntityMoveReply } from '@/lib/entityFollowing';
import { navigableDestinations } from '@/lib/locationContext';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { TURN_PASSES } from '@/lib/turnPipeline/turnPasses';
import { emptyTurnMaterial, type TurnPassSubject } from '@/lib/turnPipeline/turnPlan';
import { testInput, TEST_PROMPTS } from '@/lib/turnPipeline/turnTestInputs';
import { migrateWorld } from '@/lib/version';
import type { Entity, EntityPositions } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '6'));
const only = argVal('--only', '');
const serial = args.includes('--serial');
const show = args.includes('--show');

const world = migrateWorld(JSON.parse(readFileSync(path.resolve('src/defaultworlds/emberwatch.json'), 'utf8')));
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
const sylvie = { ...byName('Sylvie Thornwhistle'), movement: 'follow' as const, presence: 'random' as const };
const corvin = { ...byName('Corvin Vale'), movement: 'follow' as const, presence: 'random' as const };
const albus = { ...byName('Albus'), movement: 'follow' as const, presence: 'random' as const };
const positions: EntityPositions = { [sylvie.id]: tavern.id, [corvin.id]: tavern.id, [albus.id]: tavern.id };
const followers = [albus.id];
const cast = entitiesInPlay(
  world.entities.map((entity: Entity) => [sylvie, corvin, albus].find((e) => e.id === entity.id) ?? entity),
  positions,
);
const ctx = chipValues(authoredChipScene({ ...world, entities: cast }, { location: tavern, resolve: (text) => text }));
const destinations = navigableDestinations(tavern, world.locations, world.connections ?? []).map((l) => l.name);

type Gold = Partial<Record<'Sylvie' | 'Corvin' | 'Albus', EntityMoveReply>>;
interface Case { id: string; action: string; go: string | null; gold: Gold }
// Albus follows in every case, so his gold is keep following unless the action parts with him.
const CASES: Case[] = [
  { id: 'invite', action: 'Sylvie, come with me. We are heading out to the square.', go: 'Ashford Square', gold: { Sylvie: 'comeAlong', Corvin: 'stay', Albus: 'keepFollowing' } },
  { id: 'leave', action: 'I finish my drink and walk out into the square.', go: 'Ashford Square', gold: { Sylvie: 'stay', Corvin: 'stay', Albus: 'keepFollowing' } },
  { id: 'wait', action: 'Albus, wait here for me. I head out to the square alone.', go: 'Ashford Square', gold: { Sylvie: 'stay', Corvin: 'stay', Albus: 'stayHere' } },
  { id: 'all', action: 'Come on, all of you. We go to the square together.', go: 'Ashford Square', gold: { Sylvie: 'comeAlong', Corvin: 'comeAlong', Albus: 'keepFollowing' } },
  { id: 'lead', action: 'I take Corvin by the arm and lead him out into the square.', go: 'Ashford Square', gold: { Sylvie: 'stay', Corvin: 'comeAlong', Albus: 'keepFollowing' } },
  { id: 'stay', action: 'I order another ale and ask Wenna what she knows about the barrow.', go: null, gold: { Sylvie: 'stay', Corvin: 'stay', Albus: 'keepFollowing' } },
  { id: 'talk', action: 'I tell Sylvie that Corvin plans to go to the square tonight.', go: null, gold: { Sylvie: 'stay', Corvin: 'stay', Albus: 'keepFollowing' } },
  { id: 'later', action: 'I tell Sylvie to meet me at the square tomorrow, then I leave for the square.', go: 'Ashford Square', gold: { Sylvie: 'stay', Corvin: 'stay', Albus: 'keepFollowing' } },
];

const input = testInput(
  { prompts: { ...TEST_PROMPTS, locationChange: defaultLocationChangePrompt, locationChangeUser: defaultLocationChangeUserPrompt, entityLocation: defaultEntityLocationPrompt, entityLocationUser: defaultEntityLocationUserPrompt } },
  { thinkingMode: 'off' },
);
const pass = (id: string) => {
  const record = TURN_PASSES.find((p) => p.id === id);
  if (!record) throw new Error(`no pass ${id}`);
  return record;
};
const control = pass('locationAuto');
const mover = pass('entityLocationAuto');
const short = (entity: Entity) => entity.name.split(' ')[0] as keyof Gold;
const subjects: TurnPassSubject[] = [sylvie, corvin, albus].map((entity) => ({
  name: entity.name, entity, moves: entityMoveOptions(followers.includes(entity.id)),
}));

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
const arms = { control: tally(), entity: tally() };
const stage: { control: number; all: number }[] = [];
const misses: string[] = [];
const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
console.log(`model ${model} · runs ${runs} · cases ${cases.length} · ${serial ? 'serial' : 'parallel'} · destinations ${destinations.join(', ')}`);
if (args.includes('--dump')) {
  const material = { ...emptyTurnMaterial({ action: cases[0].action, effectiveAction: cases[0].action, turnId: 'probe', baseCtx: ctx, destinations }), ctx };
  const request = mover.buildRequest(input, { ...material, subject: subjects[1] });
  console.log(`--- system\n${request.systemPrompt}\n--- user\n${request.messages[0].content}\n--- cap ${request.maxTokens}`);
  process.exit(0);
}
const begun = Date.now();

for (let run = 0; run < runs; run++) {
  for (const c of cases) {
    const material = { ...emptyTurnMaterial({ action: c.action, effectiveAction: c.action, turnId: 'probe', baseCtx: ctx, destinations }), ctx };
    const requests = [
      control.buildRequest(input, material),
      ...subjects.map((subject) => mover.buildRequest(input, { ...material, subject })),
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

    subjects.forEach((subject, i) => {
      const answer = answers[i + 1];
      const reply = mover.parseResponse(answer.raw, { ...material, subject }) as EntityMoveReply | null;
      const want = c.gold[short(subject.entity!)]!;
      const moves = (r: EntityMoveReply | null) => r === 'comeAlong' || r === 'stayHere';
      arms.entity.n++;
      arms.entity.ms.push(answer.ms);
      if (reply === null) arms.entity.unmatched++;
      if (reply === want) arms.entity.right++;
      else {
        if (moves(reply) && !moves(want)) arms.entity.falseMove++;
        if (!moves(reply) && moves(want)) arms.entity.missedMove++;
        misses.push(`${short(subject.entity!)} ${c.id}: ${JSON.stringify(answer.raw)} (want ${ENTITY_MOVE_LABELS[want]})`);
      }
      if (show) console.log(`  ${c.id} ${short(subject.entity!)} → ${JSON.stringify(answer.raw)}`);
    });
    process.stdout.write(`run ${run + 1} ${c.id} · stage ${Date.now() - started}ms\n`);
  }
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length));
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] ?? 0;
console.log('\narm      n   right  falseMove  missedMove  unmatched  meanMs  p95Ms');
for (const [name, t] of Object.entries(arms)) {
  console.log(`${name.padEnd(8)} ${String(t.n).padStart(3)}  ${`${Math.round((100 * t.right) / Math.max(1, t.n))}%`.padStart(5)}  ${String(t.falseMove).padStart(9)}  ${String(t.missedMove).padStart(10)}  ${String(t.unmatched).padStart(9)}  ${String(mean(t.ms)).padStart(6)}  ${String(p95(t.ms)).padStart(5)}`);
}
console.log(`stage    control alone mean ${mean(stage.map((s) => s.control))}ms · whole dispatch mean ${mean(stage.map((s) => s.all))}ms · added ${mean(stage.map((s) => s.all - s.control))}ms`);
if (misses.length) console.log(`\nmisses:\n  ${misses.join('\n  ')}`);
console.log(`\nwall ${Math.round((Date.now() - begun) / 1000)}s`);
