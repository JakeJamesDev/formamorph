// Choices order quality probe — does a new section order (choicesOrder.mjs) cost choice quality? Replays
// captured choices requests from AI-context dumps in each arm, through FormamorphServer's live hosted run
// (testing key), with paired seeds across arms. Each dump turn's next action is what the player actually did.
//
// Per reply: the shipped contract (world-probe-score), words per option, marks the rules forbid (numbering,
// bullets, quotes), whether an option names someone in the current-location roster, and pick recall: the
// best word overlap between an option and the player's next action (exact picks reported apart).
//
// Usage: npx vite-node testing/baseline/harness/choices-order-quality-probe.mjs -- <dump.json> [...more]
//          [--arms A,C,D] [--per-dump 8] [--runs 3] [--concurrency 4] [--server ../FormamorphServer]
//          [--out FILE] [--rescore FILE] [--show] [--endpoint URL] [--model NAME]
//   --endpoint An OpenAI-compatible base URL called directly (e.g. Demo AI), in place of the server run.
//   --rescore  A stored run file: scores its replies again, sends nothing.
//   --show     Prints every reply under its case.
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { parseChoices } from '@/lib/choices';
import { TURN_PASS_CAPS } from '@/lib/turnPipeline/turnPasses';
import { scoreTurn } from './world-probe-score';
import { messagesFor } from './choicesOrder.mjs';

const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name, fallback = null) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const valued = new Set(['--arms', '--per-dump', '--runs', '--concurrency', '--server', '--out', '--rescore', '--endpoint', '--model']);
const dumps = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
const arms = option('--arms', 'A,C,D').split(',').map((s) => s.trim());
const perDump = Number(option('--per-dump', '8'));
const runs = Number(option('--runs', '3'));
const concurrency = Number(option('--concurrency', '4'));
const server = path.resolve(option('--server', path.resolve(process.cwd(), '../FormamorphServer')));
const rescore = option('--rescore');
const show = args.includes('--show');
const endpoint = option('--endpoint')?.replace(/\/+$/, '');
const model = option('--model', 'default');
const out = option('--out', `.scratch/choices-order/run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

/** The turns of a dump whose choices request has a reply and is followed by the player's next action. */
function casesOf(dump, name) {
  const all = [];
  for (let i = 0; i < dump.length - 1; i++) {
    const request = dump[i].requests?.find((r) => r.type === 'choices' && r.response);
    if (!request) continue;
    const next = String(dump[i + 1].action ?? '').trim();
    const offered = parseChoices(request.response, Infinity);
    all.push({ id: `${name}#${i}`, request, next, picked: offered.includes(next) });
  }
  // Spread across the session rather than its opening turns.
  const step = Math.max(1, all.length / perDump);
  return Array.from({ length: Math.min(perDump, all.length) }, (_, k) => all[Math.floor(k * step)]);
}

const ROSTER_BLOCK = /^## (?:Characters and things that may appear in this location|Entities in the Current Location)\n([\s\S]*?)(?=\n## |\n\n[^-\s]|(?![\s\S]))/m;

/** First names in the current-location roster. */
function rosterNames(system) {
  const block = system.match(ROSTER_BLOCK)?.[1] ?? '';
  return [...block.matchAll(/^- \*\*([^*]+)\*\*/gm)].map((m) => m[1].trim().split(/\s+/)[0]).filter((n) => n.length > 2);
}

const STOP = new Set('the and that with your into onto from then them they this have just what when about there their would could while back down over'.split(' '));
const words = (text) => new Set(text.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && w !== 'i'));

/** Dice overlap of content words: 1 for the same words, 0 for none shared. */
function overlap(a, b) {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return (2 * shared) / (x.size + y.size);
}

function scoreReply(reply, kase) {
  const lines = parseChoices(reply, Infinity);
  const counts = lines.map((l) => l.split(/\s+/).length);
  const names = rosterNames(kase.request.messages[0].content);
  return {
    contract: scoreTurn({ action: '', requests: [{ type: 'choices', messages: [], response: reply }] }).choices === 'ok',
    lines: lines.length,
    meanWords: counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0,
    longShare: counts.length ? counts.filter((n) => n > 16).length / counts.length : 0,
    marked: /^\s*(?:[-*•]|\d+[.)])\s+/m.test(reply) || /["“”]/.test(reply),
    grounded: names.length ? lines.some((l) => names.some((n) => l.toLowerCase().includes(n.toLowerCase()))) : null,
    recall: kase.next ? Math.max(0, ...lines.map((l) => overlap(l, kase.next))) : null,
  };
}

