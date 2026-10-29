// Inventory pass probe — does the Inventory pass record what the narration did to items, and does the stat pass's
// item line stop it double-adding a potion? Sedge Landing at the dock: the player carries a lantern, a knife, a
// pouch, an oilskin cloak and two healing draughts; Odette wears a bone hook and holds smoked eel; an oar lies on
// the dock and a silver token lies hidden between the planks.
//
// Pass arms, paired by run index: `schema` (the shipped request with its JSON schema) and `text` (its text
// fallback, the line format). Each reply goes through the real parser and `applyInventoryPass`; a case is right
// when every row of the items it names ends as expected and no other item moved. `talk` and `look` change
// nothing: they are the false-positive guard.
//
// Stat arms (Q53), paired by run index: `none` (no item line) and `line` (the line naming the Healing Draught).
//   potion   — the player drinks a draught whose effect the game applies: a Vigor gain is a double-add (↓)
//   honeycake — the player eats a runtime item the game gives no effect: a Vigor gain is right (↑)
//
// Usage: npx vite-node testing/baseline/harness/inventory-pass-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 12] [--pool 4] [--only pass|stat] [--out results.json] [--show]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  defaultInventoryPrompt, defaultInventoryUserPrompt, defaultStatUpdatesPrompt, defaultStatUpdatesUserPrompt,
} from '@/components/game/GamePrompts';
import { responseFormat } from '@/lib/aiRequest/responseSchema';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { applyInventoryPass, parseInventoryReply } from '@/lib/inventory';
import { resolveEntityText } from '@/lib/placeholders';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { layerValues } from '@/lib/promptValues';
import { createStatRequest, readStatResponse } from '@/lib/statRequest';
import { inventoryRequest, statItemEffectsLine, statUpdatesRequest } from '@/lib/turnPipeline/turnPasses';
import type { TurnPassRequest } from '@/lib/turnPipeline/turnPlan';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Entity, Item, ItemCopy, ItemCopyWhere, PlayerStat, Slot } from '@/types';

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
const SEED = 909090;

type CopySpec = { item: string; where: string; equipped?: boolean; quantity?: number; hidden?: boolean };
type Expect = { item?: string; runtime?: string; where: string; quantity?: number; equipped?: boolean; visibility?: 'visible' | 'hidden' };
type PassCase = { id: string; action: string; narration: string; expect: Expect[] };
type StatCase = { id: string; action: string; narration: string; want: 'none' | 'up' };
const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'inventory-pass-cases.json'), 'utf8')) as {
  items: Omit<Item, 'statEffects' | 'traitEffects' | 'equipRequires'>[];
  slots: Slot[];
  copies: CopySpec[];
  cases: PassCase[];
  stat: StatCase[];
};
// The draught carries a stat effect, so the stat request's item line names it.
const items: Item[] = fixture.items.map((item) => ({
  ...item, traitEffects: [], equipRequires: [],
  statEffects: item.id === 'draught'
    ? [{ id: 'row', statId: 'stat-vigor', facet: 'value', timing: 'consumed', amount: 20, op: 'add' } as unknown as Item['statEffects'][number]]
    : [],
}));
const whereOf = (where: string): ItemCopyWhere => (
  where === 'you' ? { kind: 'you' } : where.startsWith('loc-') ? { kind: 'location', id: where } : { kind: 'entity', id: where }
);
const start: ItemCopy[] = fixture.copies.map((spec, i) => ({
  id: `c${i}`, item: { kind: 'item', itemId: spec.item }, where: whereOf(spec.where), quantity: spec.quantity ?? 1,
  visibility: spec.hidden ? 'hidden' : 'visible', ...(spec.equipped && { equipped: { slotId: items.find((it) => it.id === spec.item)?.slotId ?? 'hand', order: i } }),
}));

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
const pins = (kind: 'inventory' | 'statUpdates') => ({
  temperature: PROMPT_SAMPLER_PINS[kind]?.temperature,
  ...(PROMPT_SAMPLER_PINS[kind]?.repetitionPenalty !== undefined && { repetition_penalty: PROMPT_SAMPLER_PINS[kind]?.repetitionPenalty }),
});

