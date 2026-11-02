// Currency chip probe — does the narrator state fair prices and respect what the player can afford once the
// <INVENTORY> chip carries worth and balances? Sedge Landing at the dock: Odette holds a hook and smoked eels and
// keeps a purse; the player holds a knife and coins.
//
// Arms, paired by run index: `control` (the same Item Copies with no Currencies, so no worth and no balance line)
// and `chip` (the world's Currency). Every other byte is shared, the coins in Carried included. With --alt-pre,
// an `alt` arm is the chip with this Prepend text in place of the shipped one. A prior turn opens the sale in
// every arm, so a price is due in the reply.
//
// Checks:
//   price-stated  — the passage names a price in silver or copper (up)
//   fair-eel      — names 3 Silver and 5 Copper, or 35 Copper, the eel's worth (up)
//   fair-hook     — names 12 Silver, or 120 Copper, the hook's worth (up)
//   fair-knife    — names 1 Silver and 5 Copper, or 15 Copper, the knife's worth (up)
//   sale-happens  — the model's own yes/no: the player gets the eel (up when they can pay, down when they can't)
//   short-of-coin — the model's own yes/no: the passage shows the player lacks the money (up when broke)
//
// Usage: npx vite-node testing/baseline/harness/currency-chip-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 6] [--max 600] [--only ask-eel,buy-broke] [--alt-pre TEXT] [--pool 4] [--out results.json] [--show]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultSystemPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { resolveEntityText } from '@/lib/placeholders';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Currency, Entity, Item, ItemCopy, ItemCopyWhere, Placement } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '6'));
const maxTokens = Number(argVal('--max', '600'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const SEED = 909090;
const CHIP = /<INVENTORY\|[^>]*>/;
const altPre = argVal('--alt-pre', '');
type Arm = 'control' | 'chip' | 'alt';
const ARMS: Arm[] = ['control', 'chip', ...(altPre ? ['alt' as const] : [])];
const OPENING = [
  { role: 'user', content: 'I ask Odette whether she trades with travelers.' },
  { role: 'assistant', content: '"Everything I have is for sale," Odette says, turning an eel over the coals. "Ask, and I will tell you what it costs."' },
];

const world = migrateWorld(JSON.parse(readFileSync(path.resolve('testing/baseline/sedge-landing.json'), 'utf8')));
const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');

const item = (id: string, name: string, value?: number): Item => ({
  id, name, ...(value !== undefined && { value, currencyId: 'river-coin' }), statEffects: [], traitEffects: [], equipRequires: [],
});
const ITEMS = [item('copper', 'Copper'), item('silver', 'Silver'), item('eel', 'Smoked Eel', 35), item('hook', 'Bone Hook', 120), item('knife', 'Gutting Knife', 15)];
const CURRENCY: Currency = { id: 'river-coin', name: 'River Coin', backing: { kind: 'coins', coins: [{ itemId: 'copper', worth: 1 }, { itemId: 'silver', worth: 10 }] } };
const ODETTE = 'ent-odette';
const PURSE: Placement = { id: 'purse', where: { kind: 'entity', id: ODETTE }, quantity: 10, source: { kind: 'item', itemId: 'silver' } };

const copy = (itemId: string, where: ItemCopyWhere, quantity = 1): ItemCopy => ({
  id: `${itemId}-${where.kind}`, item: { kind: 'item', itemId }, where, quantity, visibility: 'visible',
});
const you: ItemCopyWhere = { kind: 'you' };
const odette: ItemCopyWhere = { kind: 'entity', id: ODETTE };
const shelf = [copy('hook', odette), copy('eel', odette, 3), copy('silver', odette, 10)];
const RICH = [copy('knife', you), copy('silver', you, 5), ...shelf];
const BROKE = [copy('knife', you), copy('copper', you, 8), ...shelf];

type Case = { id: string; action: string; copies: ItemCopy[]; checks: string[] };
const CASES: Case[] = [
  { id: 'ask-eel', action: 'I point at the smoked eels Odette is holding. "How much for one? Name your price."', copies: RICH, checks: ['price-stated', 'fair-eel'] },
  { id: 'ask-hook', action: 'I nod at the bone hook on Odette\'s wrist. "What would you charge me for one like that? Give me a number."', copies: RICH, checks: ['price-stated', 'fair-hook'] },
  { id: 'sell-knife', action: 'I hold out my gutting knife to Odette. "What is this worth to you? Give me a number."', copies: RICH, checks: ['price-stated', 'fair-knife'] },
  { id: 'buy-broke', action: 'I tell Odette I will take one smoked eel at her usual price. I count out my coins into her hand and we see if it is enough.', copies: BROKE, checks: ['sale-happens', 'short-of-coin'] },
  { id: 'buy-rich', action: 'I tell Odette I will take one smoked eel at her usual price. I count out my coins into her hand and we see if it is enough.', copies: RICH, checks: ['sale-happens', 'short-of-coin'] },
];

const baseScene = authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});
const ctxFor = (arm: Arm, c: Case) => chipValues({
  ...baseScene, items: ITEMS, itemCopies: c.copies, ...(arm !== 'control' && { currencies: [CURRENCY], placements: [PURSE] }),
});

