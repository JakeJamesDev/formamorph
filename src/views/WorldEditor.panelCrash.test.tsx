import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { benchEditorWorld, clickOpenBench, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { ErrorDetailsHost } from '@/components/ErrorDetailsDialog';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';
import { closeErrorDetails } from '@/lib/errorDetails';

/**
 * A crash in one editor panel shows the card in that panel only, through the real editor under the real
 * root boundary. What matters is what the author still has afterward: the tree, the tabs, their edits.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

// The entity detail panel throws while `fault` is set; otherwise it is the real panel.
const fault = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock('@/managers/EntityManager', async (importOriginal) => {
  const { default: Real } = await importOriginal<typeof import('@/managers/EntityManager')>();
  return {
    default: (props: React.ComponentProps<typeof Real>) => {
      if (fault.error) throw fault.error;
      return <Real {...props} />;
    },
  };
});

// The Test Bench panel throws while `benchFault` is set; otherwise it is the real panel.
const benchFault = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock('@/components/editor/TestBench', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/editor/TestBench')>();
  return {
    ...real,
    TestBench: (props: React.ComponentProps<typeof real.TestBench>) => {
      if (benchFault.error) throw benchFault.error;
      return <real.TestBench {...props} />;
    },
  };
});

const WORLD = benchEditorWorld({
  entities: [
    { id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.', locations: ['harbor'] },
    { id: 'e2', name: 'Marsh Tom', aiDescription: 'A ferryman.', locations: ['harbor'] },
  ],
});

const CARD = { name: 'This Panel Stopped Working' };
const wrap = (tree: ReactNode) => (
  <RootErrorBoundary>
    {tree}
    <ErrorDetailsHost />
  </RootErrorBoundary>
);
const setup = () => renderWorldEditorBench(WORLD, 'advanced', {}, wrap);
const selectEntity = (name: string) => {
  openEditorTab(/Entities/);
  fireEvent.click(screen.getByText(name));
};
const cardShown = () => screen.queryByRole('heading', CARD) !== null;

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  fault.error = null;
  benchFault.error = null;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  closeErrorDetails();
  errorSpy.mockRestore();
});

describe('WorldEditor — a crashed panel', () => {
  it('shows the card in the detail panel while the tree and the tabs keep working', () => {
    const editor = setup();
    fault.error = new Error('Entity panel blew up');

    selectEntity('Wren');

    expect(cardShown()).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Formamorph Stopped Working' })).not.toBeInTheDocument();
    expect(screen.getByText('Marsh Tom')).toBeInTheDocument();
    openEditorTab(/^Locations$/);
    expect(screen.getByText('Harbor Steps')).toBeInTheDocument();
    expect(editor.ctx().entities.map((e) => e.name)).toEqual(['Wren', 'Marsh Tom']);
  });

  it('remounts the panel on Try Again, and keeps an edit made before the crash', () => {
    const editor = setup();
    selectEntity('Wren');
    act(() => { editor.ctx().updateEntity({ ...editor.ctx().entities[0], name: 'Wren of the Fen' }); });
    fault.error = new Error('Entity panel blew up');
    selectEntity('Marsh Tom');
    expect(cardShown()).toBe(true);

    fault.error = null;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(cardShown()).toBe(false);
    expect(screen.getByRole('tablist', { name: 'Entity Fields' })).toBeInTheDocument();
    expect(editor.ctx().entities.map((e) => e.name)).toEqual(['Wren of the Fen', 'Marsh Tom']);
  });

  it("opens the Error Details dialog on the panel's error from View Details", async () => {
    setup();
    fault.error = new Error('Entity panel blew up');
    selectEntity('Wren');

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    const dialog = await screen.findByRole('dialog', { name: 'Error Details' });
    expect(dialog).toHaveTextContent('Entity panel blew up');
  });

  it('clears the card when the author selects an item that renders', () => {
    setup();
    fault.error = new Error('Entity panel blew up');
    selectEntity('Wren');
    expect(cardShown()).toBe(true);

    fault.error = null;
    selectEntity('Marsh Tom');

    expect(cardShown()).toBe(false);
    expect(screen.getByRole('tablist', { name: 'Entity Fields' })).toBeInTheDocument();
  });

  it('shows the card in the Test Bench, keeps the flask, and brings the Bench back on Try Again', async () => {
    setup();
    benchFault.error = new Error('Bench blew up');
    await clickOpenBench();

    expect(cardShown()).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Formamorph Stopped Working' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Test Bench/ })).toBeInTheDocument();

    benchFault.error = null;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(cardShown()).toBe(false);
    expect(screen.getByRole('button', { name: 'Close Test Bench' })).toBeInTheDocument();
  });
});
