import { useMemo, useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Placeholder, Stat } from '@/types';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { statCodeName } from '@/lib/statCodeNames';
import { useCodeRenameOffer, useRenameField } from '@/lib/useCodeRename';
import { CodeRenameProvider } from './CodeRenameOffer';

const stat = (id: string, name: string, code: string): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, code } as unknown as Stat);

const store: { stats: Stat[]; placeholders: Placeholder[]; rerender: () => void } = {
  stats: [], placeholders: [], rerender: () => {},
};

vi.mock('@/contexts/GameDataContext', () => ({
  useGameDataOptional: () => ({
    stats: store.stats,
    updateStat: (next: Stat) => {
      store.stats = store.stats.map((entry) => (entry.id === next.id ? next : entry));
      store.rerender();
    },
  }),
}));

/** A name field reduced to what the offer reads: a value, and the commit handlers the real fields wire. */
const NameField = ({ root, initial, otherNames, chips }: {
  root: 'stats' | 'placeholders' | 'traits';
  initial: string;
  otherNames: string[];
  /** Read the value as a stat's code name, the way the stat panel does. */
  chips?: boolean;
}) => {
  const [value, setValue] = useState(initial);
  // The hook takes the whole sibling list and the id being edited; the cases name the other entries, so
  // this one stands in as the entry those belong beside.
  const siblings = useMemo(
    () => [{ id: 'self', name: initial }, ...otherNames.map((name, i) => ({ id: `other${i}`, name }))],
    [initial, otherNames],
  );
  const rename = useRenameField({
    root,
    value,
    siblings,
    ownId: 'self',
    codeNameOf: chips ? (name) => statCodeName(name, store.placeholders) : undefined,
  });
  return (
    <input
      aria-label="Name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={rename.onFocus}
      onBlur={rename.onBlur}
      onKeyDown={(e) => { if (e.key === 'Enter') rename.onSubmit(); }}
    />
  );
};

const Harness = (props: Parameters<typeof NameField>[0]) => {
  const [, setTick] = useState(0);
  store.rerender = () => setTick((n) => n + 1);
  return (
    <CodeRenameProvider>
      <NameField {...props} />
      <button type="button">elsewhere</button>
    </CodeRenameProvider>
  );
};

const codeOf = (id: string) => store.stats.find((entry) => entry.id === id)?.code;

/** Put a new name in the field and commit it by moving focus off, as blurring the real field does. Pasted
 *  rather than typed, so a chip token's braces reach the field instead of being read as typing syntax. */
async function renameTo(next: string) {
  const user = userEvent.setup();
  const field = screen.getByLabelText('Name');
  await user.click(field);
  await user.clear(field);
  await user.paste(next);
  await user.click(screen.getByRole('button', { name: 'elsewhere' }));
  return user;
}

beforeEach(() => {
  store.placeholders = [];
  store.stats = [
    stat('a', 'Health', 'return stats.Health.value * 2;'),
    stat('b', 'Stamina', `return stats['Health'].max - 1;`),
    stat('c', 'Grit', 'return self.value;'),
  ];
});

describe('the rename offer', () => {
  it('asks with the count, and rewrites every script on Yes', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    const user = await renameTo('Vigor');

    expect(screen.getByText(/The code of 2 stats names the stat “Health” 2 times\./)).toBeInTheDocument();
    expect(screen.getByText(/Update them to “Vigor”\?/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe('return stats.Vigor.value * 2;');
    expect(codeOf('b')).toBe(`return stats['Vigor'].max - 1;`);
  });

  it('rewrites nothing on No', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    const user = await renameTo('Vigor');

    await user.click(screen.getByRole('button', { name: 'Leave Code' }));
    expect(codeOf('a')).toBe('return stats.Health.value * 2;');
    expect(codeOf('b')).toBe(`return stats['Health'].max - 1;`);
  });

  it('asks once, for the final name, however many names the author types through', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    const user = userEvent.setup();
    const field = screen.getByLabelText('Name');
    await user.click(field);
    await user.clear(field);
    await user.type(field, 'Vig');
    await user.type(field, 'or');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    expect(screen.getByText(/Update them to “Vigor”\?/)).toBeInTheDocument();
  });

  it('asks nothing when the name comes back unchanged', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks nothing when the new name is one another stat already carries', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    await renameTo('Stamina');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks nothing when no code names the old name', async () => {
    render(<Harness root="stats" initial="Grit" otherNames={['Health', 'Stamina']} />);
    await renameTo('Resolve');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('carries a trait rename over traits references', async () => {
    store.stats = [stat('a', 'Health', 'return traits.Brave.enabled ? 2 : 1;')];
    render(<Harness root="traits" initial="Brave" otherNames={['Shy']} />);
    const user = await renameTo('Bold');

    expect(screen.getByText(/names the trait “Brave” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe('return traits.Bold.enabled ? 2 : 1;');
  });

  it('carries a placeholder rename over placeholders references', async () => {
    store.stats = [stat('a', 'Health', `placeholders.Mood.pin('calm'); return self.value;`)];
    render(<Harness root="placeholders" initial="Mood" otherNames={['Weather']} />);
    const user = await renameTo('Temper');

    expect(screen.getByText(/names the placeholder “Mood” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe(`placeholders.Temper.pin('calm'); return self.value;`);
  });

  it('compares a chip-bearing stat name the way code reads it', async () => {
    store.placeholders = [{ id: 'p1', name: 'Beast', values: [] } as unknown as Placeholder];
    const token = encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'pl1' });
    store.stats = [stat('a', `${token} Power`, `return stats['Beast Power'].value;`)];
    render(<Harness root="stats" initial={`${token} Power`} otherNames={[]} chips />);
    const user = await renameTo(`${token} Might`);

    expect(screen.getByText(/names the stat “Beast Power” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe(`return stats['Beast Might'].value;`);
  });

  it('asks the next queued rename after the first is answered either way', async () => {
    // One Replace All renames several things in a single pass and reports each, so two questions queue
    // together and the second has to survive the first being answered.
    const ReplaceAll = () => {
      const [, setTick] = useState(0);
      store.rerender = () => setTick((n) => n + 1);
      const offer = useCodeRenameOffer();
      return (
        <button
          type="button"
          onClick={() => {
            offer({ root: 'stats', oldName: 'Health', newName: 'Vigor', otherNames: ['Grit'] });
            offer({ root: 'traits', oldName: 'Brave', newName: 'Bold', otherNames: ['Shy'] });
          }}
        >
          replace all
        </button>
      );
    };
    store.stats = [stat('a', 'Health', 'return stats.Health.value + (traits.Brave.enabled ? 1 : 0);')];
    render(<CodeRenameProvider><ReplaceAll /></CodeRenameProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'replace all' }));

    expect(screen.getByText(/names the stat “Health” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));

    expect(await screen.findByText(/names the trait “Brave” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe('return stats.Vigor.value + (traits.Bold.enabled ? 1 : 0);');
  });

  it('commits on Enter without waiting for the field to lose focus', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    const user = userEvent.setup();
    const field = screen.getByLabelText('Name');
    await user.click(field);
    await user.clear(field);
    await user.paste('Vigor');
    // Dispatched rather than typed: userEvent re-reads which element is focused between the keydown and
    // the activation it synthesizes, so the dialog this Enter opens takes its own Cancel press. A browser
    // settles that target before dispatching the keydown, and pressing Enter in the real editor opens the
    // offer and leaves it open.
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByText(/Update them to “Vigor”\?/)).toBeInTheDocument();
  });
});
