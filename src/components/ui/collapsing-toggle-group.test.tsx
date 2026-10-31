import { describe, expect, it, vi } from 'vitest';
import { stubSegmentWidths } from '@/test/segmentWidths';
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

// Stubbed widths: labeled segments 100px, Dictionaries 130px,
// icons 40px, insets 4px. Every label needs 338px; the widest alone 218px; icons only 128px.
const stub = stubSegmentWidths('Dictionaries');

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
    stub.room = 400;
    render(<Harness />);
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([true, true, true]);
    expect(pill().style.width).toBe('100px');
    expect(pill().style.transform).toBe('translateX(4px)');
  });

  it('keeps only the selected label when every label does not fit but the widest one alone does', () => {
    stub.room = 300;
    render(<Harness />);
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([true, false, false]);
    expect(pill().style.width).toBe('100px');
  });

  it('shows icons alone below that, and takes the icons-only width as its floor', () => {
    stub.room = 150;
    render(<Harness />);
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([false, false, false]);
    expect(pill().style.width).toBe('40px');
    expect(screen.getByRole('radiogroup', { name: 'Library' }).parentElement!.style.minWidth).toBe('128px');
  });

  it('stays icons only when a pick changes which label would show', async () => {
    // Worlds alone would fit 210px (188px); Dictionaries would not (218px).
    stub.room = 210;
    render(<Harness />);
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([false, false, false]);
    await userEvent.click(screen.getByRole('radio', { name: 'Dictionaries' }));
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([false, false, false]);
    expect(pill().style.transform).toBe('translateX(84px)');
  });

  it('names the selected option in a tip when it shows its icon alone', async () => {
    stub.room = 150;
    render(<Harness />);
    await userEvent.hover(screen.getByRole('radio', { name: 'Worlds' }));
    expect(await screen.findByText('Worlds', { selector: 'div' })).toBeInTheDocument();
  });

  it('lands on its measured step without a slide, and slides from the next frame on', async () => {
    stub.room = 150;
    render(<Harness />);
    const motion = () => OPTIONS.map((o) => screen.getByRole('radio', { name: o.label }).querySelector('.grid')!.className.includes('transition-'));
    expect(motion()).toEqual([false, false, false]);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 0));
    expect(motion()).toEqual([true, true, true]);
  });

  it('moves the label and the pill to a newly picked option', async () => {
    stub.room = 300;
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dictionaries' }));
    expect(onChange).toHaveBeenCalledWith('dictionaries');
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([false, false, true]);
    expect(pill().style.transform).toBe('translateX(84px)');
  });

  it('keeps the selection when the selected option is pressed again', async () => {
    stub.room = 300;
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Worlds' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Worlds' })).toHaveAttribute('data-state', 'on');
  });

  it('names a folded option in a tip, and gives a labeled one none', async () => {
    stub.room = 300;
    render(<Harness />);
    await userEvent.hover(screen.getByRole('radio', { name: 'Entities' }));
    expect(await screen.findByText('Entities', { selector: 'div' })).toBeInTheDocument();
    await userEvent.unhover(screen.getByRole('radio', { name: 'Entities' }));
    await userEvent.hover(screen.getByRole('radio', { name: 'Worlds' }));
    await new Promise((r) => setTimeout(r, TOOLTIP_DELAY_MS + 100));
    expect(screen.queryByText('Worlds', { selector: 'div' })).toBeNull();
  });

  it('takes a step chosen by its host over its own room, and holds the width of that step open', () => {
    stub.room = 400;
    render(
      <TooltipProvider>
        <CollapsingToggleGroup options={OPTIONS} value="worlds" onValueChange={() => {}} aria-label="Library" fold="icons" />
      </TooltipProvider>,
    );
    expect(OPTIONS.map((o) => labelShown(o.label))).toEqual([false, false, false]);
    expect(screen.getByRole('radiogroup', { name: 'Library' }).parentElement!.style.minWidth).toBe('128px');
  });

  it('reports its width at each step, the middle one sized for the widest label', () => {
    stub.room = 400;
    const onStepWidths = vi.fn();
    render(
      <TooltipProvider>
        <CollapsingToggleGroup options={OPTIONS} value="worlds" onValueChange={() => {}} aria-label="Library" onStepWidths={onStepWidths} />
      </TooltipProvider>,
    );
    expect(onStepWidths).toHaveBeenLastCalledWith({ full: 338, active: 218, icons: 128 });
  });
});
