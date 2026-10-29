// Inventory re-gain probe — does the Inventory pass record a second copy of an item the player already carries?
// Two levers, crossed into four arms paired by run index:
//   desc  — a runtime item's description names the item alone, never where it lay or who held it
//   line  — the system prompt ends with a line saying Items Here is the state before this turn
// Arms: `shipped` (place descriptions, no line) · `desc` · `line` · `both`.
//
// Cases:
//   synthetic — Sedge Landing at the dock with one runtime item carried. Retouch cases change nothing; the two
//               guards (`take-another`, `second-eel`) must still add a copy the player takes again.
//   replay    — frozen requests from real play turns that duplicated a carried item. A hit is a reply with no
//               gain or transfer to the player of an item already carried.
//   base      — the nine cases of inventory-pass-cases.json, under `shipped` and `line` (no runtime items there).
//   describe  — `--describe` only: the shipped and the object-only describe prompt on the passages that made the
//               runtime items. A hit is a description that names no place or holder (regex first pass; hand-grade).
//
// Usage: npx vite-node testing/baseline/harness/inventory-regain-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 12] [--pool 4] [--only synthetic|replay|base|describe] [--out f.json]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultInventoryPrompt, defaultInventoryUserPrompt } from '@/components/game/GamePrompts';
import { responseFormat } from '@/lib/aiRequest/responseSchema';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { applyInventoryPass, parseInventoryReply } from '@/lib/inventory';
import { describeItemRequest } from '@/lib/inventory/describe';
import { resolveEntityText } from '@/lib/placeholders';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { inventoryRequest } from '@/lib/turnPipeline/turnPasses';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Entity, Item, ItemCopy, ItemCopyWhere, RuntimeItem, Slot } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '12'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const SEED = 919191;

const HELD_LINE = 'Items Here shows who held each item before this turn. An item listed under an owner is already theirs: record it only when this turn moves it to another owner or this place, uses it up, or puts it on or takes it off.';
const LAST_SENTENCE = 'has no operations at all.';
const withLine = (system: string) => system.replace(LAST_SENTENCE, `${LAST_SENTENCE}\n\n${HELD_LINE}`);
// The arms without the line start from the prompt with it taken out.
const passPrompt = defaultInventoryPrompt.replace(`\n\n${HELD_LINE}`, '');
const PLACE_DESCRIBE = 'You describe one item from an interactive story. Reply with one short sentence that says what the item is and what it looks like, from what the passage shows. Write only that sentence.';
const OBJECT_DESCRIBE = 'You describe one item from an interactive story. Reply with one short sentence that says what the item is, what it is made of and what it looks like, from what the passage shows. Describe the object itself, apart from where it lies and who holds it. Write only that sentence.';

type Arm = 'shipped' | 'desc' | 'line' | 'both';
const ARMS: Arm[] = ['shipped', 'desc', 'line', 'both'];
const usesLine = (arm: Arm) => arm === 'line' || arm === 'both';
const usesDesc = (arm: Arm) => arm === 'desc' || arm === 'both';

type CopySpec = { item?: string; runtime?: string; where: string; equipped?: boolean; quantity?: number; hidden?: boolean };
type BaseExpect = { item?: string; runtime?: string; where: string; quantity?: number; equipped?: boolean; visibility?: 'visible' | 'hidden' };
type BaseCase = { id: string; action: string; narration: string; expect: BaseExpect[] };
type SynthCase = { id: string; guard?: boolean; copies: CopySpec[]; action: string; narration: string; expect: { name: string; where: string; quantity: number }[] };
type Replay = { id: string; system: string; user: string; held: string[]; objectOnly: [string, string][] };
type DescribeCase = { id: string; name: string; narration: string };

const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const base = JSON.parse(readFileSync(path.join(BASELINE, 'inventory-pass-cases.json'), 'utf8')) as {
  items: Omit<Item, 'statEffects' | 'traitEffects' | 'equipRequires'>[]; slots: Slot[]; copies: CopySpec[]; cases: BaseCase[];
};
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'inventory-regain-cases.json'), 'utf8')) as {
  replays: Replay[]; runtime: { id: string; name: string; place: string; object: string }[]; cases: SynthCase[]; describe: DescribeCase[];
};
const items: Item[] = base.items.map((item) => ({ ...item, traitEffects: [], equipRequires: [], statEffects: [] }));
const whereOf = (where: string): ItemCopyWhere => (
  where === 'you' ? { kind: 'you' } : where.startsWith('loc-') ? { kind: 'location', id: where } : { kind: 'entity', id: where }
);
const copiesOf = (specs: CopySpec[], offset: number): ItemCopy[] => specs.map((spec, i) => ({
  id: `c${offset + i}`,
  item: spec.runtime ? { kind: 'runtime', runtimeItemId: spec.runtime } : { kind: 'item', itemId: spec.item! },
  where: whereOf(spec.where), quantity: spec.quantity ?? 1, visibility: spec.hidden ? 'hidden' : 'visible',
  ...(spec.equipped && { equipped: { slotId: items.find((it) => it.id === spec.item)?.slotId ?? 'hand', order: i } }),
}));
const runtimeFor = (arm: Arm): RuntimeItem[] => fixture.runtime.map((r) => ({ id: r.id, name: r.name, description: usesDesc(arm) ? r.object : r.place }));

