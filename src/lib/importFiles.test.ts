// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeEvent, ReactElement } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { getErrorDetailsState } from './errorDetails';
import { filesFrom, importPackFile, importReportToast, importSummaryToast, storageCause } from './importFiles';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
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

describe('importPackFile', () => {
  it('resets the input and hands the picked file’s text to the importer', async () => {
    const event = changeEvent([file('pack.json')]);
    const importText = vi.fn(async (read: () => Promise<string | null>) => { expect(await read()).toBe('{}'); });
    importPackFile(event, importText);
    expect(event.target.value).toBe('');
    expect(importText).toHaveBeenCalledTimes(1);
    await importText.mock.results[0].value;
  });

  it('skips the importer when the picker was dismissed', () => {
    const importText = vi.fn(async () => {});
    importPackFile(changeEvent([]), importText);
    expect(importText).not.toHaveBeenCalled();
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

describe('importReportToast', () => {
  const noun = { one: 'dictionary', many: 'dictionaries' };
  beforeEach(() => vi.clearAllMocks());

  /** The toast's lines, and the Error Details its link opens. */
  const report = (level: typeof toast.error) => {
    const toasted = render(vi.mocked(level).mock.calls[0][0] as ReactElement);
    const lines = [...toasted.container.querySelectorAll('span')].map((line) => line.textContent);
    fireEvent.click(toasted.getByRole('button'));
    toasted.unmount();
    return { lines, entry: getErrorDetailsState().entry };
  };

  it('keeps the plain summary when nothing was skipped', () => {
    importReportToast(2, [], noun);
    expect(toast.success).toHaveBeenCalledWith('Imported 2 dictionaries.');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows a written cause on the line, with no raw failure to list', () => {
    importReportToast(0, [{ fileName: 'a.json', cause: 'Import it from the Worlds tab.' }], noun);
    const { lines, entry } = report(toast.error);
    expect(lines).toEqual(["Couldn't import a.json.", 'Import it from the Worlds tab.']);
    expect(entry?.details).toBe('a.json\nImport it from the Worlds tab.');
  });

  it('keeps the extra in the summary line of a partial import', () => {
    importReportToast(1, [{ fileName: 'a.json', cause: 'Bad file.' }], noun, ', 2 lorebooks');
    expect(report(toast.warning).lines).toEqual(['Imported 1 dictionary, 2 lorebooks.', "Couldn't import a.json.", 'Bad file.']);
  });

  it('keeps every raw failure out of the toast when several files were skipped', () => {
    importReportToast(0, [
      { fileName: 'a.json', cause: 'Bad file.', error: new Error('raw parser text') },
      { fileName: 'b.json', cause: 'Full.', error: new Error('raw storage text') },
    ], noun);
    const { lines, entry } = report(toast.error);
    expect(lines).toEqual(['Imported 0 dictionaries (2 skipped).']);
    expect(entry?.details).toMatch(/^a\.json\nBad file\.\nError: raw parser text/);
    expect(entry?.details).toMatch(/\n\nb\.json\nFull\.\nError: raw storage text/);
  });
});

describe('storageCause', () => {
  it('names full storage from the error name, and writes a general line for the rest', () => {
    const full = Object.assign(new Error('raw'), { name: 'QuotaExceededError' });
    expect(storageCause(full, { one: 'entity', many: 'entities' })).toBe('The storage is full.');
    expect(storageCause(new Error('raw'), { one: 'entity', many: 'entities' })).toBe('Formamorph cannot save the entity.');
  });
});
