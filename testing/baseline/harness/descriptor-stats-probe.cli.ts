// Descriptor-only stats probe — do the Narration and Choices prompts leak fewer stat numbers when the Persona
// and Here-scope Entities chips send stats as Descriptor only? Sedge Landing with the stats of
// persona-stats-chip-cases.json on the player and entity-stats-chip-cases.json on the cast.
//
// Arms, paired by run index in one batch: `old` (the chips send Range, Descriptor and Description) and `new`
// (`norange.nodescription`). Both arms derive from the live defaults, whichever form those hold. Every other
// byte is shared.
//
// Checks:
//   numeral-leak — the output repeats a stat value, a range or a percent (headline on narration, down)
//   label-leak   — the output repeats a stat label such as "Calm:" or "**Resolve**" (down)
//   rattled      — the narration shows the player shaken or wavering (stats still shape the story)
//   contract     — 3 to 5 option lines, each one "I ..." clause of at most 25 words (choices guard, up)
// Also reported per arm: mean prompt tokens (from the server's usage) and mean words.
//
// Usage: npx vite-node testing/baseline/harness/descriptor-stats-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 6] [--max 600] [--only narr-bram,choice-odette] [--pool 4]
//          [--out DIR] [--dump]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultChoicesPrompt, defaultChoicesUserPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues, sceneEntityChipValues } from '@/lib/chipValues/chipValues';
import { resolveEntityText } from '@/lib/placeholders';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { layerValues } from '@/lib/promptValues';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { Entity, Stat } from '@/types';

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
const outDir = argVal('--out', '.scratch/descriptor-stats-probe');
const ARMS = ['old', 'new'] as const;
type Arm = typeof ARMS[number];

// The Persona chip and the Here-scope Entities chip: the two that send stats by default.
const STAT_CHIPS = /<(PERSONA|ENTITIES)\|(summary\.)?(?:norange\.nodescription\.)?markdown\|/g;
const withDetail = (template: string, ids: string) => template.replace(STAT_CHIPS, `<$1|$2${ids}markdown|`);
const TEMPLATES: Record<Arm, { narration: string; choices: string }> = {
  old: { narration: withDetail(defaultSystemPrompt, ''), choices: withDetail(defaultChoicesPrompt, '') },
  new: { narration: withDetail(defaultSystemPrompt, 'norange.nodescription.'), choices: withDetail(defaultChoicesPrompt, 'norange.nodescription.') },
};
for (const kind of ['narration', 'choices'] as const) {
  const changed = TEMPLATES.new[kind].match(/norange\.nodescription/g)?.length ?? 0;
  if (changed !== 2) throw new Error(`The ${kind} template changes ${changed} chips, not 2.`);
}

type Kind = 'narration' | 'choices';
type Case = { id: string; kind: Kind | 'planning'; action?: string; narration?: string; scene?: string[] };
type ProbeCase = Case & { kind: Kind };
const BASELINE = path.resolve('testing/baseline');
const base = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const entityFixture = JSON.parse(readFileSync(path.join(BASELINE, 'entity-stats-chip-cases.json'), 'utf8')) as {
  entityStats: Record<string, Stat[]>;
};
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'persona-stats-chip-cases.json'), 'utf8')) as {
  personaStats: Stat[]; cases: Case[];
};
const location = base.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const you: Entity = { id: 'ent-you', name: 'You', customPersona: true, stats: fixture.personaStats };
const cast = base.entities.map((e) => (entityFixture.entityStats[e.id] ? { ...e, stats: entityFixture.entityStats[e.id] } : e));
const scene = authoredChipScene({ ...base, entities: [...cast, you] }, {
  location,
  activeTraitIds: base.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});
if (!scene.playedStats?.some((part) => part.stats.length)) throw new Error('The scene holds no persona stats.');
const ctx = chipValues(scene);

const STAT_LABELS = [...new Set([...fixture.personaStats, ...Object.values(entityFixture.entityStats).flat()].map((s) => s.name))];
const NAMED_VALUE = new RegExp(`\\b(${STAT_LABELS.join('|')})\\b[^.\\n]{0,12}\\b\\d+\\b`, 'i');
const contract = (text: string) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length >= 3 && lines.length <= 5 && lines.every((l) => /^I\b/.test(l) && l.split(/\s+/).length <= 25);
};
const CHECKS: Record<string, (text: string) => boolean> = {
  'numeral-leak': (t) => /\b\d+\s*(\/\s*\d+|percent|%| out of)/i.test(t) || NAMED_VALUE.test(t),
  'label-leak': (t) => STAT_LABELS.some((l) => new RegExp(`\\*\\*${l}\\*\\*|\\b${l}:`).test(t)),
  rattled: (t) => /\b(shak\w*|trembl\w*|nervous\w*|jitter\w*|rattled|unsteady|uneas\w*|anxi\w*|on edge|hesita\w*|swallow\w*|clammy|falter\w*|waver\w*|doubt\w*|fear\w*|afraid|dread\w*|pulse)\b/i.test(t),
  contract,
};
const CASE_CHECKS: Record<Kind, string[]> = { narration: ['numeral-leak', 'label-leak', 'rattled'], choices: ['numeral-leak', 'label-leak', 'contract'] };