const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const baseScene = authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});
const owners = baseScene.presentIds.flatMap((id) => {
  const entity = world.entities.find((e) => e.id === id);
  return entity ? [{ id, name: entity.name }] : [];
});
const pins = {
  temperature: PROMPT_SAMPLER_PINS.inventory?.temperature,
  ...(PROMPT_SAMPLER_PINS.inventory?.repetitionPenalty !== undefined && { repetition_penalty: PROMPT_SAMPLER_PINS.inventory?.repetitionPenalty }),
};

async function send(systemPrompt: string, messages: ChatMessage[], maxTokens: number, schema: unknown, seed: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: maxTokens, reasoning_effort: 'none', stream: false, ...pins,
        ...(schema ? { response_format: responseFormat(schema as Parameters<typeof responseFormat>[0]) } : {}),
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    });
    if (res.ok) {
      const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      return body.choices[0].message.content ?? '';
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}

/** The pass over one start state: the request, then the reply applied through the real validator. */
function passRun(start: ItemCopy[], runtimeItems: RuntimeItem[], c: { action: string; narration: string }, arm: Arm) {
  const ctx = chipValues({ ...baseScene, items, itemCopies: start, runtimeItems });
  const request = inventoryRequest(
    { system: usesLine(arm) ? withLine(passPrompt) : passPrompt, user: defaultInventoryUserPrompt },
    { ctx, action: c.action, narration: c.narration }, { textPass: false, quiet: false },
  );
  const apply = (raw: string) => applyInventoryPass(start, parseInventoryReply(raw), {
    items, runtimeItems, playerNames: ['Traveler'], owners, location: { id: location!.id, name: location!.name },
  }, { world: { items, slots: base.slots }, newId: (() => { let i = 0; return () => `n${i++}`; })() });
  return { request, apply };
}

const whereKey = (w: ItemCopyWhere) => (w.kind === 'you' ? 'you' : w.id);
/** Quantity per item name, owner, equipped and visibility: the net state a turn leaves. */
function tally(copies: readonly ItemCopy[], runtimeItems: readonly RuntimeItem[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const copy of copies) {
    const name = copy.item.kind === 'item'
      ? items.find((it) => it.id === (copy.item as { itemId: string }).itemId)?.name ?? '?'
      : runtimeItems.find((r) => r.id === (copy.item as { runtimeItemId: string }).runtimeItemId)?.name ?? '?';
    const key = `${name}|${whereKey(copy.where)}|${copy.equipped ? 'eq' : ''}|${copy.visibility}`;
    out.set(key, (out.get(key) ?? 0) + copy.quantity);
  }
  return out;
}
const diff = (a: Map<string, number>, b: Map<string, number>) => [...new Set([...a.keys(), ...b.keys()])]
  .filter((k) => (a.get(k) ?? 0) !== (b.get(k) ?? 0)).map((k) => `${k} ${a.get(k) ?? 0}→${b.get(k) ?? 0}`);

type Row = { kind: 'synthetic' | 'replay' | 'base' | 'describe'; arm: string; case: string; run: number; hit: boolean; raw: string; note: string };
const results: Row[] = [];
type Job = () => Promise<Row>;
const jobs: Job[] = [];
const want = (kind: string) => (only ? only === kind : kind !== 'describe' || args.includes('--describe'));

if (want('synthetic')) {
  for (const c of fixture.cases) for (let run = 0; run < runs; run++) for (const arm of ARMS) jobs.push(async () => {
    const start = [...copiesOf(base.copies, 0), ...copiesOf(c.copies, 100)];
    const runtime = runtimeFor(arm);
    const { request, apply } = passRun(start, runtime, c, arm);
    const raw = await send(request.systemPrompt, request.messages, request.maxTokens ?? 400, request.responseSchema, SEED + run);
    const result = apply(raw);
    const expected = tally(start, runtime);
    for (const e of c.expect) {
      for (const k of [...expected.keys()]) if (k.startsWith(`${e.name}|${e.where}|`)) expected.delete(k);
      expected.set(`${e.name}|${e.where}||visible`, e.quantity);
    }
    const off = diff(expected, tally(result.copies, result.runtimeItems));
    // A guard asks only whether the player gained the copy; the giver's side shows in the note.
    const hit = c.guard ? !off.some((d) => d.includes('|you|')) : off.length === 0;
    return { kind: 'synthetic', arm, case: c.id, run, hit, raw, note: off.join('; ') };
  });
}