function request(arm: Arm, c: Case): ChatMessage[] {
  const system = buildNarrationPrompt({
    template: arm === 'alt' ? defaultSystemPrompt.replace(CHIP, (token) => token.replace(/pre="[^"]*"/, `pre="${altPre}\n\n"`)) : defaultSystemPrompt, ctx: ctxFor(arm, c), action: c.action, history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  return [{ role: 'system', content: system }, ...OPENING, { role: 'user', content: c.action }] as ChatMessage[];
}

async function complete(messages: ChatMessage[], seed: number, extra: { temperature?: number; max?: number } = {}): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: extra.max ?? maxTokens, reasoning_effort: 'none', stream: false,
        // Narration is unpinned, so it sends no temperature; the judge sends 0.
        ...(extra.temperature !== undefined ? { temperature: extra.temperature } : {}),
        messages,
      }),
    });
    if (res.ok) {
      const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      return body.choices[0].message.content ?? '';
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}

/** The model's own yes/no on one question about `text`, at temperature 0. */
async function judge(text: string, question: string): Promise<boolean> {
  const answer = await complete([
    { role: 'system', content: 'You read one passage of a story and answer one question about it with one word: yes or no.' },
    { role: 'user', content: `Passage:\n${text}\n\nQuestion: ${question} Answer yes or no.` },
  ] as ChatMessage[], 1, { temperature: 0, max: 5 });
  return /^\W*yes/i.test(answer);
}
const JUDGED: Record<string, string> = {
  'sale-happens': 'By the end of this passage, has the player paid for a smoked eel and received it?',
  'short-of-coin': 'Does this passage show that the player does not have enough money for what they want?',
};

type Result = { arm: Arm; case: string; run: number; text: string; judged: Record<string, boolean> };
const WORD_NUMBERS: Record<string, string> = { 1: 'one', 3: 'three', 5: 'five', 12: 'twelve', 15: 'fifteen', 35: 'thirty[- ]five', 120: 'a hundred and twenty|one hundred (and )?twenty' };
const amount = (count: number, coin: string) => new RegExp(`\\b(${count}|${WORD_NUMBERS[count]})\\s+${coin}`, 'i');
const names = (text: string, ...parts: RegExp[]) => parts.every((part) => part.test(text));
const CHECKS: Record<string, (r: Result) => boolean> = {
  'price-stated': ({ text }) => /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|a)\s+(silver|copper)/i.test(text),
  'fair-eel': ({ text }) => names(text, amount(3, 'silver'), amount(5, 'copper')) || amount(35, 'copper').test(text),
  'fair-hook': ({ text }) => amount(12, 'silver').test(text) || amount(120, 'copper').test(text),
  'fair-knife': ({ text }) => names(text, amount(1, 'silver'), amount(5, 'copper')) || amount(15, 'copper').test(text),
  'sale-happens': (r) => r.judged['sale-happens'] === true,
  'short-of-coin': (r) => r.judged['short-of-coin'] === true,
};

const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
const results: Result[] = [];
const started = Date.now();
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}`);
// Arms interleave run by run, so drift during the batch lands on both.
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((arm) => ({ arm, c, run })))).flat();
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++];
    try {
      const text = await complete(request(arm, c), SEED + run);
      const judged: Record<string, boolean> = {};
      for (const check of c.checks) if (JUDGED[check]) judged[check] = await judge(text, JUDGED[check]);
      const result: Result = { arm, case: c.id, run, text, judged };
      results.push(result);
      console.log(`[${arm}] ${c.id} #${run} ${c.checks.map((check) => `${check}=${CHECKS[check](result) ? 1 : 0}`).join(' ')} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
console.log('\nTOTALS');
for (const c of cases) {
  for (const check of c.checks) {
    const cells = ARMS.map((arm) => {
      const of = results.filter((r) => r.case === c.id && r.arm === arm);
      return `${arm} ${of.filter(CHECKS[check]).length}/${of.length}`;
    });
    console.log(`${`${c.id} ${check}`.padEnd(30)} ${cells.join(' · ')}`);
  }
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
