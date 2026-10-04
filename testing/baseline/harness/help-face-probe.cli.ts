// Help face call probe — how often does the model set the Mascot's face, and does the face follow the answer's mood?
//
// Arms, interleaved per run so both see the same model state:
//   app   the app's request: the Mascot on with the default rig, every other setting default
//   bare  the same request with the face call's description cut to one line (the control)
//
// Case groups, by the mood the answer has: a how-to the guide covers, a question outside the guide, a feature
// the app does not have, a loss with no fix, and thanks.
//
// Measures, per arm and per group:
//   set      share of answers with at least one face call
//   flagged  share of answers marked as not from the guide
//   faces    how often each face was set (the last call of an answer counts)
// And per arm:
//   first    share of answers whose first round is a face call, before any answer text
//   calls    face calls per answer
//   leak     share of answers whose text names a face of the rig
//
// The default cloud endpoint rejects functions, so this runs on a local model.
// Usage: npx vite-node testing/baseline/harness/help-face-probe.cli.ts -- --model cydonia-24b-v4.3@q4_k_m [--runs 3] [--endpoint URL]
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { HELP_FACE } from '@/lib/formaquestion/helpFace';
import { askHelp } from '@/lib/formaquestion/helpSession';
import { helpSettingsOf } from '@/lib/formaquestion/helpSettings';
import { DEFAULT_MASCOT_RIG } from '@/lib/formaquestion/mascot';
import { noUsage, pct, probeSnapshot, sessionFetch } from './help-probe-shared';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const model = argVal('--model', '');
const runs = Number(argVal('--runs', '3'));
const endpoint = argVal('--endpoint', 'http://127.0.0.1:1234/v1/chat/completions');
if (!model) throw new Error('Pass --model <id>.');

const BARE_DESCRIPTION = 'Sets your face.';

// The how-to questions come from help-baseline-cases.json.
const CASE_GROUPS: Record<string, readonly string[]> = {
  howTo: [
    "I just downloaded this and have no idea what I'm doing, where should a total beginner begin?",
    'can I choose where my character begins the adventure instead of the usual spot?',
    'a side character keeps showing up and I want them gone from my current story',
    'can I write my own custom function that the AI is allowed to call during the story?',
    'what do words like listing and contest mean on the site where people share their worlds?',
  ],
  outsideGuide: [
    'Can you recommend a good fantasy novel to read tonight?',
    'what is the capital of Australia?',
  ],
  missingFeature: [
    'can my friend join my story from their own computer so we play together online?',
    'is there a button that turns my story into a printed paperback book?',
  ],
  noFix: [
    'my laptop died mid-session and I never saved, is my whole story gone for good?',
    'I deleted my favorite world by accident months ago and emptied the trash, can I get it back?',
  ],
  thanks: [
    'Thanks, that fixed it!',
    'You are so helpful, I love this app!',
  ],
};
const CASES = Object.entries(CASE_GROUPS).flatMap(([group, questions]) => questions.map((question) => ({ group, question })));

const FACE_NAMES = DEFAULT_MASCOT_RIG.layers.filter((row) => row.kind === 'expression').map((row) => row.name);
const NAME_OF = new Map(DEFAULT_MASCOT_RIG.layers.map((row) => [row.id, row.name]));

interface SentBody { tools?: { function: { name: string; description: string } }[]; messages: { role: string; content: string | null; tool_calls?: { function: { name: string } }[] }[] }

type Arm = 'app' | 'bare';

/** A fetch that records every request body. In the bare arm, it cuts the face call's description to one line. */
function armFetch(arm: Arm, bodies: SentBody[]): typeof fetch {
  const inner = sessionFetch(noUsage());
  return ((url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as SentBody;
    for (const tool of body.tools ?? []) {
      if (tool.function.name !== HELP_FACE.name) continue;
      if (tool.function.description !== HELP_FACE.description) throw new Error('The request does not carry the face call description.');
      if (arm === 'bare') tool.function.description = BARE_DESCRIPTION;
    }
    bodies.push(body);
    return inner(url, { ...init, body: JSON.stringify(body) });
  }) as typeof fetch;
}

