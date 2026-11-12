// Time-delta probe: does the clock pass ('timePassed') land the story clock where the scene ends?
//
// Each case in ../time-delta-cases.json (or --cases ../time-delta-short-cases.json, the dialogue set) is an
// (action, narration) pair with a start hour and a ground-truth range in hours. `anchor-` cases run until a time
// of day, so their right answer depends on the start hour.
//
// Arms, dispatched together per run so model drift lands on both:
//   shipped  the in-batch control: the clock prompt and parser at --ref (default: the commit before anchors),
//            over the same user message
//   text     the app's own request, built by the real pass record, scored by the real parser and anchor math
//
// Usage: npx vite-node testing/baseline/harness/time-delta-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 12] [--cases time-delta-short-cases.json] [--only id,id]
//          [--ref <sha>] [--verbose] [--show]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';
import { defaultTimePassedPrompt, defaultTimePassedUserPrompt } from '@/components/game/GamePrompts';
import { CLOCK_TEXT_FORMAT, FLAT_HOURS_PER_TURN, readingHours, type ClockReading } from '@/lib/gameClock';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { TURN_PASSES } from '@/lib/turnPipeline/turnPasses';
import { emptyTurnMaterial } from '@/lib/turnPipeline/turnPlan';
import { testInput, TEST_PROMPTS } from '@/lib/turnPipeline/turnTestInputs';
import type { ChatMessage } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '12'));
const casesFile = argVal('--cases', 'time-delta-cases.json');
const only = argVal('--only', '');
const ref = argVal('--ref', '8b9ea6e4e');
const verbose = args.includes('--verbose');
const show = args.includes('--show');

interface Case { id: string; start: number; action: string; narration: string; min: number; max: number }
const cases = (JSON.parse(readFileSync(path.resolve('testing/baseline', casesFile), 'utf8')) as Case[])
  .filter((c) => !only || only.split(',').includes(c.id));

// The control: the clock prompt and parser as they stood at `ref`.
const atRef = (file: string) => execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
const promptAtRef = (source: string, name: string): string => {
  const at = source.indexOf(`${name} = \``);
  if (at === -1) throw new Error(`${ref} has no ${name}`);
  const from = source.indexOf('`', at) + 1;
  return source.slice(from, source.indexOf('`;', from)).replaceAll('\\\n', '');
};
const refPrompts = atRef('src/components/game/GamePrompts.ts');
const SHIPPED_SYSTEM = promptAtRef(refPrompts, 'defaultTimePassedPrompt');
if (promptAtRef(refPrompts, 'defaultTimePassedUserPrompt') !== defaultTimePassedUserPrompt.replaceAll('\\\n', '')) {
  throw new Error(`the clock user prompt changed since ${ref}: the control would not share the text arm's user message`);
}
const { code } = await transform(atRef('src/lib/gameClock.ts'), { loader: 'ts', format: 'esm' });
const refClock = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`) as {
  parseTimeDelta: (reply: string) => number | null;
};

const clockPass = TURN_PASSES.find((p) => p.id === 'timePassed');
if (!clockPass) throw new Error('no clock pass');
const input = testInput({ prompts: { ...TEST_PROMPTS, timePassed: defaultTimePassedPrompt, timePassedUser: defaultTimePassedUserPrompt } }, { aiClock: true });
const requestFor = (c: Case) => clockPass.buildRequest(input, {
  ...emptyTurnMaterial({ action: c.action, effectiveAction: c.action, turnId: 'probe', baseCtx: {}, destinations: [] }),
  narration: c.narration,
});

/** Day 2 at the case's start hour, on a calendar that opens at midnight. */
const CALENDAR = { startHour: 0 };
const startOf = (c: Case) => 24 + c.start;

interface Arm { name: string; system: (c: Case) => string; messages: (c: Case) => ChatMessage[]; cap: (c: Case) => number; hours: (raw: string, c: Case) => number | null }
const ARMS: Arm[] = [
  {
    name: 'shipped',
    system: () => SHIPPED_SYSTEM,
    messages: (c) => requestFor(c).messages.map((m) => ({ ...m, content: m.content.replace(CLOCK_TEXT_FORMAT, '') })),
    cap: (c) => requestFor(c).maxTokens,
    hours: (raw) => refClock.parseTimeDelta(raw),
  },
  {
    name: 'text',
    system: (c) => requestFor(c).systemPrompt,
    messages: (c) => requestFor(c).messages,
    cap: (c) => requestFor(c).maxTokens,
    hours: (raw, c) => {
      const reading = clockPass.parseResponse(raw, emptyTurnMaterial({ action: '', effectiveAction: '', turnId: 'probe', baseCtx: {}, destinations: [] })) as ClockReading | null;
      return reading && readingHours(reading, startOf(c), CALENDAR);
    },
  },
];

if (show) {
  for (const arm of ARMS) console.log(`--- ${arm.name}\n${arm.system(cases[0])}\n\n${arm.messages(cases[0]).map((m) => m.content).join('\n')}\n`);
  process.exit(0);
}

const pins = PROMPT_SAMPLER_PINS.timePassed ?? {};
async function post(system: string, messages: ChatMessage[], maxTokens: number, attempt = 1): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: maxTokens, temperature: pins.temperature ?? 0, reasoning_effort: 'none', stream: false,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (res.status >= 500 && attempt < 4) {
    await new Promise((done) => setTimeout(done, 2000 * attempt));
    return post(system, messages, maxTokens, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
  return body.choices[0].message.content ?? '';
}

const fmt = (h: number) => (h >= 24 ? `${(h / 24).toFixed(1)}d` : h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`);
const inRange = (h: number | null, c: Case) => h !== null && h >= c.min && h <= c.max;
const pct = (n: number, d: number) => `${Math.round((n / Math.max(1, d)) * 100)}%`;
const score = Object.fromEntries(ARMS.map((a) => [a.name, { hit: 0, total: 0, unparseable: 0, anchHit: 0, anchTotal: 0 }]));
let flatHit = 0;
let flatTotal = 0;

