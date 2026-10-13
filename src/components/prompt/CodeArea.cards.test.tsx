import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { CodeArea } from './CodeArea';
import { completionCard } from '@/lib/codeCards';
import type { CodeSurface } from '@/lib/codeSurface';
import { STAT_CODE_SURFACE } from '@/lib/statCodeSurface';
import { toolScriptSurface } from '@/lib/tools/toolScriptSurface';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StatCodeTemplateDialog } from '@/components/modals/StatCodeTemplateDialog';
import type { Stat } from '@/types';

// A pass-through, so a test can count the cards the completion list builds.
vi.mock('@/lib/codeCards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/codeCards')>();
  return { ...actual, completionCard: vi.fn(actual.completionCard) };
});

function Harness({ initial, surface = STAT_CODE_SURFACE, statNames }: { initial: string; surface?: CodeSurface; statNames?: readonly string[] }) {
  const [value, setValue] = useState(initial);
  return <CodeArea value={value} onChange={setValue} ariaLabel="Stat code" surface={surface} statNames={statNames} />;
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

describe('the card in the completion list', () => {
  const popup = () => document.querySelector<HTMLElement>('.cm-tooltip-autocomplete');
  /** The pane beside the list, which holds the card for the selected option. */
  const pane = () => document.querySelector<HTMLElement>('.cm-completionInfo');
  const built = vi.mocked(completionCard);

  /** Types into the empty field one key at a time, each confirmed, then waits for the list. */
  async function typeAndList(user: ReturnType<typeof userEvent.setup>, code: string, statNames?: readonly string[]) {
    render(<Harness initial="" statNames={statNames} />);
    const field = await editor('Stat code');
    await user.click(field);
    for (let i = 0; i < code.length; i++) {
      await user.keyboard(code[i]);
      await waitFor(() => expect(field.textContent).toBe(code.slice(0, i + 1)));
    }
    await waitFor(() => expect(popup()).toBeTruthy());
  }

  beforeEach(() => { built.mockClear(); });

  it('shows the full card for the selected option in the info pane', async () => {
    const user = userEvent.setup();
    await typeAndList(user, 'return self.reg');
    await waitFor(() => expect(pane()).toBeTruthy());
    const shown = pane()!.querySelector<HTMLElement>('[data-code-card]');
    expect(shown?.textContent).toContain('(property) Stat.regen: number');
    expect(shown?.textContent).toContain('Writable');
    expect(shown?.textContent).toContain('Regen per story hour, with traits applied');
  });

  it('shows a world name’s card, with the same signature the hover card gives', async () => {
    const user = userEvent.setup();
    await typeAndList(user, 'return stats.Hea', ['Health', 'Heat']);
    await waitFor(() => expect(pane()?.querySelector('[data-code-card]')).toBeTruthy());
    expect(pane()!.textContent).toContain('(stat) stats.Health: Stat');
  });

  it('builds a card for the shown option only, and one more for each option the author moves to', async () => {
    const user = userEvent.setup();
    const names = ['Health', 'Heat', 'Heart', 'Hearth', 'Hero'];
    await typeAndList(user, 'return stats.He', names);
    await waitFor(() => expect(pane()?.querySelector('[data-code-card]')).toBeTruthy());
    await waitFor(() => expect(within(popup()!).getAllByRole('option')).toHaveLength(names.length));
    // Every list the keystrokes raised built the card of its selected option, the first, and no other.
    const labels = () => built.mock.calls.map(([, , label]) => label);
    expect(new Set(labels())).toEqual(new Set(['Health']));

    // A key aimed at a list that has only just opened is ignored for a beat.
    await new Promise((resolve) => { setTimeout(resolve, 150); });
    built.mockClear();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(built).toHaveBeenCalledTimes(1));
    expect(labels()[0]).not.toBe('Health');
  });

  it('keeps a plain info line for an option that has no card', async () => {
    const user = userEvent.setup();
    await typeAndList(user, 'const mine = 1; return mi');
    await waitFor(() => expect(pane()).toBeTruthy());
    expect(pane()!.textContent).toContain('Declared in this code');
    expect(pane()!.querySelector('[data-code-card]')).toBeNull();
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
