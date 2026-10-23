import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Script } from '@/types';
import type { StatCodeResult, StatCodeRunOptions } from '@/lib/statCodeExecutor';
import { statCodeNames, type StatCodeWorld } from '@/lib/statCodeTestRun';
import { isPromptCanceled, PromptCanceled } from '@/lib/scriptPrompts';
import { ScriptBox, type ScriptBoxContext } from './ScriptBox';

/** Test Code's prompts and sample sentence, end to end through the box. The sandbox is faked: it asks what the
 *  script would ask through the host the box hands it, so what is under test is the box's side of the run. */

const executeStatCode = vi.hoisted(() => vi.fn());
vi.mock('@/lib/statCodeExecutor', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/statCodeExecutor')>(),
  executeStatCode,
}));
// A plain textarea over the same value: the real editor arrives on its own chunk with CodeMirror.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; onChange: (next: string) => void; ariaLabel: string }) => (
    <textarea aria-label={props.ariaLabel} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
  ),
}));

const world: StatCodeWorld = {
  stats: [{ id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] }],
  statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [], dictionaries: [],
};
const context: ScriptBoxContext = { owner: null, names: statCodeNames(world), world, ownerStats: [], selfName: '', placeholderPlaces: [], home: { kind: 'world' } };
const LABEL = 'World · After the AI';

/** A box that keeps its own code, as its panel does. */
function Box({ initial }: { initial: Script }) {
  const [script, setScript] = useState(initial);
  return <ScriptBox script={script} label={LABEL} context={context} onChange={(code) => setScript({ ...script, code })} />;
}

const ran = (result: Partial<StatCodeResult>): StatCodeResult => ({ value: null, error: null, ...result });

beforeEach(() => { executeStatCode.mockReset(); });

