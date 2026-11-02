// Buy probe: does the Inventory pass report a trade as one `buy`, and do money and item move once against the stat pass?
// Sedge Landing at the dock, with a fixed narration per case, so only the two post-narration passes vary.
//
// Arms, paired by run index:
//   control: the prompt and schema with no `buy`, where a trade is a pay and a transfer
//   buy:     the shipped prompt and schema
//
// Each run sends the real requests, settles the reply through applyInventoryPass, and applies the stat pass's reply.
// Checks per case:
//   right  : the balance moved by exactly the amount the story states and the item ended where the story puts it
//   buy-op : the reply holds a buy
//   double : the balance moved further than the story states, or the item arrived more than once
//   same   : the reply also held a pay for the buy's money, which the Q68 drop has to catch
//
// Usage: npx vite-node testing/baseline/harness/buy-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 6] [--only buy-value,haggle] [--pool 4] [--text] [--out results.json] [--show]
// --text sends the Inventory pass as the text request, as an endpoint that refused the schema gets it.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultInventoryPrompt, defaultInventoryUserPrompt, defaultStatUpdatesPrompt, defaultStatUpdatesUserPrompt } from '@/components/game/GamePrompts';
import { responseFormat } from '@/lib/aiRequest/responseSchema';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { backingStatIds, balanceOf } from '@/lib/currency';
import { applyInventoryPass, inventoryPassSchema, parseInventoryReply } from '@/lib/inventory';
import { resolveEntityText } from '@/lib/placeholders';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { createStatRequest, readStatResponse } from '@/lib/statRequest';
import { inventoryRequest, statUpdatesRequest } from '@/lib/turnPipeline/turnPasses';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Currency, Entity, Item, ItemCopy, ItemCopyWhere, Placement, PlayerStat } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '6'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const textPass = args.includes('--text');
const SEED = 616161;
type Arm = 'control' | 'buy';
const ARMS: Arm[] = ['control', 'buy'];

const world = migrateWorld(JSON.parse(readFileSync(path.resolve('testing/baseline/sedge-landing.json'), 'utf8')));
const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');

