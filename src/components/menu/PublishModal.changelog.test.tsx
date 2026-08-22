import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishModal } from './PublishModal';
import WorldStorageService from '@/services/WorldStorageService';
import PolicyService from '@/services/PolicyService';
import type { PublishPayload } from '@/lib/publishPayload';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ChangelogEntry } from '@/lib/listingChangelog';
import type { PolicyState } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// jsdom can't drive a real Lexical selection; the editor is stubbed to a textarea so it can be filled.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: {
    value: string; onChange: (v: string) => void; ariaLabel?: string;
  }) => <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />,
}));

/**
 * Writing a changelog entry as part of publishing an update.
 *
 * Three rules meet here. Only an update gets the ask, because a first publish has no history to add to.
 * The ask is optional throughout, because a one-line fix should not have to be written up before it can
 * go out. And nothing is sent until the update itself is up — a refused publish must leave what the
 * author wrote exactly where it was.
 */

const payload: PublishPayload = { kind: 'world', name: 'Sedge Landing', description: 'd', contentData: {} };

const listing = (id: string, name: string): WorldRecord => ({ _id: id, name, downloads: 0 });

const NO_POLICIES: PolicyState = { uploadGate: null, tagNotice: null };

const entryRow = (): ChangelogEntry => ({
  id: 'e1',
  world_id: 'w1',
  title: 'Update 1',
  body: 'Something changed.',
  entry_date: '2026-08-01',
  created_at: '2026-08-01T12:00:00.000Z',
  updated_at: '2026-08-01T12:00:00.000Z',
});

const view = () =>
  render(
    <PublishModal
      open
      onOpenChange={() => {}}
      isAuthenticated
      payload={payload}
      events={[]}
    />,
  );

/** Pick the author's existing listing as the thing being replaced. */
const chooseUpdate = async (name = 'Sedge Landing (w1, 0 downloads)') => {
  const user = userEvent.setup();
  await user.click(await screen.findByLabelText(name));
  return user;
};

const describeButton = () => screen.queryByRole('button', { name: /describe what changed/i });

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(NO_POLICIES);
  vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([listing('w1', 'Sedge Landing')]);
  vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({ _id: 'w1' });
  vi.spyOn(WorldStorageService, 'linkWorldToListing').mockResolvedValue();
  vi.spyOn(WorldStorageService, 'fetchChangelog').mockResolvedValue([]);
  vi.spyOn(WorldStorageService, 'createChangelogEntry').mockResolvedValue(entryRow());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('when the changelog ask appears', () => {
  it('is absent while publishing as new, which has no history to add to', async () => {
    view();

    await screen.findByLabelText('Publish as new world');
    expect(describeButton()).toBeNull();
    expect(WorldStorageService.fetchChangelog).not.toHaveBeenCalled();
  });

  it('appears once an existing listing is picked', async () => {
    view();

    await chooseUpdate();

    expect(await screen.findByRole('button', { name: /describe what changed/i })).toBeInTheDocument();
  });

  it('asks the server once, not once per listing clicked', async () => {
    // The answer is about the deploy, not about the listing, while the question rides the single-listing
    // endpoint — which serves the thumbnail as a base64 data-URI (up to 5MB). Clicking down the list
    // would otherwise download a thumbnail per row to learn one boolean over and over.
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([
      listing('w1', 'Sedge Landing'), listing('w2', 'Marrow Hill'), listing('w3', 'The Cold Ford'),
    ]);
    view();
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText('Sedge Landing (w1, 0 downloads)'));
    await user.click(screen.getByLabelText('Marrow Hill (w2, 0 downloads)'));
    await user.click(screen.getByLabelText('The Cold Ford (w3, 0 downloads)'));

    await waitFor(() => expect(describeButton()).toBeInTheDocument());
    expect(WorldStorageService.fetchChangelog).toHaveBeenCalledTimes(1);
  });

  it('stays away against a server that does not keep changelogs', async () => {
    // The publish itself is unaffected — the section simply is not there, as the details window's tab
    // is not there.
    vi.spyOn(WorldStorageService, 'fetchChangelog').mockResolvedValue(null);
    view();

    await chooseUpdate();

    await waitFor(() => expect(WorldStorageService.fetchChangelog).toHaveBeenCalledWith('w1'));
    expect(describeButton()).toBeNull();
  });
});

describe('what happens to the entry', () => {
  it('publishes without one when the author skips it', async () => {
    view();
    const user = await chooseUpdate();

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalled());
    expect(WorldStorageService.createChangelogEntry).not.toHaveBeenCalled();
  });

  it('holds the draft until the update is really up, then attaches it', async () => {
    view();
    const user = await chooseUpdate();

    await user.click(await screen.findByRole('button', { name: /describe what changed/i }));
    await user.type(screen.getByLabelText('Title'), 'Update 1');
    await user.type(screen.getByLabelText('What changed'), 'The ferry runs again.');
    await user.click(screen.getByRole('button', { name: 'Attach to Update' }));

    // Written, but not sent — the update has not gone out yet.
    expect(await screen.findByText('Update 1')).toBeInTheDocument();
    expect(WorldStorageService.createChangelogEntry).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.createChangelogEntry).toHaveBeenCalledWith(
      'w1', expect.objectContaining({ title: 'Update 1', body: 'The ferry runs again.' }),
    ));
  });

  it('sends nothing when the publish itself is refused', async () => {
    // Story 5 in reverse: a failed upload must not leave an entry claiming changes nobody received.
    vi.spyOn(WorldStorageService, 'publishItem').mockRejectedValue(new Error('Server said no'));
    view();
    const user = await chooseUpdate();

    await user.click(await screen.findByRole('button', { name: /describe what changed/i }));
    await user.type(screen.getByLabelText('Title'), 'Update 1');
    await user.type(screen.getByLabelText('What changed'), 'The ferry runs again.');
    await user.click(screen.getByRole('button', { name: 'Attach to Update' }));
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(screen.getByText('Server said no')).toBeInTheDocument());
    expect(WorldStorageService.createChangelogEntry).not.toHaveBeenCalled();
    // And the draft is still there to publish again with.
    expect(screen.getByText('Update 1')).toBeInTheDocument();
  });

  it('lets the author take the draft back off', async () => {
    view();
    const user = await chooseUpdate();

    await user.click(await screen.findByRole('button', { name: /describe what changed/i }));
    await user.type(screen.getByLabelText('Title'), 'Update 1');
    await user.type(screen.getByLabelText('What changed'), 'The ferry runs again.');
    await user.click(screen.getByRole('button', { name: 'Attach to Update' }));
    await user.click(await screen.findByRole('button', { name: 'Remove' }));

    expect(describeButton()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalled());
    expect(WorldStorageService.createChangelogEntry).not.toHaveBeenCalled();
  });
});
