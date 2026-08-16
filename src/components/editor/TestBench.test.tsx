import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { groupFindings, runRules, RULES, type RuleWorld } from '@/lib/testBench/rules';
import type { Entity, WorldOverview } from '@/types';
import { TestBench, TestBenchButton } from './TestBench';

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

const renderBench = (from: RuleWorld, onOpenItem = vi.fn()) => {
  const groups = groupFindings(runRules(from));
  render(
    <TestBench
      groups={groups}
      ruleCount={RULES.length}
      tab="issues"
      onTabChange={vi.fn()}
      onClose={vi.fn()}
      onOpenItem={onOpenItem}
    />,
  );
  return { groups, onOpenItem };
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
    const onClose = vi.fn();
    render(
      <TestBench
        groups={[]} ruleCount={RULES.length} tab="issues"
        onTabChange={vi.fn()} onClose={onClose} onOpenItem={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close Test Bench' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('TestBenchButton', () => {
  it('shows the finding count', () => {
    render(<TestBenchButton count={7} open={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Test Bench, 7 findings' })).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('stays quiet at zero', () => {
    render(<TestBenchButton count={0} open={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Test Bench' })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('reads as pressed while the Bench is open', () => {
    render(<TestBenchButton count={0} open onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Test Bench' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('caps a runaway count so the icon button cannot grow', () => {
    render(<TestBenchButton count={140} open={false} onClick={vi.fn()} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
