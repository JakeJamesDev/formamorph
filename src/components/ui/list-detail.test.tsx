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
});
