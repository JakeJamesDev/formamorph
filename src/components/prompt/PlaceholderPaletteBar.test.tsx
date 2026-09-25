import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import PlaceholderPaletteBar from './PlaceholderPaletteBar';
import { ChipInsertTargetProvider, useChipInsertTarget } from './ChipInsertTarget';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { builtinForToken } from '@/lib/builtinPlaceholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });

// Molly holds Northern, Northern holds Hair; Town stands alone.
const world: Placeholder[] = [
  { id: 'molly', name: 'Molly', values: phValues([chip('northern'), 'Southern']) },
  { id: 'northern', name: 'Northern', values: phValues([chip('hair')]) },
  { id: 'hair', name: 'Hair', values: phValues(['brown']) },
  { id: 'town', name: 'Town', values: phValues(['Sedge']) },
];

/** Stands in for a value field of `ownerId` that holds the caret. */
const Claimer = ({ ownerId }: { ownerId?: string }) => {
  const { claim } = useChipInsertTarget();
  useEffect(() => {
    claim(Symbol('field'), { insert: () => {}, undo: () => {}, ownerId: ownerId ?? null }, null);
  }, [claim, ownerId]);
  return null;
};

const FocusClaimer = ({ insert, accepts }: { insert: (token: string) => void; accepts?: (token: string) => boolean }) => {
  const { claim } = useChipInsertTarget();
  const key = useMemo(() => Symbol('field'), []);
  const root = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    claim(key, { insert, undo: () => {}, ownerId: null, accepts }, root.current);
  }, [claim, insert, accepts, key]);
  return <button ref={root} type="button">Field</button>;
};

const names = () => screen.getAllByRole('button').map((b) => b.textContent).filter((t) => t && !t.startsWith('Placeholders'));

describe('PlaceholderPaletteBar cycle filter', () => {
  it('offers every top-level placeholder to a field outside any placeholder', () => {
    render(
      <ChipInsertTargetProvider>
        <Claimer />
        <PlaceholderPaletteBar placeholders={world} />
      </ChipInsertTargetProvider>,
    );
    expect(names()).toEqual(['Player Name', 'Molly', 'Northern', 'Hair', 'Town']);
  });

  it('leaves out the value’s own placeholder and everything that reaches it', () => {
    render(
      <ChipInsertTargetProvider>
        <Claimer ownerId="hair" />
        <PlaceholderPaletteBar placeholders={world} />
      </ChipInsertTargetProvider>,
    );
    expect(names()).toEqual(['Player Name', 'Town']);
  });

  it('keeps the strip when the filter empties it, so the panel does not reflow', () => {
    const lone: Placeholder[] = [{ id: 'town', name: 'Town', values: phValues(['Sedge']) }];
    render(
      <ChipInsertTargetProvider>
        <Claimer ownerId="town" />
        <PlaceholderPaletteBar placeholders={lone} />
      </ChipInsertTargetProvider>,
    );
    expect(screen.getByRole('button', { name: /Placeholders/ })).toBeInTheDocument();
    expect(names()).toEqual(['Player Name']);
  });
});

/**
 * The strip in sections: the loose shared chips first under no heading, then each folder in tree order
 * under its path, then each owner's under its name. A heading is drawn off the first chip under it, so a
 * section the cycle filter empties shows no heading at all.
 */
