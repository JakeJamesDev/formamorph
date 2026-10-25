import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TravelHintPair, type TravelHintFocus } from './TravelHintPair';
import { CHIP_PALETTE_ATTR, ChipInsertTargetProvider, useChipInsertTarget } from '@/components/prompt/ChipInsertTarget';
import { CHIP_DRAG_MIME } from '@/components/prompt/chipDragSource';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Connection, Placeholder } from '@/types';

/**
 * The Travel Hint boxes as real chip fields: every way a chip gets in, and the canvas focus request. The
 * link-state cases run in LocationConnections.test over a plain-input stand-in.
 */

const PLACEHOLDERS: Placeholder[] = [{ id: 'door', name: 'Door Color', values: phValues(['red', 'blue']) }];
const PALETTE_DOOR = encodePlaceholderToken({ id: 'door', mode: 'world', placementId: 'palette' });

/** A palette strip with one chip, sending as the editor's shared palette does. */
const Palette = () => {
  const { insert } = useChipInsertTarget();
  return (
    <div {...{ [CHIP_PALETTE_ATTR]: '' }}>
      <button type="button" onClick={() => insert?.(PALETTE_DOOR)}>Door Color</button>
    </div>
  );
};

let latest: Connection;
function Harness({ initial, focus = null }: { initial: Connection; focus?: TravelHintFocus | null }) {
  const [connection, setConnection] = useState(initial);
  latest = connection;
  return (
    <ChipInsertTargetProvider>
      <TravelHintPair
        connection={connection}
        legs={[
          { key: 'aToB', label: 'To Garden', name: 'Travel Hint to Garden' },
          { key: 'bToA', label: 'From Garden', name: 'Travel Hint from Garden' },
        ]}
        idPrefix="hints"
        placeholders={PLACEHOLDERS}
        onChange={setConnection}
        focus={focus}
      />
      <Palette />
    </ChipInsertTargetProvider>
  );
}

const unlinked: Connection = { id: 'c1', a: 'quay', b: 'garden', aToB: { hint: 'up' }, bToA: { hint: 'down' } };
const box = (name: string) => screen.getByRole('textbox', { name });
const chipIn = (text: string | undefined) => decodePlaceholderToken(text?.match(/\{\{ph:[^{}]*\}\}/)?.[0] ?? '');

afterEach(() => { Reflect.deleteProperty(document, 'caretRangeFromPoint'); });

describe('TravelHintPair chips', () => {
  it('inserts a chip from the { typeahead', async () => {
    render(<Harness initial={unlinked} />);
    const user = userEvent.setup();
    await user.click(box('Travel Hint to Garden'));
    await user.keyboard('{{Door');
    await screen.findByTestId('chip-typeahead');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(chipIn(latest.aToB?.hint)?.id).toBe('door'));
    expect(latest.bToA?.hint).toBe('down');
  });

  it('inserts a palette chip into the box that has focus', async () => {
    render(<Harness initial={unlinked} />);
    await userEvent.click(box('Travel Hint from Garden'));
    await userEvent.click(screen.getByRole('button', { name: 'Door Color' }));
    await waitFor(() => expect(chipIn(latest.bToA?.hint)?.id).toBe('door'));
    expect(latest.aToB?.hint).toBe('up');
  });

  it('takes a chip dragged from the palette', async () => {
    render(<Harness initial={unlinked} />);
    const editor = box('Travel Hint to Garden');
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode() as Text;
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => {
        const range = document.createRange();
        range.setStart(text, text.length);
        range.collapse(true);
        return range;
      },
    });
    const data = new Map([[CHIP_DRAG_MIME, PALETTE_DOOR]]);
    const dataTransfer = {
      types: [...data.keys()], effectAllowed: 'copy', dropEffect: 'none',
      getData: (type: string) => data.get(type) ?? '', setData: vi.fn(), setDragImage: vi.fn(),
    };
    await act(async () => {
      fireEvent.dragOver(editor, { clientX: 1, clientY: 1, dataTransfer });
      fireEvent.drop(editor, { clientX: 1, clientY: 1, dataTransfer });
    });
    await waitFor(() => expect(latest.aToB?.hint).toMatch(/^up\{\{ph:door:world:/));
  });

  it('focuses the leg a canvas arrow asks for', async () => {
    const { rerender } = render(<Harness initial={unlinked} />);
    rerender(<Harness initial={unlinked} focus={{ leg: 'bToA', nonce: 1 }} />);
    await waitFor(() => expect(box('Travel Hint from Garden')).toHaveFocus());
  });

  it('focuses a box when its label is clicked', async () => {
    render(<Harness initial={unlinked} />);
    await userEvent.click(screen.getByText('From Garden'));
    await waitFor(() => expect(box('Travel Hint from Garden')).toHaveFocus());
  });

  it('copies the first box chips into the read-only second box while linked', async () => {
    const hint = `past the ${encodePlaceholderToken({ id: 'door', mode: 'unique', placementId: 'p1' })} door`;
    render(<Harness initial={{ ...unlinked, aToB: { hint }, bToA: { hint } }} />);
    const second = box('Travel Hint from Garden');
    expect(second).toHaveAttribute('contenteditable', 'false');
    expect(second).toHaveAccessibleDescription('Copies the first Travel Hint');
    expect(second.querySelector('[data-chip-token]')).toHaveAttribute('data-chip-token', expect.stringContaining('p1'));
  });
});
