import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Stat } from '@/types';
import StatManager from './StatManager';

/** Running the code and reading it are two different answers about the same text, and the panel has to
 *  show both. The editor itself is stubbed — what's under test is the row beneath it. */

const stats = [
  { id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10, code: '' },
  { id: 's2', name: 'Damp', type: 'number', value: 3, min: 0, max: 10 },
] as unknown as Stat[];

const updateStat = vi.fn();
vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({ updateStat, stats, placeholders: [] }),
}));
vi.mock('@/lib/useBodyMorphNames', () => ({
  useBodyMorphSources: () => ({ sources: [], loading: false, load: vi.fn() }),
}));
vi.mock('@/components/prompt/PlaceholderField', () => ({
  PlaceholderNameField: (props: { value?: string }) => <input aria-label="Name" defaultValue={props.value} />,
}));

// A plain textarea over the same value: the real editor arrives on its own chunk and brings CodeMirror
// with it, and neither is what this file is about.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; onChange: (next: string) => void; ariaLabel: string }) => (
    <textarea
      aria-label={props.ariaLabel}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    />
  ),
}));

const executeStatCode = vi.hoisted(() => vi.fn());
vi.mock('@/lib/statCodeExecutor', () => ({ executeStatCode, STAT_CLOCK_VARS: [] }));

const row = () => screen.getByRole('button', { name: /Test Code/ }).parentElement as HTMLElement;

/** Put code in the field the way an author would, and run it. */
async function testCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  const field = screen.getByLabelText('Stat code');
  await user.clear(field);
  await user.paste(code);
  await user.click(screen.getByRole('button', { name: /Test Code/ }));
}

describe('what Test Code reports', () => {
  beforeEach(() => {
    executeStatCode.mockReset();
    updateStat.mockReset();
  });

  it('says how many problems the reader found beside the number the run produced', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null });
    render(<StatManager stat={stats[0]} />);

    // Runs perfectly — the branch holding the typo is never taken, which is exactly why running it
    // proves nothing about the typo.
    await testCode(user, 'if (false) { return nope; } return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5'));
    await waitFor(() => expect(row()).toHaveTextContent('1 error in this code'));
  });

  it('leaves a clean result clean, with nothing to qualify it', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null });
    render(<StatManager stat={stats[0]} />);

    await testCode(user, 'return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5'));
    expect(row()).not.toHaveTextContent('in this code');
  });

  it('still counts the problems when the run itself threw', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: "Error: 'nope' is not defined" });
    render(<StatManager stat={stats[0]} />);

    await testCode(user, 'const x = nope; return alsoNope;');

    await waitFor(() => expect(row()).toHaveTextContent('nope'));
    await waitFor(() => expect(row()).toHaveTextContent('2 errors in this code'));
  });

  it('drops the whole report once the code it described has been edited', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null });
    render(<StatManager stat={stats[0]} />);

    await testCode(user, 'if (false) { return nope; } return 5;');
    await waitFor(() => expect(row()).toHaveTextContent('1 error in this code'));

    await user.type(screen.getByLabelText('Stat code'), ' ');
    expect(row()).not.toHaveTextContent('Result:');
    expect(row()).not.toHaveTextContent('in this code');
  });
});
