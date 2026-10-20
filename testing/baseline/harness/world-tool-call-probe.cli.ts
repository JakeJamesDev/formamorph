// World Tool call-rate probe: replays a captured drone-world narration request with lock_target offered, over
// scenes that ask for a lock and scenes that don't, and reports how often the model calls it. Arm A sends the
// shipped description; arm B, the in-batch control, sends a bare one. Arms alternate order case by case.
// A call gets a second round with the Tool's Reply, and the probe runs the Tool's real script over that
// narration to count whether the filter marked the target.
//
// Usage: npx vite-node testing/baseline/harness/world-tool-call-probe.cli.ts -- --capture <live turns json>
//          --action <the captured player action> --enemy <an enemy in the captured scene> [--runs 4]
//          [--endpoint URL] [--model ID] [--description <candidate for arm A>]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readWorldTools } from '@/lib/tools/worldTools';
import { toolSchema, type ToolFunctionSchema } from '@/lib/tools/toolSchema';
import { DEFAULT_GEN_REPETITION_PENALTY, DEFAULT_GEN_TEMPERATURE, DEFAULT_GEN_TOP_P } from '@/contexts/settingsDefaults';
import { runStatCodeTurn } from '@/lib/statCodeTurn';

const args = process.argv.slice(2);
function option(name: string, fallback?: string): string {
  const index = args.indexOf(name);
  const value = index < 0 ? fallback : args[index + 1];
  if (value === undefined) throw new Error(`${name} needs a value.`);
  return value;
}
const capturePath = option('--capture');
const capturedAction = option('--action');
const enemy = option('--enemy');
const runs = Number(option('--runs', '4'));
const endpoint = option('--endpoint', 'http://127.0.0.1:1234/v1/chat/completions');
const model = option('--model', 'g4-meromero-v2-31b-i1');
/** A candidate description for arm A in place of the shipped one. */
const candidate = args.includes('--description') ? option('--description') : null;

/** Player actions that aim at one enemy, and ones that aim at no one. `{enemy}` is the scene's enemy. */
const CASES = [
  { id: 'fire-at', asked: true, action: 'I aim my cannon at {enemy} and fire.' },
  { id: 'target', asked: true, action: 'I swivel my turret toward {enemy}, lock on, and charge my next shot.' },
  { id: 'dash-attack', asked: true, action: 'I dash at {enemy} and ram my armor into it.' },
  { id: 'look-around', asked: false, action: 'I roll slowly along the path and scan the ruins around me.' },
  { id: 'greet', asked: false, action: 'I blink my lights in a friendly pattern at the nearest traveler.' },
  { id: 'rest', asked: false, action: 'I park in the shade, power down my cannon, and let my cells recharge.' },
].map((scenario) => ({ ...scenario, action: scenario.action.replaceAll('{enemy}', enemy) }));

const CONTROL_DESCRIPTION = 'Lock onto an enemy.';

interface Message { role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }
interface Capture { type: string; messages: Message[] }

const turns = JSON.parse(readFileSync(capturePath, 'utf8')) as Array<{ requests?: Capture[] } | Capture>;
const records = turns.flatMap((turn) => ('requests' in turn && turn.requests ? turn.requests : [turn as Capture]));
const narration = records.filter((record) => record.type === 'narration' && record.messages?.some((message) => message.content?.includes(capturedAction))).at(-1);
if (!narration) throw new Error('No narration request in the capture carries the given action.');

const world = JSON.parse(readFileSync('src/defaultworlds/drone.json', 'utf8')) as { tools?: unknown };
const lockTarget = readWorldTools(world.tools).tools.find((tool) => tool.name === 'lock_target');
if (!lockTarget || lockTarget.handler.kind !== 'script') throw new Error('The drone world lost lock_target.');
const reply = lockTarget.handler.reply ?? 'Done.';
const lockCode = lockTarget.handler.code;
const armTool = (arm: 'A' | 'B'): ToolFunctionSchema =>
  toolSchema({ ...lockTarget, description: arm === 'B' ? CONTROL_DESCRIPTION : candidate ?? lockTarget.description });

