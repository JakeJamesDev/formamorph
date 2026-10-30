// Inventory re-gain probe — does the Inventory pass keep carried items right: no second copy of one already held,
// no lost item for one that only changed, and the right result for a use or a reveal?
// Two arms, paired by run index:
//   shipped — the pass prompt and schema before `use`, `change` and identify-`reveal` (frozen in the fixture as
//             `shippedPrompt`); its `consume` replies run as `use`
//   new     — the current prompt and schema
//
// Cases (fixture `group`):
//   state    — an item changes without leaving (unseal, open a box, light the lantern, soaked cloak). A hit keeps the
//              item with its owner and moves nothing else (Q49); the State-set rate is reported beside it.
//   control  — rereading an already-open letter: nothing changes.
//   retouch  — the item is shown or handled: nothing changes.
//   use      — drink (Becomes a bottle), blow a horn (unlimited), read a single-use writ (Changes State).
//   reveal   — a carried unidentified ring's true nature becomes known: the copy is identified.
//   regain   — `take-another` and `second-eel` must still add the copy the player takes again.
//   useGuard — burning the writ and shattering a draught: the item is gone and no After Use dose fires.
//   replay   — frozen requests from real play turns that duplicated a carried item, with the arm's operation list
//              in place of theirs. A hit is a reply with no gain or transfer to the player of an item already carried.
//   base     — the nine cases of inventory-pass-cases.json.
//   describe — `--describe` only: the place and the object-only describe prompt on the passages that made the
//              runtime items. A hit is a description that names no place or holder (regex first pass; hand-grade).
//
// Usage: npx vite-node testing/baseline/harness/inventory-regain-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 12] [--pool 4] [--only synthetic|replay|base|describe] [--cases id,id] [--prompt file] [--out f.json]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultInventoryPrompt, defaultInventoryUserPrompt } from '@/components/game/GamePrompts';
import { responseFormat, type ResponseSchema } from '@/lib/aiRequest/responseSchema';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { applyInventoryPass, inventoryPassSchema, parseInventoryReply } from '@/lib/inventory';
import { describeItemRequest } from '@/lib/inventory/describe';
import { copyState, isUnidentified } from '@/lib/items';
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

const PLACE_DESCRIBE = 'You describe one item from an interactive story. Reply with one short sentence that says what the item is and what it looks like, from what the passage shows. Write only that sentence.';
const OBJECT_DESCRIBE = 'You describe one item from an interactive story. Reply with one short sentence that says what the item is, what it is made of and what it looks like, from what the passage shows. Describe the object itself, apart from where it lies and who holds it. Write only that sentence.';

type Arm = 'shipped' | 'new';
const ARMS: Arm[] = ['shipped', 'new'];

type Group = 'state' | 'control' | 'retouch' | 'use' | 'reveal' | 'regain' | 'useGuard';
type CopySpec = { item?: string; runtime?: string; where: string; equipped?: boolean; quantity?: number; hidden?: boolean; state?: string; unidentified?: boolean };
type BaseExpect = { item?: string; runtime?: string; where: string; quantity?: number; equipped?: boolean; visibility?: 'visible' | 'hidden' };
type BaseCase = { id: string; action: string; narration: string; expect: BaseExpect[] };
type SynthCase = {
  id: string; group: Group; copies: CopySpec[]; action: string; narration: string;
  /** Net rows for these names; `state` also requires that State on one of them. */
  expect: { name: string; where: string; quantity: number; state?: string }[];
  /** The item whose State-set rate a state case reports. */
  stateOf?: string;
  /** Item ids no After Use dose may fire for. */
  noDose?: string[];
};
type Replay = { id: string; system: string; user: string; held: string[]; objectOnly: [string, string][] };
type DescribeCase = { id: string; name: string; narration: string };
type FixtureItem = Omit<Item, 'statEffects' | 'traitEffects' | 'equipRequires'> & Partial<Pick<Item, 'statEffects'>>;

