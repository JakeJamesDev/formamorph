// Inventory target probe — does the Inventory pass spend the right item when the story uses one item on another,
// and name the other item as the use's target? Sedge Landing at the dock: the player carries lamp oil, a hooded
// lantern, a whetstone, a gutting knife, an iron key and a healing draught; an iron-bound chest lies on the dock.
//
// Arms, paired by run index: `old` (the use line and schema before `target`) and `new` (the shipped prompt and
// schema). Each reply goes through the real parser and `applyInventoryPass`. Per case:
//   spent  — exactly the expected item was used, once, and nothing else moved
//   target — the used event names the expected other item (none for the controls)
// `light` and `drink` use one item alone: the controls, which must not gain a target or lose their use.
//
// Usage: npx vite-node testing/baseline/harness/inventory-target-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 8] [--pool 4] [--show]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultInventoryPrompt, defaultInventoryUserPrompt } from '@/components/game/GamePrompts';
import { responseFormat, type ResponseSchema } from '@/lib/aiRequest/responseSchema';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { applyInventoryPass, parseInventoryReply } from '@/lib/inventory';
import { resolveEntityText } from '@/lib/placeholders';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { inventoryRequest } from '@/lib/turnPipeline/turnPasses';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Entity, Item, ItemCopy } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '8'));
const pool = Number(argVal('--pool', '4'));
const SEED = 919191;

const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const items: Item[] = [
  item('oil', 'Lamp Oil', { uses: 1 }),
  item('lantern', 'Hooded Lantern', { uses: 3, whenEmpty: { kind: 'stays' }, stackable: false }),
  item('whetstone', 'Whetstone', { uses: 5, whenEmpty: { kind: 'stays' } }),
  item('knife', 'Gutting Knife', { stackable: false }),
  item('key', 'Iron Key', { uses: 1, whenEmpty: { kind: 'stays' } }),
  item('chest', 'Iron-Bound Chest', { stackable: false }),
  item('draught', 'Healing Draught', { uses: 1 }),
];
const start: ItemCopy[] = [
  ['oil', 'you'], ['lantern', 'you'], ['whetstone', 'you'], ['knife', 'you'], ['key', 'you'], ['draught', 'you'], ['chest', 'loc-sedge'],
].map(([itemId, where], i) => ({
  id: `c${i}`, item: { kind: 'item', itemId }, quantity: 1, visibility: 'visible',
  where: where === 'you' ? { kind: 'you' } : { kind: 'location', id: where },
}));

type Case = { id: string; action: string; narration: string; spent: string; target: string | null };
const cases: Case[] = [
  { id: 'oil', action: 'I pour the lamp oil into my lantern.', spent: 'oil', target: 'lantern',
    narration: 'You unstop the flask and tip the lamp oil into the lantern\'s well until it runs to the brim. The empty flask goes back in your pack. Odette wrinkles her nose at the smell.' },
  { id: 'whetstone', action: 'I sharpen my gutting knife on the whetstone.', spent: 'whetstone', target: 'knife',
    narration: 'You spit on the whetstone and draw the gutting knife along it in long, even strokes. The edge comes up bright. Odette nods once, as if you passed a test.' },
  { id: 'key', action: 'I unlock the chest with the iron key.', spent: 'key', target: 'chest',
    narration: 'The iron key grinds in the iron-bound chest\'s lock, then turns with a clack. The lid rises an inch on its own. The key stays in your hand.' },
  { id: 'light', action: 'I light my lantern.', spent: 'lantern', target: null,
    narration: 'You strike a light and touch it to the lantern\'s wick. The flame catches and steadies behind the glass, throwing a warm circle across the wet planks.' },
  { id: 'drink', action: 'I drink the healing draught.', spent: 'draught', target: null,
    narration: 'You pull the cork and drink the healing draught in two swallows. Warmth spreads from your belly to your fingertips, and the ache in your side fades.' },
];

const world = migrateWorld(JSON.parse(readFileSync(path.resolve('testing/baseline/sedge-landing.json'), 'utf8')));
const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const baseScene = authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});
const ctx = chipValues({ ...baseScene, items, itemCopies: start });
const owners = baseScene.presentIds.flatMap((id) => {
  const entity = world.entities.find((e) => e.id === id);
  return entity ? [{ id, name: entity.name }] : [];
});