describe('Test Code with a prompt', () => {
  /** A run that confirms, then writes the stat by the pick. A closed prompt fails it, as the executor reports one. */
  const confirming = () => executeStatCode.mockImplementation(async (_code: string, _stats: unknown, _self: unknown, options: StatCodeRunOptions) => {
    try {
      await options.prompts!.prompt({ kind: 'tell', text: 'The bottle glows.' });
      const drink = await options.prompts!.prompt({ kind: 'confirm', question: 'Drink it?' });
      return ran({ statWrites: [{ id: 'h', name: 'Health', value: drink ? 80 : 20 }] });
    } catch (error) {
      if (!isPromptCanceled(error)) throw error;
      return ran({ error: error.message, kind: 'canceled' });
    }
  });

  it('shows the inline prompt line in the editor and completes with the pick', async () => {
    confirming();
    const user = userEvent.setup();
    render(<Box initial={{ id: 's', timing: 'after', code: 'player.confirm("Drink it?")' }} />);
    await user.click(screen.getByRole('button', { name: `Test Code ${LABEL}` }));
    const prompt = await screen.findByTestId('script-prompt');
    expect(prompt).toHaveTextContent('Drink it?');
    await user.click(screen.getByRole('button', { name: 'No' }));
    expect(await screen.findByText('stats.Health.value = 20 · Tell: The bottle glows.')).toBeInTheDocument();
    expect(screen.queryByTestId('script-prompt')).toBeNull();
  });

  it('answers input, a long ask and a multiple ask through the same line', async () => {
    executeStatCode.mockImplementation(async (_code: string, _stats: unknown, _self: unknown, options: StatCodeRunOptions) => {
      const name = await options.prompts!.prompt({ kind: 'input', question: 'Your name?' });
      const road = await options.prompts!.prompt({ kind: 'ask', question: 'Which road?', options: ['A', 'B', 'C', 'D', 'E'], multiple: false });
      const packed = await options.prompts!.prompt({ kind: 'ask', question: 'Pack what?', options: ['Rope', 'Lamp'], multiple: true });
      return ran({ statWrites: [{ id: 'h', name: 'Health', value: name.length * 10 + Number(road) + (packed as number[]).length }] });
    });
    const user = userEvent.setup();
    render(<Box initial={{ id: 's', timing: 'after', code: 'player.input("Your name?")' }} />);
    await user.click(screen.getByRole('button', { name: `Test Code ${LABEL}` }));
    await user.type(await screen.findByRole('textbox', { name: 'Your name?' }), 'Ada{Enter}');
    await user.click(await screen.findByRole('combobox', { name: 'Which road?' }));
    await user.click(await screen.findByRole('option', { name: 'E' }));
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await user.click(await screen.findByRole('button', { name: 'Lamp' }));
    await user.click(screen.getByRole('button', { name: 'OK' }));
    // 3 letters, the fifth road, one item.
    expect(await screen.findByText('stats.Health.value = 35')).toBeInTheDocument();
  });

  it('fails the run as canceled when Escape closes the prompt', async () => {
    confirming();
    const user = userEvent.setup();
    render(<Box initial={{ id: 's', timing: 'after', code: 'player.confirm("Drink it?")' }} />);
    await user.click(screen.getByRole('button', { name: `Test Code ${LABEL}` }));
    (await screen.findByRole('button', { name: 'Yes' })).focus();
    await user.keyboard('{Escape}');
    expect(await screen.findByText(/Error: .*closed the prompt/)).toBeInTheDocument();
  });

  it('keeps a tell beside the error when the script then fails', async () => {
    confirming();
    const user = userEvent.setup();
    render(<Box initial={{ id: 's', timing: 'after', code: 'player.confirm("Drink it?")' }} />);
    await user.click(screen.getByRole('button', { name: `Test Code ${LABEL}` }));
    (await screen.findByRole('button', { name: 'Yes' })).focus();
    await user.keyboard('{Escape}');
    expect(await screen.findByText('Tell: The bottle glows.')).toBeInTheDocument();
  });

  it('closes an open prompt when the box unmounts, failing its script as canceled', async () => {
    let asked!: Promise<unknown>;
    executeStatCode.mockImplementation((_code: string, _stats: unknown, _self: unknown, options: StatCodeRunOptions) => {
      asked = options.prompts!.prompt({ kind: 'confirm', question: 'Drink it?' });
      return asked.then(() => ran({}), () => ran({ error: 'canceled', kind: 'canceled' }));
    });
    const user = userEvent.setup();
    const { unmount } = render(<Box initial={{ id: 's', timing: 'after', code: 'player.confirm("Drink it?")' }} />);
    await user.click(screen.getByRole('button', { name: `Test Code ${LABEL}` }));
    await screen.findByTestId('script-prompt');
    unmount();
    await expect(asked).rejects.toBeInstanceOf(PromptCanceled);
  });

  it('closes an open prompt when the code changes, and shows no stale report', async () => {
    confirming();
    const user = userEvent.setup();
    render(<Box initial={{ id: 's', timing: 'after', code: 'player.confirm("Drink it?")' }} />);
    await user.click(screen.getByRole('button', { name: `Test Code ${LABEL}` }));
    await screen.findByTestId('script-prompt');
    await user.type(screen.getByLabelText(`Code ${LABEL}`), ';');
    await waitFor(() => expect(screen.queryByTestId('script-prompt')).toBeNull());
    expect(screen.queryByText(/Error:/)).toBeNull();
    expect(screen.getByRole('button', { name: `Test Code ${LABEL}` })).toBeEnabled();
  });
});

describe('Test Code on a During AI Output script', () => {
  const OUTPUT = { id: 's', timing: 'output' as const, code: 'narration.sentence = narration.sentence.toUpperCase();' };

  it('takes a sample sentence and shows the rewritten one', async () => {
    executeStatCode.mockImplementation(async (_code: string, _stats: unknown, _self: unknown, options: StatCodeRunOptions) =>
      ran({ sentence: options.narration!.sentence.toUpperCase() }));
    const user = userEvent.setup();
    render(<Box initial={OUTPUT} />);
    const test = screen.getByRole('button', { name: `Test Code ${LABEL}` });
    expect(test).toBeDisabled();
    await user.type(screen.getByLabelText('Sample Sentence'), 'The door opens.');
    await user.click(test);
    expect(await screen.findByText('Sentence: THE DOOR OPENS.')).toBeInTheDocument();
    expect(executeStatCode.mock.calls[0][3].narration).toEqual({ sentence: 'The door opens.', full: 'The door opens.', index: 0, sent: [], buffered: [] });
  });

  it('shows no sample field outside During AI Output', () => {
    render(<Box initial={{ ...OUTPUT, timing: 'after' }} />);
    expect(screen.queryByLabelText('Sample Sentence')).toBeNull();
  });
});
