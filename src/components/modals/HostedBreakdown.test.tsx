// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HostedBreakdown } from './HostedBreakdown';

afterEach(cleanup);

describe('HostedBreakdown', () => {
  it('shows every group, a zero share included, and names a large prompt under its group', () => {
    render(<HostedBreakdown breakdown={{ narration: 70, thinking: 20, statUpdates: 10 }} threshold={10} />);
    const list = screen.getByRole('list', { name: /this week/i });
    expect(within(list).getByText('Inventory').parentElement?.textContent).toContain('0%');
    const planning = list.querySelector('[data-breakdown-group="planning"]') as HTMLElement;
    expect(within(planning).getByText('Planning')).toBeTruthy();
    expect(within(planning).getAllByText('20%')).toHaveLength(2);
    expect(list.querySelector('[data-breakdown-prompt="statUpdates"]')).not.toBeNull();
  });

  it('shows the empty state when nothing is spent this week', () => {
    render(<HostedBreakdown breakdown={{}} threshold={10} />);
    expect(screen.getByText('Nothing used yet this week')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
