// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import {
  HISTORY_FIELD_ATTRIBUTE, fieldFrame, fieldOf, fieldPath, findHistoryField, watchFieldInUse,
} from '@/lib/historyField';

/** A field's identity is read from its frame, found again by name, and followed through focus. */

const frame = (field: string) => {
  const div = document.createElement('div');
  div.setAttribute(HISTORY_FIELD_ATTRIBUTE, field);
  div.append(document.createElement('input'));
  document.body.append(div);
  return div;
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('fieldPath and fieldFrame', () => {
  it('join the data path into one identity', () => {
    expect(fieldPath('descriptors', 'd-2', 'text')).toBe('descriptors/d-2/text');
    expect(fieldFrame('descriptors', 'd-2', 'text')).toEqual({ [HISTORY_FIELD_ATTRIBUTE]: 'descriptors/d-2/text' });
  });
});

describe('fieldOf', () => {
  it('names the field whose frame holds the node', () => {
    const name = frame('name');
    expect(fieldOf(name.querySelector('input'))).toBe('name');
  });

  it('names nothing outside a frame', () => {
    const loose = document.createElement('button');
    document.body.append(loose);
    expect(fieldOf(loose)).toBeUndefined();
    expect(fieldOf(null)).toBeUndefined();
  });
});

describe('findHistoryField', () => {
  it('finds the frame by its whole identity, not by a prefix', () => {
    frame('descriptors/d-1/text');
    const second = frame('descriptors/d-2/text');
    expect(findHistoryField(document, 'descriptors/d-2/text')).toBe(second);
    expect(findHistoryField(document, 'descriptors/d-2')).toBeNull();
  });

  it('prefers the frame on screen when a layout draws the field twice', () => {
    const hidden = frame('name');
    const shown = frame('name');
    vi.spyOn(hidden, 'getClientRects').mockReturnValue([] as unknown as DOMRectList);
    vi.spyOn(shown, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    expect(findHistoryField(document, 'name')).toBe(shown);
  });
});

describe('watchFieldInUse', () => {
  let seen: (string | undefined)[];
  let stop: () => void;
  beforeEach(() => {
    seen = [];
    stop = watchFieldInUse(document, (field) => seen.push(field));
  });
  afterEach(() => stop());

  it('follows focus from field to field, and out to a control with no field', () => {
    const tab = document.createElement('button');
    document.body.append(tab);
    frame('name').querySelector('input')!.focus();
    frame('aiDescription').querySelector('input')!.focus();
    tab.focus();
    expect(seen).toEqual(['name', 'aiDescription', undefined]);
  });

  it('reports no field when focus leaves for no element', () => {
    const input = frame('name').querySelector('input')!;
    input.focus();
    input.blur();
    expect(seen).toEqual(['name', undefined]);
  });

  it('reports a field once while focus moves inside it', () => {
    const frameEl = frame('aiSummary');
    frameEl.append(document.createElement('input'));
    const [first, second] = frameEl.querySelectorAll('input');
    first.focus();
    second.focus();
    expect(seen).toEqual(['aiSummary']);
  });

  it('follows a press on a control that takes no focus, and a press on a place with no field', () => {
    const checkbox = document.createElement('button');
    frame('hidden').append(checkbox);
    const canvas = document.createElement('div');
    document.body.append(canvas);
    fireEvent.pointerUp(checkbox);
    fireEvent.pointerUp(canvas);
    expect(seen).toEqual(['hidden', undefined]);
  });

  it('keeps the old field while the press that leaves it is still down', () => {
    const checkbox = document.createElement('button');
    frame('hidden').append(checkbox);
    frame('name').querySelector('input')!.focus();
    fireEvent.pointerDown(checkbox);
    expect(seen).toEqual(['name']);
  });

  it('keeps the field that opened a pop-out for focus and presses inside it', () => {
    const popout = document.createElement('div');
    popout.setAttribute('data-radix-popper-content-wrapper', '');
    const option = document.createElement('button');
    popout.append(option);
    document.body.append(popout);
    frame('aiDescription').querySelector('input')!.focus();
    option.focus();
    fireEvent.pointerUp(option);
    expect(seen).toEqual(['aiDescription']);
  });

  it('names no field for a pop-out opened from a place with no field', () => {
    const popout = document.createElement('div');
    popout.setAttribute('role', 'menu');
    const item = document.createElement('button');
    popout.append(item);
    document.body.append(popout);
    item.focus();
    fireEvent.pointerUp(item);
    expect(seen).toEqual([]);
  });

  it("names the pop-out's own field when its controls have one", () => {
    const popout = document.createElement('div');
    popout.setAttribute('data-radix-popper-content-wrapper', '');
    popout.append(frame('pins/0'));
    document.body.append(popout);
    frame('aiDescription').querySelector('input')!.focus();
    popout.querySelector('input')!.focus();
    expect(seen).toEqual(['aiDescription', 'pins/0']);
  });

  it('stops reporting once stopped', () => {
    stop();
    frame('name').querySelector('input')!.focus();
    expect(seen).toEqual([]);
  });
});
