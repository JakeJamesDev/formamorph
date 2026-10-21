import { describe, expect, it } from 'vitest';
import { editorPromptRun } from './editorScriptPrompts';
import { PromptCanceled } from './scriptPrompts';

describe('editorPromptRun', () => {
  it('holds a confirm open in its store until the row answers', async () => {
    const run = editorPromptRun();
    const answer = run.host.prompt({ kind: 'confirm', question: 'Sure?' });
    const [open] = run.store.pending();
    expect(open.request).toEqual({ kind: 'confirm', question: 'Sure?' });
    run.store.answer(open.id, true);
    await expect(answer).resolves.toBe(true);
  });

  it('holds input, a long ask and a multiple ask open for the line too', async () => {
    const run = editorPromptRun();
    const text = run.host.prompt({ kind: 'input', question: 'Name?' });
    const long = run.host.prompt({ kind: 'ask', question: 'Road?', options: ['A', 'B', 'C', 'D', 'E'], multiple: false });
    const multi = run.host.prompt({ kind: 'ask', question: 'Pack?', options: ['A', 'B'], multiple: true });
    const [first, second, third] = run.store.pending();
    run.store.answer(first.id, 'Ada');
    run.store.answer(second.id, 4);
    run.store.answer(third.id, [1]);
    await expect(text).resolves.toBe('Ada');
    await expect(long).resolves.toBe(4);
    await expect(multi).resolves.toEqual([1]);
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