const item = (id: string, name: string, over: Partial<Item> = {}): Item => ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], stackable: true, ...over });
const MONEY: Currency = { id: 'river-coin', name: 'River Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'silver', worth: 10 }] } };
const SCRIP: Currency = { id: 'scrip', name: 'Scrip', backing: { kind: 'stat', statId: 'stat-scrip' } };
const priced = (currencyId: string) => [
  item('knife', 'Gutting Knife', { value: 30, currencyId }), item('lantern', 'Tin Lantern', { value: 25, currencyId }), item('net', 'Fishing Net', { value: 90, currencyId }),
];
const BACKING_ITEMS = [item('copper', 'Copper'), item('silver', 'Silver'), ...priced('river-coin')];
const STAT_ITEMS = priced('scrip');
const ODETTE = 'ent-odette';
const PURSE: Placement = { id: 'purse', where: { kind: 'entity', id: ODETTE }, quantity: 10, source: { kind: 'item', itemId: 'silver' } };
const WALLET: PlayerStat = { id: 'stat-scrip', name: 'Scrip', type: 'number', description: 'Money the player carries, in scrip.', min: 0, max: 1000, value: 40, regen: 0, descriptors: [] };

const copy = (itemId: string, where: ItemCopyWhere, quantity = 1): ItemCopy => ({
  id: `${itemId}-${where.kind}`, item: { kind: 'item', itemId }, where, quantity, visibility: 'visible',
});
const you: ItemCopyWhere = { kind: 'you' };
const odette: ItemCopyWhere = { kind: 'entity', id: ODETTE };
const BACKING_COPIES = [copy('silver', you, 5), copy('silver', odette, 10), copy('knife', you), copy('lantern', odette), copy('net', odette)];
const STAT_COPIES = [copy('knife', you), copy('lantern', odette), copy('net', odette)];

type Money = 'items' | 'stat';
/** `change` is the player's balance change the story states; `holds` is how many of `itemId` the player ends with. */
type Case = { id: string; money: Money; action: string; narration: string; change: number; itemId: string; holds: number; wantsBuy: boolean };
const CASES: Case[] = [
  {
    id: 'buy-value', money: 'items', action: 'I buy the tin lantern from Odette.', itemId: 'lantern', holds: 1, change: -25, wantsBuy: true,
    narration: 'Odette lifts the tin lantern from its hook and sets it on the counter. You count out what it is worth and she slides it across to you.',
  },
  {
    id: 'haggle', money: 'items', action: 'I talk Odette down on the lantern.', itemId: 'lantern', holds: 1, change: -15, wantsBuy: true,
    narration: '"Fifteen copper, and not a coin less," Odette says at last. You pay her fifteen copper and she hands you the tin lantern.',
  },
  {
    id: 'sell', money: 'items', action: 'I sell my gutting knife to Odette.', itemId: 'knife', holds: 0, change: 30, wantsBuy: true,
    narration: 'You lay the gutting knife on the counter. Odette tests the edge, nods, and pays you what it is worth before tucking it under her apron.',
  },
  {
    id: 'sell-haggle', money: 'items', action: 'I ask Odette for a better price on my knife.', itemId: 'knife', holds: 0, change: 40, wantsBuy: true,
    narration: '"Four silver, then," Odette says. She counts four silver into your hand and takes the gutting knife.',
  },
  {
    id: 'buy-broke', money: 'items', action: 'I buy the fishing net from Odette.', itemId: 'net', holds: 0, change: 0, wantsBuy: true,
    narration: 'Odette names her price for the fishing net: nine silver. You hand it over and she drops the net into your arms.',
  },
  {
    id: 'talk-price', money: 'items', action: 'I ask Odette what the lantern costs.', itemId: 'lantern', holds: 0, change: 0, wantsBuy: false,
    narration: '"Two silver and five copper," Odette says, tapping the tin lantern. You thank her and leave it on its hook, and your coins stay in your purse.',
  },
  {
    id: 'gift', money: 'items', action: 'I ask Odette if I can have the lantern.', itemId: 'lantern', holds: 1, change: 0, wantsBuy: false,
    narration: '"Take it, it was my late husband\'s," Odette says, and she presses the tin lantern into your hands. She will not hear of payment.',
  },
  {
    id: 'stat-buy', money: 'stat', action: 'I buy the tin lantern from Odette.', itemId: 'lantern', holds: 1, change: -25, wantsBuy: true,
    narration: 'Odette takes the tin lantern from its hook. You pay her what it is worth in scrip and she hands it to you.',
  },
  {
    id: 'stat-haggle', money: 'stat', action: 'I talk Odette down on the lantern.', itemId: 'lantern', holds: 1, change: -15, wantsBuy: true,
    narration: '"Fifteen scrip, and that is robbery," Odette says. You pay the fifteen scrip and she hands you the tin lantern.',
  },
  {
    id: 'stat-sell', money: 'stat', action: 'I sell my gutting knife to Odette.', itemId: 'knife', holds: 0, change: 30, wantsBuy: true,
    narration: 'You lay the gutting knife on the counter. Odette pays you what it is worth in scrip and tucks it under her apron.',
  },
  {
    id: 'stat-broke', money: 'stat', action: 'I buy the fishing net from Odette.', itemId: 'net', holds: 0, change: 0, wantsBuy: true,
    narration: 'Odette names her price for the fishing net: ninety scrip. You pay it and she drops the net into your arms.',
  },
];

/** The prompt with no `buy`, for the control arm. */
const controlPrompt = defaultInventoryPrompt
  .split('\n').filter((line) => !line.startsWith('- buy:')).join('\n')
  .replace('it is made or found where', 'it is made, bought or found where')
  .replace('Every sum of money handed over with no item is one pay', 'Every sum of money handed over is one pay')
  .replace(' For buy, the seller, and empty when no seller is here.', '')
  .replace('who receives a pay, or who buys,', 'or who receives a pay,')
  .replace(/ For buy, the sum for the whole purchase[^.]*\./, '')
  .replace('for pay or a buy with a price,', 'for pay,')
  .replace('has no pay or buy.', 'has no pay.');
const controlSchema = () => {
  const schema = inventoryPassSchema();
  return JSON.parse(JSON.stringify(schema).replace(',"buy"', '')) as typeof schema;
};

const baseScene = authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});
const itemsOf = (c: Case) => (c.money === 'items' ? BACKING_ITEMS : STAT_ITEMS);
const copiesOf = (c: Case) => (c.money === 'items' ? BACKING_COPIES : STAT_COPIES);
const statsOf = (c: Case): PlayerStat[] => (c.money === 'stat' ? [WALLET, ...baseScene.stats] : baseScene.stats);
const currenciesOf = (c: Case) => [c.money === 'stat' ? SCRIP : MONEY];
const ctxFor = (c: Case) => chipValues({
  ...baseScene, stats: statsOf(c), items: itemsOf(c), itemCopies: copiesOf(c), currencies: currenciesOf(c), placements: c.money === 'items' ? [PURSE] : [],
});
const balance = (c: Case, copies: readonly ItemCopy[], stats: readonly PlayerStat[]) => {
  const read = balanceOf(currenciesOf(c)[0], you as { kind: 'you' }, { copies, placements: [PURSE], globalStats: stats, statsOf: () => [] });
  return read.tracked ? read.amount : 0;
};
const held = (copies: readonly ItemCopy[], itemId: string) => copies
  .filter((c) => c.where.kind === 'you' && c.item.kind === 'item' && c.item.itemId === itemId).reduce((sum, c) => sum + c.quantity, 0);