/** The captured messages with the player's action swapped for `action`. */
const messagesFor = (action: string): Message[] => narration.messages.map((message) =>
  (message.role === 'user' && message.content?.includes(capturedAction)
    ? { ...message, content: message.content.replaceAll(capturedAction, action) }
    : message));

async function complete(messages: Message[], tools: ToolFunctionSchema[]) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, messages, tools, tool_choice: 'auto', max_tokens: 1024, stream: false, reasoning_effort: 'none',
      temperature: DEFAULT_GEN_TEMPERATURE, top_p: DEFAULT_GEN_TOP_P,
      repetition_penalty: DEFAULT_GEN_REPETITION_PENALTY, repeat_penalty: DEFAULT_GEN_REPETITION_PENALTY,
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const body = await response.json() as { choices: Array<{ message: Message & { tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }> };
  return body.choices[0].message;
}

/** Whether lock_target's script, armed with `target`, marks anything in `text`, run as one sentence. */
async function marks(target: string, text: string): Promise<boolean> {
  const out = await runStatCodeTurn({
    timing: 'output', narration: { sentence: text, full: text, index: 0, sent: [], buffered: [] },
    triggers: [{ name: 'lock_target', code: lockCode, args: { name: target } }],
    state: {
      stats: [], enabled: {}, clock: {},
      ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
    },
    previous: [], asks: [], regenApplied: {},
    statNameOf: (stat) => stat.name, traitNameOf: (trait) => trait.name,
  });
  return (out.sentence ?? '').includes('⌖');
}

interface Trial { arm: 'A' | 'B'; scenario: string; asked: boolean; run: number; called: boolean; target: string | null; named: boolean | null; narration: string; ms: number }
const trials: Trial[] = [];
const outDir = 'testing/baseline/runs/world-tool-call-probe';
mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
const save = () => writeFileSync(outPath, `${JSON.stringify({ model, endpoint, enemy, capturedAction, runs, candidate, trials }, null, 2)}\n`);

for (let run = 0; run < runs; run++) {
  for (const [caseIndex, scenario] of CASES.entries()) {
    for (const arm of ((run + caseIndex) % 2 ? ['B', 'A'] : ['A', 'B']) as Array<'A' | 'B'>) {
      const started = performance.now();
      const tools = [armTool(arm)];
      const messages = messagesFor(scenario.action);
      const first = await complete(messages, tools);
      const call = first.tool_calls?.find((toolCall) => toolCall.function.name === 'lock_target');
      let target: string | null = null;
      let text = first.content ?? '';
      if (call) {
        try { target = String((JSON.parse(call.function.arguments) as { name?: unknown }).name ?? ''); } catch { target = ''; }
        const second = await complete([...messages, { role: 'assistant', content: first.content ?? null, tool_calls: first.tool_calls },
          ...(first.tool_calls ?? []).map((toolCall) => ({ role: 'tool', tool_call_id: toolCall.id, content: reply }))], tools);
        text = second.content ?? '';
      }
      const named = target ? await marks(target, text) : null;
      trials.push({ arm, scenario: scenario.id, asked: scenario.asked, run, called: Boolean(call), target, named, narration: text, ms: Math.round(performance.now() - started) });
      save();
      console.log(`${trials.length}/${runs * CASES.length * 2} ${arm} ${scenario.id}: ${call ? `called(${target})${named ? ' marked' : ' NOT marked'}` : 'no call'} ${(trials.at(-1)!.ms / 1000).toFixed(1)}s`);
    }
  }
}

const rate = (arm: string, asked: boolean) => {
  const set = trials.filter((trial) => trial.arm === arm && t.asked === asked);
  return `${set.filter((trial) => trial.called).length}/${set.length}`;
};
for (const arm of ['A', 'B']) {
  const calls = trials.filter((trial) => trial.arm === arm && t.called);
  console.log(`arm ${arm}: called when asked ${rate(arm, true)}, when not asked ${rate(arm, false)}, filter marked the target ${calls.filter((trial) => trial.named).length}/${calls.length}`);
}
console.log(outPath);
