// Inventory chip probe — what changes when the narration prompt carries <INVENTORY>? Sedge Landing at the dock:
// the player holds a lantern, a knife and a pouch; Odette holds a hook and smoked eel; an oar lies on the dock
// and a silver token lies hidden between the planks.
//
// Arms, paired by run index: `none` (the shipped prompt with the Inventory chip removed) and `chip` (the shipped
// prompt). The `gave` case adds `event`: the chip plus a one-time line before the action saying what the
// player just did in the Inventory panel (Q19). Every other byte is shared.
//
// Checks:
//   names-own        — names at least two of the player's three items (up)
//   invented         — names a held item the player does not have: rope, flint, map, tinderbox, compass (guard, down)
//   lantern          — names the player's lantern, not the dock's (up)
//   lantern-summary  — carries the lantern's AI Summary: its half-closing shutter or its stripe of light (up)
//   names-odette     — names the hook or the smoked eel (up)
//   hidden-leak      — mentions the hidden token unprompted (guard, down)
//   reveal           — the search finds the token (up)
//   odette-has-knife — the model's own yes/no: does Odette have the knife now (up)
//   player-has-knife — the model's own yes/no: does the player still have the knife (guard, down)
//
// Usage: npx vite-node testing/baseline/harness/inventory-chip-probe.cli.ts --
//          [--alt-pre TEXT] [--endpoint URL] [--model ID] [--runs 12] [--max 600] [--only carry,look] [--pool 4] [--out results.json] [--dump] [--show]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultSystemPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { resolveEntityText } from '@/lib/placeholders';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Entity, Item, ItemCopy, ItemCopyWhere } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const runs = Number(argVal('--runs', '12'));
const maxTokens = Number(argVal('--max', '600'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const SEED = 808080;
const CHIP = /<INVENTORY\|[^>]*>/;
type Arm = 'none' | 'chip' | 'event' | 'alt';
// With --alt-pre, every case gains an `alt` arm: the chip with this Prepend text in place of the shipped one.
const altPre = argVal('--alt-pre', '');

type CopySpec = { item: string; where: string; equipped?: boolean; quantity?: number; hidden?: boolean };
type Case = {
  id: string; action: string; checks: string[]; copies?: string; arms?: Arm[];
  history?: { role: 'user' | 'assistant'; content: string }[]; event?: string;
};
const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'inventory-chip-cases.json'), 'utf8')) as {
  items: Omit<Item, 'statEffects' | 'traitEffects' | 'equipRequires'>[];
  copies: Record<string, CopySpec[]>;
  cases: Case[];
};
const items: Item[] = fixture.items.map((item) => ({ ...item, statEffects: [], traitEffects: [], equipRequires: [] }));
const whereOf = (where: string): ItemCopyWhere => (
  where === 'you' ? { kind: 'you' } : where.startsWith('loc-') ? { kind: 'location', id: where } : { kind: 'entity', id: where }
);
const copiesOf = (key: string): ItemCopy[] => fixture.copies[key].map((spec, i) => ({
  id: `${key}-${i}`, item: { kind: 'item', itemId: spec.item }, where: whereOf(spec.where), quantity: spec.quantity ?? 1,
  visibility: spec.hidden ? 'hidden' : 'visible', ...(spec.equipped && { equipped: { slotId: 'slot', order: i } }),
}));

const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const baseScene = authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});
const ctxFor = (key: string) => chipValues({ ...baseScene, items, itemCopies: copiesOf(key) });
if (!CHIP.test(defaultSystemPrompt)) throw new Error('The shipped narration prompt lacks the Inventory chip.');

