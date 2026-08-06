import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishModal } from './PublishModal';
import WorldStorageService from '@/services/WorldStorageService';
import type { PublishPayload } from '@/lib/publishPayload';
import { type WorldRecord } from '@/components/WorldDetails';

const worldPayload: PublishPayload = { kind: 'world', name: 'My World', description: 'd', contentData: {} };
const dictPayload: PublishPayload = { kind: 'dictionary', name: 'My Book', description: '', contentData: {} };

const listing = (id: string, name: string) => ({ _id: id, name, downloads: 0 });

beforeEach(() => {
  vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/** Render the modal the way MainMenu does: mounted permanently, opened by a prop. */
const view = (props: { open: boolean; payload: PublishPayload | null }) =>
  render(<PublishModal open={props.open} onOpenChange={() => {}} isAuthenticated payload={props.payload} />);

describe('PublishModal target selection', () => {
  it('publishes as new by default', async () => {
    vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([listing('w1', 'Existing World')]);
    view({ open: true, payload: worldPayload });

    await screen.findByText('Existing World (w1, 0 downloads)');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    // null target = POST a new listing, not a PUT over an existing one.
    expect(WorldStorageService.publishItem).toHaveBeenCalledWith(worldPayload, null);
  });

  it('publishes over the listing you picked', async () => {
    vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([listing('w1', 'Existing World')]);
    view({ open: true, payload: worldPayload });

    await userEvent.click(await screen.findByLabelText('Existing World (w1, 0 downloads)'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(WorldStorageService.publishItem).toHaveBeenCalledWith(worldPayload, 'w1');
  });

  it('drops a target picked for a previous publish when reopened for another kind', async () => {
    // The modal is mounted for the app's lifetime, so its state outlives a close. Without a reset on open,
    // a world target stayed selected into a dictionary publish and PUT the book over the world.
    vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([listing('w1', 'Existing World')]);
    const { rerender } = view({ open: true, payload: worldPayload });

    await userEvent.click(await screen.findByLabelText('Existing World (w1, 0 downloads)'));

    // Close, then reopen for a dictionary — the old world listing must not still be the target.
    rerender(<PublishModal open={false} onOpenChange={() => {}} isAuthenticated payload={worldPayload} />);
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([]);
    rerender(<PublishModal open onOpenChange={() => {}} isAuthenticated payload={dictPayload} />);

    await screen.findByText('Publish Dictionary');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(WorldStorageService.publishItem).toHaveBeenCalledWith(dictPayload, null);
    expect(WorldStorageService.publishItem).not.toHaveBeenCalledWith(dictPayload, 'w1');
  });

  it('drops a stale target before the new listings load, not after', async () => {
    // The window that made this a data-loss bug: a target is already picked from a previous publish, the
    // modal reopens for another kind, and the user clicks Publish before the network answers. The reset
    // has to be synchronous with the open — doing it once the fetch resolves leaves the old target armed
    // for the whole round-trip, and forever if the request fails.
    vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([listing('w1', 'Existing World')]);
    const { rerender } = view({ open: true, payload: worldPayload });

    // Pollute the state exactly as a real prior publish would.
    await userEvent.click(await screen.findByLabelText('Existing World (w1, 0 downloads)'));
    rerender(<PublishModal open={false} onOpenChange={() => {}} isAuthenticated payload={worldPayload} />);

    // Reopen for a dictionary with the listings request still in flight.
    vi.mocked(WorldStorageService.getUserWorlds).mockImplementation(() => new Promise(() => {}));
    rerender(<PublishModal open onOpenChange={() => {}} isAuthenticated payload={dictPayload} />);

    await screen.findByText('Publish Dictionary');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    // The world 'w1' must not be the target of a dictionary publish.
    expect(WorldStorageService.publishItem).toHaveBeenCalledWith(dictPayload, null);
    expect(WorldStorageService.publishItem).not.toHaveBeenCalledWith(dictPayload, 'w1');
  });

  it('ignores a slower response for a kind that is no longer open', async () => {
    // A world's request resolving after a character's would otherwise fill the character dialog with
    // worlds — making every row a wrong-kind overwrite target.
    let resolveWorlds: (v: WorldRecord[]) => void = () => {};
    vi.spyOn(WorldStorageService, 'getUserWorlds').mockImplementation((kind) =>
      kind === 'world'
        ? new Promise<WorldRecord[]>((r) => { resolveWorlds = r; })
        : Promise.resolve([]));

    const { rerender } = view({ open: true, payload: worldPayload });
    rerender(<PublishModal open onOpenChange={() => {}} isAuthenticated payload={dictPayload} />);
    await screen.findByText('Publish Dictionary');

    // The world request lands late, after the dialog has moved on to dictionaries.
    await act(async () => {
      resolveWorlds([listing('w1', 'Existing World')]);
      await Promise.resolve(); // let the late setState flush before asserting it did nothing
    });

    // Asserted after the flush: a bare `waitFor` on an absence passes on its first check, before the
    // update it's meant to catch has even landed.
    expect(screen.queryByText(/Existing World/)).not.toBeInTheDocument();
  });
});

// Warn, never block: a publish carrying an expiring link must still be publishable — the author may know,
// or may be publishing a draft. This is the one place the breakage lands on other people, so it says so.
describe('PublishModal expiring-link warning', () => {
  const withImages = (contentData: unknown): PublishPayload =>
    ({ kind: 'world', name: 'W', description: '', contentData });

  beforeEach(() => { vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([]); });

  it('warns when a world links a Discord attachment', async () => {
    view({ open: true, payload: withImages({
      worldOverview: { thumbnail: 'https://cdn.discordapp.com/attachments/1/2/a.png' },
    }) });

    expect(await screen.findByText(/stop working/i)).toBeTruthy();
  });

  it('counts every expiring link, across entities and locations', async () => {
    view({ open: true, payload: withImages({
      worldOverview: { thumbnail: 'https://cdn.discordapp.com/attachments/1/2/a.png' },
      entities: [{ id: 'e', name: 'E', images: ['https://cdn.discordapp.com/attachments/1/2/b.png'] }],
      locations: [{ id: 'l', name: 'L', backgroundImage: 'https://media.discordapp.net/attachments/1/2/c.png' }],
    }) });

    expect(await screen.findByText(/3 images use/i)).toBeTruthy();
  });

  it('stays silent for an ordinary linked image', async () => {
    view({ open: true, payload: withImages({
      worldOverview: { thumbnail: 'https://files.catbox.moe/a.png' },
    }) });

    await screen.findByRole('button', { name: 'Publish' });
    expect(screen.queryByText(/stop working/i)).toBeNull();
  });

  it('still lets the publish through', async () => {
    view({ open: true, payload: withImages({
      worldOverview: { thumbnail: 'https://cdn.discordapp.com/attachments/1/2/a.png' },
    }) });
    await screen.findByText(/stop working/i);

    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish.hasAttribute('disabled')).toBe(false);
    await userEvent.click(publish);

    expect(WorldStorageService.publishItem).toHaveBeenCalled();
  });
});