if (want('replay')) {
  const schema = passRun(copiesOf(base.copies, 0), [], { action: '', narration: '' }, 'shipped').request.responseSchema;
  for (const r of fixture.replays) for (let run = 0; run < runs; run++) for (const arm of ARMS) jobs.push(async () => {
    let system = r.system;
    if (usesDesc(arm)) for (const [from, to] of r.objectOnly) system = system.split(from).join(to);
    if (usesLine(arm)) system = withLine(system);
    const raw = await send(system, [{ role: 'user', content: r.user }], 400, schema, SEED + run);
    const held = r.held.map((h) => h.toLowerCase());
    const dups = parseInventoryReply(raw).filter((op) => (op.op === 'gain' || op.op === 'transfer')
      && /^(you|albus)$/i.test((op.to || '').trim()) && held.some((h) => op.item.toLowerCase().includes(h) || h.includes(op.item.toLowerCase())));
    return { kind: 'replay', arm, case: r.id, run, hit: dups.length === 0, raw, note: dups.map((op) => `${op.op} ${op.item}`).join('; ') };
  });
}

if (want('base')) {
  for (const c of base.cases) for (let run = 0; run < runs; run++) for (const arm of ['shipped', 'line'] as Arm[]) jobs.push(async () => {
    const start = copiesOf(base.copies, 0);
    const { request, apply } = passRun(start, [], c, arm);
    const raw = await send(request.systemPrompt, request.messages, request.maxTokens ?? 400, request.responseSchema, SEED + run);
    const result = apply(raw);
    const expected = tally(start, []);
    for (const e of c.expect.filter((x) => x.item)) {
      const name = items.find((it) => it.id === e.item)!.name;
      for (const k of [...expected.keys()]) if (k.startsWith(`${name}|`)) expected.delete(k);
      expected.set(`${name}|${e.where}|${e.equipped ? 'eq' : ''}|${e.visibility ?? 'visible'}`, e.quantity ?? 1);
    }
    const got = tally(result.copies, result.runtimeItems);
    const wantRuntime = c.expect.filter((x) => x.runtime);
    const made = diff(expected, got).filter((d) => !items.some((it) => d.startsWith(`${it.name}|`)));
    const runtimeRight = made.length === wantRuntime.length
      && wantRuntime.every((e) => made.some((d) => new RegExp(e.runtime!, 'i').test(d.split('|')[0]) && d.split('|')[1] === e.where));
    const catalogOff = diff(expected, got).filter((d) => items.some((it) => d.startsWith(`${it.name}|`)));
    return { kind: 'base', arm, case: c.id, run, hit: catalogOff.length === 0 && runtimeRight, raw, note: [...catalogOff, ...(runtimeRight ? [] : made)].join('; ') };
  });
}

// A place or a holder in a description: a first-pass flag, hand-graded from the saved rows.
const PLACE = /\b(lying|lies|lay|resting|rests|tucked|sits|sitting|placed|left|beneath|under|atop|beside|next to|on the (desk|table|floor|ground|shelf|wall)|held by|holds|carried by|embedded|plunged|currently|weapons?,|in (his|her|their|your|the captain's) (hand|hands|grip|pocket|palm)|from the)\b/i;
if (want('describe')) {
  for (const d of fixture.describe) for (let run = 0; run < runs; run++) for (const arm of ['shipped', 'desc'] as Arm[]) jobs.push(async () => {
    const request = describeItemRequest({ runtimeItemId: d.id, name: d.name, turnId: 't', narration: d.narration });
    const raw = await send(arm === 'desc' ? OBJECT_DESCRIBE : PLACE_DESCRIBE, request.messages, request.maxTokens ?? 80, null, SEED + run);
    return { kind: 'describe', arm, case: d.id, run, hit: !PLACE.test(raw), raw, note: raw.replace(/\s+/g, ' ').slice(0, 160) };
  });
}

const started = Date.now();
console.log(`model ${model} · runs ${runs} · pool ${pool} · ${jobs.length} requests`);
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    try {
      const row = await job();
      results.push(row);
      console.log(`[${row.kind}:${row.arm}] ${row.case} #${row.run} ${row.hit ? 1 : 0}${row.note ? ` · ${row.note}` : ''}`);
    } catch (error) {
      console.log(`FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
const rate = (xs: Row[]) => `${xs.filter((r) => r.hit).length}/${xs.length}`;
const of = (kind: Row['kind'], arm: string, id?: string) => results.filter((r) => r.kind === kind && r.arm === arm && (!id || r.case === id));
const section = (kind: Row['kind'], title: string, ids: string[], arms: string[]) => {
  if (!results.some((r) => r.kind === kind)) return;
  console.log(`\n${title}`);
  for (const id of ids) console.log(`  ${id.padEnd(16)} ${arms.map((arm) => `${arm} ${rate(of(kind, arm, id))}`).join(' · ')}`);
  console.log(`  ${'all'.padEnd(16)} ${arms.map((arm) => `${arm} ${rate(of(kind, arm))}`).join(' · ')}`);
};
section('synthetic', 'SYNTHETIC (hit = right net state; guards must add the copy)', fixture.cases.map((c) => c.id), ARMS);
section('replay', 'REPLAY (hit = no re-gain of a carried item)', fixture.replays.map((r) => r.id), ARMS);
section('base', 'BASE (hit = expected rows, nothing else moved)', base.cases.map((c) => c.id), ['shipped', 'line']);
section('describe', 'DESCRIBE (hit = no place or holder, regex first pass)', fixture.describe.map((d) => d.id), ['shipped', 'desc']);
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
