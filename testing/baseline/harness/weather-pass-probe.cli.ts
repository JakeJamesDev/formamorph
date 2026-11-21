// Weather Pass probe — does the pass change the World Weather when the scene shows it, and hold it through the
// traps the prompt names: metaphor, past or remembered weather, weather reported from elsewhere, and weather a
// character only talks about?
//
// Requests come from the production pass record (weatherPass.buildRequest) over the shipped prompts, so the reply
// format, the offered kinds and the schema are exactly what a turn sends. Replies parse through the pass's own
// parser and the Turn Commit's offer filter.
//
// Arms, interleaved run by run so cloud drift lands on all of them:
//   schema   — the schema request, what a turn sends first (the production path)
//   text     — the text request, what an endpoint that refuses the schema gets
//   noTraps  — the text request with the trap line ablated: the in-batch control that weighs that line
//   alt      — the schema request with the system prompt read from --alt <file>, for iterating a candidate
//
// Cases: `change` cases have a right new kind; `hold` cases (traps and quiet scenes) want the weather unchanged.
// The `open-` cases are the page-one read: no weather before the passage, and Clear when the scene shows none.
//
// Metrics per arm:
//   change ACCURACY  the answer is the case's expected kind
//   hold   HOLD      the weather stays as it was (no change, or the current kind named again)
//   INVALID          a reply that names nothing offered (reads as no change in the game)
//
// Usage: npx vite-node testing/baseline/harness/weather-pass-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 12] [--pool 4] [--only rain-starts,metaphor] [--arms schema,alt] [--alt prompt.txt]
//          [--out results.json] [--show]
import { readFileSync, writeFileSync } from 'node:fs';
import { defaultWeatherPrompt, defaultWeatherUserPrompt } from '@/components/game/GamePrompts';
import { responseFormat } from '@/lib/aiRequest/responseSchema';
import { weatherPass } from '@/lib/turnPipeline/turnPasses';
import { emptyTurnMaterial } from '@/lib/turnPipeline/turnPlan';
import { TEST_PROMPTS, testInput } from '@/lib/turnPipeline/turnTestInputs';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import type { ChatMessage, WeatherKind } from '@/types';

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
const SEED = 424242;
const TRAP_LINE = /^- Weather in a figure of speech.*\n/m;

type Arm = 'schema' | 'text' | 'noTraps' | 'alt';
const ALT = argVal('--alt', '');
const ALT_PROMPT = ALT ? readFileSync(ALT, 'utf8').trimEnd() : '';
const ARMS: Arm[] = argVal('--arms', '') ? (argVal('--arms', '').split(',') as Arm[]) : ['schema', 'text', 'noTraps', ...(ALT ? ['alt' as const] : [])];

type Case = { id: string; kind: 'change' | 'hold'; current: WeatherKind | null; offered: WeatherKind[]; action: string; narration: string; expect: WeatherKind };
const ALL: WeatherKind[] = ['clear', 'rain', 'snow', 'storm', 'brightSun'];
const NIGHT: WeatherKind[] = ['clear', 'rain', 'snow', 'storm'];
const CASES: Case[] = [
  { id: 'rain-starts', kind: 'change', current: 'clear', offered: ALL, expect: 'rain', action: 'I keep walking toward the mill.',
    narration: 'The first drops strike the dust of the road, then more, until a steady rain is drumming on your hood and running off the brim. The mill wheel ahead turns grey behind the falling water.' },
  { id: 'storm-breaks', kind: 'change', current: 'rain', offered: ALL, expect: 'storm', action: 'I hurry along the cliff path.',
    narration: 'Thunder cracks directly overhead. The rain turns to sheets, wind tears at your cloak, and a fork of lightning splits the sky over the bay as the storm breaks in earnest.' },
  { id: 'clears', kind: 'change', current: 'rain', offered: ALL, expect: 'clear', action: 'I wait under the awning until it passes.',
    narration: 'The rain thins to nothing. The clouds pull apart, the last drops fall from the awning, and the street steams under a clean, empty sky.' },
  { id: 'snow-starts', kind: 'change', current: 'clear', offered: ALL, expect: 'snow', action: 'I climb toward the pass.',
    narration: 'The air bites colder with every step. Flakes begin to drift down, a few at first, then thick and silent, settling on the rocks and on your shoulders until the trail ahead is white.' },
  { id: 'sun-out', kind: 'change', current: 'clear', offered: ALL, expect: 'brightSun', action: 'I step out of the inn into the square.',
    narration: 'The sun stands high and hard over the square. Light glares off the whitewashed walls, the cobbles are hot underfoot, and you squint against the blaze.' },
  { id: 'steady-rain', kind: 'hold', current: 'rain', offered: ALL, expect: 'rain', action: 'I ask the ferryman when he leaves.',
    narration: '"When the river lets me," the ferryman says, pulling his oilskin tighter as the rain keeps falling on the dock. "Not before noon."' },
  { id: 'indoor-quiet', kind: 'hold', current: 'storm', offered: ALL, expect: 'storm', action: 'I sit down at the corner table and order stew.',
    narration: 'The innkeeper sets a steaming bowl in front of you and wipes her hands on her apron. "Bread is extra," she says, and heads back to the kitchen.' },
  { id: 'metaphor', kind: 'hold', current: 'clear', offered: ALL, expect: 'clear', action: 'I tell the captain the cargo is gone.',
    narration: 'The captain\'s face darkens like a thunderhead. A storm of curses rains down on you, and the crew go quiet, waiting for the lightning of his temper to strike someone.' },
  { id: 'past-snow', kind: 'hold', current: 'clear', offered: ALL, expect: 'clear', action: 'I look over the fields.',
    narration: 'Last winter\'s snow lay on these fields until spring, the farmer tells you. Today the furrows are dry and brown, and a lark sings somewhere above them.' },
  { id: 'reported', kind: 'hold', current: 'clear', offered: ALL, expect: 'clear', action: 'I ask the traveler about the road north.',
    narration: '"Snowing hard in the high pass," the traveler says, stamping his boots. "Came through a blizzard two days back. You won\'t get a cart over it this week."' },
  { id: 'talk-only', kind: 'hold', current: 'clear', offered: ALL, expect: 'clear', action: 'I ask the farmer if we will get rain.',
    narration: 'The farmer squints at the horizon. "Rain by tomorrow, maybe a storm if the wind turns," she says. "My knee always knows." She goes back to mending the fence.' },
  { id: 'memory', kind: 'hold', current: 'rain', offered: ALL, expect: 'rain', action: 'I think about home.',
    narration: 'For a moment you remember the bright summer mornings of your childhood, sun pouring through the kitchen window. Then the drip from the eaves pulls you back to the grey street.' },
  { id: 'open-rain', kind: 'change', current: null, offered: ALL, expect: 'rain', action: 'START GAME',
    narration: 'Rain hammers the slate roofs of the harbor town as you step off the gangplank, water sheeting from the eaves and pooling between the cobbles.' },
  { id: 'open-none', kind: 'hold', current: null, offered: ALL, expect: 'clear', action: 'START GAME',
    narration: 'You sit across the chessboard from the old abbot in the candlelit library. He moves a knight and folds his hands, waiting for your reply.' },
  { id: 'open-told', kind: 'hold', current: null, offered: ALL, expect: 'clear', action: 'START GAME',
    narration: 'The guard at the gate looks you over. "Storm coming tonight, they say," he grunts, and waves you through into the quiet market square.' },
  { id: 'sun-at-night', kind: 'hold', current: 'clear', offered: NIGHT, expect: 'clear', action: 'I look up at the sky.',
    narration: 'The stars are out, hard and bright, and the moon throws your shadow across the courtyard. The night air is still and cool.' },
];

