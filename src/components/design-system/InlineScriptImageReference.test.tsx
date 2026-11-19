import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InlineScriptImageReference } from './InlineScriptImageReference';

describe('InlineScriptImageReference', () => {
  it('lists every wrap in every size, and floats only the left and right ones below large', () => {
    render(<InlineScriptImageReference />);
    expect(screen.getAllByTestId('script-image')).toHaveLength(9);
    const wraps = screen.getAllByTestId('script-image').map((figure) => `${figure.dataset.wrap}/${figure.dataset.size}`);
    expect(wraps).toEqual([
      'block/small', 'block/medium', 'block/large',
      'left/small', 'left/medium', 'block/large',
      'right/small', 'right/medium', 'block/large',
    ]);
  });
});
