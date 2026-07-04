import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StartingLocationModal from './StartingLocationModal';
import type { GameLocation } from '@/types';

const locations: GameLocation[] = [
  { id: 'harbor', name: 'Harbor', isStarting: true, playerDescription: 'A salty dock.' },
  { id: 'keep', name: 'Old Keep', isStarting: true },
];

describe('StartingLocationModal', () => {
  it('lists Random plus each starting location', () => {
    render(<StartingLocationModal locations={locations} onConfirm={() => {}} onAbort={() => {}} />);
    expect(screen.getByText('Random')).toBeTruthy();
    expect(screen.getByText('Harbor')).toBeTruthy();
    expect(screen.getByText('Old Keep')).toBeTruthy();
    expect(screen.getByText('A salty dock.')).toBeTruthy();
  });

  it('confirms with null when Random (the default) is chosen', () => {
    const onConfirm = vi.fn();
    render(<StartingLocationModal locations={locations} onConfirm={onConfirm} onAbort={() => {}} />);
    fireEvent.click(screen.getByText('Start'));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('confirms with the location id when one is picked', () => {
    const onConfirm = vi.fn();
    render(<StartingLocationModal locations={locations} onConfirm={onConfirm} onAbort={() => {}} />);
    fireEvent.click(screen.getByText('Old Keep'));
    fireEvent.click(screen.getByText('Start'));
    expect(onConfirm).toHaveBeenCalledWith('keep');
  });

  it('aborts via the Abort button', () => {
    const onAbort = vi.fn();
    render(<StartingLocationModal locations={locations} onConfirm={() => {}} onAbort={onAbort} />);
    fireEvent.click(screen.getByText('Abort'));
    expect(onAbort).toHaveBeenCalled();
  });
});
