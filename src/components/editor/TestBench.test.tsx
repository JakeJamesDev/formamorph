import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { groupFindings, runRules, RULES, type FindingGroup, type RuleWorld } from '@/lib/testBench/rules';
import { partitionFindings, withDismissed, withSeen, EMPTY_BENCH_STATE } from '@/lib/testBench/seenState';
import type { Entity, WorldOverview } from '@/types';
import { TestBench, TestBenchButton, type TestBenchProps } from './TestBench';

// The panel renders whatever the rule pass produced, so the fixture goes through the real engine rather
// than hand-built groups — a row shape the rules can't actually emit would prove nothing. The base world
// is structurally sound (a starting location, every entity placed) so only the authored defects fire.
const world = (entities: Entity[]): RuleWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: '' } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: entities.map((e) => ({ locations: ['harbor'], ...e })),
  traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

const defective = world([
  { id: 'e1', name: 'Maren', aliases: ['the visitor', 'Maren'] },
  { id: 'e2', name: 'Old Tobb', aliases: ['the fishmonger'] },
]);

/** Everything the panel needs, so a test names only the props it is about. */
const benchProps = (groups: FindingGroup[], over: Partial<TestBenchProps> = {}): TestBenchProps => ({
  groups,
  dismissedGroups: [],
  ruleCount: RULES.length,
  newCount: 0,
  codedStatCount: 0,
  codeCheckStatus: 'idle',
  tab: 'issues',
  onTabChange: vi.fn(),
  onClose: vi.fn(),
  onOpenItem: vi.fn(),
  onFixRule: vi.fn(),
  onDismissRule: vi.fn(),
  onRestoreRule: vi.fn(),
  onMarkAllSeen: vi.fn(),
  onCheckStatCode: vi.fn(),
  ...over,
});

const renderBench = (from: RuleWorld, over: Partial<TestBenchProps> = {}) => {
  const props = benchProps(groupFindings(runRules(from)), over);
  render(<TestBench {...props} />);
  return props;
};

