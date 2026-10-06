import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { BackButton } from './BackButton';

afterEach(cleanup);

describe('BackButton', () => {
  it('is named Back and calls its handler once on click', () => {
    const onClick = vi.fn();
    render(<BackButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
