// Choices cache probe — how much of each choices request repeats the one before it, and so could be served
// from the provider's prefix cache. Reads captured choices requests from AI-context dumps (the app's Export)
// and re-lays each system prompt in the candidate section orders:
//
//   Arm A = as captured.
//   Arm B = the fixed instructions (from 'The player character is "I"' to the end) moved right after the role
//           header; the world blocks keep their order.
//   Arm C = Arm B, plus the stat-bearing blocks (Global Stats, Player Stats, Player Character) moved last.
//
// Gate 1 (default, no model): the shared prefix between consecutive calls, and the section it breaks in.
// Gate 2 (--live): sends the calls in order through FormamorphServer's `npm run live:hosted-ai` (testing key)
// and reads the provider's cached-token count, to see whether a longer shared prefix is actually cached.
//
// Usage: node testing/baseline/harness/choices-cache-probe.mjs <dump.json> [...more dumps]
//          [--arms A,B,C] [--live] [--server ../FormamorphServer] [--limit 12]
//   --live    Gate 2. Sends --limit consecutive calls per dump and arm, one live:hosted-ai run each.
//   --server  The FormamorphServer main checkout (it holds .env and the settings copy).
//   --settings  A hosted_ai settings file for the run, e.g. one with a provider pin. Default: the server's copy.
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback = null) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const flagged = new Set(['--arms', '--server', '--limit', '--settings']);
const dumps = args.filter((a, i) => !a.startsWith('--') && !flagged.has(args[i - 1]));
const arms = option('--arms', 'A,B,C').split(',').map((s) => s.trim());
const live = args.includes('--live');
const server = path.resolve(option('--server', path.resolve(process.cwd(), '../FormamorphServer')));
const limit = Number(option('--limit', '12'));
const settings = option('--settings') && path.resolve(option('--settings'));

const STATIC_MARKER = '\n\nThe player character is "I"';
const STAT_BLOCKS = new Set(['Global Stats', 'Player Stats', 'Player Character']);

/** Every captured choices request in a dump, in turn order. */
function choicesRequests(dump) {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'choices' && Array.isArray(node.messages)) found.push(node);
    for (const key of Object.keys(node)) walk(node[key]);
  };
  walk(dump);
  return found;
}

