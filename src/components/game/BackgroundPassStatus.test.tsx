import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BackgroundPassStatus, type StatusPassKind } from './BackgroundPassStatus';

const statusFor = (...running: StatusPassKind[]) => render(<BackgroundPassStatus running={new Set(running)} />);

describe('BackgroundPassStatus', () => {
  it('shows one label by precedence: digest, then milestone, then diary', () => {
    statusFor('diary', 'milestone', 'digest');
    expect(screen.getByText('Summarizing turn…')).toBeTruthy();
    expect(screen.queryByText('Selecting memories…')).toBeNull();
    expect(screen.queryByText('Writing diary…')).toBeNull();
  });

  it('shows the milestone over the diary', () => {
    statusFor('diary', 'milestone');
    expect(screen.getByText('Selecting memories…')).toBeTruthy();
    expect(screen.queryByText('Writing diary…')).toBeNull();
  });

  it('shows the diary alone', () => {
    statusFor('diary');
    expect(screen.getByText('Writing diary…')).toBeTruthy();
  });

  it('renders nothing when no pass runs', () => {
    const { container } = statusFor();
    expect(container.innerHTML).toBe('');
  });
});
