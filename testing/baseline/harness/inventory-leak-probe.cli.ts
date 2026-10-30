// Inventory leak probe — how often does the narrator name an unidentified item's true face before a reveal?
// Sedge Landing; each case shows one unidentified item (Q14, Q38) and never reveals it.
//
// Arms, paired by run index: `both` (the shipped Items Here: the unidentified face, then the true face marked
// unknown to the player) and `control` (the same item as an ordinary one that holds only the unidentified face, so the
// true name and AI text never reach the prompt). Every other byte is shared.
//
// Rates per arm, per case and pooled over the unprompted cases (the `baited` case asks "what is this?" and reports apart):
//   name   — the passage names the item's true name (regex per case; the primary rate)
//   nature — the passage states what the item really is or does (keyword regex from its true AI text; second line)
// A control hit can only be chance, so each one is printed in full to hand-check as a scorer false positive.
//
// Usage: npx vite-node testing/baseline/harness/inventory-leak-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 12] [--max 600] [--only carried,worn] [--pool 4] [--out results.json] [--dump] [--show]
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
const SEED = 909090;
type Arm = 'both' | 'control';
const ARMS: Arm[] = ['both', 'control'];

type FixtureItem = Omit<Item, 'statEffects' | 'traitEffects' | 'equipRequires'>;
type CopySpec = { item: string; where: string; equipped?: boolean };
type Case = { id: string; action: string; copies: string; leak: string; nature: string; baited?: boolean };
const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'inventory-leak-cases.json'), 'utf8')) as {
  items: FixtureItem[]; copies: Record<string, CopySpec[]>; cases: Case[];
};
const withDefaults = (item: FixtureItem): Item => ({ ...item, statEffects: [], traitEffects: [], equipRequires: [] });
const bothItems: Item[] = fixture.items.map(withDefaults);
// The control holds only the unidentified face: it is the item's whole name and AI text.
const controlItems: Item[] = fixture.items.map(({ unidentifiedName, unidentifiedDescription, aiSummary: _dropped, ...item }) => (
  withDefaults({ ...item, name: unidentifiedName ?? item.name, aiSummary: unidentifiedDescription })));
const whereOf = (where: string): ItemCopyWhere => (
  where === 'you' ? { kind: 'you' } : where.startsWith('loc-') ? { kind: 'location', id: where } : { kind: 'entity', id: where }
);
const copiesOf = (key: string, arm: Arm): ItemCopy[] => fixture.copies[key].map((spec, i) => ({
  id: `${key}-${i}`, item: { kind: 'item', itemId: spec.item }, where: whereOf(spec.where), quantity: 1, visibility: 'visible',
  ...(spec.equipped && { equipped: { slotId: 'slot', order: i } }),
  ...(arm === 'both' && { state: { unidentified: true } }),
}));

const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const baseScene = authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});

function request(arm: Arm, c: Case): ChatMessage[] {
  const ctx = chipValues({ ...baseScene, items: arm === 'both' ? bothItems : controlItems, itemCopies: copiesOf(c.copies, arm) });
  const system = buildNarrationPrompt({
    template: defaultSystemPrompt, ctx, action: c.action, history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  return [{ role: 'system', content: system }, { role: 'user', content: c.action }] as ChatMessage[];
}

async function chatCompletion(model: string, messages: ChatMessage[], seed: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Narration is unpinned, so it sends no temperature.
      body: JSON.stringify({ model, seed, max_tokens: maxTokens, reasoning_effort: 'none', stream: false, messages }),
    });
    if (res.ok) {
      const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      return body.choices[0].message.content ?? '';
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}

type Result = { arm: Arm; case: string; run: number; text: string; name: boolean; nature: boolean };
const cases = fixture.cases.filter((c) => !only || only.split(',').includes(c.id));
if (args.includes('--dump')) {
  for (const c of cases) for (const arm of ARMS) console.log(`\n=== ${c.id} (${arm})\n${JSON.stringify(request(arm, c), null, 2).slice(0, 12000)}`);
  process.exit(0);
}

const results: Result[] = [];
const started = Date.now();
const model = argVal('--model', 'default');
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}`);
// Arms interleave run by run, so drift during the batch lands on every arm.
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((arm) => ({ arm, c, run })))).flat();
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++];
    try {
      const text = await chatCompletion(model, request(arm, c), SEED + run);
      const result: Result = {
        arm, case: c.id, run, text, name: new RegExp(c.leak, 'i').test(text), nature: new RegExp(c.nature, 'i').test(text),
      };
      results.push(result);
      console.log(`[${arm}] ${c.id} #${run} name=${+result.name} nature=${+result.nature} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
type Rate = { k: number; n: number };
const rate = (xs: Result[], key: 'name' | 'nature'): Rate => ({ k: xs.filter((r) => r[key]).length, n: xs.length });
const diffCi = (base: Rate, treated: Rate) => {
  if (!base.n || !treated.n) return 'n/a';
  const pa = base.k / base.n, pb = treated.k / treated.n;
  const se = Math.sqrt((pa * (1 - pa)) / base.n + (pb * (1 - pb)) / treated.n);
  return `Δ ${(pb - pa).toFixed(2)} [${(pb - pa - 1.96 * se).toFixed(2)}, ${(pb - pa + 1.96 * se).toFixed(2)}]`;
};
const line = (label: string, xs: Result[]) => {
  for (const key of ['name', 'nature'] as const) {
    const both = rate(xs.filter((r) => r.arm === 'both'), key), control = rate(xs.filter((r) => r.arm === 'control'), key);
    console.log(`${`${label} ${key}`.padEnd(22)} both ${both.k}/${both.n} · control ${control.k}/${control.n} · both−control ${diffCi(control, both)}`);
  }
};

console.log('\nTOTALS (leak rate per arm; Δ = both − control, unpaired 95% CI)');
for (const c of cases) {
  for (const arm of ARMS) {
    const n = results.filter((r) => r.case === c.id && r.arm === arm).length;
    if (n < runs) console.log(`WARNING ${c.id} ${arm}: ${n} of ${runs} runs finished`);
  }
  line(c.id, results.filter((r) => r.case === c.id));
}
const unprompted = new Set(cases.filter((c) => !c.baited).map((c) => c.id));
line('POOLED unprompted', results.filter((r) => unprompted.has(r.case)));

console.log('\nCONTROL HITS (chance only: hand-check each as a scorer false positive)');
for (const r of results.filter((x) => x.arm === 'control' && (x.name || x.nature))) {
  console.log(`- ${r.case} #${r.run} name=${+r.name} nature=${+r.nature}: ${r.text.replace(/\n+/g, ' ¶ ')}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
