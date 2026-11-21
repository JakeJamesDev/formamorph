// Weather narrator probe — does the Weather chip in the narration system prompt keep the story to the World
// Weather, and does its Sheltered note keep weather off a player who is under shelter?
//
// The system prompt is the shipped defaultSystemPrompt, rendered by the production chip values and narration
// builder over Sedge Landing. Arms, paired by run index:
//   control — the scene with Weather off, so the chip renders nothing (today's request)
//   chip    — the same scene with the World Weather set
//
// Cases: open scenes in rain, snow and storm (the story should show that weather); a Sheltered scene in rain
// (the player stays dry); a Clear scene (the false-positive guard: no invented weather in either arm).
//
// The model's own one-word read of each passage at temperature 0 is the judge:
//   shown        the passage shows the case's weather in the scene (up, open cases)
//   contradicts  the passage shows weather the World Weather rules out (down)
//   wet          the player is rained or snowed on (down, the Sheltered case)
//
// It also prints where the Weather block starts in the system prompt next to where the Current Location block
// starts, the prefix a weather change keeps cached against the one a move keeps.
//
// Usage: npx vite-node testing/baseline/harness/weather-narrator-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 8] [--max 600] [--pool 4] [--only rain-out] [--out results.json] [--show]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultSystemPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { resolveEntityText } from '@/lib/placeholders';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { ChatMessage, Entity, WeatherKind } from '@/types';

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
const SEED = 515151;
type Arm = 'control' | 'chip';
const ARMS: Arm[] = ['control', 'chip'];

const world = migrateWorld(JSON.parse(readFileSync(path.resolve('testing/baseline/sedge-landing.json'), 'utf8')));
const placeOf = (id: string) => {
  const found = world.locations.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Sedge Landing fixture is missing ${id}.`);
  return found;
};

type Case = { id: string; weather: WeatherKind; locationId: string; sheltered?: boolean; action: string; checks: string[] };
const CASES: Case[] = [
  { id: 'rain-out', weather: 'rain', locationId: 'loc-sedge', action: 'I walk to the end of the dock and look across the river.', checks: ['shown', 'contradicts'] },
  { id: 'snow-out', weather: 'snow', locationId: 'loc-green', action: 'I cross the green toward the hamlet.', checks: ['shown', 'contradicts'] },
  { id: 'storm-talk', weather: 'storm', locationId: 'loc-sedge', action: 'I ask Odette whether the ferry is running today.', checks: ['shown', 'contradicts'] },
  { id: 'rain-shelter', weather: 'rain', locationId: 'loc-eelhouse', sheltered: true, action: 'I sit down by the smoking racks and warm my hands.', checks: ['wet'] },
  { id: 'clear-out', weather: 'clear', locationId: 'loc-sedge', action: 'I walk to the end of the dock and look across the river.', checks: ['contradicts'] },
];

const scene = (c: Case) => authoredChipScene(world, {
  location: { ...placeOf(c.locationId), ...(c.sheltered && { sheltered: true as const }) },
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});

const systemFor = (arm: Arm, c: Case): string => buildNarrationPrompt({
  template: defaultSystemPrompt, ctx: chipValues({ ...scene(c), weather: arm === 'chip' ? c.weather : null }), action: c.action, history: [], dictionary: [],
  actionVec: null, semanticLore: false, embedVectors: new Map(),
  language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
  sectionStyle: 'markdown', resolvePH: (text) => text,
}).prompt;

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

const READS = ['rain', 'snow', 'storm', 'sunny', 'clear', 'unstated'] as const;
type Read = (typeof READS)[number];
/** The model's one-word read of the weather the passage shows in its scene. */
async function weatherRead(text: string): Promise<Read> {
  const answer = await complete([
    { role: 'system', content: 'You read one passage of a story and name the weather it shows in the scene, here and now.' },
    { role: 'user', content: `Passage:\n${text}\n\nAnswer with exactly one word: ${READS.join(', ')}. Answer unstated when the passage shows no weather.` },
  ] as ChatMessage[], 1, { temperature: 0, max: 5 });
  return READS.find((word) => answer.toLowerCase().includes(word)) ?? 'unstated';
}
async function wetRead(text: string): Promise<boolean> {
  const answer = await complete([
    { role: 'system', content: 'You read one passage of a story and answer one question about it with one word: yes or no.' },
    { role: 'user', content: `Passage:\n${text}\n\nQuestion: In this passage, does rain or snow fall on the player character? Answer yes or no.` },
  ] as ChatMessage[], 1, { temperature: 0, max: 5 });
  return /^\W*yes/i.test(answer);
}

const SHOWN: Record<WeatherKind, Read[]> = { rain: ['rain', 'storm'], snow: ['snow'], storm: ['storm', 'rain'], brightSun: ['sunny'], clear: ['clear', 'sunny'] };
const RULED_OUT: Record<WeatherKind, Read[]> = { rain: ['snow', 'sunny', 'clear'], snow: ['rain', 'storm', 'sunny'], storm: ['snow', 'sunny', 'clear'], brightSun: ['rain', 'snow', 'storm'], clear: ['rain', 'snow', 'storm'] };

type Result = { arm: Arm; case: string; run: number; text: string; read: Read; wet?: boolean };
const CHECKS: Record<string, (r: Result, c: Case) => boolean> = {
  shown: (r, c) => SHOWN[c.weather].includes(r.read),
  contradicts: (r, c) => RULED_OUT[c.weather].includes(r.read),
  wet: (r) => r.wet === true,
};

const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
const sample = systemFor('chip', CASES[0]);
console.log(`prefix kept: Current Location block at char ${sample.indexOf('Current Location')} · Weather block at char ${sample.indexOf('## Weather')} of ${sample.length}`);
const results: Result[] = [];
const started = Date.now();
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}`);
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((arm) => ({ arm, c, run })))).flat();
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++];
    try {
      const text = await complete([{ role: 'system', content: systemFor(arm, c) }, { role: 'user', content: c.action }] as ChatMessage[], SEED + run);
      const result: Result = { arm, case: c.id, run, text, read: await weatherRead(text), ...(c.checks.includes('wet') && { wet: await wetRead(text) }) };
      results.push(result);
      console.log(`[${arm}] ${c.id} #${run} read=${result.read} ${c.checks.map((check) => `${check}=${CHECKS[check](result, c) ? 1 : 0}`).join(' ')} · ${text.split(/\s+/).length}w`);
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
      return `${arm} ${of.filter((r) => CHECKS[check](r, c)).length}/${of.length}`;
    });
    console.log(`${`${c.id} ${check}`.padEnd(26)} ${cells.join(' · ')}`);
  }
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
