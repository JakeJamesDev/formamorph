import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BackgroundPassKind } from '@/lib/backgroundPassQueue/backgroundPassQueue';
import { BackgroundPassStatus } from './BackgroundPassStatus';

const statusFor = (...running: BackgroundPassKind[]) => render(<BackgroundPassStatus running={new Set(running)} />);

describe('BackgroundPassStatus', () => {
  it('shows one label by precedence: digest, then milestone, then diary, then discover', () => {
    statusFor('discover', 'diary', 'milestone', 'digest');
    expect(screen.getByText('Summarizing turn…')).toBeTruthy();
    expect(screen.queryByText('Selecting memories…')).toBeNull();
    expect(screen.queryByText('Writing diary…')).toBeNull();
    expect(screen.queryByText('Describing character…')).toBeNull();
  });

  it('shows the diary over the discover', () => {
    statusFor('discover', 'diary');
    expect(screen.getByText('Writing diary…')).toBeTruthy();
    expect(screen.queryByText('Describing character…')).toBeNull();
  });

  it('shows the discover alone', () => {
    statusFor('discover');
    expect(screen.getByText('Describing character…')).toBeTruthy();
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