const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const base = JSON.parse(readFileSync(path.join(BASELINE, 'inventory-pass-cases.json'), 'utf8')) as {
  items: FixtureItem[]; slots: Slot[]; copies: CopySpec[]; cases: BaseCase[];
};
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'inventory-regain-cases.json'), 'utf8')) as {
  shippedPrompt: string; items: FixtureItem[]; replays: Replay[]; runtime: { id: string; name: string; object: string }[];
  cases: SynthCase[]; describe: DescribeCase[];
};
const items: Item[] = [...base.items, ...fixture.items].map((item) => ({ statEffects: [], ...item, traitEffects: [], equipRequires: [] }));
const runtimeItems: RuntimeItem[] = fixture.runtime.map((r) => ({ id: r.id, name: r.name, description: r.object }));
const whereOf = (where: string): ItemCopyWhere => (
  where === 'you' ? { kind: 'you' } : where.startsWith('loc-') ? { kind: 'location', id: where } : { kind: 'entity', id: where }
);
const copiesOf = (specs: CopySpec[], offset: number): ItemCopy[] => specs.map((spec, i) => ({
  id: `c${offset + i}`,
  item: spec.runtime ? { kind: 'runtime', runtimeItemId: spec.runtime } : { kind: 'item', itemId: spec.item! },
  where: whereOf(spec.where), quantity: spec.quantity ?? 1, visibility: spec.hidden ? 'hidden' : 'visible',
  ...(spec.equipped && { equipped: { slotId: items.find((it) => it.id === spec.item)?.slotId ?? 'hand', order: i } }),
  ...((spec.state || spec.unidentified) && { state: { ...(spec.state && { state: spec.state }), ...(spec.unidentified && { unidentified: true }) } }),
}));

// The arm's prompt from "## Operations" on: what replaces a replay's frozen operation list.
const OPS_HEADER = '## Operations';
// `--prompt <file>` swaps the new arm's prompt for a candidate wording.
const promptFile = argVal('--prompt', '');
const newPrompt = promptFile ? readFileSync(promptFile, 'utf8') : defaultInventoryPrompt;
const promptOf = (arm: Arm) => (arm === 'new' ? newPrompt : fixture.shippedPrompt);
const opsTail = (arm: Arm) => promptOf(arm).slice(promptOf(arm).indexOf(OPS_HEADER));

