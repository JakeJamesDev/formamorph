import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Textarea } from './textarea';

// Textareas resize vertically by default: the browser's native `both` lets an author drag a field wider
// than its column and break the layout around it. Callers that want a fixed box opt out with `resize-none`,
// which has to survive the class merge — several already rely on that.
describe('Textarea', () => {
  it('resizes vertically by default', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox').className).toContain('resize-y');
  });

  it('lets a caller pin it with resize-none', () => {
    render(<Textarea className="resize-none" />);
    const cls = screen.getByRole('textbox').className;
    expect(cls).toContain('resize-none');
    expect(cls).not.toContain('resize-y');
  });

  it('keeps the default when a caller sets unrelated classes', () => {
    render(<Textarea className="min-h-[200px] font-mono" />);
    expect(screen.getByRole('textbox').className).toContain('resize-y');
  });
});