function request(arm: Arm, c: Case): ChatMessage[] {
  const template = arm === 'none' ? defaultSystemPrompt.replace(CHIP, '')
    : arm === 'alt' ? defaultSystemPrompt.replace(CHIP, (token) => token.replace(/pre="[^"]*"/, `pre="${altPre}\n\n"`))
    : defaultSystemPrompt;
  const system = buildNarrationPrompt({
    template, ctx: ctxFor(c.copies ?? 'base'), action: c.action, history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  const user = arm === 'event' && c.event ? `${c.event}\n\n${c.action}` : c.action;
  return [{ role: 'system', content: system }, ...(c.history ?? []), { role: 'user', content: user }] as ChatMessage[];
}

async function complete(model: string, messages: ChatMessage[], seed: number, extra: { temperature?: number; max?: number } = {}): Promise<string> {
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
async function judge(model: string, text: string, question: string): Promise<boolean> {
  const answer = await complete(model, [
    { role: 'system', content: 'You read one passage of a story and answer one question about it with one word: yes or no.' },
    { role: 'user', content: `Earlier, the player carried a gutting knife.\n\nPassage:\n${text}\n\nQuestion: ${question} Answer yes or no.` },
  ] as ChatMessage[], 1, { temperature: 0, max: 5 });
  return /^\W*yes/i.test(answer);
}
const JUDGED: Record<string, string> = {
  'odette-has-knife': 'In this passage, is the gutting knife with Odette - in her hands or among her things - rather than with the player?',
  'player-has-knife': 'In this passage, does the player still have the gutting knife on them (carrying it, touching it at their belt, or using it)?',
};

type Result = { arm: Arm; case: string; run: number; text: string; judged: Record<string, boolean> };
// The world names silver hair and a dock lantern, so these match the items' own words only.
const TOKEN = /\btoken\b|silver (coin|disc|piece)/i;
const LANTERN = /(hooded|brass|your|own) lantern/i;
const CHECKS: Record<string, { test: (r: Result) => boolean; want: boolean }> = {
  'names-own': { test: ({ text }) => [LANTERN, /knife/i, /pouch/i].filter((re) => re.test(text)).length >= 2, want: true },
  invented: { test: ({ text }) => /\b(rope|flint|map|tinderbox|compass)\b/i.test(text.split(/[.!?]/).filter((s) => /\b(your|you)\b/i.test(s)).join('.')), want: false },
  lantern: { test: ({ text }) => LANTERN.test(text), want: true },
  'lantern-summary': { test: ({ text }) => /\b(shutter|stripe)\b/i.test(text), want: true },
  // Her description already says she smokes eels, so only the item's own words count.
  'names-odette': { test: ({ text }) => /\bhook\b|smoked eels?\b/i.test(text), want: true },
  'hidden-leak': { test: ({ text }) => TOKEN.test(text), want: false },
  reveal: { test: ({ text }) => TOKEN.test(text), want: true },
  'odette-has-knife': { test: (r) => r.judged['odette-has-knife'] === true, want: true },
  'player-has-knife': { test: (r) => r.judged['player-has-knife'] === true, want: false },
};

const cases = fixture.cases.filter((c) => !only || only.split(',').includes(c.id));
const armsOf = (c: Case): Arm[] => [...(c.arms ?? ['none', 'chip']), ...(altPre ? ['alt' as const] : [])];
if (args.includes('--dump')) {
  for (const c of cases) for (const arm of armsOf(c)) console.log(`\n=== ${c.id} (${arm})\n${JSON.stringify(request(arm, c), null, 2).slice(0, 12000)}`);
  process.exit(0);
}

const results: Result[] = [];
const started = Date.now();
const model = argVal('--model', 'default');
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}`);
// Arms interleave run by run, so drift during the batch lands on every arm.
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => armsOf(c).map((arm) => ({ arm, c, run })))).flat();
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++];
    try {
      const text = await complete(model, request(arm, c), SEED + run);
      const judged: Record<string, boolean> = {};
      for (const check of c.checks) if (JUDGED[check]) judged[check] = await judge(model, text, JUDGED[check]);
      const result: Result = { arm, case: c.id, run, text, judged };
      results.push(result);
      const hits = c.checks.map((check) => `${check}=${CHECKS[check].test(result) ? 1 : 0}`).join(' ');
      console.log(`[${arm}] ${c.id} #${run} ${hits} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
const rate = (xs: Result[], test: (r: Result) => boolean) => ({ k: xs.filter(test).length, n: xs.length });
const diffCi = (a: { k: number; n: number }, b: { k: number; n: number }) => {
  if (!a.n || !b.n) return 'n/a';
  const pa = a.k / a.n, pb = b.k / b.n;
  const se = Math.sqrt((pa * (1 - pa)) / a.n + (pb * (1 - pb)) / b.n);
  return `Δ ${(pb - pa).toFixed(2)} [${(pb - pa - 1.96 * se).toFixed(2)}, ${(pb - pa + 1.96 * se).toFixed(2)}]`;
};

console.log('\nTOTALS (↑/↓ = direction wanted; Δ = arm − none, 95% CI)');
for (const c of cases) {
  const of = (arm: Arm) => results.filter((r) => r.case === c.id && r.arm === arm);
  for (const check of c.checks) {
    const control = rate(of('none'), CHECKS[check].test);
    const cells = armsOf(c).map((arm) => {
      const cell = rate(of(arm), CHECKS[check].test);
      return `${arm} ${cell.k}/${cell.n}${arm === 'none' ? '' : ` ${diffCi(control, cell)}`}`;
    });
    console.log(`${`${c.id} ${check}`.padEnd(26)} ${CHECKS[check].want ? '↑' : '↓'}  ${cells.join(' · ')}`);
  }
  if (c.arms?.includes('event')) {
    for (const check of c.checks) {
      const [chip, event] = [rate(of('chip'), CHECKS[check].test), rate(of('event'), CHECKS[check].test)];
      console.log(`${`${c.id} ${check} event−chip`.padEnd(26)}    ${diffCi(chip, event)}`);
    }
  }
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