// The `old` arm: the shipped prompt with the use line and the target field taken back out.
const NEW_USE = 'spends a charge of it, or pours, applies or loads it into another item. The item is the one spent; the other item is the target.';
const NEW_TARGET = /\n- target: [^\n]*/;
if (!defaultInventoryPrompt.includes(NEW_USE) || !NEW_TARGET.test(defaultInventoryPrompt)) throw new Error('The shipped prompt no longer holds the lines the old arm removes.');
const oldPrompt = defaultInventoryPrompt.replace(NEW_USE, 'or spends a charge of it.').replace(NEW_TARGET, '');
const withoutTarget = (schema: ResponseSchema): ResponseSchema => JSON.parse(JSON.stringify(schema), (key, value) =>
  (key === 'properties' && value && typeof value === 'object' && 'target' in value ? (({ target: _t, ...rest }) => rest)(value) : value));

type Arm = 'old' | 'new';
const requestOf = (arm: Arm, c: Case) => {
  const built = inventoryRequest(
    { system: arm === 'old' ? oldPrompt : defaultInventoryPrompt, user: defaultInventoryUserPrompt },
    { ctx, action: c.action, narration: c.narration }, { textPass: false, quiet: false },
  );
  return arm === 'old' && built.responseSchema ? { ...built, responseSchema: withoutTarget(built.responseSchema) } : built;
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

const itemIdOf = (copy: ItemCopy | undefined) => (copy?.item.kind === 'item' ? copy.item.itemId : undefined);
const rows = (copies: readonly ItemCopy[]) => copies.map((c) => JSON.stringify([c.id, c.where, c.quantity, c.state ?? null])).sort();

function score(c: Case, raw: string) {
  const result = applyInventoryPass(start, parseInventoryReply(raw), {
    items, runtimeItems: [], playerNames: ['Traveler'], owners, location: { id: location!.id, name: location!.name },
  }, { world: { items }, newId: (() => { let i = 0; return () => `n${i++}`; })() });
  const used = result.events.filter((e) => e.timing === 'used');
  const spentIds = used.map((e) => e.itemId);
  // Only the spent item's copy may change; a use leaves every other row as it was.
  const spentCopy = start.find((s) => itemIdOf(s) === c.spent)!.id;
  const others = (copies: readonly ItemCopy[]) => rows(copies.filter((x) => x.id !== spentCopy));
  const spent = spentIds.length === 1 && spentIds[0] === c.spent && JSON.stringify(others(result.copies)) === JSON.stringify(others(start));
  const target = used.length === 1 && (itemIdOf(used[0].target) ?? null) === c.target;
  return { spent, target, note: `used ${spentIds.join(',') || '-'} → ${used.map((e) => itemIdOf(e.target) ?? '-').join(',') || '-'}` };
}

type Row = { arm: Arm; case: string; run: number; spent: boolean; target: boolean; raw: string; note: string };
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => (['old', 'new'] as Arm[]).map((arm) => async (): Promise<Row> => {
  const raw = await send(requestOf(arm, c), SEED + run);
  return { arm, case: c.id, run, raw, ...score(c, raw) };
}))).flat();

console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool} · ${jobs.length} requests`);
const results: Row[] = [];
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const row = await jobs[next++]();
    results.push(row);
    console.log(`[${row.arm}] ${row.case} #${row.run} spent ${row.spent ? 1 : 0} target ${row.target ? 1 : 0} · ${row.note}`);
    if (args.includes('--show')) console.log(`    ${row.raw.replace(/\n+/g, ' ¶ ')}`);
  }
}));

const rate = (list: Row[], key: 'spent' | 'target') => `${list.filter((r) => r[key]).length}/${list.length}`;
console.log('\n| Case | old spent | new spent | old target | new target |\n|---|---|---|---|---|');
for (const c of [...cases.map((x) => x.id), 'all']) {
  const of = (arm: Arm) => results.filter((r) => r.arm === arm && (c === 'all' || r.case === c));
  console.log(`| ${c} | ${rate(of('old'), 'spent')} | ${rate(of('new'), 'spent')} | ${rate(of('old'), 'target')} | ${rate(of('new'), 'target')} |`);
}
