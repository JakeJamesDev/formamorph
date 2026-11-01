// Inventory slots probe — does the Inventory pass stop proposing an equip into a slot the owner lacks, and still
// equip where the owner has the slot? Sedge Landing at the dock, with a Humanoid Body (Head, Hand ×2) as the
// Default and a Wolf Body (Collar). Cases in `inventory-slots-cases.json`:
//   slotless-held  — Odette under None puts on a helm she carries: an equip is wrong
//   slotless-given — Odette under None is handed the helm and puts it on (the Q52 same-turn edge): an equip is wrong
//   normal         — the player on the Default puts on a carried helm: the equip is right and lands
//   transformed    — the player on the Wolf Body pushes into the helm: an equip is wrong
//
//   transformed-odette — the same scene with Odette on the Wolf Body
//
// Arms, paired by run index on the shipped schema request:
//   control — Items Here as before Bodies reached the prompt (no slots), and the equip line without its slot clause
//   slots   — Items Here with each owner's slots and each item's slot, the equip line without its slot clause
//   clause  — the shipped request: slots, and the equip line with its slot clause (Q53)
//
// Usage: npx vite-node testing/baseline/harness/inventory-slots-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 8] [--pool 4] [--only <case>] [--out results.json] [--show] [--dump]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultInventoryPrompt, defaultInventoryUserPrompt } from '@/components/game/GamePrompts';
import { responseFormat } from '@/lib/aiRequest/responseSchema';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import type { SceneEquipment } from '@/lib/chipValues/chipScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { applyInventoryPass, itemNameKey, parseInventoryReply } from '@/lib/inventory';
import { resolveEntityText } from '@/lib/placeholders';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { inventoryRequest } from '@/lib/turnPipeline/turnPasses';
import { migrateWorld } from '@/lib/version';
import type { Body, ChatMessage, Entity, InventoryPassOp, Item, ItemCopy, ItemCopyWhere, Slot } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '8'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const SEED = 707070;

const CLAUSE = ", when that owner's slots include the slot shown after the item's name";
if (!defaultInventoryPrompt.includes(CLAUSE)) throw new Error('The equip line no longer carries the slot clause this probe ablates.');
const PROMPTS = { clause: defaultInventoryPrompt, bare: defaultInventoryPrompt.replace(CLAUSE, '') };

type CopySpec = { item: string; where: string; equipped?: boolean; quantity?: number };
type Case = {
  id: string; picks: Record<string, string>; copies: CopySpec[]; action: string; narration: string;
  owner: string; item: string; want: 'equip' | 'no-equip';
};
const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'inventory-slots-cases.json'), 'utf8')) as {
  items: Omit<Item, 'statEffects' | 'traitEffects' | 'equipRequires'>[]; slots: Slot[]; bodies: Body[]; cases: Case[];
};
const items: Item[] = fixture.items.map((item) => ({ ...item, statEffects: [], traitEffects: [], equipRequires: [] }));
const whereOf = (where: string): ItemCopyWhere => (
  where === 'you' ? { kind: 'you' } : where.startsWith('loc-') ? { kind: 'location', id: where } : { kind: 'entity', id: where }
);
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

/** The case's Body slice: the player reads a stand-in Custom Persona entity's pick. */
const equipmentOf = (c: Case): SceneEquipment => ({
  world: {
    bodies: fixture.bodies, slots: fixture.slots,
    entities: [
      { id: 'probe-persona', customPersona: true, ...(c.picks.you && { body: { kind: 'body' as const, id: c.picks.you } }) },
      ...Object.entries(c.picks).filter(([id]) => id !== 'you')
        .map(([id, pick]) => ({ id, body: pick === 'none' ? { kind: 'none' as const } : { kind: 'body' as const, id: pick } })),
    ],
  },
});
const startOf = (c: Case): ItemCopy[] => c.copies.map((spec, i) => ({
  id: `c${i}`, item: { kind: 'item', itemId: spec.item }, where: whereOf(spec.where), quantity: spec.quantity ?? 1, visibility: 'visible',
  ...(spec.equipped && { equipped: { slotId: items.find((it) => it.id === spec.item)?.slotRule?.slotIds[0] ?? 'hand', order: i } }),
}));

type Arm = 'control' | 'slots' | 'clause';
const ARMS: Arm[] = ['control', 'slots', 'clause'];
const requestOf = (arm: Arm, c: Case) => {
  const scene = { ...baseScene, items, itemCopies: startOf(c), ...(arm !== 'control' && { equipment: equipmentOf(c) }) };
  return inventoryRequest(
    { system: arm === 'clause' ? PROMPTS.clause : PROMPTS.bare, user: defaultInventoryUserPrompt },
    { ctx: chipValues(scene), action: c.action, narration: c.narration }, { textPass: false, quiet: false },
  );
};