/** A system prompt split into role header, `## ` world blocks, and the fixed instructions. */
function sections(system) {
  const at = system.indexOf(STATIC_MARKER);
  if (at < 0) return null;
  const head = system.slice(0, at);
  const firstBlock = head.indexOf('\n## ');
  const header = firstBlock < 0 ? head : head.slice(0, firstBlock);
  const body = firstBlock < 0 ? '' : head.slice(firstBlock + 1);
  const blocks = body ? body.split(/\n(?=## )/).map((text) => ({ title: text.match(/^## (.+)/)?.[1] ?? '', text: text.replace(/\n+$/, '') })) : [];
  return { header: header.replace(/\n+$/, ''), blocks, instructions: system.slice(at).replace(/^\n+/, '') };
}

/** The system prompt laid out for one arm. A prompt without the fixed-instruction marker is sent as captured. */
function relay(system, arm) {
  const parts = arm === 'A' ? null : sections(system);
  if (!parts) return system;
  const blocks = arm === 'C'
    ? [...parts.blocks.filter((b) => !STAT_BLOCKS.has(b.title)), ...parts.blocks.filter((b) => STAT_BLOCKS.has(b.title))]
    : parts.blocks;
  return [parts.header, parts.instructions, ...blocks.map((b) => b.text)].join('\n\n');
}

const messagesFor = (request, arm) =>
  request.messages.map((m, i) => (i === 0 && m.role === 'system' ? { ...m, content: relay(m.content, arm) } : m));

/** The request as the provider tokenizes it, close enough for a prefix comparison. */
const serialized = (messages) => messages.map((m) => `<${m.role}>${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('');

const commonPrefix = (a, b) => {
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  return k;
};

/** The section a prefix ends in: the last `## ` title before it, or the user turn. */
function breakSection(text, at) {
  const userAt = text.indexOf('<user>');
  if (userAt >= 0 && at >= userAt) return 'user message';
  const titles = [...text.slice(0, at).matchAll(/\n## ([^\n]+)/g)];
  return titles.length ? titles[titles.length - 1][1] : 'role header';
}

const pct = (part, whole) => `${whole ? Math.round((100 * part) / whole) : 0}%`;
const tok = (chars) => Math.round(chars / 4);

async function gateOne(name, requests) {
  console.log(`\n## ${name}: ${requests.length} choices calls`);
  for (const arm of arms) {
    let shared = 0;
    let total = 0;
    const breaks = {};
    for (let i = 1; i < requests.length; i++) {
      const before = serialized(messagesFor(requests[i - 1], arm));
      const now = serialized(messagesFor(requests[i], arm));
      const k = commonPrefix(before, now);
      shared += k;
      total += now.length;
      const where = breakSection(now, k);
      breaks[where] = (breaks[where] ?? 0) + 1;
    }
    const top = Object.entries(breaks).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(', ');
    console.log(`  ${arm}: shared ${pct(shared, total)} (~${tok(shared / Math.max(1, requests.length - 1))} of ~${tok(total / Math.max(1, requests.length - 1))} tok/call) | breaks: ${top}`);
  }
}

async function gateTwo(name, requests) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'choices-cache-'));
  const run = requests.slice(0, limit);
  // A fresh first line per arm, so no run reads a cache an earlier run warmed.
  const nonce = () => `Run ${Math.random().toString(36).slice(2, 10)}.\n`;
  console.log(`\n## ${name}: live, ${run.length} consecutive calls per arm`);
  for (const arm of arms) {
    let prompt = 0;
    let cached = 0;
    let expected = 0;
    const perCall = [];
    const first = nonce();
    const cold = (request) => messagesFor(request, arm).map((m, j) => (j === 0 ? { ...m, content: first + m.content } : m));
    for (let i = 0; i < run.length; i++) {
      const messages = cold(run[i]);
      const file = path.join(dir, `${arm}-${i}.json`);
      await writeFile(file, JSON.stringify({ messages, max_tokens: 256 }));
      let out;
      try {
        const extra = settings ? ['--settings', settings] : [];
        out = execFileSync(process.execPath, ['src/utils/runHostedLive.js', '--body', file, '--mode', 'whole', ...extra], { cwd: server, encoding: 'utf8' });
      } catch (error) {
        out = String(error.stdout ?? '');
        console.log(`  ${arm} call ${i}: run failed: ${out.split('\n').filter(Boolean).slice(-2).join(' | ') || error.message}`);
        continue;
      }
      const row = out.match(/Row: .*?tokens (\d+)\+\d+, cached (\d+)/);
      if (!row) {
        console.log(`  ${arm} call ${i}: no usage row`);
        continue;
      }
      const p = Number(row[1]);
      const c = Number(row[2]);
      if (i > 0) {
        prompt += p;
        cached += c;
        expected += commonPrefix(serialized(cold(run[i - 1])), serialized(messages)) / 4;
      }
      perCall.push(c);
    }
    console.log(`  ${arm}: cached ${pct(cached, prompt)} of ${prompt} prompt tok (calls 2+); shared prefix predicts ~${pct(expected, prompt)} | cached per call: ${perCall.join(' ')}`);
  }
}

if (!dumps.length) {
  console.error('Pass one or more AI-context dump files.');
  process.exit(1);
}
for (const file of dumps) {
  const requests = choicesRequests(JSON.parse(await readFile(file, 'utf8')));
  const name = path.basename(file);
  if (requests.length < 2) {
    console.log(`\n## ${name}: fewer than 2 choices calls, skipped`);
    continue;
  }
  if (live) await gateTwo(name, requests);
  else await gateOne(name, requests);
}