console.log(`arms ${ARMS.map((a) => a.name).join(', ')} · control at ${ref} · ${casesFile} · ${cases.length} cases · model ${model} · runs ${runs}\n`);
for (const c of cases) {
  const got: Record<string, (number | null)[]> = Object.fromEntries(ARMS.map((a) => [a.name, []]));
  for (let r = 0; r < runs; r++) {
    const replies = await Promise.all(ARMS.map((arm) => post(arm.system(c), arm.messages(c), arm.cap(c))));
    ARMS.forEach((arm, i) => {
      const hours = arm.hours(replies[i], c);
      const s = score[arm.name];
      s.total++;
      if (hours === null) s.unparseable++;
      if (inRange(hours, c)) s.hit++;
      if (c.id.startsWith('anchor-')) { s.anchTotal++; if (inRange(hours, c)) s.anchHit++; }
      got[arm.name].push(hours);
      if (verbose) console.log(`    ${c.id}#${r + 1} ${arm.name} "${replies[i].replace(/\s+/g, ' ').slice(0, 80)}" -> ${hours === null ? 'unparseable' : fmt(hours)}`);
    });
  }
  flatTotal += runs;
  if (inRange(FLAT_HOURS_PER_TURN, c)) flatHit += runs;
  console.log(`${c.id.padEnd(16)} start ${String(c.start).padStart(2, '0')}:00  want ${fmt(c.min)}..${fmt(c.max)}`);
  for (const arm of ARMS) {
    const ok = got[arm.name].filter((h) => inRange(h, c)).length;
    console.log(`  ${ok === runs ? 'OK  ' : ok === 0 ? 'MISS' : 'part'} ${arm.name.padEnd(8)} ${ok}/${runs}  ${got[arm.name].map((h) => (h === null ? '??' : fmt(h))).join(' ')}`);
  }
}

console.log('');
for (const arm of ARMS) {
  const s = score[arm.name];
  console.log(`${arm.name.padEnd(8)} in range ${pct(s.hit, s.total)} (${s.hit}/${s.total}) · anchored ${pct(s.anchHit, s.anchTotal)} (${s.anchHit}/${s.anchTotal}) · unanchored ${pct(s.hit - s.anchHit, s.total - s.anchTotal)} · unparseable ${pct(s.unparseable, s.total)}`);
}
console.log(`flat 1h  in range ${pct(flatHit, flatTotal)} (${flatHit}/${flatTotal})`);
