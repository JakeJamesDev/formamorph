import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Stat } from '@/types';
import { StatCodeTemplateDialog } from './StatCodeTemplateDialog';

/** What a template asks for is a form the author writes by typing slots into code, and the form has to
 *  agree with the code it generates underneath — that agreement is what these cover. */

const stats = [
  { id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10 },
  { id: 's2', name: 'Damp', type: 'number', value: 3, min: 0, max: 10 },
] as unknown as Stat[];

// The real editor arrives on its own chunk and brings CodeMirror with it; a textarea over the same
// value is enough to type a slot into. Its `preview` is rendered rather than dropped — in the template
// editor that pane IS the form under test, and the real field shows it beside the code.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: {
    value: string; onChange: (next: string) => void; ariaLabel: string; preview?: React.ReactNode;
  }) => (
    <>
      <textarea
        aria-label={props.ariaLabel}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.preview}
    </>
  ),
}));

const open = () => render(
  <StatCodeTemplateDialog
    open
    onOpenChange={vi.fn()}
    stats={stats}
    currentStatId="s1"
    hasExistingCode={false}
    onInsert={vi.fn()}
  />,
);

/** Start a new template and replace its code with `code`. */
async function authoring(user: ReturnType<typeof userEvent.setup>, code: string) {
  open();
  await user.click(await screen.findByRole('button', { name: /New Template/i }));
  const field = await screen.findByLabelText('Template code');
  await user.clear(field);
  await user.paste(code);
  return field;
}

describe('the form a template presents', () => {
  it('shows a slot’s declared default the moment it is typed into the code', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return (me?.value ?? 0) + {{ratePerHour:number=-5}} * deltaHours;');

    // Typed after the editor opened, so nothing seeded it — the default has to come from the slot itself.
    await waitFor(() => expect(screen.getByLabelText('Rate Per Hour')).toHaveValue('-5'));
  });

  it('does not ask for a slot the template already answered', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return {{ratePerHour:number=-5}};');

    await waitFor(() => expect(screen.getByLabelText('Rate Per Hour')).toHaveValue('-5'));
    expect(screen.queryByText('Required')).toBeNull();
  });

  it('still asks for a slot the template left blank', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return stats.find(s => s.name === {{source:stat}})?.value ?? 0;');

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument());
  });

  // Snapping back on every keystroke would refill a backspaced field before the next character landed.
  it('lets a defaulted number be backspaced and retyped', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return {{ratePerHour:number=-5}};');
    const slotField = await screen.findByLabelText('Rate Per Hour');

    await user.clear(slotField);
    expect(slotField).toHaveValue('');
    await user.type(slotField, '2');
    expect(slotField).toHaveValue('2');
  });

  it('returns a field left blank to the default once you leave it', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return {{ratePerHour:number=-5}};');
    const slotField = await screen.findByLabelText('Rate Per Hour');

    await user.clear(slotField);
    await user.tab();
    await waitFor(() => expect(slotField).toHaveValue('-5'));
  });

  it('prefills the defaults of a template picked from the list', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByText('Per-Turn Change'));

    // The built-in declares -5 per hour; the picker must meet the author with that, not with a blank.
    await waitFor(() => expect(screen.getByLabelText('Rate Per Hour')).toHaveValue('-5'));
  });
});
