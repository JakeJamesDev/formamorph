// Inventory told probe: does the Inventory pass repeat a panel action the player already took (Action List Q7)?
// Sedge Landing at the dock, from the inventory-pass fixture, after the panel action ran: the state already holds
// it, and the narration describes it.
//
// Each reply to the shipped request is scored twice through the real parser and `applyInventoryPass`: `rule off`
// (no told entries in the scene) and `rule on` (the shipped guard, Q50). A case is right when every row of the
// items it names ends as expected and no other item moved.
//   potion-empty  the player drank a draught from the panel and sent an empty box: a use is a double consume
//   potion-typed  the same, with the drink also typed in the box
//   give          the player gave Odette a draught from the panel: a transfer is a double give
//   second        positive control: a panel drink, then a typed second one. The second use must still land.
//   second-both   the same, with the narration showing both drinks
//
// Usage: npx vite-node testing/baseline/harness/inventory-told-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 12] [--pool 4] [--only <case>] [--show]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultInventoryPrompt, defaultInventoryUserPrompt } from '@/components/game/GamePrompts';
import type { ToldAction } from '@/lib/actionList';
import { responseFormat } from '@/lib/aiRequest/responseSchema';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { applyInventoryPass, parseInventoryReply } from '@/lib/inventory';
import { resolveEntityText } from '@/lib/placeholders';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { inventoryRequest } from '@/lib/turnPipeline/turnPasses';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Entity, Item, ItemCopy, ItemCopyWhere, Slot } from '@/types';

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
const SEED = 313131;

type CopySpec = { item: string; where: string; equipped?: boolean; quantity?: number; hidden?: boolean };
type Expect = { item: string; where: string; quantity?: number };
type Case = { id: string; action: string; narration: string; told: ToldAction[]; held: Record<string, CopySpec[]>; expect: Expect[] };

const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'inventory-pass-cases.json'), 'utf8')) as {
  items: Omit<Item, 'statEffects' | 'traitEffects' | 'equipRequires'>[];
  slots: Slot[];
  copies: CopySpec[];
};
const items: Item[] = fixture.items.map((item) => ({ ...item, statEffects: [], traitEffects: [], equipRequires: [] }));
const whereOf = (where: string): ItemCopyWhere => (
  where === 'you' ? { kind: 'you' } : where.startsWith('loc-') ? { kind: 'location', id: where } : { kind: 'entity', id: where }
);

const draught = { key: 'item:draught', name: 'Healing Draught' };
const drank: ToldAction = { facts: { kind: 'use', item: draught, copyId: 'c4' }, count: 1 };
const DRINK = 'You pull the stopper from one of your healing draughts and drink it down. It is bitter and green on the tongue, and warmth spreads through your chest until the ache in your legs fades.';
const CASES: Case[] = [
  {
    id: 'potion-empty', action: '', narration: DRINK, told: [drank],
    held: { draught: [{ item: 'draught', where: 'you', quantity: 1 }] }, expect: [{ item: 'draught', where: 'you', quantity: 1 }],
  },
  {
    id: 'potion-typed', action: 'I drink one of my healing draughts.', narration: DRINK, told: [drank],
    held: { draught: [{ item: 'draught', where: 'you', quantity: 1 }] }, expect: [{ item: 'draught', where: 'you', quantity: 1 }],
  },
  {
    id: 'give', action: '',
    narration: 'You hold out one of your healing draughts. Odette takes the vial, turns it against the lantern light, and tucks it into her apron. "That will keep the ferryman sweet," she says.',
    told: [{ facts: { kind: 'give', item: draught, quantity: 1, to: { id: 'ent-odette', name: 'Odette' } }, count: 1 }],
    held: { draught: [{ item: 'draught', where: 'you', quantity: 1 }, { item: 'draught', where: 'ent-odette', quantity: 1 }] },
    expect: [{ item: 'draught', where: 'you', quantity: 1 }, { item: 'draught', where: 'ent-odette', quantity: 1 }],
  },
  {
    id: 'second', action: 'I drink my other healing draught too.',
    narration: 'The first draught has barely settled when you uncork your last one and drink that down as well. The bitterness lingers, and the warmth deepens into a slow, steady heat.',
    told: [drank],
    held: { draught: [{ item: 'draught', where: 'you', quantity: 1 }] }, expect: [],
  },
  {
    id: 'second-both', action: 'I drink my other healing draught too.',
    narration: 'You drink one healing draught, then uncork your last one and drink that down as well. The bitterness lingers, and the warmth deepens into a slow, steady heat.',
    told: [drank],
    held: { draught: [{ item: 'draught', where: 'you', quantity: 1 }] }, expect: [],
  },
].filter((c) => !only || c.id === only);

