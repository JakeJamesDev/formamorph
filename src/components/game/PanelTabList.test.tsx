import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Box, Map } from 'lucide-react';
import { Tabs } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PanelTab, PanelTabList } from './PanelTabList';

/** jsdom lays nothing out and has no Tailwind: each tab cell is `cell` wide, each label 7px a character, the
 *  icon 16px, and a trigger's `px-1 gap-1.5` 4px a side and 6px. */
function stubLayout(cell: number) {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
    const style = real(el, pseudo);
    if (el.getAttribute('role') !== 'tab') return style;
    const tw: Record<PropertyKey, string> = { paddingLeft: '4px', paddingRight: '4px', columnGap: '6px' };
    return new Proxy(style, {
      get: (target, key) => (key in tw ? tw[key] : Reflect.get(target, key, target) as unknown),
    });
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.getAttribute('role') === 'tab') return { width: cell } as DOMRect;
    return { width: this.tagName.toLowerCase() === 'svg' ? 16 : 0 } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return (this.textContent ?? '').length * 7;
  });
}

const strip = () => render(
  <TooltipProvider>
    <Tabs value="items">
      <PanelTabList>
        <PanelTab value="items" icon={Box} label="Inventory" />
        <PanelTab value="map" icon={Map} label="Map" />
      </PanelTabList>
    </Tabs>
  </TooltipProvider>,
);
const hidden = (label: string) => screen.getByText(label).classList.contains('sr-only');

afterEach(() => vi.restoreAllMocks());

describe('PanelTabList', () => {
  it('shows every label while the longest fits its cell', () => {
    // "Inventory" is 63px; with the icon, gap and padding it needs 93px.
    stubLayout(93);
    strip();
    expect(hidden('Inventory')).toBe(false);
    expect(hidden('Map')).toBe(false);
  });

  it('shows icons alone once one label would overflow, each tab still named', () => {
    stubLayout(92);
    strip();
    expect(hidden('Inventory')).toBe(true);
    expect(hidden('Map')).toBe(true);
    expect(screen.getByRole('tab', { name: 'Inventory' })).toBeInTheDocument();
  });
});
