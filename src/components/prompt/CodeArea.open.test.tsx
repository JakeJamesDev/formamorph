import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { CodeArea } from './CodeArea';
import type { CodeCardItem } from '@/lib/codeCards';
import { STAT_CODE_SURFACE } from '@/lib/statCodeSurface';
import { statBoxLookup } from '@/lib/codeWorldLookup';
import { statCodeOwners } from '@/lib/statCodeTargets';
import type { Stat } from '@/types';

/** A card's Open: shown where the host gives one and the card names a world item, and it leaves full screen. */

const fatigue = { id: 'f', name: 'Fatigue', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] } as Stat;
const lookup = statBoxLookup(statCodeOwners({ stats: [fatigue], placeholders: [] }), { owner: null, timing: 'after', self: fatigue });

function Harness({ initial, onOpenItem }: { initial: string; onOpenItem?: (item: CodeCardItem) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <CodeArea
      value={value} onChange={setValue} ariaLabel="Stat code" surface={STAT_CODE_SURFACE} statNames={['Fatigue']}
      lookup={lookup} navigation={onOpenItem && { open: onOpenItem, goToUse: vi.fn() }}
    />
  );
}

const editorIn = (root: HTMLElement | Document = document) => waitFor(() => {
  const field = within(root as HTMLElement).getAllByLabelText('Stat code').find((element) => element.closest('.cm-editor'));
  expect(field).toBeTruthy();
  return field!;
});

// jsdom lays nothing out. These stand in for layout only: a pointer's x reads as the document offset under it.
beforeEach(() => {
  vi.spyOn(EditorView.prototype, 'posAtCoords').mockImplementation(
    ((coords: { x: number }) => Math.floor(coords.x)) as EditorView['posAtCoords'],
  );
  vi.spyOn(EditorView.prototype, 'coordsAtPos').mockImplementation((pos: number) => ({ left: pos, right: pos + 1, top: 0, bottom: 10 }));
});
afterEach(() => vi.restoreAllMocks());

function hover(field: HTMLElement, text: string) {
  const at = field.textContent!.indexOf(text);
  expect(at).toBeGreaterThanOrEqual(0);
  fireEvent.mouseMove(field.querySelector('.cm-line')!, { clientX: at + 1.5, clientY: 5 });
}

const card = () => document.querySelector<HTMLElement>('[data-code-card]');
const openCard = () => waitFor(() => { expect(card()).toBeTruthy(); return card()!; });

describe('Open on a code card', () => {
  it('opens the stat the card names and closes the card', async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    render(<Harness initial="return stats.Fatigue.value;" onOpenItem={onOpenItem} />);
    hover(await editorIn(), 'Fatigue');
    await user.click(within(await openCard()).getByRole('button', { name: 'Open' }));
    expect(onOpenItem).toHaveBeenCalledWith({ kind: 'stat', statId: 'f' });
    await waitFor(() => expect(card()).toBeNull());
  });

  it('shows no Open where the host gives none', async () => {
    render(<Harness initial="return stats.Fatigue.value;" />);
    hover(await editorIn(), 'Fatigue');
    expect(within(await openCard()).queryByRole('button', { name: 'Open' })).toBeNull();
  });

  it('shows no Open on a card that names no world item', async () => {
    render(<Harness initial="self.regen = 0;" onOpenItem={vi.fn()} />);
    hover(await editorIn(), 'regen');
    expect(within(await openCard()).queryByRole('button', { name: 'Open' })).toBeNull();
  });

  it('opens from the keyboard card too', async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    render(<Harness initial="return stats.Fatigue.value;" onOpenItem={onOpenItem} />);
    const field = await editorIn();
    await user.click(field);
    const view = EditorView.findFromDOM(field.closest('.cm-editor') as HTMLElement)!;
    view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('Fatigue') + 2 } });
    await user.keyboard('{Control>}ki{/Control}');
    await user.click(within(await openCard()).getByRole('button', { name: 'Open' }));
    expect(onOpenItem).toHaveBeenCalledWith({ kind: 'stat', statId: 'f' });
  });

  it('leaves full screen before it opens the item', async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    render(<Harness initial="return stats.Fatigue.value;" onOpenItem={onOpenItem} />);
    await editorIn();
    await user.click(screen.getByLabelText('Edit full screen'));
    const overlay = screen.getByRole('dialog');
    hover(await editorIn(overlay), 'Fatigue');
    // The card's host sits outside the overlay, which hides everything else from the accessibility tree.
    await user.click(within(await openCard()).getByRole('button', { name: 'Open', hidden: true }));

    expect(onOpenItem).toHaveBeenCalledWith({ kind: 'stat', statId: 'f' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
