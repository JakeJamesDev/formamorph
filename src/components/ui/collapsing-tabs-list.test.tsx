import { describe, expect, it } from 'vitest';
import { stubSegmentWidths } from '@/test/segmentWidths';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { AlignLeft, Filter, User } from 'lucide-react';
import { CollapsingTabsList } from './collapsing-tabs-list';
import type { CollapsingSegmentOption } from './collapsing-segments';
import { Tabs, TabsContent } from './tabs';
import { TOOLTIP_DELAY_MS, TooltipProvider } from './tooltip';

type Tab = 'profile' | 'descriptions' | 'matching';
const TABS: CollapsingSegmentOption<Tab>[] = [
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'descriptions', label: 'Descriptions', icon: AlignLeft },
  { value: 'matching', label: 'Matching', icon: Filter },
];

// Stubbed widths: labeled tabs 100px, Descriptions 130px,
// icons 40px, insets 4px. Every label needs 338px; the widest alone 218px; icons only 128px.
const stub = stubSegmentWidths('Descriptions');

function Harness({ tabs = TABS }: { tabs?: readonly CollapsingSegmentOption<Tab>[] }) {
  const [value, setValue] = useState<Tab>('profile');
  return (
    <TooltipProvider>
      <Tabs value={value} onValueChange={(v) => setValue(v as Tab)}>
        <CollapsingTabsList tabs={tabs} value={value} aria-label="Entity Fields" />
        {tabs.map((t) => <TabsContent key={t.value} value={t.value}>{t.label} body</TabsContent>)}
      </Tabs>
    </TooltipProvider>
  );
}

const labelShown = (name: string) => screen.getByRole('tab', { name }).querySelector('.grid')!.className.includes('grid-cols-[1fr]');
const widths = () => TABS.map((t) => screen.getByRole('tab', { name: t.label }).style.width);

describe('CollapsingTabsList', () => {
  it('shows every label when they fit, and shares the spare room evenly', () => {
    stub.room = 368;
    render(<Harness />);
    expect(TABS.map((t) => labelShown(t.label))).toEqual([true, true, true]);
    expect(widths()).toEqual(['110px', '140px', '110px']);
  });

  it('keeps only the selected label when every label does not fit but the widest one alone does', () => {
    stub.room = 300;
    render(<Harness />);
    expect(TABS.map((t) => labelShown(t.label))).toEqual([true, false, false]);
  });

  it('shows icons alone below that, stretched to the row', () => {
    stub.room = 158;
    render(<Harness />);
    expect(TABS.map((t) => labelShown(t.label))).toEqual([false, false, false]);
    expect(widths()).toEqual(['50px', '50px', '50px']);
  });

  it('lands on its measured step without a slide, and slides from the next frame on', async () => {
    stub.room = 158;
    render(<Harness />);
    const motion = () => TABS.map((t) => screen.getByRole('tab', { name: t.label }).querySelector('.grid')!.className.includes('transition-'));
    expect(motion()).toEqual([false, false, false]);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 0));
    expect(motion()).toEqual([true, true, true]);
  });

  it('lands without a slide when tabs arrive after mount, as a game panel adds its Inventory tab', async () => {
    // Profile and Matching alone fit 300px with both labels; the third tab folds the strip to one label.
    stub.room = 300;
    const { rerender } = render(<Harness tabs={[TABS[0], TABS[2]]} />);
    const frame = async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, 0));
    };
    await frame();
    rerender(<Harness tabs={TABS} />);
    const motion = () => TABS.map((t) => screen.getByRole('tab', { name: t.label }).querySelector('.grid')!.className.includes('transition-'));
    expect(TABS.map((t) => labelShown(t.label))).toEqual([true, false, false]);
    expect(motion()).toEqual([false, false, false]);
    await frame();
    expect(motion()).toEqual([true, true, true]);
  });

  it('hugs its tabs with its full-label width as basis, folding by the room a tight row leaves it', () => {
    const hugging = () => (
      <TooltipProvider>
        <Tabs value="profile">
          <CollapsingTabsList hug tabs={TABS} value="profile" aria-label="Entity Fields" />
        </Tabs>
      </TooltipProvider>
    );
    stub.room = 400;
    const { unmount } = render(hugging());
    const root = () => screen.getByRole('tablist', { name: 'Entity Fields' }).parentElement!;
    expect(root().style.flex).toBe('0 1 338px');
    expect(widths()).toEqual(['100px', '130px', '100px']);
    unmount();
    stub.room = 300;
    render(hugging());
    expect(TABS.map((t) => labelShown(t.label))).toEqual([true, false, false]);
    expect(widths()).toEqual(['100px', '40px', '40px']);
  });

  it('moves the kept label to the picked tab', async () => {
    stub.room = 300;
    render(<Harness />);
    await userEvent.click(screen.getByRole('tab', { name: 'Matching' }));
    expect(TABS.map((t) => labelShown(t.label))).toEqual([false, false, true]);
    expect(screen.getByRole('tabpanel', { name: 'Matching' })).toHaveTextContent('Matching body');
  });

  it('names each panel by its tab, through the tip that wraps the tab', () => {
    stub.room = 150;
    render(<Harness />);
    const tab = screen.getByRole('tab', { name: 'Profile' });
    const panel = screen.getByRole('tabpanel', { name: 'Profile' });
    expect(tab).toHaveAttribute('aria-controls', panel.id);
  });

  it('tips a folded tab by name on hover, and not a tab whose label shows', async () => {
    stub.room = 300;
    render(<Harness />);
    await userEvent.hover(screen.getByRole('tab', { name: 'Matching' }));
    expect(await screen.findByText('Matching', { selector: 'div' })).toBeInTheDocument();
    await userEvent.unhover(screen.getByRole('tab', { name: 'Matching' }));
    await userEvent.hover(screen.getByRole('tab', { name: 'Profile' }));
    await new Promise((r) => setTimeout(r, TOOLTIP_DELAY_MS + 100));
    expect(screen.queryByText('Profile', { selector: 'div' })).toBeNull();
  });
});