/** The schema before this ticket: `consume` in place of `use` and `change`, no `state` or `after`. */
const shippedSchema = (): ResponseSchema => {
  const schema = structuredClone(inventoryPassSchema());
  const row = (schema.schema as { properties: { operations: { items: { required: string[]; properties: Record<string, unknown> } } } })
    .properties.operations.items;
  row.required = ['op', 'item', 'quantity', 'owner', 'to'];
  row.properties = {
    ...Object.fromEntries(Object.entries(row.properties).filter(([key]) => key !== 'state' && key !== 'after')),
    op: { type: 'string', enum: ['gain', 'lose', 'transfer', 'equip', 'unequip', 'consume', 'reveal'] },
  };
  return schema;
};
const schemaOf = (arm: Arm) => (arm === 'new' ? inventoryPassSchema() : shippedSchema());
/** The shipped app ran its `consume` as a use. */
const shim = (arm: Arm, raw: string) => (arm === 'shipped' ? raw.replace(/("op"\s*:\s*")consume"/g, '$1use"') : raw);

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

async function send(systemPrompt: string, messages: ChatMessage[], maxTokens: number, schema: ResponseSchema | null, seed: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: maxTokens, reasoning_effort: 'none', stream: false, ...pins,
        ...(schema ? { response_format: responseFormat(schema) } : {}),
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

/** The pass over one start state under `arm`: the request, then the reply applied through the real validator. */
function passRun(start: ItemCopy[], c: { action: string; narration: string }, arm: Arm) {
  const ctx = chipValues({ ...baseScene, items, itemCopies: start, runtimeItems });
  const request = inventoryRequest(
    { system: promptOf(arm), user: defaultInventoryUserPrompt }, { ctx, action: c.action, narration: c.narration }, { textPass: false, quiet: false },
  );
  const apply = (raw: string) => applyInventoryPass(start, parseInventoryReply(shim(arm, raw)), {
    items, runtimeItems, playerNames: ['Traveler'], owners, location: { id: location!.id, name: location!.name },
  }, { world: { items, slots: base.slots }, newId: (() => { let i = 0; return () => `n${i++}`; })() });
  return { request: { ...request, responseSchema: schemaOf(arm) }, apply };
}

const nameOf = (copy: ItemCopy, runtime: readonly RuntimeItem[]) => (copy.item.kind === 'item'
  ? items.find((it) => it.id === (copy.item as { itemId: string }).itemId)?.name ?? '?'
  : runtime.find((r) => r.id === (copy.item as { runtimeItemId: string }).runtimeItemId)?.name ?? '?');
const whereKey = (w: ItemCopyWhere) => (w.kind === 'you' ? 'you' : w.id);
/** Quantity per item name, owner, equipped, visibility and identity: the net state a turn leaves. */
function tally(copies: readonly ItemCopy[], runtime: readonly RuntimeItem[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const copy of copies) {
    const key = `${nameOf(copy, runtime)}|${whereKey(copy.where)}|${copy.equipped ? 'eq' : ''}|${copy.visibility}${isUnidentified(copy) ? '|u' : ''}`;
    out.set(key, (out.get(key) ?? 0) + copy.quantity);
  }
  return out;
}
const diff = (a: Map<string, number>, b: Map<string, number>) => [...new Set([...a.keys(), ...b.keys()])]
  .filter((k) => (a.get(k) ?? 0) !== (b.get(k) ?? 0)).map((k) => `${k} ${a.get(k) ?? 0}→${b.get(k) ?? 0}`);
const stateKey = (copy: ItemCopy) => (copyState(copy) ?? '').toLowerCase();

type Row = {
  kind: 'synthetic' | 'replay' | 'base' | 'describe'; arm: string; case: string; group?: Group; run: number;
  hit: boolean; stateSet?: boolean; raw: string; note: string;
};
const results: Row[] = [];
type Job = () => Promise<Row>;
const jobs: Job[] = [];
const want = (kind: string) => (only ? only === kind : kind !== 'describe' || args.includes('--describe'));

const caseFilter = argVal('--cases', '').split(',').filter(Boolean);
if (want('synthetic')) {
  for (const c of fixture.cases.filter((x) => !caseFilter.length || caseFilter.includes(x.id))) for (let run = 0; run < runs; run++) for (const arm of ARMS) jobs.push(async () => {
    const start = [...copiesOf(base.copies, 0), ...copiesOf(c.copies, 100)];
    const { request, apply } = passRun(start, c, arm);
    const raw = await send(request.systemPrompt, request.messages, request.maxTokens ?? 400, request.responseSchema, SEED + run);
    const result = apply(raw);
    const expected = tally(start, runtimeItems);
    for (const e of c.expect) {
      for (const k of [...expected.keys()]) if (k.startsWith(`${e.name}|${e.where}|`)) expected.delete(k);
      if (e.quantity > 0) expected.set(`${e.name}|${e.where}||visible`, e.quantity);
    }
    const off = diff(expected, tally(result.copies, runtimeItems));
    const atYou = (copies: readonly ItemCopy[], name: string) => copies.filter((x) => nameOf(x, runtimeItems) === name && x.where.kind === 'you');
    const stateMiss = c.expect.filter((e) => e.state && !atYou(result.copies, e.name).some((x) => stateKey(x) === e.state!.toLowerCase()))
      .map((e) => `${e.name} not ${e.state}`);
    const doseMiss = result.doses.filter((d) => c.noDose?.includes(d.itemId)).map((d) => `dose ${d.itemId}`);
    // A regain guard asks only whether the player gained the copy; the giver's side shows in the note.
    const netRight = c.group === 'regain' ? !off.some((d) => d.includes('|you|')) : off.length === 0;
    const hit = netRight && !stateMiss.length && !doseMiss.length;
    const before = new Set(c.stateOf ? atYou(start, c.stateOf).map(stateKey) : []);
    const stateSet = c.stateOf ? atYou(result.copies, c.stateOf).some((x) => !!stateKey(x) && !before.has(stateKey(x))) : undefined;
    const states = c.stateOf ? atYou(result.copies, c.stateOf).map((x) => copyState(x) ?? '-').join(',') : '';
    return {
      kind: 'synthetic', arm, case: c.id, group: c.group, run, hit, stateSet, raw,
      note: [...off, ...stateMiss, ...doseMiss, ...(states ? [`state ${states}`] : [])].join('; '),
    };
  });
}

if (want('replay')) {
  for (const r of fixture.replays.filter((x) => !caseFilter.length || caseFilter.includes(x.id))) for (let run = 0; run < runs; run++) for (const arm of ARMS) jobs.push(async () => {
    let system = r.system;
    for (const [from, to] of r.objectOnly) system = system.split(from).join(to);
    const at = system.indexOf(OPS_HEADER);
    if (at < 0) throw new Error(`replay ${r.id} has no operation list`);
    system = system.slice(0, at) + opsTail(arm);
    const raw = await send(system, [{ role: 'user', content: r.user }], 400, schemaOf(arm), SEED + run);
    const held = r.held.map((h) => h.toLowerCase());
    const dups = parseInventoryReply(shim(arm, raw)).filter((op) => (op.op === 'gain' || op.op === 'transfer')
      && /^(you|albus)$/i.test((op.to || '').trim()) && held.some((h) => op.item.toLowerCase().includes(h) || h.includes(op.item.toLowerCase())));
    return { kind: 'replay', arm, case: r.id, run, hit: dups.length === 0, raw, note: dups.map((op) => `${op.op} ${op.item}`).join('; ') };
  });
}

if (want('base')) {
  for (const c of base.cases.filter((x) => !caseFilter.length || caseFilter.includes(x.id))) for (let run = 0; run < runs; run++) for (const arm of ARMS) jobs.push(async () => {
    const start = copiesOf(base.copies, 0);
    const { request, apply } = passRun(start, c, arm);
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
  for (const d of fixture.describe) for (let run = 0; run < runs; run++) for (const arm of ['place', 'object']) jobs.push(async () => {
    const request = describeItemRequest({ runtimeItemId: d.id, name: d.name, turnId: 't', narration: d.narration });
    const raw = await send(arm === 'object' ? OBJECT_DESCRIBE : PLACE_DESCRIBE, request.messages, request.maxTokens ?? 80, null, SEED + run);
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
const count = (xs: Row[], pick: (r: Row) => boolean = (r) => r.hit) => xs.filter(pick).length;
const rate = (xs: Row[], pick?: (r: Row) => boolean) => `${count(xs, pick)}/${xs.length}`;
const of = (kind: Row['kind'], arm: string, id?: string) => results.filter((r) => r.kind === kind && r.arm === arm && (!id || r.case === id));
const section = (kind: Row['kind'], title: string, ids: string[], arms: string[]) => {
  if (!results.some((r) => r.kind === kind)) return;
  console.log(`\n${title}`);
  for (const id of ids) console.log(`  ${id.padEnd(16)} ${arms.map((arm) => `${arm} ${rate(of(kind, arm, id))}`).join(' · ')}`);
  console.log(`  ${'all'.padEnd(16)} ${arms.map((arm) => `${arm} ${rate(of(kind, arm))}`).join(' · ')}`);
};

/** Wilson 95% interval of k/n. */
const wilson = (k: number, n: number): [number, number] => {
  if (!n) return [0, 1];
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const mid = (p + z * z / (2 * n)) / d, half = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [mid - half, mid + half];
};
/** Newcombe's 95% interval of b's rate minus a's. */
const newcombe = (ka: number, na: number, kb: number, nb: number) => {
  const pa = ka / na, pb = kb / nb, [la, ua] = wilson(ka, na), [lb, ub] = wilson(kb, nb);
  return { d: pb - pa, lo: pb - pa - Math.sqrt((pb - lb) ** 2 + (ua - pa) ** 2), hi: pb - pa + Math.sqrt((ub - pb) ** 2 + (pa - la) ** 2) };
};
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}`;

if (results.some((r) => r.kind === 'synthetic')) {
  const GROUPS: Group[] = ['state', 'control', 'retouch', 'use', 'reveal', 'regain', 'useGuard'];
  console.log('\nSYNTHETIC (hit = right net state; regain guards must add the copy; use guards fire no dose)');
  for (const group of GROUPS) {
    const ids = fixture.cases.filter((c) => c.group === group && results.some((r) => r.case === c.id)).map((c) => c.id);
    if (!ids.length) continue;
    for (const id of ids) console.log(`  ${id.padEnd(16)} ${ARMS.map((arm) => `${arm} ${rate(of('synthetic', arm, id))}`).join(' · ')}`);
    const rows = (arm: Arm) => of('synthetic', arm).filter((r) => r.group === group);
    const [a, b] = [rows('shipped'), rows('new')];
    const ci = newcombe(count(a), a.length, count(b), b.length);
    console.log(`  ${`= ${group}`.padEnd(16)} shipped ${rate(a)} · new ${rate(b)} · new−shipped ${pct(ci.d)} pts, 95% CI [${pct(ci.lo)}, ${pct(ci.hi)}]`);
    if (group === 'state') console.log(`  ${'  State set'.padEnd(16)} shipped ${rate(a, (r) => !!r.stateSet)} · new ${rate(b, (r) => !!r.stateSet)}`);
  }
}
section('replay', 'REPLAY (hit = no re-gain of a carried item)', fixture.replays.map((r) => r.id), ARMS);
section('base', 'BASE (hit = expected rows, nothing else moved)', base.cases.map((c) => c.id), ARMS);
section('describe', 'DESCRIBE (hit = no place or holder, regex first pass)', fixture.describe.map((d) => d.id), ['place', 'object']);
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
