import { describe, it, expect, vi } from 'vitest';
import contextMenu from './contextMenu.cjs';

const { contextMenuTemplate, MAX_SUGGESTIONS } = contextMenu;

const actions = () => ({ replaceMisspelling: vi.fn(), addToDictionary: vi.fn() });

/** An editable field with a misspelled word under the cursor — the case the whole feature exists for. */
const misspelled = {
  isEditable: true,
  misspelledWord: 'teh',
  dictionarySuggestions: ['the', 'ten', 'tea'],
  editFlags: { canCut: true, canCopy: true, canPaste: true, canSelectAll: true },
};

const labels = (template) => template.map((i) => i.label ?? i.role ?? i.type);

describe('the misspelling menu', () => {
  it('offers each suggestion the spellchecker returned', () => {
    const template = contextMenuTemplate(misspelled, actions());
    expect(labels(template).slice(0, 3)).toEqual(['the', 'ten', 'tea']);
  });

  it('replaces the word with the suggestion that was clicked', () => {
    const a = actions();
    const template = contextMenuTemplate(misspelled, a);
    template[1].click();
    expect(a.replaceMisspelling).toHaveBeenCalledWith('ten');
  });

  it('teaches the dictionary the word it flagged', () => {
    const a = actions();
    const template = contextMenuTemplate(misspelled, a);
    template.find((i) => i.label === 'Add To Dictionary').click();
    expect(a.addToDictionary).toHaveBeenCalledWith('teh');
  });

  it('caps a long suggestion list so the menu stays usable', () => {
    const many = { ...misspelled, dictionarySuggestions: Array.from({ length: 12 }, (_, i) => `w${i}`) };
    const template = contextMenuTemplate(many, actions());
    expect(template.filter((i) => i.label?.startsWith('w'))).toHaveLength(MAX_SUGGESTIONS);
  });

  it('still says something when the dictionary has no suggestions', () => {
    const template = contextMenuTemplate({ ...misspelled, dictionarySuggestions: [] }, actions());
    expect(template[0]).toMatchObject({ label: 'No Spelling Suggestions', enabled: false });
  });
});

describe('the clipboard section', () => {
  it('gives an editable field the full set', () => {
    const template = contextMenuTemplate({ ...misspelled, misspelledWord: '' }, actions());
    expect(labels(template)).toEqual(['cut', 'copy', 'paste', 'selectAll']);
  });

  it('greys out what the field cannot do right now', () => {
    const readOnlyish = { isEditable: true, editFlags: { canCopy: true, canSelectAll: true } };
    const template = contextMenuTemplate(readOnlyish, actions());
    expect(template.find((i) => i.role === 'paste').enabled).toBe(false);
    expect(template.find((i) => i.role === 'copy').enabled).toBe(true);
  });

  it('offers only copy on selected narration text', () => {
    const template = contextMenuTemplate(
      { isEditable: false, selectionText: 'the goo shifts', editFlags: { canCopy: true } },
      actions(),
    );
    expect(labels(template)).toEqual(['copy']);
  });

  it('stays empty on a plain right-click with nothing to act on', () => {
    expect(contextMenuTemplate({ isEditable: false, selectionText: '' }, actions())).toEqual([]);
    expect(contextMenuTemplate(undefined, actions())).toEqual([]);
  });
});

describe('separators', () => {
  it('never leads or trails with one', () => {
    const template = contextMenuTemplate({ ...misspelled, isEditable: false, selectionText: '' }, actions());
    expect(template[0].type).not.toBe('separator');
    expect(template[template.length - 1].type).not.toBe('separator');
  });
});
