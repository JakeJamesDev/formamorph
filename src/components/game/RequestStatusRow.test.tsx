import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequestStatusRow } from './RequestStatusRow';

describe('RequestStatusRow', () => {
  it('shows the label as text beside the bar', () => {
    render(<RequestStatusRow label="Generating Narration…" />);
    expect(screen.getByText('Generating Narration…')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('keeps the glyph slot out of the accessibility tree', () => {
    const { container } = render(<RequestStatusRow label="Summarizing turn…" glyph={<svg data-testid="glyph" />} />);
    const slot = container.querySelector('[data-slot="status-glyph"]');
    expect(slot?.getAttribute('aria-hidden')).toBe('true');
    expect(slot?.contains(screen.getByTestId('glyph'))).toBe(true);
  });
});
