import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Stat } from '@/types';
import { TooltipProvider } from '@/components/ui/tooltip';
import { STAT_FIELDS } from '@/lib/statCodeSurface';
import { StatCodeTemplateDialog } from './StatCodeTemplateDialog';

/** The template editor has no world, so its Variable menu types over one `Name` at each name level.
 *  These pick through the real dialog and editor, as an author does. */

type User = ReturnType<typeof userEvent.setup>;

const stats = [{ id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10 }] as unknown as Stat[];

/** Opens a new template and waits for its code editor, which arrives on its own chunk. */
async function openEditor(user: User) {
  render(
    <TooltipProvider>
      <StatCodeTemplateDialog
        open
        onOpenChange={vi.fn()}
        timing="after"
        stats={stats}
        currentStatId="s1"
        hasExistingCode={false}
        onInsert={vi.fn()}
        placeholderPlaces={[]}
        traitPlaces={[]}
        entities={[]}
      />
    </TooltipProvider>,
  );
  await user.click(await screen.findByRole('button', { name: /New Template/i }));
  // The real editor replaces a plain stand-in once its chunk loads.
  const field = await waitFor(() => {
    const real = screen.getAllByLabelText('Template code').find((element) => element.closest('.cm-editor'));
    expect(real).toBeTruthy();
    return real!;
  });
  await user.click(field);
  await user.keyboard('{Control>}a{/Control}{Backspace}');
  return field;
}

const code = (field: HTMLElement) => field.textContent;
const level = (label: string) => screen.queryByRole('group', { name: label });

/** A row of the level showing: an option where the level has a search box, else a button. */
const row = (name: string) => screen.queryByRole('option', { name }) ?? screen.getByRole('button', { name });

/** Opens the Variable menu and clicks down the named rows. */
async function pick(user: User, ...rows: string[]) {
  await user.click(screen.getByLabelText('Variable'));
  for (const name of rows) await user.click(row(name));
}

/** The named level's row names. */
function rowsOf(label: string) {
  const group = within(screen.getByRole('group', { name: label }));
  const options = group.queryAllByRole('option');
  return (options.length ? options : group.getAllByRole('button')).map((element) => element.textContent);
}

describe('the Code Templates editor’s Variable menu', () => {
  it('lists one Name row under Stats and inserts the path with Name selected', async () => {
    const user = userEvent.setup();
    const field = await openEditor(user);

    await pick(user, 'Stats');
    expect(rowsOf('Stats')).toEqual(['Name']);
    await user.click(row('Name'));
    await user.click(row('value'));
    expect(code(field)).toBe('stats["Name"].value');

    // `Name` is selected, so typing replaces just it.
    await user.keyboard('Warmth');
    expect(code(field)).toBe('stats["Warmth"].value');
  });

  it('reaches a trait through an entity with the first Name selected', async () => {
    const user = userEvent.setup();
    const field = await openEditor(user);

    await pick(user, 'Entities');
    expect(rowsOf('Entities')).toEqual(['Name']);
    await user.click(row('Name'));
    await user.click(row('Traits'));
    expect(rowsOf('Traits')).toEqual(['Name']);
    await user.click(row('Name'));
    await user.click(row('enabled'));
    expect(code(field)).toBe('entities["Name"].traits["Name"].enabled');

    await user.keyboard('Mira');
    expect(code(field)).toBe('entities["Mira"].traits["Name"].enabled');
  });

  it('inserts This Stat and Clock fields as the stat box does', async () => {
    const user = userEvent.setup();
    const field = await openEditor(user);

    await pick(user, 'This Stat', 'value');
    expect(code(field)).toBe('self.value');
    await user.keyboard(';');
    await pick(user, 'Clock', 'day');
    expect(code(field)).toBe('self.value;clock.day');
  });

  it('keeps the menu’s keyboard, Back row and tooltips', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.click(screen.getByLabelText('Variable'));

    await user.keyboard('{Enter}');
    expect(level('This Stat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'This Stat' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    const field = STAT_FIELDS[0];
    expect(screen.getByRole('button', { name: field.name })).toHaveFocus();
    await user.hover(screen.getByRole('button', { name: field.name }));
    expect(await screen.findByText(field.info, { selector: 'div' })).toBeVisible();

    await user.keyboard('{Backspace}');
    expect(level('Variable')).toBeInTheDocument();
    await user.keyboard('{Enter}{ArrowLeft}');
    expect(level('Variable')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'This Stat' }));
    expect(level('Variable')).toBeInTheDocument();

    // Escape leaves the whole menu, from any level.
    await user.keyboard('{Enter}{Escape}');
    expect(level('This Stat')).toBeNull();
    expect(level('Variable')).toBeNull();
  });

  it('leaves the Slot menu as it was', async () => {
    const user = userEvent.setup();
    const field = await openEditor(user);

    await user.click(screen.getByLabelText('Slot'));
    const menu = within(screen.getByRole('button', { name: 'Number' }).parentElement!);
    expect(menu.getAllByRole('button').map((item) => item.textContent))
      .toEqual(['Stat picker', 'Number', 'Daypart picker', 'Choice', 'Free text']);

    await user.click(screen.getByRole('button', { name: 'Number' }));
    expect(code(field)).toBe('{{name:number=0}}');
  });
});
