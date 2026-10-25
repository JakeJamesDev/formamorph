import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { CodeArea } from './CodeArea';
import { completionCard } from '@/lib/codeCards';
import type { CodeSurface } from '@/lib/codeSurface';
import { STAT_CODE_SURFACE } from '@/lib/statCodeSurface';
import { toolScriptSurface } from '@/lib/tools/toolScriptSurface';
import { TOOLTIP_DELAY_MS, TooltipProvider } from '@/components/ui/tooltip';
import { CARET_PAUSE_MS } from './codeCaretCard';
import { StatCodeTemplateDialog } from '@/components/modals/StatCodeTemplateDialog';
import { statBoxLookup, type CodeWorldLookup } from '@/lib/codeWorldLookup';
import { statCodeOwners } from '@/lib/statCodeTargets';
import type { Stat } from '@/types';

// A pass-through, so a test can count the cards the completion list builds.
vi.mock('@/lib/codeCards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/codeCards')>();
  return { ...actual, completionCard: vi.fn(actual.completionCard) };
});

function Harness({ initial, surface = STAT_CODE_SURFACE, statNames, lookup }: {
  initial: string; surface?: CodeSurface; statNames?: readonly string[]; lookup?: CodeWorldLookup;
}) {
  const [value, setValue] = useState(initial);
  return <CodeArea value={value} onChange={setValue} ariaLabel="Stat code" surface={surface} statNames={statNames} lookup={lookup} />;
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
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Rests the pointer on the first `text` in the field, as a reader does before a card opens. */
function hover(field: HTMLElement, text: string) {
  const at = field.textContent!.indexOf(text);
  expect(at, `"${text}" is in the code`).toBeGreaterThanOrEqual(0);
  fireEvent.mouseMove(field.querySelector('.cm-line')!, { clientX: at + 1.5, clientY: 5 });
}

const card = () => document.querySelector<HTMLElement>('[data-code-card]');
const openCard = () => waitFor(() => { expect(card()).toBeTruthy(); return card()!; });
/** Runs the fake clock past the hover delay and the caret pause, so a card that was going to open has. */
const pastCardDelays = () => act(() => vi.advanceTimersByTimeAsync(Math.max(TOOLTIP_DELAY_MS, CARET_PAUSE_MS)));

/** Types on a fake clock. Testing Library releases its zero-delay drain only for a `jest` global, so one stands in. */
async function typeOnFakeClock(text: string) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const scope = globalThis as { jest?: unknown };
  scope.jest = { advanceTimersByTime: vi.advanceTimersByTime };
  try {
    await user.keyboard(text);
  } finally {
    delete scope.jest;
  }
}

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

  it('shows a stat’s World Details from the box’s lookup', async () => {
    const fatigue = { id: 'f', name: 'Fatigue', type: 'number', description: 'How worn out you are.', min: 0, max: 100, regen: 1, descriptors: [] } as Stat;
    const lookup = statBoxLookup(statCodeOwners({ stats: [fatigue], placeholders: [] }), { owner: null, timing: 'after', self: fatigue });
    render(<Harness initial="return stats.Fatigue.value;" lookup={lookup} />);
    hover(await editor('Stat code'), 'Fatigue');
    const card = await openCard();
    expect(card.textContent).toContain('(global stat) stats.Fatigue: Stat');
    expect(card.querySelector('dl[aria-label="World Details"]')?.textContent).toBe('TypeNumberRange0 – 100Regen+1 per story hour');
  });

  describe('a name the code declares', () => {
    const code = 'const tired = 1;\nreturn tired;';

    it('shows its kind, with Go to Line moving the caret to the declaration', async () => {
      const user = userEvent.setup();
      render(<Harness initial={code} />);
      const field = await editor('Stat code');
      // `hover` finds the first match, which is the declaration; the card for the use is what the test reads.
      const at = field.textContent!.lastIndexOf('tired');
      fireEvent.mouseMove(field.querySelectorAll('.cm-line')[1], { clientX: at + 1.5, clientY: 5 });
      const shown = await openCard();
      expect(shown.textContent).toContain('(const) tired');
      expect(shown.textContent).not.toContain('tired:');

      await user.click(within(shown).getByRole('button', { name: 'Go to Line 1' }));
      const view = EditorView.findFromDOM(field.closest<HTMLElement>('.cm-editor')!)!;
      expect(view.state.selection.main.head).toBe(code.indexOf('tired'));
      await waitFor(() => expect(card()).toBeNull());
    });

    it('offers no Go to Line on the declaration itself', async () => {
      render(<Harness initial={code} />);
      hover(await editor('Stat code'), 'tired');
      const shown = await openCard();
      expect(shown.textContent).toContain('(const) tired');
      expect(within(shown).queryByRole('button')).toBeNull();
    });
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
    // A list opened mid-typing shows its earlier pick until the update for the last key lands.
    await waitFor(() => expect(popup()?.querySelector('[aria-selected] .cm-completionLabel')?.textContent).toBe('regen'));
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

  it('shows the declared card for a name the code declares, with no Go to Line', async () => {
    const user = userEvent.setup();
    await typeAndList(user, 'const mine = 1; return mi');
    await waitFor(() => expect(pane()?.querySelector('[data-code-card]')).toBeTruthy());
    expect(pane()!.textContent).toContain('(const) mine');
    expect(pane()!.textContent).toContain('Declared on line 1');
    // The pane can't move the caret, so it offers no link.
    expect(within(pane()!).queryByRole('button')).toBeNull();
  });

  it('keeps a plain info line for an option that has no card', async () => {
    const user = userEvent.setup();
    // A stat name offered inside a string that is no map key has no card.
    await typeAndList(user, 'return x === "He', ['Health']);
    await waitFor(() => expect(pane()).toBeTruthy());
    expect(pane()!.querySelector('[data-code-card]')).toBeNull();
    expect(pane()!.textContent).toBeTruthy();
  });
});

