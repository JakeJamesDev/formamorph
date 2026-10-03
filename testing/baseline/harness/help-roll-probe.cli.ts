// Help dice roll probe — does the help roll's description get the roll called when the player asks for
// one, and stay uncalled on a plain help question?
//
// Arms, interleaved per run so both see the same model state:
//   help     the app's request: the help dice roll on, the guide lookup off, every other setting default
//   catalog  the same request with the roll's description swapped for the catalog roll's (the control)
//
// Measures, per arm:
//   roll cases    called = share of runs that call the roll; total = share whose answer holds the roll's total
//   plain cases   called = share of runs that call the roll (should stay near zero)
//
// The default cloud endpoint rejects functions, so this runs on a local model.
// Usage: npx vite-node testing/baseline/harness/help-roll-probe.cli.ts -- --model cydonia-24b-v4.3@q4_k_m [--runs 2] [--endpoint URL]
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { HELP_ROLL } from '@/lib/formaquestion/helpRoll';
import { askHelp } from '@/lib/formaquestion/helpSession';
import { helpSettingsOf } from '@/lib/formaquestion/helpSettings';
import { ROLL } from '@/lib/tools/rollTool';
import { noUsage, pct, probeSnapshot, sessionFetch } from './help-probe-shared';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const model = argVal('--model', '');
const runs = Number(argVal('--runs', '2'));
const endpoint = argVal('--endpoint', 'http://127.0.0.1:1234/v1/chat/completions');
if (!model) throw new Error('Pass --model <id>.');

const ROLL_CASES = [
  'Roll a d20 for me.',
  'Can you roll 3d6?',
  'Roll two six-sided dice and tell me what I got.',
  'I need a 1d8+2 roll for my damage.',
  'Quick, roll percentile dice.',
  'roll 4d6 please',
];
// Five player questions from help-baseline-cases.json, and one about dice that asks for no roll.
const PLAIN_CASES = [
  "I just downloaded this and have no idea what I'm doing, where should a total beginner begin?",
  'can I choose where my character begins the adventure instead of the usual spot?',
  'a side character keeps showing up and I want them gone from my current story',
  'can I write my own custom function that the AI is allowed to call during the story?',
  'what do words like listing and contest mean on the site where people share their worlds?',
  'How do dice rolls work in a game?',
];

interface SentBody { tools?: { function: { name: string; description: string } }[]; messages: { role: string; content: string | null; tool_calls?: { function: { name: string } }[] }[] }

/** A fetch that records every request body. In the catalog arm, it sends the catalog roll's description in place of the help roll's. */
function armFetch(arm: 'help' | 'catalog', bodies: SentBody[]): typeof fetch {
  const inner = sessionFetch(noUsage());
  return ((url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as SentBody;
    for (const tool of body.tools ?? []) {
      if (tool.function.name !== HELP_ROLL.name) continue;
      if (tool.function.description !== HELP_ROLL.description) throw new Error('The request does not carry the help roll description.');
      if (arm === 'catalog') tool.function.description = ROLL.description;
    }
    bodies.push(body);
    return inner(url, { ...init, body: JSON.stringify(body) });
  }) as typeof fetch;
}

interface Trial { called: boolean; totalInAnswer: boolean; answer: string; error?: string }

async function trial(question: string, arm: 'help' | 'catalog'): Promise<Trial> {
  const bodies: SentBody[] = [];
  let answer = '';
  try {
    for await (const event of askHelp({
      question,
      settings: helpSettingsOf({ roll: true }),
      snapshot: probeSnapshot({ endpoint, model, token: '' }, true),
      index: bundledDocsIndex(),
      fetchImpl: armFetch(arm, bodies),
    })) {
      if (event.type === 'done') answer = event.text;
    }
  } catch (error: unknown) {
    return { called: false, totalInAnswer: false, answer, error: error instanceof Error ? error.message : String(error) };
  }
  const last = bodies.at(-1);
  const called = (last?.messages ?? []).some((message) => message.tool_calls?.some((call) => call.function.name === HELP_ROLL.name));
  const totals = (last?.messages ?? []).filter((message) => message.role === 'tool').flatMap((message) => {
    try {
      const { total } = JSON.parse(message.content ?? '') as { total?: unknown };
      return typeof total === 'number' ? [total] : [];
    } catch {
      return [];
    }
  });
  const totalInAnswer = totals.length > 0 && totals.every((total) => new RegExp(`(^|\\D)${total}(\\D|$)`).test(answer));
  return { called, totalInAnswer, answer };
}

const arms = ['help', 'catalog'] as const;
const results: Record<string, Record<string, Trial[]>> = { help: {}, catalog: {} };
console.log(`help-roll-probe · ${model} · ${runs} runs per case per arm\n`);
for (let run = 0; run < runs; run++) {
  for (const question of [...ROLL_CASES, ...PLAIN_CASES]) {
    for (const arm of arms) {
      const result = await trial(question, arm);
      (results[arm][question] ??= []).push(result);
      const mark = result.error ? `error: ${result.error}` : `${result.called ? 'called' : '—'}${result.totalInAnswer ? ' · total' : ''}`;
      console.log(`run ${run + 1} · ${arm.padEnd(7)} · ${mark.padEnd(16)} · ${question}\n    ${result.answer.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
}

const tally = (arm: string, cases: readonly string[], key: 'called' | 'totalInAnswer') => {
  const trials = cases.flatMap((question) => results[arm][question]);
  const hits = trials.filter((t) => t[key]).length;
  return `${hits}/${trials.length} (${pct(hits, trials.length).trim()})`;
};
const errors = (arm: string) => Object.values(results[arm]).flat().filter((t) => t.error).length;
console.log(`\n${'arm'.padEnd(9)}${'roll: called'.padEnd(18)}${'roll: total'.padEnd(18)}${'plain: called'.padEnd(18)}errors`);
for (const arm of arms) {
  console.log(`${arm.padEnd(9)}${tally(arm, ROLL_CASES, 'called').padEnd(18)}${tally(arm, ROLL_CASES, 'totalInAnswer').padEnd(18)}${tally(arm, PLAIN_CASES, 'called').padEnd(18)}${errors(arm)}`);
}