/** One direct call to an OpenAI-compatible endpoint; the reply, or the failure. */
async function sendDirect(messages, seed) {
  try {
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: TURN_PASS_CAPS.choices, seed }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return { failure: `status_${res.status}` };
    const body = await res.json();
    return { reply: body.choices?.[0]?.message?.content ?? '', prompt: body.usage?.prompt_tokens ?? 0 };
  } catch (error) {
    return { failure: error.name === 'TimeoutError' ? 'timeout' : error.message };
  }
}

/** One live call through the server's runner; the reply, or null with the failure. */
function send(messages, seed, dir, tag) {
  return new Promise(async (resolve) => {
    const file = path.join(dir, `${tag}.json`);
    await writeFile(file, JSON.stringify({ messages, max_tokens: TURN_PASS_CAPS.choices, seed }));
    execFile(process.execPath, ['src/utils/runHostedLive.js', '--body', file, '--mode', 'whole', '--format', 'json'], { cwd: server, encoding: 'utf8', maxBuffer: 1 << 24 }, (error, stdout) => {
      try {
        const report = JSON.parse(stdout.trim().split('\n').pop());
        const call = report.calls[0];
        resolve(report.ok ? { reply: call.reply, cached: call.rows.at(-1)?.cached_tokens ?? 0, prompt: call.rows.at(-1)?.prompt_tokens ?? 0 } : { failure: call.rows.at(-1)?.failure ?? call.code ?? 'failed' });
      } catch {
        resolve({ failure: error?.message?.split('\n')[0] ?? 'no report' });
      }
    });
  });
}

async function pool(jobs, size) {
  const results = new Array(jobs.length);
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await jobs[i]();
      done++;
      if (done % 20 === 0 || done === jobs.length) process.stderr.write(`  ${done}/${jobs.length} calls\n`);
    }
  }));
  return results;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x) => (Number.isNaN(x) ? '  -  ' : `${Math.round(100 * x)}%`.padStart(5));

function summarize(results, cases) {
  const byCase = new Map(cases.map((c) => [c.id, c]));
  console.log('\n| arm | replies | fails | contract | lines | words | >16 words | marked | names cast | recall | recall (picks) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const arm of arms) {
    const mine = results.filter((r) => r.arm === arm);
    const ok = mine.filter((r) => r.reply != null).map((r) => ({ ...r, score: scoreReply(r.reply, byCase.get(r.case)) }));
    const s = (f) => ok.map((r) => f(r.score)).filter((v) => v != null);
    const picks = ok.filter((r) => byCase.get(r.case).picked).map((r) => r.score.recall);
    console.log(`| ${arm} | ${ok.length} | ${mine.length - ok.length} | ${pct(mean(s((x) => +x.contract)))} | ${mean(s((x) => x.lines)).toFixed(1)} | ${mean(s((x) => x.meanWords)).toFixed(1)} | ${pct(mean(s((x) => x.longShare)))} | ${pct(mean(s((x) => +x.marked)))} | ${pct(mean(s((x) => (x.grounded == null ? null : +x.grounded))))} | ${mean(s((x) => x.recall)).toFixed(2)} | ${mean(picks).toFixed(2)} |`);
  }
  if (show) {
    for (const c of cases) {
      console.log(`\n### ${c.id}${c.picked ? ' (picked)' : ''}: next action: ${c.next}`);
      for (const r of results.filter((x) => x.case === c.id)) console.log(`- ${r.arm} seed ${r.seed}: ${r.reply == null ? `FAILED ${r.failure}` : r.reply.replace(/\n+/g, ' / ')}`);
    }
  }
}

if (rescore) {
  const stored = JSON.parse(await readFile(rescore, 'utf8'));
  summarize(stored.results, stored.cases);
} else {
  if (!dumps.length) {
    console.error('Pass one or more AI-context dump files.');
    process.exit(1);
  }
  const cases = [];
  for (const file of dumps) cases.push(...casesOf(JSON.parse(await readFile(file, 'utf8')), path.basename(file, '.json').replace(/^ai-context-/, '')));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'choices-order-'));
  const jobs = [];
  cases.forEach((c, ci) => {
    for (let run = 0; run < runs; run++) {
      for (const arm of arms) {
        const seed = 1000 + run;
        jobs.push(async () => ({ case: c.id, arm, seed, ...(await (endpoint ? sendDirect(messagesFor(c.request, arm), seed) : send(messagesFor(c.request, arm), seed, dir, `${ci}-${run}-${arm}`))) }));
      }
    }
  });
  console.log(`${cases.length} cases (${cases.filter((c) => c.picked).length} picked), ${runs} runs, arms ${arms.join(',')}: ${jobs.length} calls`);
  const results = await pool(jobs, concurrency);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ arms, runs, cases: cases.map(({ id, next, picked, request }) => ({ id, next, picked, request })), results }, null, 1));
  console.log(`Saved ${out}`);
  summarize(results, cases);
}
