import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ADD_FIRST, ADD_TO_ROW, FieldHarness, sentences, writtenRows } from '@/test/requirementRows';
import type { TraitRequirementRow } from '@/types';

const field = (initial: TraitRequirementRow[] = [], offWorld = false) => render(<FieldHarness initial={initial} offWorld={offWorld} />);
const pickTime = async (button: string) => {
  fireEvent.click(screen.getByRole('button', { name: button }));
  fireEvent.click(await screen.findByRole('option', { name: /^Time of Day/ }));
};
/** Opens the Condition's token, whose popover holds the daypart toggles. */
const openToken = () => fireEvent.click(screen.getByRole('button', { name: /^Edit It is/ }));
const daypart = (name: string) => within(screen.getByRole('toolbar', { name: 'Time of day' })).getByRole('button', { name });

describe('a time Condition in the rows editor', () => {
  it('adds an empty, broken token with no owner page, on and off world', async () => {
    for (const offWorld of [false, true]) {
      const { unmount } = field([], offWorld);
      await pickTime(ADD_FIRST);
      expect(writtenRows()).toEqual([{ all: [{ kind: 'time', dayparts: [] }] }]);
      const token = screen.getByRole('button', { name: 'Edit It is pick a time' });
      expect(token).toHaveAttribute('data-broken');
      expect(token).toHaveAccessibleDescription('No time of day is picked.');
      openToken();
      expect(daypart('Night')).toHaveAttribute('aria-pressed', 'false');
      unmount();
    }
  });

  it('edits the dayparts in clock order and lets the last one go off', () => {
    field([{ all: [{ kind: 'time', dayparts: ['night'] }] }]);
    openToken();
    expect(daypart('Night')).toBeEnabled();
    fireEvent.click(daypart('Evening'));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'time', dayparts: ['night', 'evening'] }] }]);
    expect(sentences()).toEqual(['It is evening or night and…']);
    fireEvent.click(daypart('Night'));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'time', dayparts: ['evening'] }] }]);
    fireEvent.click(daypart('Evening'));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'time', dayparts: [] }] }]);
  });

  it('flips to Not and back, keeping its dayparts, and edits them while negated', () => {
    field([{ all: [{ kind: 'time', dayparts: ['night'] }] }]);
    openToken();
    fireEvent.click(screen.getByRole('button', { name: 'Change to “is not”' }));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'time', dayparts: ['night'], not: true }] }]);
    expect(sentences()).toEqual(['It is not night and…']);
    fireEvent.click(daypart('Dawn'));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'time', dayparts: ['night', 'dawn'], not: true }] }]);
    fireEvent.click(screen.getByRole('button', { name: 'Change to “is”' }));
    expect(writtenRows()[0].all[0]).not.toHaveProperty('not');
  });

  it('a row takes one time Condition', async () => {
    field([{ all: [{ kind: 'time', dayparts: ['night'] }] }]);
    fireEvent.click(screen.getByRole('button', { name: ADD_TO_ROW }));
    expect(await screen.findByRole('option', { name: /^Time of Day/ })).toHaveAttribute('aria-disabled', 'true');
  });
});