describe('PlaceholderPaletteBar sections', () => {
  const groups = [
    { id: 'body', name: 'Body', parentId: null }, { id: 'face', name: 'Face', parentId: 'body' }, { id: 'gear', name: 'Gear', parentId: null },
  ];
  const shared: Placeholder[] = [
    { id: 'skin', name: 'Skin', values: phValues(['pale']), groupId: 'face' },
    { id: 'town', name: 'Town', values: phValues(['Sedge']) },
    { id: 'sword', name: 'Sword', values: phValues(['iron']), groupId: 'gear' },
    { id: 'hair', name: 'Hair', values: phValues(['red']), groupId: 'body' },
  ];
  const eyes: Placeholder = { id: 'eyes', name: 'Eyes', values: phValues(['gray']) };
  const lists = {
    placeholders: shared, placeholderGroups: groups, dictionaries: [],
    entities: [{ id: 'molly', name: 'Molly', placeholders: [eyes] }],
  };
  const all = allPlaceholders(lists);
  const store = { ...placeholderStore(all, () => {}), lists, owners: placeholderOwners(lists) };
  /** Headings and chips in strip order, a heading in brackets. */
  const strip = () => [...document.querySelectorAll('[data-editor-find-skip] span.text-meta, [data-editor-find-skip] button')]
    .map((el) => (el.tagName === 'SPAN' ? `[${el.textContent}]` : el.textContent))
    .filter((t) => t && !t.startsWith('Placeholders'));

  it('heads each folder in tree order and each owner by name, loose chips first', () => {
    render(
      <PlaceholderStoreProvider value={store}>
        <ChipInsertTargetProvider>
          <Claimer />
          <PlaceholderPaletteBar placeholders={all} />
        </ChipInsertTargetProvider>
      </PlaceholderStoreProvider>,
    );
    expect(strip()).toEqual([
      '[Built-in]', 'Player Name', 'Town', '[Body]', 'Hair', '[Body › Face]', 'Skin', '[Gear]', 'Sword', '[Molly]', 'Eyes',
    ]);
  });

  it('hides a heading whose every chip the cycle filter removed', () => {
    render(
      <PlaceholderStoreProvider value={store}>
        <ChipInsertTargetProvider>
          <Claimer ownerId="skin" />
          <PlaceholderPaletteBar placeholders={all} />
        </ChipInsertTargetProvider>
      </PlaceholderStoreProvider>,
    );
    expect(strip()).toEqual(['[Built-in]', 'Player Name', 'Town', '[Body]', 'Hair', '[Gear]', 'Sword', '[Molly]', 'Eyes']);
  });
});

/**
 * The toggle spends no width on its own word while the bar is open — the chips are what the author came
 * for — and says what it hides only once it hides it. Its accessible name and tooltip carry the word.
 */
describe('PlaceholderPaletteBar toggle', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const bar = () => render(
    <ChipInsertTargetProvider>
      <Claimer />
      <PlaceholderPaletteBar placeholders={world} />
    </ChipInsertTargetProvider>,
  );

  it('names itself for a screen reader while showing no text open', () => {
    bar();
    expect(screen.getByRole('button', { name: 'Placeholders' }).textContent).toBe('');
  });

  it('reads Placeholders (N) once collapsed', async () => {
    bar();
    await userEvent.click(screen.getByRole('button', { name: 'Placeholders' }));
    expect(screen.getByRole('button', { name: 'Placeholders' })).toHaveTextContent('Placeholders (5)');
    expect(names()).toEqual([]);
  });
});

