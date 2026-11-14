// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RootCrashScreen } from './RootCrashScreen';
import { holdUnsavedWorld } from '@/lib/unsavedWorld';
import { downloadBlob } from '@/lib/downloadBlob';
import type { World } from '@/types';

vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/lib/worldFile', () => ({ serializeWorldFile: vi.fn(async () => new Blob(['{}'])) }));

const world = { worldOverview: { name: 'Fen' } } as unknown as World;

afterEach(() => {
  cleanup();
  holdUnsavedWorld(null);
  vi.mocked(downloadBlob).mockClear();
});

describe('RootCrashScreen', () => {
  it('exports a plain world with unsaved edits', async () => {
    holdUnsavedWorld(() => world);
    render(<RootCrashScreen error={new Error('x')} componentStack="" />);

    fireEvent.click(screen.getByRole('button', { name: 'Export World' }));
    await vi.waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Fen.json'));
  });

  it('shows Export World disabled, with the reason as text, for a Supporter Copy', () => {
    holdUnsavedWorld(() => world, { reason: "You can't export a Supporter world" });
    render(<RootCrashScreen error={new Error('x')} componentStack="" />);

    const button = screen.getByRole('button', { name: 'Export World' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(screen.getByText("You can't export a Supporter world, so your unsaved edits will be lost. Reload the app to continue.")).toBeTruthy();
  });

  it('offers only Reload while the world’s marker is unread', () => {
    holdUnsavedWorld(() => world, { reason: null });
    render(<RootCrashScreen error={new Error('x')} componentStack="" />);

    expect(screen.queryByRole('button', { name: 'Export World' })).toBeNull();
    expect(screen.getByText('Reload the app to continue.')).toBeTruthy();
  });
});
