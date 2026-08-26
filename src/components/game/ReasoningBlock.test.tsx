import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReasoningBlock } from './ReasoningBlock';

/**
 * The reasoning aside's open/closed behavior. Each turn mounts a fresh instance (the thinking-phase block
 * unmounts when narration commits, and paging swaps the message list), so the cases that matter are the
 * ones that cross an unmount: the reader's manual toggle must carry to the next turn's block.
 */
describe('ReasoningBlock', () => {
  beforeEach(() => localStorage.clear());

  it('opens while thinking by default and auto-collapses when narration starts', () => {
    const { rerender } = render(<ReasoningBlock text="pondering the marsh" ms={0} active />);
    expect(screen.getByText('pondering the marsh')).toBeInTheDocument();

    rerender(<ReasoningBlock text="pondering the marsh" ms={3000} active={false} />);
    expect(screen.queryByText('pondering the marsh')).not.toBeInTheDocument();
    expect(screen.getByText('Thought for 3s')).toBeInTheDocument();
  });

  it('carries a manual collapse to the next turn: a fresh active block mounts closed', async () => {
    const first = render(<ReasoningBlock text="turn one scratchpad" ms={0} active />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('turn one scratchpad')).not.toBeInTheDocument();
    first.unmount();

    render(<ReasoningBlock text="turn two scratchpad" ms={0} active />);
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
    expect(screen.queryByText('turn two scratchpad')).not.toBeInTheDocument();
  });

  it('expanding again restores the default for future turns', async () => {
    const first = render(<ReasoningBlock text="turn one scratchpad" ms={0} active />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('turn one scratchpad')).toBeInTheDocument();
    first.unmount();

    render(<ReasoningBlock text="turn two scratchpad" ms={0} active />);
    expect(screen.getByText('turn two scratchpad')).toBeInTheDocument();
  });

  it('with the collapsed choice standing, a mounted block that turns active stays closed', async () => {
    const first = render(<ReasoningBlock text="turn one scratchpad" ms={0} active />);
    await userEvent.click(screen.getByRole('button'));
    first.unmount();

    // Live→saved handoff in reverse: an instance already on screen flips to active (regenerate reuses
    // the same tree slot), so the auto-follow effect must honor the standing choice, not just the seed.
    const { rerender } = render(<ReasoningBlock text="turn two scratchpad" ms={2000} active={false} />);
    rerender(<ReasoningBlock text="turn two scratchpad" ms={0} active />);
    expect(screen.queryByText('turn two scratchpad')).not.toBeInTheDocument();
  });
});