const startOf = (c: Case): ItemCopy[] => [
  ...fixture.copies.filter((spec) => !c.held[spec.item]),
  ...Object.values(c.held).flat(),
].map((spec, i) => ({
  id: `c${i}`, item: { kind: 'item', itemId: spec.item }, where: whereOf(spec.where), quantity: spec.quantity ?? 1,
  visibility: spec.hidden ? 'hidden' : 'visible',
  ...(spec.equipped && { equipped: { slotId: items.find((it) => it.id === spec.item)?.slotRule?.slotIds[0] ?? 'hand', order: i } }),
}));

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
const pin = PROMPT_SAMPLER_PINS.inventory;

async function send(c: Case, seed: number): Promise<string> {
  const request = inventoryRequest(
    { system: defaultInventoryPrompt, user: defaultInventoryUserPrompt },
    { ctx: chipValues({ ...baseScene, items, itemCopies: startOf(c) }), action: c.action, narration: c.narration },
    { textPass: false, quiet: false },
  );
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: request.maxTokens ?? 400, reasoning_effort: 'none', stream: false,
        temperature: pin?.temperature, ...(pin?.repetitionPenalty !== undefined && { repetition_penalty: pin.repetitionPenalty }),
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

const rowsOf = (copies: readonly ItemCopy[], itemId: string) => copies
  .filter((copy) => copy.item.kind === 'item' && copy.item.itemId === itemId)
  .map((copy) => JSON.stringify([copy.where, copy.quantity])).sort();

/** Whether the reply, applied with or without the guard, leaves exactly the expected rows. */
function right(c: Case, raw: string, rule: boolean): boolean {
  const start = startOf(c);
  const result = applyInventoryPass(start, parseInventoryReply(raw), {
    items, runtimeItems: [], playerNames: ['Traveler'], owners, location: { id: location!.id, name: location!.name },
    ...(rule && { told: c.told }),
  }, { world: { items, slots: fixture.slots }, newId: (() => { let i = 0; return () => `n${i++}`; })() });
  const named = new Set([...c.expect.map((e) => e.item), ...Object.keys(c.held)]);
  const others = items.every((item) => named.has(item.id) || JSON.stringify(rowsOf(result.copies, item.id)) === JSON.stringify(rowsOf(start, item.id)));
  return others && [...named].every((id) => JSON.stringify(rowsOf(result.copies, id))
    === JSON.stringify(c.expect.filter((e) => e.item === id).map((e) => JSON.stringify([whereOf(e.where), e.quantity ?? 1])).sort()));
}

type Row = { case: string; run: number; off: boolean; on: boolean };
const results: Row[] = [];
const jobs = CASES.flatMap((c) => Array.from({ length: runs }, (_, run) => async () => {
  const raw = await send(c, SEED + run);
  const row = { case: c.id, run, off: right(c, raw, false), on: right(c, raw, true) };
  if (args.includes('--show')) console.log(`    ${raw.replace(/\n+/g, ' ¶ ')}`);
  return row;
}));

const started = Date.now();
console.log(`model ${model} · runs ${runs} per case · pool ${pool} · ${jobs.length} requests`);
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    try {
      const row = await job();
      results.push(row);
      console.log(`${row.case} #${row.run} rule off ${row.off ? 1 : 0} · rule on ${row.on ? 1 : 0}`);
    } catch (error) {
      console.log(`FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
    }
  }
}));

const rate = (rows: Row[], key: 'off' | 'on') => `${rows.filter((r) => r[key]).length}/${rows.length}`;
console.log('\nRIGHT (expected rows, nothing else moved)   rule off · rule on');
for (const c of CASES) {
  const rows = results.filter((r) => r.case === c.id);
  console.log(`  ${c.id.padEnd(13)} ${rate(rows, 'off').padStart(6)} · ${rate(rows, 'on')}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
