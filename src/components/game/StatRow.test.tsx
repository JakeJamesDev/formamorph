import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatRow } from './StatRow';
import type { PlayerStat } from '@/types';

/**
 * The stat row renders from the stat alone. In Play shows it inside the World Editor, where no game is
 * running and no game state exists to read.
 */

const grit = { id: 'grit', name: 'Grit', min: 0, max: 10, value: 7 } as PlayerStat;

afterEach(cleanup);

describe('StatRow outside a running game', () => {
  it('shows the name and the value over the max', () => {
    render(
      <StatRow
        stat={grit}
        change={0}
        barDelta={0}
        draining={false}
        page={0}
        isViewingPast={false}
        snap
        fading={false}
        editable={false}
        reserveDescriptorLine={false}
        onCommitValue={() => {}}
      />,
    );
    expect(screen.getByText('Grit')).toBeInTheDocument();
    expect(screen.getByText('7 / 10')).toBeInTheDocument();
  });
});