async function send(request: Pick<TurnPassRequest, 'systemPrompt' | 'messages' | 'maxTokens' | 'responseSchema'>, kind: 'inventory' | 'statUpdates', seed: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: request.maxTokens ?? 400, reasoning_effort: 'none', stream: false, ...pins(kind),
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

// --- The pass -------------------------------------------------------------------------------------------------
type PassArm = 'schema' | 'text';
const passRequest = (arm: PassArm, c: PassCase) => {
  const built = inventoryRequest(
    { system: defaultInventoryPrompt, user: defaultInventoryUserPrompt },
    { ctx, action: c.action, narration: c.narration }, { textPass: arm === 'text', quiet: false },
  );
  return built;
};
const rowsOf = (copies: readonly ItemCopy[], itemId: string) => copies
  .filter((c) => c.item.kind === 'item' && c.item.itemId === itemId)
  .map((c) => JSON.stringify([c.where, c.quantity, !!c.equipped, c.visibility])).sort();
const expectRow = (e: Expect) => JSON.stringify([whereOf(e.where), e.quantity ?? 1, e.equipped ?? false, e.visibility ?? 'visible']);

/** Whether the reply, applied, leaves exactly the expected rows, and the item ids that moved besides. */
function score(c: PassCase, raw: string): { right: boolean; extra: string[]; ops: number } {
  const ops = parseInventoryReply(raw);
  const result = applyInventoryPass(start, ops, {
    items, runtimeItems: [], playerNames: ['Traveler'], owners, location: { id: location!.id, name: location!.name },
  }, { world: { items, slots: fixture.slots }, newId: (() => { let i = 0; return () => `n${i++}`; })() });
  const named = new Set(c.expect.flatMap((e) => (e.item ? [e.item] : [])));
  const extra = items.filter((item) => !named.has(item.id)
    && JSON.stringify(rowsOf(result.copies, item.id)) !== JSON.stringify(rowsOf(start, item.id))).map((item) => item.id);
  const runtime = result.copies.filter((copy) => copy.item.kind === 'runtime');
  const runtimeWanted = c.expect.filter((e) => e.runtime);
  const runtimeRight = runtimeWanted.length === runtime.length && runtimeWanted.every((e) => runtime.some((copy) => {
    const made = result.runtimeItems.find((r) => copy.item.kind === 'runtime' && r.id === copy.item.runtimeItemId);
    return !!made && new RegExp(e.runtime!, 'i').test(made.name) && JSON.stringify(copy.where) === JSON.stringify(whereOf(e.where));
  }));
  if (runtime.length > runtimeWanted.length) extra.push('runtime');
  const itemsRight = [...named].every((id) => JSON.stringify(rowsOf(result.copies, id))
    === JSON.stringify(c.expect.filter((e) => e.item === id).map(expectRow).sort()));
  return { right: itemsRight && runtimeRight && extra.length === 0, extra, ops: ops.length };
}

// --- The stat line --------------------------------------------------------------------------------------------
type StatArm = 'none' | 'line' | 'user';
// `--user-arm` adds `user`: the same line at the end of the user message instead of the system prompt.
const statArms: StatArm[] = args.includes('--user-arm') ? ['none', 'line', 'user'] : ['none', 'line'];
const vigor = world.stats.find((s: PlayerStat) => s.id === 'stat-vigor') as PlayerStat;
const statRequest = (arm: StatArm, c: StatCase) => {
  const snapshot = createStatRequest([vigor]);
  const built = statUpdatesRequest(
      { system: defaultStatUpdatesPrompt, user: defaultStatUpdatesUserPrompt, text: { system: null, user: null } },
      { ctx: layerValues(ctx, snapshot.context), action: c.action, narration: c.narration },
      { statCount: 1, statRequest: snapshot, quiet: false, ...(arm === 'line' && { itemNames: ['Healing Draught'] }) },
  );
  if (arm !== 'user') return { snapshot, request: built };
  const [first] = built.messages;
  return { snapshot, request: { ...built, messages: [{ ...first, content: `${first.content}${statItemEffectsLine(['Healing Draught'])}` }] } };
};

type Row = { kind: 'pass' | 'stat'; arm: string; case: string; run: number; hit: boolean; raw: string; note: string };
const results: Row[] = [];
const passCases = only === 'stat' ? [] : fixture.cases;
const statCases = only === 'pass' ? [] : fixture.stat;
const jobs = [
  ...passCases.flatMap((c) => Array.from({ length: runs }, (_, run) => (['schema', 'text'] as PassArm[]).map((arm) => async () => {
    const raw = await send(passRequest(arm, c), 'inventory', SEED + run);
    const s = score(c, raw);
    return { kind: 'pass' as const, arm, case: c.id, run, hit: s.right, raw, note: `ops ${s.ops}${s.extra.length ? ` extra ${s.extra.join(',')}` : ''}` };
  }))).flat(),
  ...statCases.flatMap((c) => Array.from({ length: runs }, (_, run) => statArms.map((arm) => async () => {
    const { snapshot, request } = statRequest(arm, c);
    const raw = await send(request, 'statUpdates', SEED + run);
    const gain = readStatResponse(raw, snapshot).updates.find((u) => u.id === 'stat-vigor')?.value ?? 0;
    return { kind: 'stat' as const, arm, case: c.id, run, hit: gain > 0, raw, note: `vigor ${gain}` };
  }))).flat(),
];

const started = Date.now();
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool} · ${jobs.length} requests`);
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    try {
      const row = await job();
      results.push(row);
      console.log(`[${row.kind}:${row.arm}] ${row.case} #${row.run} ${row.hit ? 1 : 0} · ${row.note}`);
      if (args.includes('--show')) console.log(`    ${row.raw.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      console.log(`FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
const rate = (xs: Row[]) => `${xs.filter((r) => r.hit).length}/${xs.length}`;
const of = (kind: Row['kind'], arm: string, id?: string) => results.filter((r) => r.kind === kind && r.arm === arm && (!id || r.case === id));
console.log('\nPASS (right = expected rows, nothing else moved)');
for (const c of passCases) console.log(`  ${c.id.padEnd(10)} schema ${rate(of('pass', 'schema', c.id))} · text ${rate(of('pass', 'text', c.id))}`);
const changing = passCases.filter((c) => c.expect.length).map((c) => c.id);
const guard = passCases.filter((c) => !c.expect.length).map((c) => c.id);
for (const arm of ['schema', 'text']) {
  const rows = of('pass', arm);
  console.log(`  ${arm.padEnd(6)} changes ${rate(rows.filter((r) => changing.includes(r.case)))} · guard (no change) ${rate(rows.filter((r) => guard.includes(r.case)))}`);
}
console.log('\nSTAT (hit = a Vigor gain)');
for (const c of statCases) {
  console.log(`  ${c.id.padEnd(10)} ${c.want === 'none' ? '↓' : '↑'}  ${statArms.map((arm) => `${arm} ${rate(of('stat', arm, c.id))}`).join(' · ')}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
