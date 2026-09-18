import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  $getRoot, $getSlot, $isElementNode, $isTextNode, getNearestEditorFromDOMNode, UNDO_COMMAND,
  type LexicalEditor, type TextNode,
} from 'lexical';
import PlaceholderField from './PlaceholderField';
import { $isVariableNode } from './VariableNode';
import { VALUE_SLOT } from './openValueContext';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { GameLocation, Placeholder, Stat, Trait } from '@/types';

/**
 * Every pin on a placeholder is a stop on the Values tab: the chevrons reach it after the values, and typing
 * in it rewrites the pin on the trait, location, stat band or value that carries it.
 */

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

// The world the field reads its pins from, set by the harness on every render.
const game = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/contexts/GameDataContext', async (original) => ({
  ...(await original<typeof import('@/contexts/GameDataContext')>()),
  useGameDataOptional: () => game.current,
}));

const world = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow']) };
const hair: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['silver']) };
// No values of its own: every stop it has is a pin.
const ghost: Placeholder = { id: 'ghost', name: 'Ghost', values: [] };
const PLACEHOLDERS = [town, hair, ghost];

// Only the fields the pin rows read.
const sworn = { id: 'sworn', name: 'Sworn', placeholderPins: [
  { placeholderId: 'ghost', value: 'Oathshade' },
  { placeholderId: 'town', value: 'Oathhold' },
  { placeholderId: 'hair', value: 'ash grey' },
] } as unknown as Trait;
const fen = { id: 'fen', name: 'Fen', placeholderPins: [{ placeholderId: 'ghost', value: 'Bogwisp' }] } as unknown as GameLocation;
const hunger = {
  id: 'hunger', name: 'Hunger', min: 0, max: 100,
  descriptors: [{ id: 1, threshold: 20, description: 'starving', placeholderPins: [{ placeholderId: 'ghost', value: 'Hollow' }] }],
} as unknown as Stat;

const traitWrites = vi.fn<(t: Trait) => void>();
const locationWrites = vi.fn<(l: GameLocation) => void>();
const statWrites = vi.fn<(s: Stat) => void>();

/** One field in a world that carries traits, locations and stats, all written back to state. */
function Field({ text, readOnly }: { text: string; readOnly?: boolean }) {
  const [placeholders, setPlaceholders] = useState(PLACEHOLDERS);
  const [traits, setTraits] = useState([sworn]);
  const [locations, setLocations] = useState([fen]);
  const [stats, setStats] = useState([hunger]);
  game.current = {
    placeholders, traits, locations, stats,
    updateTrait: (t: Trait) => { traitWrites(t); setTraits((prev) => prev.map((x) => (x.id === t.id ? t : x))); },
    updateLocation: (l: GameLocation) => { locationWrites(l); setLocations((prev) => prev.map((x) => (x.id === l.id ? l : x))); },
    updateStat: (s: Stat) => { statWrites(s); setStats((prev) => prev.map((x) => (x.id === s.id ? s : x))); },
  };
  return (
    <PlaceholderStoreProvider value={placeholderStore(placeholders, setPlaceholders)}>
      <EditorPreviewRollsProvider>
        <PlaceholderField value={text} onChange={() => {}} placeholders={placeholders} readOnly={readOnly} />
        <div data-testid="ghost-values">{placeholders.find((p) => p.id === 'ghost')!.values.length}</div>
        <div data-testid="sworn-pins">{(traits[0].placeholderPins ?? []).map((p) => p.value).join('|')}</div>
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>
  );
}

const openValues = () => Array.from(document.querySelectorAll<HTMLElement>('[data-open-value]'));
const valueText = (el: HTMLElement) => el.querySelector('[data-open-value-text]')?.textContent ?? '';
const valueLabel = (el: HTMLElement) => el.querySelector('[data-open-value-label]')?.textContent ?? '';
const slotEditable = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-lexical-slot]')?.contentEditable;
const openTab = (name: string) => userEvent.click(screen.getByRole('tab', { name }));
const step = (el: HTMLElement, dir: 'Previous' | 'Next') =>
  userEvent.click(within(el).getByRole('button', { name: `${dir} Value` }));

function editor(): LexicalEditor {
  const found = getNearestEditorFromDOMNode(screen.getByRole('textbox'));
  if (!found) throw new Error('no editor');
  return found;
}

function $valueTextNode(nth: number): TextNode {
  const para = $getRoot().getFirstChild();
  const chip = $isElementNode(para) ? para.getChildren().filter($isVariableNode)[nth] : undefined;
  const box = chip && $getSlot(chip, VALUE_SLOT);
  const node = $isElementNode(box) ? box.getAllTextNodes()[0] : undefined;
  if (!$isTextNode(node)) throw new Error('no value text');
  return node;
}

const typeInValue = (nth: number, text: string) => act(async () => {
  editor().update(() => { $valueTextNode(nth).setTextContent(text).select(text.length, text.length); }, { discrete: true });
});

const random = vi.spyOn(Math, 'random');
beforeEach(() => {
  localStorage.clear();
  random.mockReturnValue(0);
  traitWrites.mockReset();
  locationWrites.mockReset();
  statWrites.mockReset();
});
afterEach(() => random.mockReset());

