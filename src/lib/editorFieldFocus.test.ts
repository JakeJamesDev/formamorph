import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  revealEditorMatch, revealEditorChip, revealSelectedRow, clearEditorMatch, cancelEditorReveals, CHIP_TOKEN_ATTR,
} from './editorFieldFocus';

/**
 * Guards the reveal retries' cancel paths.
 *
 * A reveal that finds nothing keeps looking on a timer, because the field usually mounts a little later.
 * That timer has to stop when the editor goes away or a newer reveal replaces it, or the lookup runs
 * against a panel nobody is looking at.
 */

const RING = 'editor-find-target';
/** Longer than the whole retry budget, so a lookup still alive has certainly run again. */
const PAST_EVERY_RETRY = 5000;

let root: HTMLElement;

const hitFor = (value: string) => ({ value, matchText: value, start: 0 });

/** Mount a text field holding `value`, the way a panel does some time after the navigation. */
const mountField = (value: string) => {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  const wrapper = document.createElement('div');
  wrapper.append(input);
  root.append(wrapper);
  return input;
};

beforeEach(() => {
  vi.useFakeTimers();
  root = document.createElement('div');
  document.body.append(root);
  // jsdom implements no scrolling.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cancelEditorReveals();
  clearEditorMatch();
  root.remove();
  vi.useRealTimers();
});

describe('a field reveal', () => {
  it('rings a field that mounts after the navigation', () => {
    revealEditorMatch(root, hitFor('Odd Wick'));
    const field = mountField('Odd Wick');

    vi.advanceTimersByTime(PAST_EVERY_RETRY);

    expect(field.classList.contains(RING)).toBe(true);
  });

  it('stops looking once the reveals are canceled', () => {
    revealEditorMatch(root, hitFor('Odd Wick'));
    cancelEditorReveals();
    const field = mountField('Odd Wick');

    vi.advanceTimersByTime(PAST_EVERY_RETRY);

    expect(field.classList.contains(RING)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops looking once the marker is cleared', () => {
    // The find bar closing: a field that mounts afterwards must not get a ring with no bar to explain it.
    revealEditorMatch(root, hitFor('Odd Wick'));
    clearEditorMatch();
    const field = mountField('Odd Wick');

    vi.advanceTimersByTime(PAST_EVERY_RETRY);

    expect(field.classList.contains(RING)).toBe(false);
  });

  it('drops the older lookup when a newer reveal starts', () => {
    // The newer hit's field never mounts. The older one's does, and ringing it would mark a hit the
    // author already moved on from.
    revealEditorMatch(root, hitFor('Odd Wick'));
    revealEditorMatch(root, hitFor('Harbor Steps'));
    const older = mountField('Odd Wick');

    // Short of the budget: the newer lookup giving up clears every marker, which would hide a wrong ring.
    vi.advanceTimersByTime(80);

    expect(older.classList.contains(RING)).toBe(false);
  });

  it('drops a pending field lookup when a chip reveal starts', () => {
    revealEditorMatch(root, hitFor('Odd Wick'));
    revealEditorChip('<NAME>');
    const field = mountField('Odd Wick');

    vi.advanceTimersByTime(PAST_EVERY_RETRY);

    expect(field.classList.contains(RING)).toBe(false);
  });
});

describe('a chip reveal', () => {
  const mountChip = (token: string) => {
    const editor = document.createElement('div');
    editor.setAttribute('data-lexical-editor', 'true');
    const chip = document.createElement('span');
    chip.setAttribute(CHIP_TOKEN_ATTR, token);
    editor.append(chip);
    root.append(editor);
    return chip;
  };

  it('rings a chip that mounts after the jump', () => {
    revealEditorChip('<NAME>');
    const chip = mountChip('<NAME>');

    vi.advanceTimersByTime(80);

    expect(chip.classList.contains(RING)).toBe(true);
  });

  it('stops looking once the reveals are canceled', () => {
    revealEditorChip('<NAME>');
    cancelEditorReveals();
    const chip = mountChip('<NAME>');

    // Short of the ring's own lifetime, so a chip ringed by a live lookup still wears it here.
    vi.advanceTimersByTime(80);

    expect(chip.classList.contains(RING)).toBe(false);
  });
});

describe('a row reveal', () => {
  const mountRow = () => {
    const row = document.createElement('div');
    row.setAttribute('data-editor-row-selected', '');
    row.scrollIntoView = vi.fn();
    root.append(row);
    return row;
  };

  it('scrolls to a row that renders after the selection', () => {
    revealSelectedRow(root);
    const row = mountRow();

    vi.advanceTimersByTime(PAST_EVERY_RETRY);

    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('stops looking once the reveals are canceled', () => {
    revealSelectedRow(root);
    cancelEditorReveals();
    const row = mountRow();

    vi.advanceTimersByTime(PAST_EVERY_RETRY);

    expect(row.scrollIntoView).not.toHaveBeenCalled();
  });

  it('runs one lookup, not two, when a second selection follows the first', () => {
    revealSelectedRow(root);
    revealSelectedRow(root);
    const row = mountRow();

    vi.advanceTimersByTime(PAST_EVERY_RETRY);

    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