interface Trial { group: string; faces: string[]; flagged: boolean; first: boolean; leak: boolean; answer: string; error?: string }

async function trial(group: string, question: string, arm: Arm): Promise<Trial> {
  const bodies: SentBody[] = [];
  const faces: string[] = [];
  let answer = '';
  let flagged = false;
  try {
    for await (const event of askHelp({
      question,
      settings: helpSettingsOf({}),
      snapshot: probeSnapshot({ endpoint, model, token: '' }, true),
      index: bundledDocsIndex(),
      fetchImpl: armFetch(arm, bodies),
    })) {
      if (event.type === 'face') faces.push(NAME_OF.get(event.face) ?? event.face);
      if (event.type === 'done') ({ text: answer, flagged } = event);
    }
  } catch (error: unknown) {
    return { group, faces, flagged, first: false, leak: false, answer, error: error instanceof Error ? error.message : String(error) };
  }
  // The question has no history, so the last request's first assistant message is the first round's reply.
  const firstRound = bodies.at(-1)?.messages.find((message) => message.role === 'assistant' && message.tool_calls);
  const first = !!firstRound?.tool_calls?.some((call) => call.function.name === HELP_FACE.name) && !firstRound.content?.trim();
  const leak = FACE_NAMES.some((name) => new RegExp(`\\b${name}\\b`).test(answer));
  return { group, faces, flagged, first, leak, answer };
}

const arms: readonly Arm[] = ['app', 'bare'];
const results: Record<Arm, Trial[]> = { app: [], bare: [] };
console.log(`help-face-probe · ${model} · ${runs} runs per case per arm\n`);
for (let run = 0; run < runs; run++) {
  for (const { group, question } of CASES) {
    for (const arm of arms) {
      const result = await trial(group, question, arm);
      results[arm].push(result);
      const mark = result.error ? `error: ${result.error}` : `${result.faces.join(', ') || '—'}${result.flagged ? ' · flagged' : ''}`;
      console.log(`run ${run + 1} · ${arm.padEnd(4)} · ${group.padEnd(14)} · ${mark.padEnd(24)} · ${question}\n    ${result.answer.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
}

const share = (trials: Trial[], test: (t: Trial) => boolean) => {
  const hits = trials.filter(test).length;
  return `${hits}/${trials.length} (${pct(hits, trials.length).trim()})`;
};
/** The face each answer ended on, counted. */
const faceCounts = (trials: Trial[]) => {
  const counts = new Map<string, number>();
  for (const face of trials.flatMap((t) => t.faces.slice(-1))) counts.set(face, (counts.get(face) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([face, n]) => `${face} ${n}`).join(', ') || '—';
};

console.log(`\n${'arm'.padEnd(6)}${'group'.padEnd(16)}${'set'.padEnd(14)}${'flagged'.padEnd(14)}faces`);
for (const arm of arms) {
  for (const group of Object.keys(CASE_GROUPS)) {
    const trials = results[arm].filter((t) => !t.error && t.group === group);
    console.log(`${arm.padEnd(6)}${group.padEnd(16)}${share(trials, (t) => t.faces.length > 0).padEnd(14)}${share(trials, (t) => t.flagged).padEnd(14)}${faceCounts(trials)}`);
  }
}

console.log(`\n${'arm'.padEnd(6)}${'first'.padEnd(14)}${'calls'.padEnd(8)}${'leak'.padEnd(14)}errors`);
for (const arm of arms) {
  const trials = results[arm].filter((t) => !t.error);
  const calls = trials.reduce((sum, t) => sum + t.faces.length, 0);
  console.log(`${arm.padEnd(6)}${share(trials, (t) => t.first).padEnd(14)}${(trials.length ? (calls / trials.length).toFixed(2) : '–').padEnd(8)}${share(trials, (t) => t.leak).padEnd(14)}${results[arm].length - trials.length}`);
}