async function complete(body: Record<string, unknown>): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, reasoning_effort: 'none', stream: false, ...body }),
    });
    if (res.ok) {
      const parsed = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      return parsed.choices[0].message.content ?? '';
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}
const messagesOf = (request: { systemPrompt: string; messages: ChatMessage[] }) => [{ role: 'system', content: request.systemPrompt }, ...request.messages];

async function runCase(arm: Arm, c: Case, run: number) {
  const ctx = ctxFor(c);
  const values = { ctx, action: c.action, narration: c.narration };
  const invRequest = inventoryRequest({ system: arm === 'buy' ? defaultInventoryPrompt : controlPrompt, user: defaultInventoryUserPrompt }, values, { textPass, quiet: true });
  const statRequest = createStatRequest(statsOf(c), { omit: backingStatIds(currenciesOf(c)) });
  const statPass = statUpdatesRequest({ system: defaultStatUpdatesPrompt, user: defaultStatUpdatesUserPrompt, text: { system: defaultStatUpdatesPrompt, user: defaultStatUpdatesUserPrompt } as unknown as Parameters<typeof statUpdatesRequest>[0]['text'] /* The stat pass here always takes the schema. */ }, values, { statCount: statRequest.targets.length, statRequest, quiet: true });
  const [invRaw, statRaw] = await Promise.all([
    complete({
      seed: SEED + run, max_tokens: 400, temperature: PROMPT_SAMPLER_PINS.inventory?.temperature, messages: messagesOf(invRequest),
      ...(!textPass && { response_format: responseFormat(arm === 'control' ? controlSchema() : inventoryPassSchema()) }),
    }),
    complete({
      seed: SEED + run, max_tokens: 400, temperature: PROMPT_SAMPLER_PINS.statUpdates?.temperature, messages: messagesOf(statPass),
      response_format: responseFormat(statPass.responseSchema!),
    }),
  ]);
  const ops = parseInventoryReply(invRaw);
  let next = 0;
  const landed = applyInventoryPass(copiesOf(c), ops, {
    items: itemsOf(c), runtimeItems: [], playerNames: [], owners: baseScene.entities.filter((e) => e.id === ODETTE).map((e) => ({ id: e.id, name: e.name })),
    location: { id: location!.id, name: location!.name },
    money: {
      currencies: currenciesOf(c), placements: [PURSE], stats: { globalStats: statsOf(c), entityStats: {} }, playedIds: [], statsOn: (_owner, stats) => stats,
    },
  }, { world: { items: itemsOf(c) }, newId: () => `n${next++}` });
  const statMove = readStatResponse(statRaw, statRequest).updates.filter((u) => u.id === WALLET.id).reduce((sum, u) => sum + u.value, 0);
  const moved = balance(c, landed.copies, landed.stats?.globalStats ?? statsOf(c)) - balance(c, copiesOf(c), statsOf(c)) + statMove;
  return { arm, case: c.id, run, ops, moved, statMove, holds: held(landed.copies, c.itemId), diagnostics: landed.diagnostics, invRaw, statRaw };
}
type Result = Awaited<ReturnType<typeof runCase>>;

const checks = (r: Result, c: Case) => ({
  right: r.moved === c.change && r.holds === c.holds,
  buyOp: r.ops.some((op) => op.op === 'buy'),
  double: Math.abs(r.moved) > Math.abs(c.change) || r.holds > 1,
  same: r.diagnostics.some((line) => line.includes('the same sum')),
});

