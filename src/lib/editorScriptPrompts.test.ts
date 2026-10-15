import { describe, expect, it } from 'vitest';
import { editorPromptRun, fitsChoiceRow } from './editorScriptPrompts';
import { PromptCanceled } from './scriptPrompts';

describe('fitsChoiceRow', () => {
  it('takes a confirm and a single ask of up to four options', () => {
    expect(fitsChoiceRow({ kind: 'confirm', question: 'Sure?' })).toBe(true);
    expect(fitsChoiceRow({ kind: 'ask', question: 'Door?', options: ['A', 'B', 'C', 'D'], multiple: false })).toBe(true);
  });

  it('leaves a fifth option, a multiple ask and askText to the dialog', () => {
    expect(fitsChoiceRow({ kind: 'ask', question: 'Door?', options: ['A', 'B', 'C', 'D', 'E'], multiple: false })).toBe(false);
    expect(fitsChoiceRow({ kind: 'ask', question: 'Door?', options: ['A', 'B'], multiple: true })).toBe(false);
    expect(fitsChoiceRow({ kind: 'askText', question: 'Name?' })).toBe(false);
  });
});

describe('editorPromptRun', () => {
  it('holds a confirm open in its store until the row answers', async () => {
    const run = editorPromptRun();
    const answer = run.host.prompt({ kind: 'confirm', question: 'Sure?' });
    const [open] = run.store.pending();
    expect(open.request).toEqual({ kind: 'confirm', question: 'Sure?' });
    run.store.answer(open.id, true);
    await expect(answer).resolves.toBe(true);
  });

  it('cancels a prompt the dialog would show, and opens nothing', async () => {
    const run = editorPromptRun();
    await expect(run.host.prompt({ kind: 'askText', question: 'Name?' })).rejects.toBeInstanceOf(PromptCanceled);
    await expect(run.host.prompt({ kind: 'ask', question: 'Pick', options: ['A'], multiple: true })).rejects.toBeInstanceOf(PromptCanceled);
    expect(run.store.pending()).toEqual([]);
  });

  it('notes a tell and a toast in call order and resolves both', async () => {
    const run = editorPromptRun();
    await expect(run.host.prompt({ kind: 'tell', text: 'A bell rings.' })).resolves.toBeUndefined();
    await expect(run.host.prompt({ kind: 'toast', text: 'Saved.' })).resolves.toBeUndefined();
    expect(run.notes).toEqual(['Tell: A bell rings.', 'Toast: Saved.']);
    expect(run.store.pending()).toEqual([]);
  });

  it('cancels every open prompt on close, and every later one at once', async () => {
    const run = editorPromptRun();
    const open = run.host.prompt({ kind: 'confirm', question: 'Sure?' });
    run.close();
    await expect(open).rejects.toBeInstanceOf(PromptCanceled);
    expect(run.store.pending()).toEqual([]);
    await expect(run.host.prompt({ kind: 'confirm', question: 'Again?' })).rejects.toBeInstanceOf(PromptCanceled);
  });
});