describe('TestBench panel', () => {
  it('lists findings under their severity headings', () => {
    renderBench(defective);
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText(/2 aliases begin with an article/)).toBeInTheDocument();
  });

  it('sends every item a row names to the editor tab that owns it', async () => {
    const { onOpenItem } = renderBench(defective);
    await userEvent.click(screen.getByRole('button', { name: 'Old Tobb' }));
    expect(onOpenItem).toHaveBeenCalledWith('entities', 'e2');
  });

  it('reports a clean world as verified, with the number of rules that ran', () => {
    renderBench(world([{ id: 'e1', name: 'Maren', aliases: ['Wren'] }]));
    expect(screen.getByText('No Problems Found')).toBeInTheDocument();
    expect(screen.getByText(`${RULES.length} rules checked`)).toBeInTheDocument();
  });

  it('offers the unbuilt instruments as disabled tabs', () => {
    renderBench(defective);
    expect(screen.getByRole('tab', { name: /Issues/ })).toBeEnabled();
    for (const label of ['Triggers', 'AI Context', 'Opening']) {
      expect(screen.getByRole('tab', { name: label })).toBeDisabled();
    }
  });

  it('stands on the instrument it was handed', () => {
    // The strip is controlled, so the panel on screen follows the prop rather than its own click state.
    renderBench(defective);
    expect(screen.getByRole('tab', { name: /Issues/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders an error group ahead of the rest', () => {
    renderBench({ ...world([]), locations: [{ id: 'l1', name: 'The Long Pier' }] });
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText(/No location is flagged as a starting location/)).toBeInTheDocument();
  });

  it('opens a finding item on its own tab when it overrides the rule’s section', async () => {
    // A broken chip's rule lives on the Placeholders tab, but the item carrying it is an entity.
    const { onOpenItem } = renderBench(
      world([{ id: 'e1', name: 'Maren', aiDescription: 'A {{ph:gone:world:pl1}} of the fen.' }]),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Maren' }));
    expect(onOpenItem).toHaveBeenCalledWith('entities', 'e1');
  });

  it('closes from the bench header', async () => {
    const { onClose } = renderBench(world([]));
    await userEvent.click(screen.getByRole('button', { name: 'Close Test Bench' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('TestBench stat-code check', () => {
  const CHECK = { name: 'Check Stat Code' };

  it('offers nothing to run in a world whose stats carry no code', () => {
    renderBench(world([]), { codedStatCount: 0 });
    expect(screen.queryByRole('button', { name: /Check Stat Code|Check Again/ })).toBeNull();
  });

  it('runs the check on demand and never on its own', async () => {
    const { onCheckStatCode } = renderBench(world([]), { codedStatCount: 2 });
    expect(screen.getByText('2 stats have code, run separately')).toBeInTheDocument();
    // Rendering alone must not have run anything — a VM per stat is exactly what the badge can't afford.
    expect(onCheckStatCode).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', CHECK));
    expect(onCheckStatCode).toHaveBeenCalledTimes(1);
  });

  it('closes the button while a run is in flight', () => {
    renderBench(world([]), { codedStatCount: 2, codeCheckStatus: 'running' });
    expect(screen.getByRole('button', { name: /Running/ })).toBeDisabled();
  });

  it('says what it checked once a run has finished, and offers another', () => {
    renderBench(world([]), { codedStatCount: 1, codeCheckStatus: 'done' });
    expect(screen.getByText('Checked 1 coded stat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Again' })).toBeEnabled();
  });
});

describe('TestBench quick fixes', () => {
  it('hands the row’s rule to the editor when Fix is pressed', async () => {
    const { onFixRule } = renderBench(world([{ id: 'e1', name: 'Maren', aliases: ['the visitor'] }]));
    await userEvent.click(screen.getByRole('button', { name: 'Fix' }));
    expect(onFixRule).toHaveBeenCalledWith('alias-leading-article');
  });

  it('says Fix All once the row stands for more than one finding', () => {
    renderBench(defective);
    // Two articled aliases collapse into one row, so the button repairs both at once.
    expect(screen.getByRole('button', { name: 'Fix All' })).toBeInTheDocument();
  });

  it('offers no Fix on a row whose repair is a judgment call', () => {
    // No location is flagged as starting: which one should be is the author's decision, so the row is Open only.
    renderBench({ ...world([]), locations: [{ id: 'l1', name: 'The Long Pier' }] });
    expect(screen.getByText(/No location is flagged as a starting location/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Fix/ })).toBeNull();
  });
});

describe('TestBench newness', () => {
  // The panel is handed marked findings, so the fixture goes through the real seen-state seam rather than
  // hand-set flags — a marking the store can't actually produce would prove nothing.
  const marked = (from: RuleWorld, state = EMPTY_BENCH_STATE): Partial<TestBenchProps> => {
    const { live, dismissed } = partitionFindings(runRules(from), state);
    const groups = groupFindings(live, (f) => f.isNew);
    return {
      groups,
      dismissedGroups: groupFindings(dismissed),
      newCount: groups.filter((g) => g.newCount > 0).length,
    };
  };
  const renderMarked = (from: RuleWorld, state = EMPTY_BENCH_STATE, over: Partial<TestBenchProps> = {}) => {
    const props = benchProps([], { ...marked(from, state), ...over });
    render(<TestBench {...props} />);
    return props;
  };
  /** The rows on screen, in the order they are rendered. */
  const rowOrder = () => screen.getAllByRole('button', { name: /^Dismiss: / })
    .map((b) => b.getAttribute('aria-label')?.replace('Dismiss: ', ''));

  const articled = world([{ id: 'e1', name: 'Maren', aliases: ['the visitor'] }]);

  it('marks a row nobody has been shown yet', () => {
    renderMarked(articled);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('goes quiet once the row has been seen', () => {
    renderMarked(articled, withSeen(EMPTY_BENCH_STATE, runRules(articled)));
    expect(screen.queryByText('New')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark All Seen' })).toBeNull();
    // The finding is still listed — seen means known, not gone.
    expect(screen.getByText(/begins with an article/)).toBeInTheDocument();
  });

  it('marks a known row again once a second instance of the same rule arrives', () => {
    const seen = withSeen(EMPTY_BENCH_STATE, runRules(articled));
    const both = world([
      { id: 'e1', name: 'Maren', aliases: ['the visitor'] },
      { id: 'e2', name: 'Old Tobb', aliases: ['the fishmonger'] },
    ]);
    renderMarked(both, seen);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('1 new')).toBeInTheDocument();
  });

  it('sorts a new row above a known one of the same severity', () => {
    // Both warnings. The articled alias fires first in catalog order, so only newness can reorder them.
    const two = {
      ...articled,
      entities: [{ id: 'e1', name: 'Maren', aliases: ['the visitor'], locations: ['harbor'] }, { id: 'e2', name: 'Old Tobb', locations: [] }],
    };
    renderMarked(two, withSeen(EMPTY_BENCH_STATE, runRules(articled)));
    expect(rowOrder()?.[0]).toMatch(/placed in no location/);
  });

  it('marks the whole list seen on request', async () => {
    const { onMarkAllSeen } = renderMarked(articled);
    await userEvent.click(screen.getByRole('button', { name: 'Mark All Seen' }));
    expect(onMarkAllSeen).toHaveBeenCalled();
  });
});

describe('TestBench dismissal', () => {
  const articled = world([{ id: 'e1', name: 'Maren', aliases: ['the visitor'] }]);

  it('hands the row’s rule over when dismissed', async () => {
    const { onDismissRule } = renderBench(articled);
    await userEvent.click(screen.getByRole('button', { name: /^Dismiss: / }));
    expect(onDismissRule).toHaveBeenCalledWith('alias-leading-article');
  });

  it('keeps a muted row out of the list but reachable', async () => {
    const state = withDismissed(EMPTY_BENCH_STATE, runRules(articled));
    const { live, dismissed } = partitionFindings(runRules(articled), state);
    const props = benchProps(groupFindings(live), { dismissedGroups: groupFindings(dismissed) });
    render(<TestBench {...props} />);
    expect(screen.getByText('No Problems Found')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '1 dismissed' }));
    await userEvent.click(screen.getByRole('button', { name: /^Restore: / }));
    expect(props.onRestoreRule).toHaveBeenCalledWith('alias-leading-article');
  });

  it('says nothing about dismissals when there are none', () => {
    renderBench(articled);
    expect(screen.queryByText(/dismissed/)).toBeNull();
  });
});

describe('TestBenchButton', () => {
  it('shows what is new, prominently', () => {
    render(<TestBenchButton count={7} newCount={3} open={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Test Bench, 3 new findings' })).toBeInTheDocument();
    expect(screen.getByText('3')).toHaveClass('bg-warning');
  });

  it('drops to a muted total once nothing is new', () => {
    render(<TestBenchButton count={7} newCount={0} open={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Test Bench, 7 findings' })).toBeInTheDocument();
    expect(screen.getByText('7')).toHaveClass('bg-muted');
  });

  it('counts a lone finding in the singular', () => {
    render(<TestBenchButton count={1} newCount={1} open={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Test Bench, 1 new finding' })).toBeInTheDocument();
  });

  it('stays quiet at zero', () => {
    render(<TestBenchButton count={0} newCount={0} open={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Test Bench' })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('reads as pressed while the Bench is open', () => {
    render(<TestBenchButton count={0} newCount={0} open onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Test Bench' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('caps a runaway count so the icon button cannot grow', () => {
    render(<TestBenchButton count={140} newCount={0} open={false} onClick={vi.fn()} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
