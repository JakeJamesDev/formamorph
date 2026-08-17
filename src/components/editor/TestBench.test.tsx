import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildAiContext, type AiContextData } from '@/lib/testBench/aiContext';
import {
  buildLens, EMPTY_LENS, lensLocationOptions, lensPcOptions,
  type BenchLens, type LensOption, type LensState, type StatOverride,
} from '@/lib/testBench/lens';
import { buildOpening, EMPTY_OPENING, primeOpeningRolls, type OpeningData } from '@/lib/testBench/opening';
import {
  groupFindings, runRules, RULES, type Finding, type FindingGroup, type RuleWorld,
} from '@/lib/testBench/rules';
import { partitionFindings, withDismissed, withSeen, EMPTY_BENCH_STATE } from '@/lib/testBench/seenState';
import { buildTriggerReport, type TriggerReport } from '@/lib/testBench/triggers';
import type { SemanticStatus } from '@/lib/testBench/useTriggerSemantics';
import type { Entity, WorldOverview } from '@/types';
import type { BenchTab } from '@/lib/testBench/benchTabs';
import type { CodeCheckStatus, OpenFindingItem, TestBenchProps } from '@/lib/testBench/benchProps';
import { TestBench, TestBenchButton } from './TestBench';

// The panel renders whatever the rule pass produced, so the fixture goes through the real engine rather
// than hand-built groups — a row shape the rules can't actually emit would prove nothing. The base world
// is structurally sound and described (a starting location, every entity placed with both descriptions,
// a prompt and a readme) so only the authored defects fire.
const world = (entities: Entity[]): RuleWorld => ({
  worldOverview: {
    name: 'Sedge Landing', description: '', systemPrompt: 'Narrate the fen.', readme: 'A fen primer.',
  } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: entities.map((e) => ({
    locations: ['harbor'], playerDescription: 'Seen around.', aiDescription: 'A fen regular.', ...e,
  })),
  traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

const defective = world([
  { id: 'e1', name: 'Maren', aliases: ['the visitor', 'Maren'] },
  { id: 'e2', name: 'Old Tobb', aliases: ['the fishmonger'] },
]);

/** The panel's props laid out flat — the shape a test overrides by name; `toProps` folds them into the
 *  per-Instrument bundles the component takes, so a test still names only the props it is about. */
interface FlatBenchProps {
  groups: FindingGroup[];
  dismissedGroups: FindingGroup[];
  ruleCount: number;
  newCount: number;
  codedStatCount: number;
  codeCheckStatus: CodeCheckStatus;
  lens: BenchLens;
  pcOptions: LensOption[];
  locationOptions: LensOption[];
  statOverrides: StatOverride[];
  onPcChange: (traitId: string | null) => void;
  onLocationChange: (locationId: string | null) => void;
  tab: BenchTab;
  onTabChange: (tab: BenchTab) => void;
  onClose: () => void;
  onOpenItem: OpenFindingItem;
  onFixRule: (ruleId: string) => void;
  onDismissRule: (ruleId: string) => void;
  onRestoreRule: (ruleId: string) => void;
  onMarkAllSeen: () => void;
  onCheckStatCode: () => void;
  triggerText: string;
  onTriggerTextChange: (text: string) => void;
  triggerHistory: string;
  onTriggerHistoryChange: (text: string) => void;
  triggerReport: TriggerReport;
  matchingFindings: Finding[];
  onPasteLastTurn?: () => void;
  semanticStatus: SemanticStatus;
  semanticOn: boolean;
  onSemanticChange: (on: boolean) => void;
  aiContext: AiContextData;
  opening: OpeningData;
  onRerollOpening: () => void;
}

const toProps = (flat: FlatBenchProps): TestBenchProps => ({
  tab: flat.tab,
  onTabChange: flat.onTabChange,
  onClose: flat.onClose,
  onFixRule: flat.onFixRule,
  issues: {
    groups: flat.groups,
    dismissedGroups: flat.dismissedGroups,
    ruleCount: flat.ruleCount,
    newCount: flat.newCount,
    codedStatCount: flat.codedStatCount,
    codeCheckStatus: flat.codeCheckStatus,
    onOpenItem: flat.onOpenItem,
    onDismissRule: flat.onDismissRule,
    onRestoreRule: flat.onRestoreRule,
    onMarkAllSeen: flat.onMarkAllSeen,
    onCheckStatCode: flat.onCheckStatCode,
  },
  lens: {
    lens: flat.lens,
    pcOptions: flat.pcOptions,
    locationOptions: flat.locationOptions,
    statOverrides: flat.statOverrides,
    onPcChange: flat.onPcChange,
    onLocationChange: flat.onLocationChange,
  },
  triggers: {
    text: flat.triggerText,
    onTextChange: flat.onTriggerTextChange,
    history: flat.triggerHistory,
    onHistoryChange: flat.onTriggerHistoryChange,
    report: flat.triggerReport,
    matchingFindings: flat.matchingFindings,
    onPasteLastTurn: flat.onPasteLastTurn,
    semanticStatus: flat.semanticStatus,
    semanticOn: flat.semanticOn,
    onSemanticChange: flat.onSemanticChange,
  },
  aiContext: flat.aiContext,
  opening: { data: flat.opening, onReroll: flat.onRerollOpening },
});

/** Everything the panel needs, so a test names only the props it is about. */
const benchProps = (groups: FindingGroup[], over: Partial<FlatBenchProps> = {}): FlatBenchProps => ({
  groups,
  dismissedGroups: [],
  ruleCount: RULES.length,
  newCount: 0,
  codedStatCount: 0,
  codeCheckStatus: 'idle',
  tab: 'issues',
  onTabChange: vi.fn(),
  onClose: vi.fn(),
  lens: buildLens(defective, EMPTY_LENS),
  pcOptions: [],
  locationOptions: lensLocationOptions(defective),
  statOverrides: [],
  onPcChange: vi.fn(),
  onLocationChange: vi.fn(),
  onOpenItem: vi.fn(),
  onFixRule: vi.fn(),
  onDismissRule: vi.fn(),
  onRestoreRule: vi.fn(),
  onMarkAllSeen: vi.fn(),
  onCheckStatCode: vi.fn(),
  semanticStatus: 'unavailable',
  semanticOn: false,
  onSemanticChange: vi.fn(),
  triggerText: '',
  onTriggerTextChange: vi.fn(),
  triggerHistory: '',
  onTriggerHistoryChange: vi.fn(),
  triggerReport: buildTriggerReport({ entities: [], dictionaries: [], placeholders: [] }, ''),
  matchingFindings: [],
  aiContext: buildAiContext(defective, buildLens(defective, EMPTY_LENS)),
  opening: EMPTY_OPENING,
  onRerollOpening: vi.fn(),
  ...over,
});

const renderBench = (from: RuleWorld, over: Partial<FlatBenchProps> = {}) => {
  const props = benchProps(groupFindings(runRules(from)), over);
  render(<TestBench {...toProps(props)} />);
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

  it('offers all four instruments as live tabs', () => {
    renderBench(defective);
    for (const label of [/Issues/, 'Triggers', 'AI Context', 'Opening']) {
      expect(screen.getByRole('tab', { name: label })).toBeEnabled();
    }
  });

  it('shows the AI Context instrument its cost, its blocks and the travel caveat', () => {
    const lens = buildLens(defective, { pcTraitId: null, locationId: 'harbor' });
    renderBench(defective, { tab: 'aiContext', lens, aiContext: buildAiContext(defective, lens) });
    expect(screen.getByText(/A turn from here ≈ ~\d/)).toBeInTheDocument();
    expect(screen.getByText('Entities Here')).toBeInTheDocument();
    expect(screen.getByText(/can never be traveled to from here/)).toBeInTheDocument();
  });

  it('asks the AI Context instrument for a location when the lens stands nowhere', () => {
    renderBench(defective, { tab: 'aiContext' });
    expect(screen.getByText(/Pick a location in the lens/)).toBeInTheDocument();
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

describe('TestBench lens bar', () => {
  // A world with a playable character: an exclusive group of two origins, one of which pins a Wildcard.
  const lensWorld: RuleWorld = {
    ...world([]),
    locations: [
      { id: 'harbor', name: 'Harbor Steps', isStarting: true },
      { id: 'market', name: 'The Long Market' },
    ],
    traitGroups: [{ id: 'g-origin', name: 'Origin', parentId: null, exclusive: true }],
    traits: [
      {
        id: 't-sedge', name: 'Sedge-Born', groupId: 'g-origin', statChanges: [], order: 0,
        placeholderPins: [{ placeholderId: 'ph-hair', value: 'copper' }],
      },
      { id: 't-reach', name: 'Reach-Born', groupId: 'g-origin', statChanges: [], order: 1 },
    ],
    placeholders: [{ id: 'ph-hair', name: 'Hair Color', values: ['ash', 'copper'] }],
  };

  const renderLens = (state: LensState, over: Partial<FlatBenchProps> = {}) => renderBench(lensWorld, {
    lens: buildLens(lensWorld, state),
    pcOptions: lensPcOptions(lensWorld),
    locationOptions: lensLocationOptions(lensWorld),
    ...over,
  });

  const pcSelector = () => screen.getByRole('combobox', { name: 'Test as character' });
  const locationSelector = () => screen.getByRole('combobox', { name: 'Test at location' });

  it('shows the selection on both selectors', () => {
    renderLens({ pcTraitId: 't-sedge', locationId: 'market' });
    expect(pcSelector()).toHaveTextContent('Sedge-Born');
    expect(locationSelector()).toHaveTextContent('The Long Market');
  });

  it('says who and where it is testing as when nothing is picked', () => {
    renderLens(EMPTY_LENS);
    expect(pcSelector()).toHaveTextContent('Anyone');
    expect(locationSelector()).toHaveTextContent('Nowhere');
  });

  it('offers every exclusive-group trait under its group heading', async () => {
    renderLens(EMPTY_LENS);
    await userEvent.click(pcSelector());
    expect(screen.getByRole('option', { name: 'Sedge-Born' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Reach-Born' })).toBeInTheDocument();
    expect(screen.getByText('Origin')).toBeInTheDocument();
  });

  it('reports a pick as the id of the thing picked', async () => {
    const { onPcChange } = renderLens(EMPTY_LENS);
    await userEvent.click(pcSelector());
    await userEvent.click(screen.getByRole('option', { name: 'Reach-Born' }));
    expect(onPcChange).toHaveBeenCalledWith('t-reach');
  });

  it('clears back to no PC', async () => {
    const { onPcChange } = renderLens({ pcTraitId: 't-sedge', locationId: null });
    await userEvent.click(pcSelector());
    await userEvent.click(screen.getByRole('option', { name: 'Anyone' }));
    expect(onPcChange).toHaveBeenCalledWith(null);
  });

  it('has no PC to offer in a world with no exclusive group', () => {
    renderBench(defective, { pcOptions: [], locationOptions: lensLocationOptions(defective) });
    expect(pcSelector()).toBeDisabled();
  });

  it('stands above the tab strip, so switching instruments keeps the setup', () => {
    const props = benchProps(groupFindings(runRules(lensWorld)), {
      lens: buildLens(lensWorld, { pcTraitId: 't-sedge', locationId: 'market' }),
      pcOptions: lensPcOptions(lensWorld),
      locationOptions: lensLocationOptions(lensWorld),
    });
    const { rerender } = render(<TestBench {...toProps(props)} />);
    rerender(<TestBench {...toProps(props)} tab="triggers" />);
    expect(screen.getByRole('tab', { name: 'Triggers' })).toHaveAttribute('aria-selected', 'true');
    expect(pcSelector()).toHaveTextContent('Sedge-Born');
    expect(locationSelector()).toHaveTextContent('The Long Market');
  });

  it('says so when the PC pins a value the placeholder does not offer', () => {
    const broken: RuleWorld = {
      ...lensWorld,
      traits: [{ ...lensWorld.traits[0], placeholderPins: [{ placeholderId: 'ph-hair', value: 'teal' }] }],
    };
    renderBench(broken, {
      lens: buildLens(broken, { pcTraitId: 't-sedge', locationId: null }),
      pcOptions: lensPcOptions(broken),
      locationOptions: lensLocationOptions(broken),
    });
    expect(screen.getByText(/Pins “Hair Color” to “teal”, which isn’t one of its values/)).toBeInTheDocument();
  });

  it('is silent about pins the world honors', () => {
    renderLens({ pcTraitId: 't-sedge', locationId: null });
    expect(screen.queryByText(/isn’t one of its values/)).toBeNull();
  });

  it('names the stats the PC switches away from the world’s defaults', () => {
    renderLens({ pcTraitId: 't-sedge', locationId: null }, {
      statOverrides: [{ stat: 'Tide Sense', enabled: true }],
    });
    expect(screen.getByText('Adds Tide Sense')).toBeInTheDocument();
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
  const marked = (from: RuleWorld, state = EMPTY_BENCH_STATE): Partial<FlatBenchProps> => {
    const { live, dismissed } = partitionFindings(runRules(from), state);
    const groups = groupFindings(live, (f) => f.isNew);
    return {
      groups,
      dismissedGroups: groupFindings(dismissed),
      newCount: groups.filter((g) => g.newCount > 0).length,
    };
  };
  const renderMarked = (from: RuleWorld, state = EMPTY_BENCH_STATE, over: Partial<FlatBenchProps> = {}) => {
    const props = benchProps([], { ...marked(from, state), ...over });
    render(<TestBench {...toProps(props)} />);
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
    render(<TestBench {...toProps(props)} />);
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

describe('TestBench Opening instrument', () => {
  // A world with one banded stat starting exactly on a band edge, and one rolled Wildcard — enough to watch
  // the slider re-band and the reroll land. The view-model goes through the real builder, deterministic pick.
  const openingWorld: RuleWorld = {
    ...world([]),
    worldOverview: {
      name: 'Sedge Landing', description: '', systemPrompt: 'Coin: {{ph:ph-coin:world:pl-c1}}.',
    } as WorldOverview,
    stats: [{
      id: 's-nerve', name: 'Nerve', type: 'number', description: '', min: 0, max: 100, value: 25, regen: 0,
      descriptors: [
        { id: 'd1', threshold: 25, description: 'Shaky' },
        { id: 'd2', threshold: 100, description: 'Iron' },
      ],
    }],
    placeholders: [{ id: 'ph-coin', name: 'Coin Bird', values: ['gull', 'wren'] }],
  };
  const openingData = () => buildOpening(
    openingWorld,
    buildLens(openingWorld, EMPTY_LENS),
    primeOpeningRolls(openingWorld, {}, (values) => values[0]),
  );
  const renderOpening = (over: Partial<FlatBenchProps> = {}) =>
    renderBench(openingWorld, { tab: 'opening', opening: openingData(), ...over });

  it('shows the fresh game: cost, start, stats with their band, and the rolls', () => {
    renderOpening();
    expect(screen.getByText(/Turn one as the default character ≈ ~\d/)).toBeInTheDocument();
    expect(screen.getByText(/Starts at Harbor Steps/)).toBeInTheDocument();
    expect(screen.getByText('Nerve')).toBeInTheDocument();
    expect(screen.getByText('Shaky')).toBeInTheDocument();
    expect(screen.getByText('Coin Bird')).toBeInTheDocument();
    expect(screen.getByText('gull')).toBeInTheDocument();
  });

  it('re-bands live as the slider scrubs, without touching the world', async () => {
    // The instrument has no world-writing prop at all — scrubbing is structurally unable to edit anything.
    renderOpening();
    const thumb = screen.getByRole('slider', { name: 'Scrub Nerve' });
    thumb.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByText('Iron')).toBeInTheDocument();
    expect(screen.getByText('26/100')).toBeInTheDocument();
    expect(screen.queryByText('Shaky')).toBeNull();
  });

  it('opens the assembled first prompt on request', async () => {
    renderOpening();
    await userEvent.click(screen.getByRole('button', { name: /System Prompt/ }));
    expect(screen.getByText(/Coin: gull\./)).toBeInTheDocument();
  });

  it('hands the reroll to the editor', async () => {
    const { onRerollOpening } = renderOpening();
    await userEvent.click(screen.getByRole('button', { name: /Reroll/ }));
    expect(onRerollOpening).toHaveBeenCalledTimes(1);
  });

  it('says a world with no locations has nowhere to start', () => {
    const homeless: RuleWorld = { ...openingWorld, locations: [] };
    renderBench(homeless, {
      tab: 'opening',
      opening: buildOpening(homeless, buildLens(homeless, EMPTY_LENS), {}),
    });
    expect(screen.getByText(/nowhere to start/)).toBeInTheDocument();
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