describe('a placeholder with no values, held by pins', () => {
  it('opens on its first pin, editable, named by the pin\'s source', async () => {
    render(<Field text={`It is ${world('ghost', 'g1')}.`} />);
    await openTab('Values');
    const [open] = openValues();
    // A stat band outranks a location, which outranks a trait.
    expect(valueText(open)).toBe('Hollow');
    expect(slotEditable(open)).toBe('true');
    expect(valueLabel(open)).toMatch(/Pinned by Hunger ≤ 20/);
    expect(within(open).getByText('Pin 1 of 3')).toBeInTheDocument();
  });

  it('steps through every pin on it, strongest source kind first', async () => {
    render(<Field text={`It is ${world('ghost', 'g1')}.`} />);
    await openTab('Values');
    const seen = [valueText(openValues()[0])];
    for (let i = 0; i < 3; i++) {
      await step(openValues()[0], 'Next');
      seen.push(valueText(openValues()[0]));
    }
    expect(seen).toEqual(['Hollow', 'Bogwisp', 'Oathshade', 'Hollow']);
  });

  it('writes a trait\'s pin on the trait, and gives the placeholder no value', async () => {
    render(<Field text={`It is ${world('ghost', 'g1')}.`} />);
    await openTab('Values');
    await step(openValues()[0], 'Previous');
    expect(valueText(openValues()[0])).toBe('Oathshade');
    await typeInValue(0, 'Oathshadow');
    expect(traitWrites).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sworn-pins').textContent).toBe('Oathshadow|Oathhold|ash grey');
    expect(screen.getByTestId('ghost-values').textContent).toBe('0');
  });

  it('writes a location\'s pin on the location', async () => {
    render(<Field text={`It is ${world('ghost', 'g1')}.`} />);
    await openTab('Values');
    await step(openValues()[0], 'Next');
    await typeInValue(0, 'Bogwight');
    expect(locationWrites).toHaveBeenCalledTimes(1);
    expect(locationWrites.mock.calls[0][0].placeholderPins).toEqual([{ placeholderId: 'ghost', value: 'Bogwight' }]);
  });

  it('writes a stat band\'s pin on the stat', async () => {
    render(<Field text={`It is ${world('ghost', 'g1')}.`} />);
    await openTab('Values');
    await typeInValue(0, 'Hollowed');
    expect(statWrites).toHaveBeenCalledTimes(1);
    expect(statWrites.mock.calls[0][0].descriptors?.[0].placeholderPins).toEqual([{ placeholderId: 'ghost', value: 'Hollowed' }]);
  });

  it('keeps two keystrokes in one tick, each building on the last', async () => {
    render(<Field text={`It is ${world('ghost', 'g1')}.`} />);
    await openTab('Values');
    await act(async () => {
      editor().update(() => { $valueTextNode(0).setTextContent('Hollo'); }, { discrete: true });
      editor().update(() => { $valueTextNode(0).setTextContent('Hollowing'); }, { discrete: true });
    });
    expect(statWrites.mock.calls.at(-1)?.[0].descriptors?.[0].placeholderPins).toEqual([{ placeholderId: 'ghost', value: 'Hollowing' }]);
  });

  it('restores the pin on undo', async () => {
    render(<Field text={`It is ${world('ghost', 'g1')}.`} />);
    await openTab('Values');
    await typeInValue(0, 'Hollowed');
    await act(async () => { editor().dispatchCommand(UNDO_COMMAND, undefined); });
    expect(statWrites.mock.calls.at(-1)?.[0].descriptors?.[0].placeholderPins).toEqual([{ placeholderId: 'ghost', value: 'Hollow' }]);
  });

  it('opens one editable copy and one mirror for two chips on one pin stop', async () => {
    render(<Field text={`${world('ghost', 'g1')} and ${world('ghost', 'g2')}.`} />);
    await openTab('Values');
    expect(openValues().map(slotEditable)).toEqual(['true', 'false']);
    await typeInValue(0, 'Hollowed');
    expect(openValues().map(valueText)).toEqual(['Hollowed', 'Hollowed']);
  });

  it('takes no typing in a read-only field', async () => {
    render(<Field text={`It is ${world('ghost', 'g1')}.`} readOnly />);
    await openTab('Values');
    expect(slotEditable(openValues()[0])).toBe('false');
  });
});

describe('a placeholder with values and pins', () => {
  it('reaches its pins after its values, counting both together', async () => {
    render(<Field text={`At ${world('town', 't1')}.`} />);
    await openTab('Values');
    await step(openValues()[0], 'Previous');
    const [open] = openValues();
    expect(valueText(open)).toBe('Oathhold');
    expect(within(open).getByText('Pin 3 of 3')).toBeInTheDocument();
    expect(valueLabel(open)).toMatch(/Pinned by Trait: Sworn/);

    await openTab('Preview');
    expect(screen.getByTestId('prompt-preview')).toHaveTextContent('At Oathhold.');
  });

  it('shows the pager on a Variable a pin reaches, which it would not have alone', async () => {
    render(<Field text={`Hair of ${world('hair', 'h1')}.`} />);
    await openTab('Values');
    const [open] = openValues();
    expect(within(open).getByText('Value 1 of 2')).toBeInTheDocument();
    await step(open, 'Next');
    expect(valueText(openValues()[0])).toBe('ash grey');
  });
});
