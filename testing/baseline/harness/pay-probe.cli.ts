// Pay probe: does the Inventory pass report money moves as `pay`, and does money move once against the stat pass?
// Sedge Landing at the dock, with a fixed narration per case, so only the two post-narration passes vary.
//
// Arms, paired by run index:
//   control: the prompt and schema with no `pay`, and a stat request that still holds the backing stat
//   pay:     the shipped prompt and schema, and a stat request with the backing stat left out
//
// Each run sends the real requests, settles the reply through applyInventoryPass, and applies the stat pass's reply.
// Checks per case:
//   right  : the balance moved by exactly the amount the story states (held still, for a refusal or a no-money case)
//   pay-op : the reply holds a pay
//   double : the balance moved further than the story states
//
// Usage: npx vite-node testing/baseline/harness/pay-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 6] [--only bribe,bounty] [--pool 4] [--text] [--out results.json] [--show]
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
const SEED = 515151;
type Arm = 'control' | 'pay';
const ARMS: Arm[] = ['control', 'pay'];

const world = migrateWorld(JSON.parse(readFileSync(path.resolve('testing/baseline/sedge-landing.json'), 'utf8')));
const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');

const item = (id: string, name: string): Item => ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], stackable: true });
const ITEMS = [item('copper', 'Copper'), item('silver', 'Silver'), item('knife', 'Gutting Knife')];
const COINS: Currency = { id: 'river-coin', name: 'River Coin', backing: { kind: 'coins', coins: [{ itemId: 'copper', worth: 1 }, { itemId: 'silver', worth: 10 }] } };
const CREDITS: Currency = { id: 'scrip', name: 'Scrip', backing: { kind: 'stat', statId: 'stat-scrip' } };
const ODETTE = 'ent-odette';
const PURSE: Placement = { id: 'purse', where: { kind: 'entity', id: ODETTE }, quantity: 10, source: { kind: 'item', itemId: 'silver' } };
const SCRIP: PlayerStat = { id: 'stat-scrip', name: 'Scrip', type: 'number', description: 'Money the player carries, in scrip.', min: 0, max: 1000, value: 40, regen: 0, descriptors: [] };

const copy = (itemId: string, where: ItemCopyWhere, quantity = 1): ItemCopy => ({
  id: `${itemId}-${where.kind}`, item: { kind: 'item', itemId }, where, quantity, visibility: 'visible',
});
const you: ItemCopyWhere = { kind: 'you' };
const odette: ItemCopyWhere = { kind: 'entity', id: ODETTE };
const COIN_COPIES = [copy('knife', you), copy('silver', you, 5), copy('silver', odette, 10)];
const STAT_COPIES = [copy('knife', you)];

type Money = 'coins' | 'stat';
/** `change` is the player's balance change the story states, in base units; a refusal holds at 0. */
type Case = { id: string; money: Money; action: string; narration: string; change: number; wantsPay: boolean };
const CASES: Case[] = [
  {
    id: 'bribe', money: 'coins', action: 'I slip the dock guard two silver to look the other way.',
    narration: 'You press two silver coins into the dock guard\'s palm. He closes his fist around them, turns his back and studies the river until you have passed.', change: -20, wantsPay: true,
  },
  {
    id: 'fee', money: 'coins', action: 'I pay Odette the mooring fee.',
    narration: '"One silver and five copper," Odette says. You count it out and she drops the coins into her apron without looking at them.', change: -15, wantsPay: true,
  },
  {
    id: 'bounty', money: 'coins', action: 'I bring the reeve the poacher\'s snare and claim the bounty.',
    narration: 'The reeve weighs the snare in one hand, nods, and counts four silver into your palm. "That is the bounty, and fairly earned."', change: 40, wantsPay: true,
  },
  {
    id: 'fine-broke', money: 'coins', action: 'I tell the reeve I will settle the fine now.',
    narration: 'The reeve names the fine: nine silver. You hand it over, and he makes a mark in his ledger.', change: 0, wantsPay: true,
  },
  {
    id: 'talk-price', money: 'coins', action: 'I ask Odette what the mooring fee is.',
    narration: '"Three silver a night," Odette says. You thank her and say you will think about it, and the coins stay in your purse.', change: 0, wantsPay: false,
  },
  {
    id: 'gift-item', money: 'coins', action: 'I hand my gutting knife to Odette as a gift.',
    narration: 'You hold the gutting knife out handle first. Odette takes it and tests the edge on her thumb. "A fine gift," she says.', change: 0, wantsPay: false,
  },
  {
    id: 'stat-fee', money: 'stat', action: 'I pay the ferry toll.',
    narration: 'The ferryman holds out his hand. "Fifteen scrip." You pay him and he waves you aboard.', change: -15, wantsPay: true,
  },
  {
    id: 'stat-wage', money: 'stat', action: 'I collect my wages from the reeve.',
    narration: 'The reeve checks his ledger and pays out your wages: twelve scrip, counted onto the table.', change: 12, wantsPay: true,
  },
  {
    id: 'stat-broke', money: 'stat', action: 'I pay the harbor fine.',
    narration: 'The harbor clerk stamps the form. "Ninety scrip." You pay the fine in full and the clerk files it.', change: 0, wantsPay: true,
  },
  {
    id: 'stat-talk', money: 'stat', action: 'I ask what passage costs.',
    narration: '"Twenty scrip to the far bank," the ferryman says. You shake your head and stay on the dock.', change: 0, wantsPay: false,
  },
];