const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
const results: Result[] = [];
const started = Date.now();
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}`);
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((arm) => ({ arm, c, run })))).flat();
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++];
    try {
      const result = await runCase(arm, c, run);
      results.push(result);
      const seen = checks(result, c);
      console.log(`[${arm}] ${c.id} #${run} moved=${result.moved} want=${c.change} holds=${result.holds}/${c.holds} right=${+seen.right} buy=${+seen.buyOp} double=${+seen.double} same=${+seen.same} ops=${result.ops.map((op) => `${op.op}:${op.item}${op.price ? `(${op.price})` : ''}|${op.owner}>${op.to}`).join(',') || '-'}`);
      if (args.includes('--show')) console.log(`    ${result.invRaw.replace(/\n+/g, ' ')}\n    ${result.diagnostics.join(' / ')}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
console.log('\nTOTALS (right · buy-op · double · same-sum drop)');
for (const c of cases) {
  const cells = ARMS.map((arm) => {
    const of = results.filter((r) => r.case === c.id && r.arm === arm);
    const count = (key: keyof ReturnType<typeof checks>) => of.filter((r) => checks(r, c)[key]).length;
    return `${arm} ${count('right')}/${of.length} · ${count('buyOp')} · ${count('double')} · ${count('same')}`;
  });
  console.log(`${c.id.padEnd(12)} ${cells.join('   |   ')}`);
}

// Replies a model could send, settled with no request: the same-sum drop and the all-or-nothing commit.
const itemCase = CASES.find((c) => c.id === 'buy-value')!;
const settleCanned = (ops: ReturnType<typeof parseInventoryReply>, presentIds?: string[]) => {
  let id = 0;
  const landed = applyInventoryPass(copiesOf(itemCase), ops, {
    items: itemsOf(itemCase), runtimeItems: [], playerNames: [], owners: [{ id: ODETTE, name: 'Odette' }], location: { id: location.id, name: location.name },
    money: { currencies: [MONEY], placements: [PURSE], stats: { globalStats: [], entityStats: {} }, playedIds: [], statsOn: (_owner, stats) => stats },
  }, { world: { items: itemsOf(itemCase) }, newId: () => `c${id++}`, ...(presentIds && { presence: { locationId: location.id, entityIds: new Set(presentIds) } }) });
  return { moved: balance(itemCase, landed.copies, []) - balance(itemCase, copiesOf(itemCase), []), holds: held(landed.copies, 'lantern') };
};
const op = (kind: 'buy' | 'pay' | 'gain', over: Record<string, unknown>) => ({ op: kind, item: '', quantity: 1, owner: '', to: '', ...over }) as ReturnType<typeof parseInventoryReply>[number];
const lantern = op('buy', { item: 'Tin Lantern', owner: 'Odette', to: 'you' });
const canned: [string, ReturnType<typeof settleCanned>, number, number][] = [
  ['buy + same-sum pay', settleCanned([lantern, op('pay', { owner: 'you', to: 'Odette', price: '25' })]), -25, 1],
  ['buy + same-sum pay, blank payee', settleCanned([lantern, op('pay', { owner: 'you', price: '25' })]), -25, 1],
  ['buy + same-sum pay, own direction', settleCanned([lantern, op('pay', { owner: 'Odette', to: 'you', price: '25' })]), -25, 1],
  ['refused buy + same-sum pay', settleCanned([op('buy', { item: 'Fishing Net', owner: 'Odette', to: 'you', price: '60 Silver' }), op('pay', { owner: 'you', to: 'Odette', price: '60 Silver' })]), 0, 0],
  ['buy said twice', settleCanned([lantern, lantern]), -25, 1],
  ['buy + gain of it', settleCanned([lantern, op('gain', { item: 'Tin Lantern', owner: 'Odette', to: 'you' })]), -25, 1],
  ['refused buy + gain of it', settleCanned([op('buy', { item: 'Fishing Net', owner: 'Odette', to: 'you', price: '900' }), op('gain', { item: 'Fishing Net', owner: 'Odette', to: 'you' })]), 0, 0],
  ['item cannot move, money stays', settleCanned([lantern], []), 0, 0],
];
console.log('\nCANNED (moved · lantern held)');
for (const [label, got, moved, holds] of canned) console.log(`${label.padEnd(30)} ${got.moved} · ${got.holds}  ${got.moved === moved && got.holds === holds ? 'ok' : `WANT ${moved} · ${holds}`}`);
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
