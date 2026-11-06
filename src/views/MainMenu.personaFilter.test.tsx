import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { ENTITY_LIBRARY_FILTER_KEY } from '@/lib/entityLibraryFilter';
import EntityStorageService from '@/services/EntityStorageService';

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), warning: vi.fn(), update: vi.fn(), dismiss: vi.fn() }),
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

const store = (id: string, name: string, persona: boolean) =>
  EntityStorageService.storeEntity({ id, name, data: { id, name, persona } });

beforeEach(async () => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await store('pf-persona', 'Chip Persona', true);
  await store('pf-plain', 'Chip Bystander', false);
});
afterEach(async () => {
  cleanup();
  await EntityStorageService.deleteEntity('pf-persona');
  await EntityStorageService.deleteEntity('pf-plain');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Personas chip in the entity library', () => {
  it('shows only personas while pressed, remembers it, and shows everyone again when released', async () => {
    renderMainMenu();
    await userEvent.click(await screen.findByRole('radio', { name: 'Entities' }));
    await screen.findByText('Chip Bystander');

    const chip = screen.getByRole('button', { name: 'Personas' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.queryByText('Chip Bystander')).toBeNull());
    expect(screen.getByText('Chip Persona')).toBeInTheDocument();
    expect(localStorage.getItem(ENTITY_LIBRARY_FILTER_KEY)).toContain('personas');

    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByText('Chip Bystander')).toBeInTheDocument();
  });
});
