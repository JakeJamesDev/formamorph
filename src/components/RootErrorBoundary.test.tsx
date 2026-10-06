// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { World } from '@/types';

vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(async (value: unknown) => new Blob([JSON.stringify(value)])),
}));

import { downloadBlob } from '@/lib/downloadBlob';
import { serializeJsonBlob } from '@/lib/jsonFileWorkerUtils';
import { holdUnsavedWorld } from '@/lib/unsavedWorld';
import { RootErrorBoundary } from './RootErrorBoundary';

const world = { id: 'w1', version: '1.0.0', worldOverview: { name: 'Sedge Landing' }, locations: [], entities: [] } as unknown as World;

function Boom(): never {
  throw new Error('Render blew up');
}

const renderCrash = () => render(<RootErrorBoundary><Boom /></RootErrorBoundary>);

const clipboard = { writeText: vi.fn() };
const reload = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  holdUnsavedWorld(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  clipboard.writeText.mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, clipboard });
  vi.stubGlobal('location', { ...window.location, reload });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('RootErrorBoundary', () => {
  it('passes children through while nothing throws', () => {
    render(<RootErrorBoundary><p>All well</p></RootErrorBoundary>);

    expect(screen.getByText('All well')).toBeInTheDocument();
  });

  it('shows the crash screen when a component throws during render', () => {
    renderCrash();

    expect(screen.getByRole('heading', { name: 'Formamorph Stopped Working' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Error Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('has no Export World button when no world is held', () => {
    renderCrash();

    expect(screen.queryByRole('button', { name: 'Export World' })).not.toBeInTheDocument();
  });

  it('downloads the held world through Export World', async () => {
    holdUnsavedWorld(() => world);
    renderCrash();

    await userEvent.click(screen.getByRole('button', { name: 'Export World' }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce());
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe('Sedge Landing.json');
    expect(vi.mocked(serializeJsonBlob).mock.calls[0][0]).toMatchObject({ worldOverview: { name: 'Sedge Landing' } });
  });

  it('still shows the screen when reading the held world fails', () => {
    holdUnsavedWorld(() => { throw new Error('corrupt world state'); });
    renderCrash();

    expect(screen.getByRole('heading', { name: 'Formamorph Stopped Working' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export World' })).not.toBeInTheDocument();
  });

  it('says so when the export fails', async () => {
    holdUnsavedWorld(() => world);
    vi.mocked(serializeJsonBlob).mockRejectedValueOnce(new Error('worker died'));
    renderCrash();

    await userEvent.click(screen.getByRole('button', { name: 'Export World' }));

    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't export the world");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('copies the message and the component stack', async () => {
    renderCrash();

    await userEvent.click(screen.getByRole('button', { name: 'Copy Error Details' }));

    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledOnce());
    const text = clipboard.writeText.mock.calls[0][0] as string;
    expect(text).toContain('Render blew up');
    expect(text).toContain('Component stack:');
    expect(text).toMatch(/at Boom/);
    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
  });

  it('says so when the copy fails', async () => {
    clipboard.writeText.mockRejectedValue(new Error('denied'));
    renderCrash();

    await userEvent.click(screen.getByRole('button', { name: 'Copy Error Details' }));

    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't copy the text");
  });

  it('reloads the app', async () => {
    renderCrash();

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(reload).toHaveBeenCalledOnce();
  });
});