const pins = {
  temperature: PROMPT_SAMPLER_PINS.inventory?.temperature,
  ...(PROMPT_SAMPLER_PINS.inventory?.repetitionPenalty !== undefined && { repetition_penalty: PROMPT_SAMPLER_PINS.inventory?.repetitionPenalty }),
};
async function send(request: ReturnType<typeof requestOf>, seed: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: request.maxTokens ?? 400, reasoning_effort: 'none', stream: false, ...pins,
        ...(request.responseSchema && { response_format: responseFormat(request.responseSchema) }),
        messages: [{ role: 'system', content: request.systemPrompt }, ...request.messages] as ChatMessage[],
      }),
    });
    if (res.ok) {
      const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      return body.choices[0].message.content ?? '';
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}

const PLAYER = new Set(['you', 'i', 'me', 'player', 'traveler']);
const itemName = (c: Case) => itemNameKey(items.find((it) => it.id === c.item)!.name);
const ownerName = (c: Case) => (c.owner === 'you' ? 'you' : itemNameKey(world.entities.find((e) => e.id === c.owner)!.name));
/** Whether an op equips the case's item on the case's owner. */
const equipsIt = (c: Case, op: InventoryPassOp) => op.op === 'equip' && itemNameKey(op.item).startsWith(itemName(c))
  && (c.owner === 'you' ? PLAYER.has(itemNameKey(op.owner).replace(/^the\s+/, '')) : itemNameKey(op.owner) === ownerName(c));

/** Right: no equip of the item on a slotless owner; or, for `equip`, an equip that the validator lands. */
function score(c: Case, raw: string): { hit: boolean; proposed: boolean; landed: boolean; ops: number } {
  const ops = parseInventoryReply(raw);
  const proposed = ops.some((op) => equipsIt(c, op));
  const start = startOf(c);
  const result = applyInventoryPass(start, ops, {
    items, runtimeItems: [], playerNames: ['Traveler'], owners, location: { id: location!.id, name: location!.name },
  }, { world: { items, ...equipmentOf(c).world }, newId: (() => { let i = 0; return () => `n${i++}`; })() });
  const landed = result.copies.some((copy) => copy.item.kind === 'item' && copy.item.itemId === c.item && !!copy.equipped
    && JSON.stringify(copy.where) === JSON.stringify(whereOf(c.owner)));
  return { hit: c.want === 'equip' ? proposed && landed : !proposed, proposed, landed, ops: ops.length };
}

type Row = { arm: Arm; case: string; run: number; hit: boolean; proposed: boolean; raw: string };
const results: Row[] = [];
const cases = fixture.cases.filter((c) => !only || c.id === only);
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((arm) => async () => {
  const raw = await send(requestOf(arm, c), SEED + run);
  const s = score(c, raw);
  console.log(`[${arm}] ${c.id} #${run} ${s.hit ? 1 : 0} · ops ${s.ops} · equip proposed ${s.proposed ? 1 : 0} landed ${s.landed ? 1 : 0}`);
  if (args.includes('--show')) console.log(`    ${raw.replace(/\n+/g, ' ¶ ')}`);
  return { arm, case: c.id, run, hit: s.hit, proposed: s.proposed, raw };
})).flat());

if (args.includes('--dump')) {
  for (const arm of ARMS) console.log(`\n===== ${arm} · ${cases[0].id}\n${requestOf(arm, cases[0]).systemPrompt}`);
  process.exit(0);
}

const started = Date.now();
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool} · ${jobs.length} requests`);
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    try {
      results.push(await job());
    } catch (error) {
      console.log(`FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
const rate = (xs: Row[], key: 'hit' | 'proposed') => `${xs.filter((r) => r[key]).length}/${xs.length}`;
const of = (arm: Arm, id: string) => results.filter((r) => r.arm === arm && r.case === id);
console.log('\nRIGHT (no-equip cases: no equip proposed · normal: equip proposed and landed) — and equip proposed');
for (const c of cases) {
  console.log(`  ${c.id.padEnd(15)} ${c.want === 'equip' ? '↑' : '↓'}  ${ARMS.map((arm) => `${arm} ${rate(of(arm, c.id), 'hit')} (eq ${rate(of(arm, c.id), 'proposed')})`).join(' · ')}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
