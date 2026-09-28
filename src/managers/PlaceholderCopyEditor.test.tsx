import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { effectiveCopy } from '@/lib/blueprints';
import type { Placeholder } from '@/types';
import { PlaceholderCopyEditor, PlaceholderCopyFooter } from './PlaceholderCopyEditor';

// The chip editors need a browser caret; a plain box stands in for typing.
vi.mock('@/components/prompt/PlaceholderField', () => {
  const Box = ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) =>
    <input aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />;
  return { default: Box, PlaceholderNameField: Box };
});

const GARB: Placeholder = {
  id: 'garb', name: 'Class Garb', groupId: 'bp',
  values: [{ id: 'v-tabard', text: 'a tabard' }, { id: 'v-plate', text: 'plate' }],
};
const COPY: Placeholder = { id: 'c-garb', name: 'Class Garb', values: [], blueprintId: 'garb' };

/** The editor and its footer over a live store, the way the World Editor mounts them. */
function renderCopy(blueprint = GARB, copy = COPY) {
  let list!: Placeholder[];
  let setList!: (next: Placeholder[] | ((prev: Placeholder[]) => Placeholder[])) => void;
  const Harness = () => {
    const [placeholders, setPlaceholders] = useState<Placeholder[]>([blueprint, copy]);
    list = placeholders;
    setList = setPlaceholders;
    const bp = placeholders.find((p) => p.id === blueprint.id)!;
    const cp = placeholders.find((p) => p.id === copy.id)!;
    return (
      <PlaceholderStoreProvider value={placeholderStore(placeholders, setPlaceholders)}>
        <PlaceholderCopyEditor copy={cp} blueprint={bp} ownerName="Albus" />
        <PlaceholderCopyFooter copy={cp} onEditBlueprint={onEditBlueprint} />
      </PlaceholderStoreProvider>
    );
  };
  const onEditBlueprint = vi.fn();
  render(<Harness />);
  const read = () => {
    const bp = list.find((p) => p.id === blueprint.id)!;
    const cp = list.find((p) => p.id === copy.id)!;
    return { copy: cp, effective: effectiveCopy(cp, bp) };
  };
  const editBlueprint = (change: (p: Placeholder) => Placeholder) =>
    act(() => setList((prev) => prev.map((p) => (p.id === blueprint.id ? change(p) : p))));
  return { read, editBlueprint, onEditBlueprint };
}

const reset = (n: number) => screen.queryByRole('button', { name: `Reset value ${n}` });
const texts = (p: Placeholder) => p.values.map((v) => v.text);

describe('PlaceholderCopyEditor', () => {
  it('names the copy after its owner and blueprint, read-only', () => {
    renderCopy();
    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('Albus.Class Garb');
    expect(name).toBeDisabled();
  });

  it('rewords one value as an override, keeping its id, and resets it', () => {
    const { read } = renderCopy();
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'a white tabard' } });
    expect(read().effective.values).toEqual([{ id: 'v-tabard', text: 'a white tabard' }, { id: 'v-plate', text: 'plate' }]);
    expect(reset(2)).toBeNull();
    fireEvent.click(reset(1)!);
    expect(read().copy.valueOverrides).toBeUndefined();
    expect(texts(read().effective)).toEqual(['a tabard', 'plate']);
  });

  it('keeps an override typed back to the blueprint value until Reset', () => {
    const { read } = renderCopy();
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'a tabard' } });
    expect(read().copy.valueOverrides).toEqual({ 'v-tabard': { text: { value: 'a tabard', blueprint: 'a tabard' } } });
    expect(reset(1)).not.toBeNull();
  });

  it('reweights one value and benches it here only', () => {
    const { read } = renderCopy();
    fireEvent.change(screen.getByLabelText('Draw weight for value 2'), { target: { value: '0' } });
    expect(read().effective.weights).toEqual({ 'v-plate': 0 });
    expect(reset(2)).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Draw weight for value 2'), { target: { value: '1' } });
    expect(read().copy.valueOverrides).toEqual({ 'v-plate': { weight: { value: 1, blueprint: 1 } } });
    fireEvent.click(reset(2)!);
    expect(read().copy.valueOverrides).toBeUndefined();
  });

  it('removes a value, lists it dimmed as Removed, and restores it with Reset', () => {
    const { read } = renderCopy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove value 2' }));
    expect(texts(read().effective)).toEqual(['a tabard']);
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.queryByLabelText('Value 2')).toBeNull();
    fireEvent.click(reset(2)!);
    expect(texts(read().effective)).toEqual(['a tabard', 'plate']);
  });

  it('adds, edits and removes values of its own after the blueprint values', () => {
    const { read } = renderCopy();
    fireEvent.click(screen.getByRole('button', { name: /Add Value/ }));
    fireEvent.change(screen.getByLabelText('Value 3'), { target: { value: 'a hooded cloak' } });
    expect(texts(read().effective)).toEqual(['a tabard', 'plate', 'a hooded cloak']);
    expect(read().copy.valueOverrides).toBeUndefined();
    fireEvent.change(screen.getByLabelText('Draw weight for value 3'), { target: { value: '3' } });
    expect(read().effective.weights).toEqual({ [read().copy.values[0].id]: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Remove value 3' }));
    expect(read().copy.values).toEqual([]);
    expect(read().copy.weights).toBeUndefined();
  });

  it('shows a value the blueprint adds later, live', () => {
    const { read, editBlueprint } = renderCopy();
    editBlueprint((p) => ({ ...p, values: [...p.values, { id: 'v-robe', text: 'a robe' }] }));
    expect(screen.getByLabelText('Value 3')).toHaveValue('a robe');
    expect(texts(read().effective)).toEqual(['a tabard', 'plate', 'a robe']);
  });

  it('marks a reworded value Blueprint changed once the blueprint rewords it too', () => {
    const { editBlueprint } = renderCopy();
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'a white tabard' } });
    const row = () => reset(1)!.closest('div')!;
    expect(within(row()).queryByText('Blueprint changed')).toBeNull();
    editBlueprint((p) => ({ ...p, values: p.values.map((v) => (v.id === 'v-tabard' ? { ...v, text: 'a red tabard' } : v)) }));
    expect(within(row()).getByText('Blueprint changed')).toBeInTheDocument();
    expect(screen.getByLabelText('Value 1')).toHaveValue('a white tabard');
  });

  it('Reset to Blueprint drops every override and keeps the own values', () => {
    const { read } = renderCopy();
    const footerReset = screen.getByRole('button', { name: 'Reset to Blueprint' });
    expect(footerReset).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'a white tabard' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove value 2' }));
    fireEvent.click(screen.getByRole('button', { name: /Add Value/ }));
    fireEvent.change(screen.getByLabelText('Value 3'), { target: { value: 'mail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Blueprint' }));
    expect(read().copy.valueOverrides).toBeUndefined();
    expect(texts(read().effective)).toEqual(['a tabard', 'plate', 'mail']);
    expect(screen.getByRole('button', { name: 'Reset to Blueprint' })).toBeDisabled();
  });

  it('opens the blueprint from the footer', () => {
    const { onEditBlueprint } = renderCopy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Blueprint' }));
    expect(onEditBlueprint).toHaveBeenCalledOnce();
  });
});
