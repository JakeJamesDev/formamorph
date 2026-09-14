import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IssuesInstrument } from './IssuesInstrument';
import { checkMissingSources } from '@/lib/testBench/missingSources';
import { groupFindings, RULES } from '@/lib/testBench/rules';
import { linkedSourceCopies, missingSources, type SourceCheckResults, type SourceCheckWorld } from '@/lib/sourceChecks';
import type { IssuesProps, SourceCheckProps } from '@/lib/testBench/benchProps';
import type { Dictionary, Entity } from '@/types';

const entity = (id: string, name: string, link?: Entity['link']): Entity =>
  ({ id, name, ...(link ? { link } : {}) }) as Entity;

const book = (id: string, name: string, link?: Dictionary['link']): Dictionary =>
  ({ id, name, entries: [], ...(link ? { link } : {}) }) as Dictionary;

const world: SourceCheckWorld = {
  entities: [entity('e1', 'Warden', { sourceId: 'src-a', sourceName: 'Marsh Warden' })],
  dictionaries: [book('d1', 'Lore', { sourceId: 'src-b', sourceName: 'Fen Lore' })],
};

/** The instrument as the Bench hands it over, from the real finding builder rather than hand-built rows. */
const renderIssues = (results: SourceCheckResults, required: string[] = [], over: Partial<SourceCheckProps> = {}) => {
  const copies = linkedSourceCopies(world, required);
  const sources: SourceCheckProps = {
    sourceCount: copies.length,
    status: 'done',
    missing: missingSources(copies, results),
    onCheckSources: vi.fn(),
    onRepair: vi.fn(),
    ...over,
  };
  const issues: IssuesProps = {
    groups: groupFindings(checkMissingSources(copies, results)),
    dismissedGroups: [],
    ruleCount: RULES.length,
    newCount: 0,
    advancedOnlyCount: 0,
    advanced: true,
    codedStatCount: 0,
    codeCheckStatus: 'idle',
    fixingRuleId: null,
    publishBytes: null,
    onOpenItem: vi.fn(),
    onDismissRule: vi.fn(),
    onRestoreRule: vi.fn(),
    onMarkAllSeen: vi.fn(),
    onCheckStatCode: vi.fn(),
    sources,
  };
  render(<IssuesInstrument issues={issues} onFix={vi.fn()} />);
  return { issues, sources };
};

describe('Issues instrument: missing sources', () => {
  it('offers the check, and nothing about missing sources, before anyone runs it', () => {
    renderIssues({}, [], { status: 'idle' });
    expect(screen.getByRole('button', { name: 'Check Sources' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /^Repair for/ })).not.toBeInTheDocument();
  });

  it('runs the check when the author asks', async () => {
    const { sources } = renderIssues({}, [], { status: 'idle' });
    await userEvent.click(screen.getByRole('button', { name: 'Check Sources' }));
    expect(sources.onCheckSources).toHaveBeenCalled();
  });

  it('offers no check at all for a world whose copies follow nothing published', () => {
    const copies = linkedSourceCopies({ entities: [entity('e1', 'Alone')] });
    render(
      <IssuesInstrument
        issues={{
          groups: [], dismissedGroups: [], ruleCount: RULES.length, newCount: 0, advancedOnlyCount: 0,
          advanced: true, codedStatCount: 0, codeCheckStatus: 'idle', fixingRuleId: null, publishBytes: null,
          onOpenItem: vi.fn(), onDismissRule: vi.fn(), onRestoreRule: vi.fn(), onMarkAllSeen: vi.fn(),
          onCheckStatCode: vi.fn(),
          sources: {
            sourceCount: copies.length, status: 'idle', missing: [],
            onCheckSources: vi.fn(), onRepair: vi.fn(),
          },
        }}
        onFix={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Check Sources' })).not.toBeInTheDocument();
  });

  it('reads a not-found answer as removed, with a repair for the copy', () => {
    renderIssues({ 'src-a': 'not_found' }, ['src-a']);
    expect(screen.getByText('“Marsh Warden” was removed by its author, and this world requires it'))
      .toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Repair for Warden' })).toBeInTheDocument();
  });

  it('reads any other failure as unchecked, and offers Retry Check', () => {
    renderIssues({ 'src-a': 'unavailable' }, ['src-a']);
    expect(screen.getByText('Formamorph could not check “Marsh Warden”')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Check/ })).toBeInTheDocument();
  });

  it('offers no Retry Check on a removed source, which asking again cannot change', () => {
    renderIssues({ 'src-a': 'not_found' }, ['src-a']);
    expect(screen.queryByRole('button', { name: /Retry Check/ })).not.toBeInTheDocument();
  });

  it('starts every row with no repair chosen', () => {
    renderIssues({ 'src-a': 'not_found', 'src-b': 'not_found' });
    for (const button of screen.getAllByRole('button', { name: 'Apply' })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getAllByText('Choose a repair')).toHaveLength(2);
  });

  it('applies one row’s repair to that row’s copy alone', async () => {
    const { sources } = renderIssues({ 'src-a': 'not_found', 'src-b': 'not_found' });

    await userEvent.click(screen.getByRole('combobox', { name: 'Repair for Warden' }));
    await userEvent.click(screen.getByRole('option', { name: 'Unlink and Keep Content' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Apply' })[0]);

    expect(sources.onRepair).toHaveBeenCalledTimes(1);
    expect(sources.onRepair).toHaveBeenCalledWith('e1', 'unlink');
  });

  it('offers the three repairs on a row', async () => {
    renderIssues({ 'src-a': 'not_found' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Repair for Warden' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Replace From Library', 'Unlink and Keep Content', 'Remove From World']);
  });

  it('offers a repair on an unreachable source too', () => {
    renderIssues({ 'src-a': 'unavailable' });
    expect(screen.getByRole('combobox', { name: 'Repair for Warden' })).toBeInTheDocument();
  });

  it('sends a book copy to the dictionary tab', async () => {
    const { issues } = renderIssues({ 'src-b': 'not_found' });
    await userEvent.click(screen.getByRole('button', { name: 'Lore' }));
    expect(issues.onOpenItem).toHaveBeenCalledWith('dictionary', 'd1');
  });

  it('holds every control while a check is in flight', () => {
    renderIssues({ 'src-a': 'unavailable' }, [], { status: 'running' });
    expect(screen.getByRole('combobox', { name: 'Repair for Warden' })).toBeDisabled();
    // Both ways in — the row's Retry Check and the section's own run.
    const checking = screen.getAllByRole('button', { name: /Checking/ });
    expect(checking).toHaveLength(2);
    for (const button of checking) expect(button).toBeDisabled();
  });
});