const viewOf = (field: HTMLElement) => EditorView.findFromDOM(field.closest<HTMLElement>('.cm-editor')!)!;
const liveRegion = (field: HTMLElement) => field.closest('.cm-editor')!.querySelector('[role="status"]')!;

/** Puts the caret inside the first `text` and focuses the editor, as a reader does before asking for a card. */
function caretIn(field: HTMLElement, text: string) {
  const view = viewOf(field);
  const at = view.state.doc.toString().indexOf(text);
  expect(at, `"${text}" is in the code`).toBeGreaterThanOrEqual(0);
  view.focus();
  view.dispatch({ selection: { anchor: at + 1 } });
  return view;
}

// Control stays down through both strokes: user-event sends no keyCode for the modifier, which is how
// CodeMirror tells a modifier press from a key that cancels a pending chord.
const chord = '{Control>}ki{/Control}';

describe('cards from the keyboard', () => {
  it('opens the card for the name at the caret with Ctrl+K Ctrl+I and reads it out', async () => {
    const user = userEvent.setup();
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    expect(card()).toBeNull();
    caretIn(field, 'regen');
    await user.keyboard(chord);
    const shown = await openCard();
    expect(shown.textContent).toContain('(property) Stat.regen: number');
    await waitFor(() => expect(liveRegion(field).textContent).toContain('Stat.regen: number'));
    const heard = liveRegion(field).textContent!;
    expect(heard).toContain('Writable');
    expect(heard).toContain('Regen per story hour, with traits applied');
  });

  it('offers Go to Line on a declared name’s card, and the link moves the caret', async () => {
    const user = userEvent.setup();
    const code = 'const tired = 1;\nreturn tired;';
    render(<Harness initial={code} />);
    const field = await editor('Stat code');
    const view = viewOf(field);
    view.focus();
    view.dispatch({ selection: { anchor: code.lastIndexOf('tired') + 1 } });
    await user.keyboard(chord);
    const shown = await openCard();
    await user.click(within(shown).getByRole('button', { name: 'Go to Line 1' }));
    expect(view.state.selection.main.head).toBe(code.indexOf('tired'));
    await waitFor(() => expect(card()).toBeNull());
  });

  it('announces a second press on the same name again', async () => {
    const user = userEvent.setup();
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    caretIn(field, 'regen');
    await user.keyboard(chord);
    await waitFor(() => expect(liveRegion(field).textContent).toContain('Stat.regen'));
    // Text set to what the region already holds is skipped by a screen reader, so the region must empty first.
    const texts: string[] = [];
    const watch = new MutationObserver(() => texts.push(liveRegion(field).textContent!));
    watch.observe(liveRegion(field), { childList: true, characterData: true, subtree: true });
    try {
      await user.keyboard(chord);
      await waitFor(() => expect(texts.at(-1)).toContain('Stat.regen'));
      expect(texts).toContain('');
    } finally {
      watch.disconnect();
    }
  });

  it('opens the card for a selected name from where the selection starts', async () => {
    const user = userEvent.setup();
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    const view = viewOf(field);
    view.focus();
    view.dispatch({ selection: { anchor: 10, head: 5 } });
    await user.keyboard(chord);
    expect((await openCard()).textContent).toContain('Stat.regen');
  });

  it('closes the card when the editor loses focus, so a later Escape is not swallowed', async () => {
    const user = userEvent.setup();
    render(<><Harness initial="self.regen = 0;" /><button type="button">Elsewhere</button></>);
    const field = await editor('Stat code');
    caretIn(field, 'regen');
    await user.keyboard(chord);
    await openCard();
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    await waitFor(() => expect(card()).toBeNull());
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    window.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
  });

  it('leaves Ctrl+I alone to select the enclosing syntax', async () => {
    const user = userEvent.setup();
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    const view = caretIn(field, 'regen');
    await user.keyboard('{Control>}i{/Control}');
    expect(view.state.selection.main.empty).toBe(false);
    expect(card()).toBeNull();
    expect(liveRegion(field).textContent).toBe('');
  });

  it('closes the card, and the announcement, when the author types', async () => {
    const user = userEvent.setup();
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    caretIn(field, 'regen');
    await user.keyboard(chord);
    await openCard();
    await user.keyboard('x');
    await waitFor(() => expect(card()).toBeNull());
    expect(liveRegion(field).textContent).toBe('');
  });

  it('closes the card on an edit that leaves the caret where it is', async () => {
    const user = userEvent.setup();
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    const view = caretIn(field, 'regen');
    await user.keyboard(chord);
    await openCard();
    view.dispatch({ changes: { from: view.state.doc.length, insert: ' // note' } });
    await waitFor(() => expect(card()).toBeNull());
    expect(liveRegion(field).textContent).toBe('');
  });

  it('opens nothing where the caret names nothing', async () => {
    const user = userEvent.setup();
    render(<Harness initial="const gap = 1;  self.regen = 0;" />);
    const field = await editor('Stat code');
    caretIn(field, '  self');
    await user.keyboard(chord);
    expect(card()).toBeNull();
    expect(liveRegion(field).textContent).toBe('');
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

    caretIn(field, 'value');
    await user.keyboard(chord);
    await openCard();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(card()).toBeNull());
    expect(screen.getByRole('dialog')).toBe(overlay);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('cards from a tap', () => {
  /** A finger lands on the name and lifts: the caret follows the pointer. */
  function tap(field: HTMLElement, text: string) {
    fireEvent.pointerDown(field, { pointerType: 'touch' });
    fireEvent.pointerUp(field, { pointerType: 'touch' });
    return caretIn(field, text);
  }

  it('opens one card after the caret rests on the name, without reading it out', async () => {
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    tap(field, 'regen');
    expect(card()).toBeNull();
    expect((await openCard()).textContent).toContain('(property) Stat.regen: number');
    expect(liveRegion(field).textContent).toBe('');
  });

  it('opens no second card from the hover a tap sends after it', async () => {
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    // Every card that ever reaches the page: a hover card replaced by the caret's would still end as one.
    const seen = new Set<Element>();
    const watch = new MutationObserver(() => document.querySelectorAll('[data-code-card]').forEach((node) => seen.add(node)));
    watch.observe(document.body, { childList: true, subtree: true });
    try {
      vi.useFakeTimers();
      tap(field, 'regen');
      hover(field, 'regen');
      await pastCardDelays();
      expect(document.querySelectorAll('[data-code-card]')).toHaveLength(1);
      expect(seen.size).toBe(1);
    } finally {
      watch.disconnect();
    }
  });

  it('lets a mouse hover open a card again after a touch', async () => {
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    tap(field, 'regen');
    fireEvent.pointerMove(field, { pointerType: 'mouse' });
    hover(field, 'regen');
    expect((await openCard()).textContent).toContain('Stat.regen');
  });

  it('closes the card when the author types', async () => {
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    const view = tap(field, 'regen');
    await openCard();
    vi.useFakeTimers();
    await typeOnFakeClock('x');
    // The pause never re-opens it for text still being typed.
    await pastCardDelays();
    expect(card()).toBeNull();
    expect(view.state.doc.toString()).toContain('x');
  });

  it('opens the card again on a second tap where the caret already is', async () => {
    const user = userEvent.setup();
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    tap(field, 'regen');
    await openCard();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(card()).toBeNull());
    // The caret doesn't move, so no selection update follows this tap.
    fireEvent.pointerDown(field, { pointerType: 'touch' });
    fireEvent.pointerUp(field, { pointerType: 'touch' });
    expect((await openCard()).textContent).toContain('Stat.regen');
  });

  it('opens nothing for a drag that the browser took as a scroll', async () => {
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    vi.useFakeTimers();
    fireEvent.pointerDown(field, { pointerType: 'touch' });
    caretIn(field, 'regen');
    fireEvent.pointerCancel(field, { pointerType: 'touch' });
    await pastCardDelays();
    expect(card()).toBeNull();
  });

  it('opens nothing for a caret move that no tap made', async () => {
    render(<Harness initial="self.regen = 0;" />);
    const field = await editor('Stat code');
    vi.useFakeTimers();
    caretIn(field, 'regen');
    await pastCardDelays();
    expect(card()).toBeNull();
  });
});

describe('hover cards in the template dialog', () => {
  const stats = [{ id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10 }] as unknown as Stat[];

  async function openTemplate(user: ReturnType<typeof userEvent.setup>, onOpenChange = vi.fn(), code = 'return self.max;') {
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
    for (let i = 0; i < code.length; i++) {
      // `{{` is how user-event types one brace.
      await user.keyboard(code[i] === '{' ? '{{' : code[i]);
      await waitFor(() => expect(field.textContent).toBe(code.slice(0, i + 1)));
    }
    // A list opened mid-typing lingers until its update runs, and its pane holds a card of its own.
    await waitFor(() => expect(document.querySelector('.cm-tooltip-autocomplete')).toBeNull());
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

  it('shows no World Details, since a template has no world', async () => {
    const user = userEvent.setup();
    hover(await openTemplate(user), 'self');
    const shown = await openCard();
    expect(shown.textContent).toContain('(global) self: Stat');
    expect(shown.querySelector('dl')).toBeNull();
  });

  it('shows a slot’s type and default', async () => {
    const user = userEvent.setup();
    hover(await openTemplate(user, vi.fn(), 'return {{amount:number=5}};'), 'amount');
    const shown = await openCard();
    expect(shown.textContent).toContain('(slot) amount: number');
    expect(shown.textContent).toContain('Default');
    expect(within(shown).getByText('5')).toBeTruthy();
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