describe('PlaceholderPaletteBar click target', () => {
  it('inserts on click and leaves the field holding focus and the claim', async () => {
    // Like the real insert, which hands focus back to the field.
    const insert = vi.fn((_token: string) => screen.getByRole('button', { name: 'Field' }).focus());
    render(
      <ChipInsertTargetProvider>
        <FocusClaimer insert={insert} />
        <PlaceholderPaletteBar placeholders={world} />
      </ChipInsertTargetProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Field' }));

    await userEvent.click(screen.getByRole('button', { name: 'Town' }));

    expect(insert).toHaveBeenCalledTimes(1);
    expect(decodePlaceholderToken(insert.mock.calls[0][0])?.id).toBe('town');
    // Past the provider's deferred focus check, so a release would have landed by now.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole('button', { name: 'Field' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Town' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('inserts on a click whose release comes a moment after its press', async () => {
    const insert = vi.fn();
    const user = userEvent.setup();
    render(
      <ChipInsertTargetProvider>
        <FocusClaimer insert={insert} />
        <PlaceholderPaletteBar placeholders={world} />
      </ChipInsertTargetProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Field' }));
    const town = screen.getByRole('button', { name: 'Town' });

    // A hand's press and release are never in the same tick, so the field's focus departure settles between them.
    await user.pointer({ keys: '[MouseLeft>]', target: town });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await user.pointer({ keys: '[/MouseLeft]', target: town });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(decodePlaceholderToken(insert.mock.calls[0][0])?.id).toBe('town');
  });
});

/** An owner heads its section as quiet text with its kind's icon — never as a chip, since a heading is not
 *  something to place. An owner named with a placeholder shows that placeholder as a pill, in a neutral
 *  tint rather than its own accent, for the same reason. */
describe('PlaceholderPaletteBar owner headings', () => {
  const eyes: Placeholder = { id: 'eyes', name: 'Eyes', values: phValues(['gray']) };
  const mount = (ownerName: string, kind: 'entities' | 'dictionaries' = 'entities') => {
    const lists = {
      placeholders: [{ id: 'town', name: 'Town', values: phValues(['Sedge']) }],
      placeholderGroups: [], dictionaries: [], entities: [],
      [kind]: [{ id: 'molly', name: ownerName, placeholders: [eyes] }],
    };
    const all = allPlaceholders(lists);
    const store = { ...placeholderStore(all, () => {}), lists, owners: placeholderOwners(lists) };
    render(
      <PlaceholderStoreProvider value={store}>
        <ChipInsertTargetProvider>
          <Claimer />
          <PlaceholderPaletteBar placeholders={all} />
        </ChipInsertTargetProvider>
      </PlaceholderStoreProvider>,
    );
  };

  it('carries the entity icon and the owner name, with the row beneath it bare', () => {
    mount('Molly');
    const icon = screen.getByRole('img', { name: 'Entity' });
    // The name is what a reader hears; the shape is what an author sees. Both, or a swapped icon passes.
    expect(icon).toHaveClass('lucide-user');
    expect(icon.parentElement).toHaveTextContent('Molly');
    expect(names()).toEqual(['Player Name', 'Town', 'Eyes']);
  });

  it('carries the dictionary icon for a book owner', () => {
    mount('Lore', 'dictionaries');
    const icon = screen.getByRole('img', { name: 'Dictionary' });
    expect(icon).toHaveClass('lucide-book-open');
    expect(icon.parentElement).toHaveTextContent('Lore');
  });

  it('wears no surface of its own, so nothing in it looks placeable', () => {
    mount('Molly');
    const heading = screen.getByRole('img', { name: 'Entity' }).parentElement!;
    // The same quiet text a folder heading is, telling the two apart by the icon alone.
    expect(heading).toHaveClass('text-meta', 'text-muted-foreground');
    expect([...heading.classList].filter((c) => c.startsWith('bg-') || c === 'border')).toEqual([]);
  });

  it('nests an owner’s own chip inside the heading rather than spelling it out', () => {
    mount(`Ma ${chip('town')}`);
    const heading = screen.getByRole('img', { name: 'Entity' }).parentElement!;
    const pill = heading.querySelector<HTMLElement>('[data-chip-token]')!;
    expect(pill).toHaveTextContent('Town');
    // Neutral, not the placeholder's accent: in a heading an accented pill reads as one to drop in a field.
    expect(pill.style.backgroundColor).toBe('');
    const placeable = screen.getByRole('button', { name: 'Town' });
    expect(placeable.style.backgroundColor).not.toBe('');
  });

  it('leaves a folder heading as quiet text', () => {
    const lists = {
      placeholders: [{ id: 'skin', name: 'Skin', values: phValues(['pale']), groupId: 'body' }],
      placeholderGroups: [{ id: 'body', name: 'Body', parentId: null }], dictionaries: [], entities: [],
    };
    const all = allPlaceholders(lists);
    const store = { ...placeholderStore(all, () => {}), lists, owners: placeholderOwners(lists) };
    render(
      <PlaceholderStoreProvider value={store}>
        <ChipInsertTargetProvider>
          <Claimer />
          <PlaceholderPaletteBar placeholders={all} />
        </ChipInsertTargetProvider>
      </PlaceholderStoreProvider>,
    );
    expect(screen.queryByRole('img', { name: 'Entity' })).not.toBeInTheDocument();
    expect([...document.querySelectorAll('span.text-muted-foreground')].map((el) => el.textContent)).toEqual(['Built-in', 'Body']);
  });
});

/**
 * The Built-in section: every world's Player Name, and Character Name over an entity's panel. A Built-in the
 * claimed field refuses stays in place, dimmed, so the strip does not reflow as focus moves.
 */
describe('PlaceholderPaletteBar Built-in section', () => {
  const lists = {
    placeholders: [{ id: 'town', name: 'Town', values: phValues(['Sedge']) }],
    placeholderGroups: [], dictionaries: [{ id: 'lore', name: 'Lore', entries: [] }],
    entities: [{ id: 'molly', name: 'Molly' }],
  };
  const all = allPlaceholders(lists);
  const store = { ...placeholderStore(all, () => {}), lists, owners: placeholderOwners(lists) };
  const mount = (scopeId?: string, field: ReactNode = <Claimer />) => render(
    <PlaceholderStoreProvider value={store}>
      <ChipInsertTargetProvider>
        {field}
        <PlaceholderPaletteBar placeholders={all} scopeId={scopeId} />
      </ChipInsertTargetProvider>
    </PlaceholderStoreProvider>,
  );

  it('offers Character Name over an entity’s panel', () => {
    mount('molly');
    expect(names()).toEqual(['Player Name', 'Character Name', 'Town']);
  });

  it('leaves Character Name out over a book and over world text', () => {
    mount('lore');
    expect(names()).toEqual(['Player Name', 'Town']);
    cleanup();
    mount();
    expect(names()).toEqual(['Player Name', 'Town']);
  });

  it('offers Character Name over a library entity, whose store names it, but not over its values', () => {
    const own = { ...placeholderStore(all, () => {}), owner: { kind: 'entity' as const, id: 'keeper' } };
    const library = (scopeId?: string) => render(
      <PlaceholderStoreProvider value={own}>
        <ChipInsertTargetProvider>
          <Claimer />
          <PlaceholderPaletteBar placeholders={all} scopeId={scopeId} />
        </ChipInsertTargetProvider>
      </PlaceholderStoreProvider>,
    );
    library();
    expect(names()).toEqual(['Player Name', 'Character Name', 'Town']);
    cleanup();
    // Scoped to one of its placeholders, the fields are that placeholder's values.
    library('town');
    expect(names()).toEqual(['Player Name', 'Town']);
  });

  it('marks each Built-in chip and no author chip', () => {
    mount('molly');
    const marked = [...document.querySelectorAll('[data-builtin-mark]')].map((el) => el.closest('button')?.textContent);
    expect(marked).toEqual(['Player Name', 'Character Name']);
    expect(document.querySelector('[data-builtin-mark]')).toHaveClass('lucide-sparkles');
  });

  it('dims a Built-in the claimed field refuses and inserts nothing on its click', async () => {
    // Like the real insert, which hands focus back to the field.
    const insert = vi.fn((_token: string) => screen.getByRole('button', { name: 'Field' }).focus());
    const accepts = (token: string) => !builtinForToken(token);
    mount(undefined, <FocusClaimer insert={insert} accepts={accepts} />);
    await userEvent.click(screen.getByRole('button', { name: 'Field' }));

    const player = screen.getByRole('button', { name: 'Player Name' });
    expect(player).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Town' })).toHaveAttribute('aria-disabled', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Town' }));
    expect(insert).toHaveBeenCalledTimes(1);
    await userEvent.click(player);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('opens no rename on a double-clicked Built-in', async () => {
    mount();
    await userEvent.dblClick(screen.getByRole('button', { name: 'Player Name' }));
    expect(screen.queryByRole('textbox', { name: /Rename/ })).not.toBeInTheDocument();
    await userEvent.dblClick(screen.getByRole('button', { name: 'Town' }));
    expect(screen.getByRole('textbox', { name: 'Rename Town' })).toBeInTheDocument();
  });
});
