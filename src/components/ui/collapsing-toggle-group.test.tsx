import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { BookOpen, Earth, Users } from 'lucide-react';
import { CollapsingToggleGroup, type CollapsingToggleOption } from './collapsing-toggle-group';
import { TOOLTIP_DELAY_MS, TooltipProvider } from './tooltip';

type Tab = 'worlds' | 'entities' | 'dictionaries';
const OPTIONS: CollapsingToggleOption<Tab>[] = [
  { value: 'worlds', label: 'Worlds', icon: Earth },
  { value: 'entities', label: 'Entities', icon: Users },
  { value: 'dictionaries', label: 'Dictionaries', icon: BookOpen },
];

// jsdom lays nothing out, so widths are given explicitly: labeled segments 100px, Dictionaries 130px,
// icons 40px, insets 4px. Every label needs 338px; the widest alone 218px; icons only 128px.
let room = 0;
let original: PropertyDescriptor | undefined;
beforeEach(() => {
  original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.hasAttribute('data-collapsing-root')) return room;
      if (this.parentElement?.parentElement?.hasAttribute('data-collapsing-measure')) {
        if (this.children.length < 2) return 40;
        return this.textContent === 'Dictionaries' ? 130 : 100;
      }
      return 0;
    },
  });
});
afterEach(() => {
  if (original) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original);
});

function Harness({ onChange }: { onChange?: (v: Tab) => void }) {
  const [value, setValue] = useState<Tab>('worlds');
  return (
    <TooltipProvider>
      <CollapsingToggleGroup options={OPTIONS} value={value} onValueChange={(v) => { setValue(v); onChange?.(v); }} aria-label="Library" />
    </TooltipProvider>
  );
}

const labelShown = (name: string) => screen.getByRole('radio', { name }).querySelector('.grid')!.className.includes('grid-cols-[1fr]');
const pill = () => document.querySelector<HTMLElement>('[data-collapsing-pill]')!;

describe('CollapsingToggleGroup', () => {
  it('shows every label and sizes the pill to the selection when they fit', () => {
    room = 400;
    render(<Harness />);
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([true, true, true]);
    expect(pill().style.width).toBe('100px');
    expect(pill().style.transform).toBe('translateX(4px)');
  });

  it('keeps only the selected label when every label does not fit but the widest one alone does', () => {
    room = 300;
    render(<Harness />);
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([true, false, false]);
    expect(pill().style.width).toBe('100px');
  });

  it('shows icons alone below that, and takes the icons-only width as its floor', () => {
    room = 150;
    render(<Harness />);
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([false, false, false]);
    expect(pill().style.width).toBe('40px');
    expect(screen.getByRole('radiogroup', { name: 'Library' }).parentElement!.style.minWidth).toBe('128px');
  });

  it('stays icons only when a pick changes which label would show', async () => {
    // Worlds alone would fit 210px (188px); Dictionaries would not (218px).
    room = 210;
    render(<Harness />);
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([false, false, false]);
    await userEvent.click(screen.getByRole('radio', { name: 'Dictionaries' }));
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([false, false, false]);
    expect(pill().style.transform).toBe('translateX(84px)');
  });

  it('names the selected option in a tip when it shows its icon alone', async () => {
    room = 150;
    render(<Harness />);
    await userEvent.hover(screen.getByRole('radio', { name: 'Worlds' }));
    expect(await screen.findByText('Worlds', { selector: 'div' })).toBeInTheDocument();
  });

  it('moves the label and the pill to a newly picked option', async () => {
    room = 300;
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dictionaries' }));
    expect(onChange).toHaveBeenCalledWith('dictionaries');
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([false, false, true]);
    expect(pill().style.transform).toBe('translateX(84px)');
  });

  it('keeps the selection when the selected option is pressed again', async () => {
    room = 300;
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Worlds' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Worlds' })).toHaveAttribute('data-state', 'on');
  });

  it('names a folded option in a tip, and gives a labeled one none', async () => {
    room = 300;
    render(<Harness />);
    await userEvent.hover(screen.getByRole('radio', { name: 'Entities' }));
    expect(await screen.findByText('Entities', { selector: 'div' })).toBeInTheDocument();
    await userEvent.unhover(screen.getByRole('radio', { name: 'Entities' }));
    await userEvent.hover(screen.getByRole('radio', { name: 'Worlds' }));
    await new Promise((r) => setTimeout(r, TOOLTIP_DELAY_MS + 100));
    expect(screen.queryByText('Worlds', { selector: 'div' })).toBeNull();
  });
});
