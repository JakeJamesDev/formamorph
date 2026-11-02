// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AllowanceRingReference } from './AllowanceRingReference';

afterEach(cleanup);

describe('Allowance Ring reference', () => {
  it('renders every tone and the breakdown bars with none of the app providers, as the showcase mounts it', () => {
    const { container } = render(<AllowanceRingReference />);
    const tones = [...container.querySelectorAll('[data-allowance-glyph]')]
      .map((glyph) => glyph.querySelector('[data-allowance-fill]')?.getAttribute('data-allowance-fill') ?? null);
    expect(tones).toEqual(['normal', 'warning', 'destructive', 'destructive', null]);
    expect(screen.getByRole('button', { name: 'No usage figure' })).toBeTruthy();
    expect(container.querySelectorAll('[data-breakdown-group] > div[aria-hidden]').length).toBeGreaterThan(0);
  });
});