const prompts = (arm: Arm) => ({
  ...TEST_PROMPTS,
  weather: arm === 'alt' ? ALT_PROMPT : arm === 'noTraps' ? defaultWeatherPrompt.replace(TRAP_LINE, '') : defaultWeatherPrompt,
  weatherUser: defaultWeatherUserPrompt,
});

function request(arm: Arm, c: Case) {
  const input = testInput({ prompts: prompts(arm), isGameStarted: c.current !== null, weather: { current: c.current ?? 'clear', offered: c.offered, startWeatherSet: false } }, { weatherTextPass: arm === 'text' || arm === 'noTraps' });
  const material = { ...emptyTurnMaterial({ action: c.action, effectiveAction: c.action, turnId: c.id, baseCtx: {}, destinations: [] }), narration: c.narration };
  const built = weatherPass.buildRequest(input, material);
  const messages = [{ role: 'system', content: built.systemPrompt }, ...built.messages] as ChatMessage[];
  return { messages, maxTokens: built.maxTokens ?? 24, schema: built.responseSchema };
}

const pins = PROMPT_SAMPLER_PINS.weather ?? {};
async function complete(arm: Arm, c: Case, seed: number): Promise<string> {
  const { messages, maxTokens, schema } = request(arm, c);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: maxTokens, reasoning_effort: 'none', stream: false,
        temperature: pins.temperature, ...(pins.repetitionPenalty !== undefined && { repetition_penalty: pins.repetitionPenalty }),
        ...(schema && { response_format: responseFormat(schema) }),
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

/** The World Weather the commit leaves: the pass's answer when it is offered, else the current weather. */
const resulting = (raw: string, c: Case): { weather: WeatherKind; invalid: boolean } => {
  const answer = weatherPass.parseResponse(raw, emptyTurnMaterial({ action: '', effectiveAction: '', turnId: '', baseCtx: {}, destinations: [] }));
  const named = /no change|"shown"\s*:\s*"no"|^\W*no\b/i.test(raw) || answer !== null;
  return { weather: answer && c.offered.includes(answer) ? answer : c.current ?? 'clear', invalid: !named || (answer !== null && !c.offered.includes(answer)) };
};

type Result = { arm: Arm; case: string; run: number; raw: string; weather: WeatherKind; invalid: boolean; ok: boolean };
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
      const raw = await complete(arm, c, SEED + run);
      const { weather, invalid } = resulting(raw, c);
      const ok = weather === c.expect;
      results.push({ arm, case: c.id, run, raw, weather, invalid, ok });
      console.log(`[${arm}] ${c.id} #${run} ${ok ? 'ok' : 'MISS'} -> ${weather}${invalid ? ' INVALID' : ''}${args.includes('--show') ? ` · ${JSON.stringify(raw)}` : ''}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
const share = (rows: Result[], pick: (r: Result) => boolean) => `${rows.filter(pick).length}/${rows.length}`;
console.log('\nPER CASE (ok / runs)');
for (const c of cases) {
  console.log(`${`${c.kind} ${c.id}`.padEnd(24)} ${ARMS.map((arm) => `${arm} ${share(results.filter((r) => r.case === c.id && r.arm === arm), (r) => r.ok)}`).join(' · ')}`);
}
console.log('\nTOTALS');
for (const arm of ARMS) {
  const of = results.filter((r) => r.arm === arm);
  const change = of.filter((r) => cases.find((c) => c.id === r.case)?.kind === 'change');
  const hold = of.filter((r) => cases.find((c) => c.id === r.case)?.kind === 'hold');
  console.log(`${arm.padEnd(8)} change ${share(change, (r) => r.ok)} · hold ${share(hold, (r) => r.ok)} · invalid ${share(of, (r) => r.invalid)}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
