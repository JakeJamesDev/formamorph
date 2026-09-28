import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListDetail } from './list-detail';

// Minimal MediaQueryList stub so `useIsMobile` resolves to a fixed value (mirrors useIsMobile.test.tsx).
function mockMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    media: '',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  })));
}

afterEach(() => vi.unstubAllGlobals());

const base = {
  list: <div>LIST-CONTENT</div>,
  detail: <div>DETAIL-CONTENT</div>,
  onBack: () => {},
};

describe('ListDetail', () => {
  it('desktop: shows list and detail together, with no back bar', () => {
    mockMatchMedia(false);
    render(<ListDetail {...base} showDetail backLabel="Placeholders" />);
    expect(screen.getByText('LIST-CONTENT')).toBeTruthy();
    expect(screen.getByText('DETAIL-CONTENT')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /placeholders/i })).toBeNull();
  });

  it('mobile: renders a back button labeled by backLabel', () => {
    mockMatchMedia(true);
    render(<ListDetail {...base} showDetail backLabel="Placeholders" />);
    expect(screen.getByRole('button', { name: /placeholders/i })).toBeTruthy();
  });

  it('mobile: clicking back calls onBack', () => {
    mockMatchMedia(true);
    const onBack = vi.fn();
    render(<ListDetail {...base} showDetail backLabel="Placeholders" onBack={onBack} />);
    screen.getByRole('button', { name: /placeholders/i }).click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('stacked: pushes the detail over the list with a back button at desktop width', () => {
    mockMatchMedia(false);
    const onBack = vi.fn();
    render(<ListDetail {...base} stacked showDetail backLabel="Traits" onBack={onBack} />);
    const back = screen.getByRole('button', { name: /traits/i });
    // The list stays mounted underneath, as on the mobile push.
    expect(screen.getByText('LIST-CONTENT')).toBeTruthy();
    back.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('paints the push with the page color at the top level, and with the panel color when stacked inside one', () => {
    mockMatchMedia(true);
    const { unmount } = render(<ListDetail {...base} showDetail backLabel="Back" />);
    const panel = () => screen.getByText('DETAIL-CONTENT').closest('.absolute') as HTMLElement;
    expect(panel()).toHaveClass('bg-background');
    unmount();
    mockMatchMedia(false);
    render(<ListDetail {...base} stacked showDetail backLabel="Traits" />);
    expect(panel()).toHaveClass('bg-card');
    expect(panel()).not.toHaveClass('bg-background');
  });

  it('freezes the detail footer below the detail scroll, side by side and in the push', () => {
    const footer = <div>DETAIL-FOOTER</div>;
    const frozen = () => {
      const foot = screen.getByText('DETAIL-FOOTER');
      const scroller = screen.getByText('DETAIL-CONTENT').closest('[data-radix-scroll-area-viewport]');
      expect(scroller).not.toBeNull();
      expect(scroller!.contains(foot)).toBe(false);
      // The next sibling of the detail's scroll root, inside the same column.
      expect(scroller!.parentElement!.nextElementSibling).toBe(foot);
    };
    mockMatchMedia(false);
    const { unmount } = render(<ListDetail {...base} detailFooter={footer} showDetail />);
    frozen();
    unmount();
    mockMatchMedia(true);
    render(<ListDetail {...base} detailFooter={footer} showDetail />);
    frozen();
  });

  it('stacked: hides the detail panel from assistive tech while the list shows', () => {
    mockMatchMedia(false);
    render(<ListDetail {...base} stacked showDetail={false} backLabel="Traits" />);
    expect(screen.getByText('DETAIL-CONTENT').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
