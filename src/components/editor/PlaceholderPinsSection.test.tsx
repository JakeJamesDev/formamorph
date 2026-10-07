import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadPinWorld } from '@/test/pinWorld';
import { pinsTargeting, removePinAt, type PinEditorWorld, type PinSourceKind } from '@/lib/placeholderPins';
import type { Placeholder } from '@/types';
import { PlaceholderPinsSection, type PinsWorld } from './PlaceholderPinsSection';

// Each row's picker lists every source of its kind: about 300 locations, 400 traits, 1,250 values.
let world: PinsWorld;
let mood: Placeholder;
/** Mood's pins kept per kind: 20 rows, the size users report a hitch at. */
const PER_KIND = 5;

beforeAll(() => {
  const raw = loadPinWorld();
  let data: PinEditorWorld = { ...raw, placeholders: raw.placeholders ?? [] };
  mood = data.placeholders.find((p) => p.name === 'Mood')!;
  const kept = new Map<PinSourceKind, number>();
  for (const row of pinsTargeting(data, mood.id)) {
    const n = kept.get(row.source.kind) ?? 0;
    kept.set(row.source.kind, n + 1);
    if (n >= PER_KIND) data = removePinAt(data, row.source, row.pin);
  }
  const noop = () => {};
  world = { ...data, updateTrait: noop, updateEntity: noop, updateLocation: noop, updateStat: noop, updatePlaceholder: noop };
}, 60_000);

describe('PlaceholderPinsSection on the pin world', () => {
  it('shows each row’s label on its closed picker and mounts none of the pickers’ items', () => {
    // Inside a form, Radix mirrors every mounted item as an option of a hidden native select.
    render(<form><PlaceholderPinsSection world={world} placeholder={mood} /></form>);
    const triggers = screen.getAllByRole('combobox', { name: 'Pin Source' });
    expect(triggers.map((t) => t.textContent)).toEqual(pinsTargeting(world, mood.id).map((row) => row.label));
    expect(document.querySelectorAll('select[aria-hidden] option')).toHaveLength(0);
  });

  it('opens each kind’s picker on the row’s own source', async () => {
    const user = userEvent.setup();
    render(<PlaceholderPinsSection world={world} placeholder={mood} />);
    const triggers = screen.getAllByRole('combobox', { name: 'Pin Source' });
    // Rows run strongest kind first, PER_KIND to a kind: one row of each.
    for (const index of [0, PER_KIND, 2 * PER_KIND, 3 * PER_KIND]) {
      await user.click(triggers[index]);
      const listbox = await screen.findByRole('listbox');
      expect(listbox.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toHaveAttribute('aria-selected', 'true');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    }
  });

  // 24 ms alone, up to 63 ms beside other test files; mounting every item while closed takes 1,600 ms.
  it('mounts 20 pin rows in under 200 ms warm', () => {
    const mount = () => {
      const t0 = performance.now();
      const view = render(<PlaceholderPinsSection world={world} placeholder={mood} />);
      const ms = performance.now() - t0;
      expect(screen.getAllByRole('combobox', { name: 'Pin Source' })).toHaveLength(4 * PER_KIND);
      view.unmount();
      return ms;
    };
    mount();
    // Load from parallel test files only adds time, so the fastest warm mount is the section's own cost.
    const warm = Array.from({ length: 5 }, mount).sort((a, b) => a - b);
    console.info(`pins section, ${4 * PER_KIND} rows, warm mount ms:`, warm.map((ms) => ms.toFixed(1)).join(' '));
    expect(warm[0]).toBeLessThan(200);
  });
});
