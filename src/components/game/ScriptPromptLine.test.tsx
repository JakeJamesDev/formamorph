import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createScriptPromptStore, PromptCanceled, type ScriptPromptRequest } from '@/lib/scriptPrompts';
import { ScriptPromptLine, ScriptTellLines } from './ScriptPromptLine';

/** A store with one open prompt on the line, and the script's side of it. */
function open(request: ScriptPromptRequest) {
  const store = createScriptPromptStore();
  render(<ScriptPromptLine store={store} />);
  let answer: Promise<unknown> = Promise.resolve();
  act(() => { answer = store.prompt(request); });
  return { store, answer };
}

describe('ScriptPromptLine', () => {
  it('answers a confirm on one press of a pill', async () => {
    const { answer } = open({ kind: 'confirm', question: 'Open the door?' });
    expect(screen.getByText('Open the door?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    await expect(answer).resolves.toBe(false);
    expect(screen.queryByTestId('script-prompt')).toBeNull();
  });

  it('answers a short ask with the pressed option index', async () => {
    const { answer } = open({ kind: 'ask', question: 'Which way?', options: ['North', 'East', 'South', 'West'], multiple: false });
    fireEvent.click(screen.getByRole('button', { name: 'South' }));
    await expect(answer).resolves.toBe(2);
  });

  it('shows a dropdown for an ask of five options and answers on OK', async () => {
    const { answer } = open({ kind: 'ask', question: 'Pick a road', options: ['A', 'B', 'C', 'D', 'E'], multiple: false });
    expect(screen.queryByRole('button', { name: 'A' })).toBeNull();
    const ok = screen.getByRole('button', { name: 'OK' });
    expect(ok).toBeDisabled();
    fireEvent.click(screen.getByRole('combobox', { name: 'Pick a road' }));
    fireEvent.click(await screen.findByRole('option', { name: 'D' }));
    expect(ok).toBeEnabled();
    fireEvent.click(ok);
    await expect(answer).resolves.toBe(3);
  });

  it('toggles pills for a multiple ask and sends the picks in option order', async () => {
    const { answer } = open({ kind: 'ask', question: 'Pack what?', options: ['Rope', 'Lamp', 'Bread'], multiple: true });
    fireEvent.click(screen.getByRole('button', { name: 'Bread' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rope' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lamp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lamp' }));
    expect(screen.getByRole('button', { name: 'Rope' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Lamp' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await expect(answer).resolves.toEqual([0, 2]);
  });

  it('sends an empty multiple pick as an empty list', async () => {
    const { answer } = open({ kind: 'ask', question: 'Pack what?', options: ['Rope', 'Lamp', 'Bread', 'Map', 'Coin'], multiple: true });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await expect(answer).resolves.toEqual([]);
  });

  it('submits input on Enter, an empty string included', async () => {
    const first = open({ kind: 'input', question: 'Your name?', placeholder: 'Name' });
    const field = screen.getByPlaceholderText('Name');
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: 'Ada' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await expect(first.answer).resolves.toBe('Ada');

    let empty: Promise<unknown> = Promise.resolve();
    act(() => { empty = first.store.prompt({ kind: 'input', question: 'A word?' }); });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'A word?' }), { key: 'Enter' });
    await expect(empty).resolves.toBe('');
  });

  it('cancels on Cancel', async () => {
    const { answer } = open({ kind: 'confirm', question: 'Open the door?' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(answer).rejects.toBeInstanceOf(PromptCanceled);
  });

  it('takes focus when it opens, and Escape inside it cancels', async () => {
    const { answer } = open({ kind: 'confirm', question: 'Open the door?' });
    expect(screen.getByTestId('script-prompt')).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Yes' }), { key: 'Escape' });
    await expect(answer).rejects.toBeInstanceOf(PromptCanceled);
  });

  it('leaves Escape in the open dropdown list to the list', async () => {
    const { store } = open({ kind: 'ask', question: 'Pick a road', options: ['A', 'B', 'C', 'D', 'E'], multiple: false });
    fireEvent.click(screen.getByRole('combobox', { name: 'Pick a road' }));
    fireEvent.keyDown(await screen.findByRole('option', { name: 'B' }), { key: 'Escape' });
    expect(store.pending()).toHaveLength(1);
  });

  it('shows the asking script’s name as muted text beside the question, on a confirm and an input', async () => {
    const { store, answer } = open({ kind: 'confirm', question: 'Open the door?', asker: 'Latch · After the AI' });
    const meta = screen.getByText('Latch · After the AI');
    expect(meta).toHaveClass('text-muted-foreground');
    expect(screen.getByText('Open the door?').parentElement).toContainElement(meta);
    act(() => { store.cancel(store.pending()[0].id); });
    await expect(answer).rejects.toBeInstanceOf(PromptCanceled);
    let text: Promise<unknown> = Promise.resolve();
    act(() => { text = store.prompt({ kind: 'input', question: 'A word?', asker: 'Tide' }); });
    expect(screen.getByText('Tide')).toBeInTheDocument();
    act(() => { store.cancel(store.pending()[0].id); });
    await expect(text).rejects.toBeInstanceOf(PromptCanceled);
  });

  it('shows no name when the request has none', () => {
    open({ kind: 'confirm', question: 'Open the door?' });
    expect(screen.getByText('Open the door?').parentElement).toHaveTextContent(/^Open the door\?$/);
  });

  it('shows nothing for a tell or a toast left in the store', () => {
    const store = createScriptPromptStore();
    render(<ScriptPromptLine store={store} />);
    act(() => { void store.prompt({ kind: 'tell', text: 'Hello' }); });
    expect(screen.queryByTestId('script-prompt')).toBeNull();
  });
});

describe('ScriptTellLines', () => {
  it('shows each tell in order, and nothing for none', () => {
    const { rerender, container } = render(<ScriptTellLines tells={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ScriptTellLines tells={[{ text: 'First.' }, { text: 'Second.' }]} />);
    expect(screen.getAllByTestId('script-tell').map((line) => line.textContent)).toEqual(['First.', 'Second.']);
  });
});
