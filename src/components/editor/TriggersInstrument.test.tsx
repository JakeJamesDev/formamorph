import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildTriggerReport, type TriggerWorld } from '@/lib/testBench/triggers';
import type { Dictionary, DictionaryEntry, Entity } from '@/types';
import { TriggersInstrument } from './TriggersInstrument';

const entry = (over: Partial<DictionaryEntry> & { id: string }): DictionaryEntry => ({
  name: '', key: [], value: 'lore', ...over,
});
const book = (entries: DictionaryEntry[], over: Partial<Dictionary> = {}): Dictionary =>
  ({ id: 'book1', name: 'Sedge Lore', entries, ...over });
const ent = (id: string, name: string, over: Partial<Entity> = {}): Entity => ({ id, name, ...over }) as Entity;

const world = (over: Partial<TriggerWorld> = {}): TriggerWorld =>
  ({ entities: [], dictionaries: [], placeholders: [], ...over });

// The panel renders whatever the real tracer produced — a row shape the module cannot emit would prove
// nothing about what an author sees.
const renderTriggers = (from: TriggerWorld, text: string) => {
  const onTextChange = vi.fn();
  render(<TriggersInstrument text={text} onTextChange={onTextChange} report={buildTriggerReport(from, text)} />);
  return { onTextChange };
};

const sedge = world({
  entities: [ent('e1', 'Maren')],
  dictionaries: [book([
    entry({ id: 'd1', name: 'Tides', key: ['tide'] }),
    entry({ id: 'd2', name: 'Storms', key: ['storm'] }),
  ])],
});

describe('TriggersInstrument', () => {
  it('re-evaluates as the author types, with no button to press', async () => {
    const { onTextChange } = renderTriggers(sedge, '');
    expect(screen.queryByRole('button', { name: /run|evaluate|check/i })).toBeNull();
    await userEvent.type(screen.getByRole('textbox', { name: 'Scene text' }), 'a');
    expect(onTextChange).toHaveBeenCalledWith('a');
  });

  it('lists a detected entity with the form that matched and the text it hit', () => {
    renderTriggers(sedge, 'Maren watches the tide.');
    const row = screen.getByText(/Matched “Maren” as “Maren”/).closest('div');
    expect(within(row as HTMLElement).getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('1 detected')).toBeInTheDocument();
  });

  it('shows a fired entry’s keyword, literal text and region', () => {
    renderTriggers(sedge, 'The tides pull out.');
    expect(screen.getByText('Keyword')).toBeInTheDocument();
    expect(screen.getByText('“tide” as “tide” · Scene')).toBeInTheDocument();
  });

  it('states the near-miss reason on a row that did not fire', () => {
    renderTriggers(
      world({ dictionaries: [book([entry({ id: 'd1', name: 'Tides', key: ['tide'], matchWholeWords: true })])] }),
      'The riptides drag the channel.',
    );
    expect(screen.getByText(/appears only inside “riptides”/)).toBeInTheDocument();
  });

  it('greys a muted book with the reason its entries were never scanned', () => {
    renderTriggers(
      world({ dictionaries: [book([entry({ id: 'd1', name: 'Tides', key: ['tide'] })], { enabled: false })] }),
      'The tide pulls out.',
    );
    expect(screen.getByText(/Sedge Lore · off/)).toBeInTheDocument();
    expect(screen.getByText(/book is off, so none of its entries are scanned/)).toBeInTheDocument();
  });

  it('flags an uncompilable pattern on the entry instead of losing the run', () => {
    renderTriggers(
      world({ dictionaries: [book([
        entry({ id: 'd1', name: 'Broken', key: ['tide('], useRegex: true }),
        entry({ id: 'd2', name: 'Tides', key: ['tide'] }),
      ])] }),
      'The tide pulls out.',
    );
    expect(screen.getByText(/is not valid regex/)).toBeInTheDocument();
    // The healthy entry beside it still got its verdict.
    expect(screen.getByText('Keyword')).toBeInTheDocument();
  });

  it('reads empty text as a result: the constant entries and what they do', () => {
    renderTriggers(
      world({ dictionaries: [book([
        entry({ id: 'd1', name: 'House Rules', constant: true }),
        entry({ id: 'd2', name: 'Tides', key: ['tide'] }),
      ])] }),
      '',
    );
    expect(screen.getByText(/1 constant entry injects on every turn/)).toBeInTheDocument();
    expect(screen.getByText('House Rules')).toBeInTheDocument();
    expect(screen.getByText('Always On')).toBeInTheDocument();
  });

  it('reads nothing-fired as a result, with the number of entries checked', () => {
    renderTriggers(sedge, 'A quiet morning.');
    expect(screen.getByText(/Nothing fired\. 2 entries were checked/)).toBeInTheDocument();
    // And the rows are still there to explain themselves.
    expect(screen.getAllByText('No keyword found in the text.')).toHaveLength(2);
  });

  it('says so plainly when a world has no dictionary at all', () => {
    renderTriggers(world(), 'Maren watches the tide.');
    expect(screen.getByText('This world has no dictionary entries.')).toBeInTheDocument();
  });
});

describe('TriggersInstrument highlights', () => {
  it('marks the matched words in the pasted text', () => {
    renderTriggers(sedge, 'Maren watches the tide.');
    expect(screen.getByRole('button', { name: 'Maren' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tide' })).toBeInTheDocument();
  });

  it('opens the row a highlight belongs to', async () => {
    renderTriggers(sedge, 'Maren watches the tide.');
    await userEvent.click(screen.getByRole('button', { name: 'tide' }));
    // The Tides row is the one the span points at, so it is the one singled out.
    const row = screen.getByText('Tides').closest('div[class*="rounded-md"]');
    expect(row?.className).toMatch(/ring-1/);
    expect(within(row as HTMLElement).getByText('“tide” as “tide” · Scene')).toBeInTheDocument();
  });

  it('reaches both rows from words an entity and an entry share', async () => {
    renderTriggers(
      world({ entities: [ent('e1', 'Maren')], dictionaries: [book([entry({ id: 'd1', name: 'The Visitor', key: ['Maren'] })])] }),
      'Maren crosses the yard.',
    );
    const span = screen.getByRole('button', { name: 'Maren' });
    const ringed = () => document.querySelectorAll('div[class*="ring-1"]');
    await userEvent.click(span);
    expect(within(ringed()[0] as HTMLElement).getByText(/Matched “Maren”/)).toBeInTheDocument();
    // A second click hands the same words to the other claimant rather than sticking on the first.
    await userEvent.click(span);
    expect(ringed()).toHaveLength(1);
    expect(within(ringed()[0] as HTMLElement).getByText('The Visitor')).toBeInTheDocument();
  });
});