function request(arm: Arm, c: ProbeCase): { system: string; user: string; max?: number } {
  if (c.kind === 'choices') {
    const values = layerValues(ctx, sceneEntityChipValues(scene, c.scene ?? []), { '<LANGUAGE>': '' });
    return {
      system: renderPromptTemplate(TEMPLATES[arm].choices, values),
      user: renderPromptTemplate(defaultChoicesUserPrompt, layerValues(values, { '<NARRATION>': c.narration ?? '' })),
      max: 220,
    };
  }
  const system = buildNarrationPrompt({
    template: TEMPLATES[arm].narration, ctx, action: c.action ?? '', history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  return { system, user: c.action ?? '' };
}

async function complete(req: ReturnType<typeof request>): Promise<{ text: string; promptTokens: number }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Narration and choices are unpinned, so they send no temperature.
      body: JSON.stringify({
        model, max_tokens: req.max ?? maxTokens, reasoning_effort: 'none', stream: false,
        messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
      }),
    });
    if (res.ok) {
      const body = await res.json() as { choices: Array<{ message: { content: string | null } }>; usage?: { prompt_tokens?: number } };
      return { text: body.choices[0].message.content ?? '', promptTokens: body.usage?.prompt_tokens ?? 0 };
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}

const cases = fixture.cases.filter((c): c is ProbeCase => c.kind !== 'planning' && (!only || only.split(',').includes(c.id)));
if (args.includes('--dump')) {
  for (const arm of ARMS) for (const c of cases) console.log(`\n=== ${c.id} (${arm})\n${request(arm, c).system}`);
  process.exit(0);
}

type Result = { arm: Arm; case: string; kind: Kind; run: number; text: string; promptTokens: number };
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
      const { text, promptTokens } = await complete(request(arm, c));
      results.push({ arm, case: c.id, kind: c.kind, run, text, promptTokens });
      const hits = CASE_CHECKS[c.kind].map((check) => `${check}=${CHECKS[check](text) ? 1 : 0}`).join(' ');
      console.log(`[${arm}] ${c.id} #${run} ${hits} · ${promptTokens}pt · ${text.split(/\s+/).length}w`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[${arm}] ${c.id} #${run} FAILED ${message.slice(0, 160)}`);
    }
  }
}));

mkdirSync(outDir, { recursive: true });
for (const arm of ARMS) {
  const body = results.filter((r) => r.arm === arm).sort((a, b) => a.case.localeCompare(b.case) || a.run - b.run)
    .map((r) => `## ${r.case} #${r.run}\n\n${r.text}\n`).join('\n');
  writeFileSync(path.join(outDir, `${arm}.md`), body);
}

const rate = (xs: Result[], test: (t: string) => boolean) => ({ k: xs.filter((r) => test(r.text)).length, n: xs.length });
const diffCi = (a: { k: number; n: number }, b: { k: number; n: number }) => {
  if (!a.n || !b.n) return 'n/a';
  const pa = a.k / a.n, pb = b.k / b.n;
  const se = Math.sqrt((pa * (1 - pa)) / a.n + (pb * (1 - pb)) / b.n);
  return `Δ ${(pb - pa).toFixed(2)} [${(pb - pa - 1.96 * se).toFixed(2)}, ${(pb - pa + 1.96 * se).toFixed(2)}]`;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Prints each check's old and new rates and the mean prompt tokens for one slice of the results. */
function report(label: string, slice: Result[], checks: string[]) {
  const armResults = (arm: Arm) => slice.filter((r) => r.arm === arm);
  for (const check of checks) {
    const [oldRate, newRate] = ARMS.map((arm) => rate(armResults(arm), CHECKS[check]));
    console.log(`${`${label} ${check}`.padEnd(28)} old ${oldRate.k}/${oldRate.n} · new ${newRate.k}/${newRate.n}  ${diffCi(oldRate, newRate)}`);
  }
  const [oldTokens, newTokens] = ARMS.map((arm) => mean(armResults(arm).map((r) => r.promptTokens)));
  console.log(`${`${label} prompt tokens`.padEnd(28)} old ${oldTokens.toFixed(0)} · new ${newTokens.toFixed(0)} · saved ${(oldTokens - newTokens).toFixed(0)}`);
}

console.log('\nPER CASE (Δ = new − old, 95% CI)');
for (const c of cases) report(c.id, results.filter((r) => r.case === c.id), CASE_CHECKS[c.kind]);
console.log('\nPOOLED');
for (const kind of ['narration', 'choices'] as const) report(kind, results.filter((r) => r.kind === kind), CASE_CHECKS[kind]);
console.log(`outputs in ${outDir}/old.md and new.md`);
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
