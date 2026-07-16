import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeEvent } from 'react';
import { filesFrom, importSummaryToast } from './importFiles';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), warning: vi.fn() },
}));
const { toast } = await import('react-toastify');

/** An array-like stand-in for the live `FileList` — jsdom ships no `DataTransfer` to build a real one. */
function fileList(files: File[]): FileList {
  const list: Record<number, File> & { length: number; item: (i: number) => File | null } = {
    length: files.length,
    item: (i) => files[i] ?? null,
  };
  files.forEach((f, i) => { list[i] = f; });
  return list as unknown as FileList;
}

/** A change event over a real file input, so resetting `value` behaves as it does in the browser. */
function changeEvent(files: File[]): ChangeEvent<HTMLInputElement> {
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', { value: fileList(files), configurable: true });
  return { target: input } as ChangeEvent<HTMLInputElement>;
}

const file = (name: string) => new File(['{}'], name, { type: 'application/json' });

describe('filesFrom', () => {
  it('returns every selected file', () => {
    expect(filesFrom(changeEvent([file('a.json'), file('b.json')])).map((f) => f.name))
      .toEqual(['a.json', 'b.json']);
  });

  it('resets the input so picking the same file again still fires a change', () => {
    const event = changeEvent([file('a.json')]);
    filesFrom(event);
    expect(event.target.value).toBe('');
  });

  it('copies the handles out, so emptying the live FileList cannot strip them', () => {
    const event = changeEvent([file('a.json')]);
    const files = filesFrom(event);

    // What a real browser does to the live list on reset; jsdom won't, so do it by hand.
    Object.defineProperty(event.target, 'files', { value: fileList([]), configurable: true });

    // The returned array still has to be readable later, in a `await file.text()`.
    expect(files.map((f) => f.name)).toEqual(['a.json']);
    expect(event.target.files).toHaveLength(0);
  });

  it('returns [] when the picker was dismissed with no selection', () => {
    const input = document.createElement('input');
    input.type = 'file';
    expect(filesFrom({ target: input } as ChangeEvent<HTMLInputElement>)).toEqual([]);
  });
});

describe('importSummaryToast', () => {
  const noun = { one: 'world', many: 'worlds' };
  beforeEach(() => vi.clearAllMocks());

  it('reports a clean import as a success', () => {
    importSummaryToast(3, 0, noun);
    expect(toast.success).toHaveBeenCalledWith('Imported 3 worlds.');
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('warns when anything was skipped, so a partial import cannot look clean', () => {
    importSummaryToast(2, 1, noun);
    expect(toast.warning).toHaveBeenCalledWith('Imported 2 worlds (1 skipped).');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('uses the singular noun for exactly one', () => {
    importSummaryToast(1, 0, noun);
    expect(toast.success).toHaveBeenCalledWith('Imported 1 world.');
  });

  it('keeps the plural for a wholly skipped import', () => {
    importSummaryToast(0, 2, noun);
    expect(toast.warning).toHaveBeenCalledWith('Imported 0 worlds (2 skipped).');
  });

  it('appends extra before the skipped count', () => {
    importSummaryToast(1, 1, noun, ' and 2 dictionaries');
    expect(toast.warning).toHaveBeenCalledWith('Imported 1 world and 2 dictionaries (1 skipped).');
  });
});