/** The prompt as it stood before `pay`, for the control arm. */
const controlPrompt = defaultInventoryPrompt
  .split('\n').filter((line) => !/^- (pay|price|currency):/.test(line)).join('\n')
  .replace(' Empty for pay.', '').replace(/ For pay, who pays[^\n]*/, '').replace(', or who receives a pay,', '')
  .replace(', and for a pay that no one here receives', '');
const controlSchema = () => {
  const schema = inventoryPassSchema();
  return JSON.parse(JSON.stringify(schema).replace(',"pay"', '').replace(/,"price":\{"type":"string"\},"currency":\{"type":"string"\}/, '')) as typeof schema;
};

const baseScene = authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});
const itemsOf = (c: Case) => (c.money === 'coins' ? ITEMS : ITEMS.filter((held) => held.id === 'knife'));
const copiesOf = (c: Case) => (c.money === 'coins' ? COIN_COPIES : STAT_COPIES);
const statsOf = (c: Case): PlayerStat[] => (c.money === 'stat' ? [SCRIP, ...baseScene.stats] : baseScene.stats);
const currenciesOf = (c: Case) => [c.money === 'stat' ? CREDITS : COINS];
const ctxFor = (c: Case) => chipValues({
  ...baseScene, stats: statsOf(c), items: itemsOf(c), itemCopies: copiesOf(c), currencies: currenciesOf(c), placements: c.money === 'coins' ? [PURSE] : [],
});
const balance = (c: Case, copies: readonly ItemCopy[], stats: readonly PlayerStat[]) => {
  const read = balanceOf(currenciesOf(c)[0], you as { kind: 'you' }, { copies, placements: [PURSE], globalStats: stats, statsOf: () => [] });
  return read.tracked ? read.amount : 0;
};

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
  const invRequest = inventoryRequest({ system: arm === 'pay' ? defaultInventoryPrompt : controlPrompt, user: defaultInventoryUserPrompt }, values, { textPass, quiet: true });
  const statRequest = createStatRequest(statsOf(c), { omit: arm === 'pay' ? backingStatIds(currenciesOf(c)) : new Set() });
  const statPass = statUpdatesRequest({ system: defaultStatUpdatesPrompt, user: defaultStatUpdatesUserPrompt, text: { system: defaultStatUpdatesPrompt, user: defaultStatUpdatesUserPrompt } as never }, values, { statCount: statRequest.targets.length, statRequest, quiet: true });
  const [invRaw, statRaw] = await Promise.all([
    complete({
      seed: SEED + run, max_tokens: 400, temperature: PROMPT_SAMPLER_PINS.inventory?.temperature, messages: messagesOf(invRequest),
      ...(!textPass && { response_format: responseFormat(arm === 'pay' ? inventoryPassSchema() : controlSchema()) }),
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
  const statMove = readStatResponse(statRaw, statRequest).updates.filter((u) => u.id === SCRIP.id).reduce((sum, u) => sum + u.value, 0);
  const moved = balance(c, landed.copies, landed.stats?.globalStats ?? statsOf(c)) - balance(c, copiesOf(c), statsOf(c)) + statMove;
  return { arm, case: c.id, run, ops, moved, statMove, diagnostics: landed.diagnostics, invRaw, statRaw };
}
type Result = Awaited<ReturnType<typeof runCase>>;

const checks = (r: Result, c: Case) => ({
  right: r.moved === c.change,
  payOp: r.ops.some((op) => op.op === 'pay'),
  double: Math.abs(r.moved) > Math.abs(c.change),
  statWrote: r.statMove !== 0,
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
      console.log(`[${arm}] ${c.id} #${run} moved=${result.moved} want=${c.change} stat=${result.statMove} right=${+seen.right} pay=${+seen.payOp} double=${+seen.double} ops=${result.ops.map((op) => `${op.op}${op.price ? `(${op.price}|${op.owner}>${op.to})` : `:${op.item}`}`).join(',') || '-'}`);
      if (args.includes('--show')) console.log(`    ${result.invRaw.replace(/\n+/g, ' ')}\n    ${result.diagnostics.join(' / ')}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
console.log('\nTOTALS (right · pay-op · double · stat pass wrote)');
for (const c of cases) {
  const cells = ARMS.map((arm) => {
    const of = results.filter((r) => r.case === c.id && r.arm === arm);
    const count = (key: keyof ReturnType<typeof checks>) => of.filter((r) => checks(r, c)[key]).length;
    return `${arm} ${count('right')}/${of.length} · ${count('payOp')} · ${count('double')} · ${count('statWrote')}`;
  });
  console.log(`${c.id.padEnd(12)} ${cells.join('   |   ')}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
