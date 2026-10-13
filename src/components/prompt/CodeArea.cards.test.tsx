import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { CodeArea } from './CodeArea';
import type { CodeSurface } from '@/lib/codeSurface';
import { STAT_CODE_SURFACE } from '@/lib/statCodeSurface';
import { toolScriptSurface } from '@/lib/tools/toolScriptSurface';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StatCodeTemplateDialog } from '@/components/modals/StatCodeTemplateDialog';
import type { Stat } from '@/types';

function Harness({ initial, surface = STAT_CODE_SURFACE }: { initial: string; surface?: CodeSurface }) {
  const [value, setValue] = useState(initial);
  return <CodeArea value={value} onChange={setValue} ariaLabel="Stat code" surface={surface} />;
}

/** The live editor under `label`, once its chunk has replaced the plain stand-in. */
const editor = (label: string) => waitFor(() => {
  const field = screen.getAllByLabelText(label).find((element) => element.closest('.cm-editor'));
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

/** Rests the pointer on the first `text` in the field, as a reader does before a card opens. */
function hover(field: HTMLElement, text: string) {
  const at = field.textContent!.indexOf(text);
  expect(at, `"${text}" is in the code`).toBeGreaterThanOrEqual(0);
  fireEvent.mouseMove(field.querySelector('.cm-line')!, { clientX: at + 1.5, clientY: 5 });
}

const card = () => document.querySelector<HTMLElement>('[data-code-card]');
const openCard = () => waitFor(() => { expect(card()).toBeTruthy(); return card()!; });

describe('hover cards in the code editor', () => {
  it('shows the signature, the access badge and the description of a stat field', async () => {
    render(<Harness initial="self.regen = 0;" />);
    hover(await editor('Stat code'), 'regen');
    const shown = await openCard();
    expect(shown.textContent).toContain('(property) Stat.regen: number');
    expect(shown.textContent).toContain('Writable');
    expect(shown.textContent).toContain('Regen per story hour, with traits applied');
  });

  it.each([
    ['self.previous.value', 'previous', 'Read-Only'],
    ['traits.Brave.enabled = true;', 'enabled', 'Writable After This Run'],
  ])('badges %s', async (code, name, badge) => {
    render(<Harness initial={code} />);
    hover(await editor('Stat code'), name);
    expect((await openCard()).textContent).toContain(badge);
  });

  it('shows a Tool script’s names', async () => {
    const surface = toolScriptSurface([{ name: 'size', type: 'number', description: 'How big.', required: true, options: [] }]);
    render(<Harness initial="return args.size;" surface={surface} />);
    hover(await editor('Stat code'), 'size');
    const shown = await openCard();
    expect(shown.textContent).toContain('(property) args.size: number');
    expect(shown.textContent).toContain('Read-Only');
  });

  it('closes on Escape without leaving full screen; a second Escape leaves', async () => {
    const user = userEvent.setup();
    render(<Harness initial="return self.value;" />);
    await editor('Stat code');
    await user.click(screen.getByLabelText('Edit full screen'));
    const overlay = screen.getByRole('dialog');
    const field = await waitFor(() => {
      const inOverlay = screen.getAllByLabelText('Stat code').find((element) => element.closest('.cm-editor') && overlay.contains(element));
      expect(inOverlay).toBeTruthy();
      return inOverlay!;
    });

    hover(field, 'value');
    await openCard();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(card()).toBeNull());
    expect(screen.getByRole('dialog')).toBe(overlay);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('hover cards in the template dialog', () => {
  const stats = [{ id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10 }] as unknown as Stat[];

  async function openTemplate(user: ReturnType<typeof userEvent.setup>, onOpenChange = vi.fn()) {
    render(
      <TooltipProvider>
        <StatCodeTemplateDialog
          open onOpenChange={onOpenChange} timing="after" stats={stats} currentStatId="s1" hasExistingCode={false}
          onInsert={vi.fn()} placeholderPlaces={[]} traitPlaces={[]} entities={[]}
        />
      </TooltipProvider>,
    );
    await user.click(await screen.findByRole('button', { name: /New Template/i }));
    const field = await editor('Template code');
    await user.click(field);
    await user.keyboard('{Control>}a{/Control}{Backspace}');
    // One key at a time, each confirmed: under load CodeMirror can drop a key sent mid-update.
    const code = 'return self.max;';
    for (let i = 0; i < code.length; i++) {
      await user.keyboard(code[i]);
      await waitFor(() => expect(field.textContent).toBe(code.slice(0, i + 1)));
    }
    return field;
  }

  it('hangs the card outside the dialog, on a host that takes the pointer', async () => {
    const user = userEvent.setup();
    hover(await openTemplate(user), 'max');
    const shown = await openCard();
    expect(shown.textContent).toContain('(property) Stat.max: number');
    // The dialog's box would clip it, and its body lock would swallow every pointer event.
    expect(screen.getByRole('dialog').contains(shown)).toBe(false);
    expect(shown.closest<HTMLElement>('[style*="pointer-events"]')?.style.pointerEvents).toBe('auto');
  });

  it('closes the card on Escape and keeps the dialog open; a second Escape closes the dialog', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    hover(await openTemplate(user, onOpenChange), 'max');
    await openCard();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(card()).toBeNull());
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
