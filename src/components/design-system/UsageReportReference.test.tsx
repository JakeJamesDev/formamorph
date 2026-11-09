// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UsageReportReference } from './UsageReportReference';

afterEach(cleanup);

describe('Usage Report reference', () => {
  it('draws the sample report with none of the app providers, as the showcase mounts it', async () => {
    const { container } = render(<UsageReportReference />);

    expect(await screen.findByRole('table', { name: 'Per Day' })).toBeTruthy();
    expect(container.querySelectorAll('[data-day]').length).toBe(14);
  });

  it('fills the columns with the theme primary, which every theme sets', async () => {
    const { container } = render(<UsageReportReference />);

    await screen.findByRole('table', { name: 'Per Day' });
    const fills = [...container.querySelectorAll('[data-day] > div:first-child')];
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every((fill) => fill.classList.contains('bg-primary'))).toBe(true);
  });
});
