// Other Traits probe — what changes when the narration prompt places the world's player traits after the
// persona block, headed "Other Traits", in place of before it, headed "Traits"? Sedge Landing with a played
// library persona nobody in the scene has been told about.
//
// Arms, paired by run index: `control` (the Traits chip before the Persona chip, headed "Traits") and `other` (the working tree's order and header). Every other
// byte is shared.
//
// Checks:
//   player-name     — the narration names the player, whom nobody here knows (guard, down)
//   npc-name-leak   — the narration names Bram or Odette, who have not given their names (guard, down)
//   stat-tabulation — a stat line such as "Vigor: 23", as narration-probe flags it (guard, down)
//   numeral-leak    — the narration repeats a stat value, a range or a percent (guard, down)
//   trait-uptake    — the narration shows one of the player's world traits on the player: Wren's look or
//                     skills, or the footsore trait's tired feet (up)
// Also reported per arm: mean words and the share of outputs with quoted dialogue (regression check).
//
// Usage: npx vite-node testing/baseline/harness/other-traits-probe.cli.ts --
//          [--endpoint URL] [--model default] [--runs 8] [--max 600] [--only narr-bram] [--pool 4]
//          [--dump] [--show]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultSystemPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { resolveEntityText } from '@/lib/placeholders';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { Entity } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '8'));
const maxTokens = Number(argVal('--max', '600'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const ARMS = ['control', 'other'] as const;
const SEED = 828282;

// The template's trailing backslashes are line continuations, so the chips sit back to back in the string.
const PERSONA_CHIP = '<PERSONA|markdown|header="{{user}} (Player Character)">';
const OTHER_CHIP = '<TRAITS DESCRIPTION|markdown|header="Other Traits">';
const OLD_CHIP = '<TRAITS DESCRIPTION|markdown|header="Traits">';
if (!defaultSystemPrompt.includes(PERSONA_CHIP + OTHER_CHIP)) throw new Error('The narration prompt does not place Other Traits after the Persona chip.');
const TEMPLATES = { control: defaultSystemPrompt.replace(PERSONA_CHIP + OTHER_CHIP, OLD_CHIP + PERSONA_CHIP), other: defaultSystemPrompt };
if (TEMPLATES.control === TEMPLATES.other) throw new Error('The control arm matches the other arm.');

const BASELINE = path.resolve('testing/baseline');
const base = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'entity-stats-chip-cases.json'), 'utf8')) as {
  cases: Array<{ id: string; kind: string; action?: string }>;
};
const location = base.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const sylvie: Entity = {
  id: 'probe-sylvie', name: 'Sylvie Thornwhistle', pronouns: 'she/her',
  aiDescription: 'A traveling herbalist with a satchel of dried roots, quick-eyed and a little too curious.',
};
const resolveOwn = (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} });
const scene = {
  ...authoredChipScene(base, {
    location,
    activeTraitIds: base.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
    resolve: (text: string) => text,
    resolveEntity: resolveOwn,
  }),
  persona: { source: 'library' as const, entity: sylvie },
  playerName: sylvie.name,
};
const ctx = chipValues(scene);

// Guards: fewer hits is better. Uptake: more is better.
const CHECKS: Record<string, (text: string) => boolean> = {
  'player-name': (t) => /\b(Sylvie|Thornwhistle)\b/.test(t),
  'npc-name-leak': (t) => /\b(Bram|Odette)\b/.test(t),
  'stat-tabulation': (t) => /(^|\n)\s*[-*]?\s*(vigor|resolve|coin|hp|health|strength|stat)\s*:?\s*[+-]?\d/i.test(t),
  'numeral-leak': (t) => /\b\d+\s*(\/\s*\d+|percent|%| out of)/i.test(t) || /\b(vigor|resolve)\b[^.\n]{0,12}\b\d+\b/i.test(t),
  'trait-uptake': (t) => /\b(ink|silver|mapmak|tollow|knot|footsore|foot-?sore|sore|tired|tire[sd]?|ache[sd]?|aching|weary|travel-worn|missing (the last )?(two )?fingers?|three fingers|cannot swim|can't swim)\b/i.test(t),
};
const UP = new Set(['trait-uptake']);
const DIALOGUE = /["“][^"”]{3,}["”]/;

function system(arm: typeof ARMS[number], action: string): string {
  return buildNarrationPrompt({
    template: TEMPLATES[arm], ctx, action, history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
}

async function complete(sys: string, user: string, seed: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Narration is unpinned, so it sends no temperature.
      body: JSON.stringify({
        model, seed, max_tokens: maxTokens, reasoning_effort: 'none', stream: false,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      }),
    });
    if (res.ok) {
      const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      return body.choices[0].message.content ?? '';
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}

const cases = fixture.cases.filter((c) => c.kind === 'narration' && (!only || only.split(',').includes(c.id)));
if (args.includes('--dump')) {
  for (const arm of ARMS) {
    const prompt = system(arm, cases[0]?.action ?? '');
    const at = prompt.indexOf('(Player Character)');
    console.log(`\n--- ${arm}\n${prompt.slice(Math.max(0, at - 700), at + 700)}`);
  }
  process.exit(0);
}

type Result = { arm: typeof ARMS[number]; case: string; run: number; text: string };
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
      const text = await complete(system(arm, c.action ?? ''), c.action ?? '', SEED + run);
      results.push({ arm, case: c.id, run, text });
      const hits = Object.keys(CHECKS).map((check) => `${check}=${CHECKS[check](text) ? 1 : 0}`).join(' ');
      console.log(`[${arm}] ${c.id} #${run} ${hits} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[${arm}] ${c.id} #${run} FAILED ${message.slice(0, 160)}`);
    }
  }
}));

const rate = (xs: Result[], test: (t: string) => boolean) => ({ k: xs.filter((r) => test(r.text)).length, n: xs.length });
const words = (xs: Result[]) => (xs.length ? (xs.reduce((s, r) => s + r.text.split(/\s+/).length, 0) / xs.length).toFixed(0) : '-');
console.log('\nTOTALS (↓ = fewer wanted, ↑ = more wanted)');
for (const scope of [...cases.map((c) => c.id), 'all']) {
  const of = (arm: string) => results.filter((r) => r.arm === arm && (scope === 'all' || r.case === scope));
  for (const check of Object.keys(CHECKS)) {
    const [a, b] = [rate(of('control'), CHECKS[check]), rate(of('other'), CHECKS[check])];
    console.log(`${`${scope} ${check}`.padEnd(30)} ${UP.has(check) ? '↑' : '↓'}  control ${a.k}/${a.n} · other ${b.k}/${b.n}`);
  }
  const [da, db] = [rate(of('control'), (t) => DIALOGUE.test(t)), rate(of('other'), (t) => DIALOGUE.test(t))];
  console.log(`${`${scope} words / dialogue`.padEnd(30)}    control ${words(of('control'))}w ${da.k}/${da.n} · other ${words(of('other'))}w ${db.k}/${db.n}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
