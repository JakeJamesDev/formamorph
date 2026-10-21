import type { SandboxSnapshot } from '@/lib/sandboxSnapshot';
import type { ToolSnapshot } from './toolSnapshot';

/** A script's outcome: its text, nothing (null), or why it failed. `dropped` lists the writes it tried, each
 *  dropped, as code spelled them (Q44). */
export type ToolScriptResult =
  | { text: string | null; dropped?: readonly string[] }
  | { error: string; kind: 'script' | 'timeout' };

/** Each Tool Snapshot's Sandbox Snapshot, built at its first script, so every script of a turn reads one board. */
const sandboxes = new WeakMap<ToolSnapshot, SandboxSnapshot>();

/** Run a Tool script over `args` and the snapshot, on the script surface without writes (Q24). A string return is
 *  the text; any other value is JSON. */
export async function runToolScript(
  code: string,
  args: Readonly<Record<string, unknown>>,
  snapshot: ToolSnapshot,
): Promise<ToolScriptResult> {
  // Loaded at the first script, so a reader that never runs one never loads the sandbox.
  let sandbox = sandboxes.get(snapshot);
  if (!sandbox) {
    const [{ snapshotOf }, { openingStateOf }] = await Promise.all([import('@/lib/sandboxSnapshot'), import('@/lib/openingState')]);
    sandbox = snapshotOf(snapshot.script.state ?? openingStateOf({}));
    sandboxes.set(snapshot, sandbox);
  }
  const result = await sandbox.run({ home: { kind: 'tool' }, timing: 'before', code, args, readOnly: true });
  if (result.kind === 'timeout') return { error: 'The script ran too long and was stopped.', kind: 'timeout' };
  // The first line only, without the executor's label: the stack trace is the author's, not the AI's.
  if (result.error !== null) return { error: `The script failed: ${result.error.split('\n')[0].replace(/^Error: /, '')}`, kind: 'script' };
  const text = result.reply ?? null;
  return result.readOnlyWrites?.length ? { text, dropped: result.readOnlyWrites } : { text };
}
