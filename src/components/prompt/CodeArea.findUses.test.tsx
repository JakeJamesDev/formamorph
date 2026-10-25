import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { CodeArea } from './CodeArea';
import type { CodeCardNavigation } from '@/lib/codeCardNavigation';
import { STAT_CODE_SURFACE } from '@/lib/statCodeSurface';
import { TOOLTIP_DELAY_MS } from '@/components/ui/tooltip';
import { statBoxLookup } from '@/lib/codeWorldLookup';
import { statCodeOwners } from '@/lib/statCodeTargets';
import type { Entity, Stat } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';

/** Find All Uses on a card: it pins the card, lists each box and line, and a row goes there. */

const stat = (id: string, name: string, extra: Partial<Stat> = {}) =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...extra } as Stat);
const fatigue = stat('f', 'Fatigue', { scripts: boxScripts({ after: 'self.value -= 1;' }) });
const alert = stat('a', 'Alert', { scripts: boxScripts({ before: 'const x = 1;\nreturn stats.Fatigue.value;' }) });
const mara: Entity = { id: 'mara', name: 'Mara', stats: [stat('mf', 'Fatigue', { scripts: boxScripts({ after: 'return owner.stats.Fatigue.value;' }) })] };
const owners = statCodeOwners({ stats: [fatigue, alert], entities: [mara], placeholders: [] });
const lookup = statBoxLookup(owners, { owner: null, timing: 'after', self: alert });
const worldLookup = statBoxLookup(owners, { owner: null, timing: 'after', self: alert }, {
  traits: [], traitGroups: [], entities: [mara], stats: [fatigue, alert], placeholders: [],
});

function Harness({ initial, navigation, revealLine, withWorld }: {
  initial: string; navigation?: CodeCardNavigation; revealLine?: number; withWorld?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CodeArea
        value={value} onChange={setValue} ariaLabel="Stat code" surface={STAT_CODE_SURFACE} statNames={['Fatigue', 'Alert']}
        lookup={withWorld ? worldLookup : lookup} navigation={navigation} revealLine={revealLine}
      />
      <button type="button">Elsewhere</button>
    </>
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
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function hover(field: HTMLElement, text: string) {
  const at = field.textContent!.indexOf(text);
  expect(at).toBeGreaterThanOrEqual(0);
  fireEvent.mouseMove(field.querySelector('.cm-line')!, { clientX: at + 1.5, clientY: 5 });
}

const card = () => document.querySelector<HTMLElement>('[data-code-card]');
const openCard = () => waitFor(() => { expect(card()).toBeTruthy(); return card()!; });
const usesList = () => document.querySelector<HTMLElement>('[data-code-uses]');
const openUses = () => waitFor(() => { expect(usesList()).toBeTruthy(); return usesList()!; });
const navigation = (): CodeCardNavigation => ({ open: vi.fn(), goToUse: vi.fn() });

/** Hovers the world's Fatigue and clicks Find All Uses. */
async function findFatigueUses(nav: CodeCardNavigation) {
  const user = userEvent.setup();
  render(<Harness initial="return stats.Fatigue.value;" navigation={nav} />);
  hover(await editorIn(), 'Fatigue');
  await user.click(within(await openCard()).getByRole('button', { name: 'Find All Uses' }));
  return { user, uses: await openUses() };
}

describe('Find All Uses on a code card', () => {
  it('pins the card and lists every use of that stat, not of its namesake', async () => {
    const { uses } = await findFatigueUses(navigation());
    expect(card()!.contains(uses)).toBe(true);
    expect(within(card()!).getByText('stats.Fatigue', { exact: false })).toBeTruthy();
    expect(within(uses).getByRole('heading').textContent).toBe('2 Uses');
    expect(within(uses).getAllByRole('button').map((row) => row.textContent)).toEqual([
      'Fatigue · After · Line 1',
      'Alert · Before · Line 2',
    ]);
  });

  it('keeps the pinned card open while the pointer crosses other names', async () => {
    await findFatigueUses(navigation());
    const field = await editorIn();
    vi.useFakeTimers();
    hover(field, 'stats');
    // At the hover delay, when a card on `stats` would have replaced it.
    await act(() => vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS));
    expect(usesList()).toBeTruthy();
    expect(within(card()!).queryByText('(global)')).toBeNull();
  });

  it('goes to a row’s box and line, and closes the card', async () => {
    const nav = navigation();
    const { user, uses } = await findFatigueUses(nav);
    await user.click(within(uses).getByRole('button', { name: 'Alert · Before · Line 2' }));
    expect(nav.goToUse).toHaveBeenCalledWith({ entityId: null, rowId: 'a', timing: 'before', scriptId: 'before', name: 'Alert', line: 2, noOwners: false });
    await waitFor(() => expect(card()).toBeNull());
  });

  it('closes both on Escape', async () => {
    const { user } = await findFatigueUses(navigation());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(card()).toBeNull());
  });

  it('closes both on a click outside', async () => {
    const { user } = await findFatigueUses(navigation());
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    await waitFor(() => expect(card()).toBeNull());
  });

  it('is missing where the host gives no navigation', async () => {
    render(<Harness initial="return stats.Fatigue.value;" />);
    hover(await editorIn(), 'Fatigue');
    expect(within(await openCard()).queryByRole('button', { name: 'Find All Uses' })).toBeNull();
  });

  it('lists an entity’s uses, its owned boxes’ `owner` among them', async () => {
    const user = userEvent.setup();
    render(<Harness initial="return entities.Mara.stats.Fatigue.value;" navigation={navigation()} withWorld />);
    hover(await editorIn(), 'Mara');
    await user.click(within(await openCard()).getByRole('button', { name: 'Find All Uses' }));
    const uses = await openUses();
    expect(within(uses).getAllByRole('button').map((row) => row.textContent)).toEqual(['Mara › Fatigue · After · Line 1']);
  });

  it('is missing on a card that names no world item', async () => {
    render(<Harness initial="self.regen = 0;" navigation={navigation()} />);
    hover(await editorIn(), 'regen');
    expect(within(await openCard()).queryByRole('button', { name: 'Find All Uses' })).toBeNull();
  });
});

describe('a box asked to reveal a line', () => {
  it('puts the caret at the start of that line’s code', async () => {
    render(<Harness initial={'const a = 1;\n  return stats.Fatigue.value;'} revealLine={2} />);
    const view = EditorView.findFromDOM((await editorIn()).closest('.cm-editor') as HTMLElement)!;
    await waitFor(() => expect(view.state.selection.main.head).toBe('const a = 1;\n  '.length));
    expect(view.hasFocus).toBe(true);
  });
});
