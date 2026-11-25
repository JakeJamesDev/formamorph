import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ADD_FIRST, ADD_TO_ROW, EMPTY_INPUT, FieldHarness, sentences, writtenRows } from '@/test/requirementRows';
import type { GateInput } from '@/lib/traitGates';
import type { TraitRequirementRow } from '@/types';

const ALLOWED = ['clear', 'rain', 'storm'] as const;

/** The field over the real clauses and options, with the world's weather kinds when it has any. */
const field = (initial: TraitRequirementRow[] = [], kinds?: GateInput['weatherKinds']) =>
  render(<FieldHarness input={{ ...EMPTY_INPUT, ...(kinds && { weatherKinds: kinds }) }} initial={initial} />);
/** Opens the set token, whose popover holds the kind toggles. */
const openToken = () => fireEvent.click(screen.getByRole('button', { name: /^Weather:/ }));
const kind = (name: string) => within(screen.getByRole('toolbar', { name: 'Weather' })).getByRole('button', { name });

describe('a weather Condition in the rows editor', () => {
  it('is offered only while Weather is on', async () => {
    const { unmount } = field();
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    expect(screen.queryByRole('option', { name: /^Weather/ })).toBeNull();
    unmount();
    field([], ALLOWED);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    expect(await screen.findByRole('option', { name: /^Weather/ })).toBeInTheDocument();
  });

  it('adds an empty, broken token with no owner page, listing only the allowed kinds', async () => {
    field([], ALLOWED);
    fireEvent.click(screen.getByRole('button', { name: ADD_FIRST }));
    fireEvent.click(await screen.findByRole('option', { name: /^Weather/ }));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'weather', kinds: [] }] }]);
    const token = screen.getByRole('button', { name: 'Weather: pick the weather' });
    expect(token).toHaveAccessibleDescription('No weather is picked.');
    openToken();
    expect(kind('Rain')).toHaveAttribute('aria-pressed', 'false');
    expect(within(screen.getByRole('toolbar', { name: 'Weather' })).queryByRole('button', { name: 'Snow' })).toBeNull();
  });

  it('edits the kinds in list order and lets the last one go off', () => {
    field([{ all: [{ kind: 'weather', kinds: ['storm'] }] }], ALLOWED);
    openToken();
    expect(kind('Storm')).toBeEnabled();
    fireEvent.click(kind('Clear'));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'weather', kinds: ['clear', 'storm'] }] }]);
    fireEvent.click(kind('Storm'));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'weather', kinds: ['clear'] }] }]);
    fireEvent.click(kind('Clear'));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'weather', kinds: [] }] }]);
  });

  it('flips to Not and back, keeping its kinds, and edits them while negated', () => {
    field([{ all: [{ kind: 'weather', kinds: ['rain'] }] }], ALLOWED);
    fireEvent.click(screen.getByRole('button', { name: 'Change to “is not”' }));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'weather', kinds: ['rain'], not: true }] }]);
    expect(sentences()).toEqual(['The weather is not Rain and…']);
    openToken();
    fireEvent.click(kind('Storm'));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'weather', kinds: ['rain', 'storm'], not: true }] }]);
  });

  it('flips back to the plain verb, keeping its kinds', () => {
    field([{ all: [{ kind: 'weather', kinds: ['rain'], not: true }] }], ALLOWED);
    fireEvent.click(screen.getByRole('button', { name: 'Change to “is”' }));
    expect(writtenRows()[0].all[0]).not.toHaveProperty('not');
  });

  it('a row takes one weather Condition', async () => {
    field([{ all: [{ kind: 'weather', kinds: ['rain'] }] }], ALLOWED);
    fireEvent.click(screen.getByRole('button', { name: ADD_TO_ROW }));
    expect(await screen.findByRole('option', { name: /^Weather/ })).toHaveAttribute('aria-disabled', 'true');
  });
});
