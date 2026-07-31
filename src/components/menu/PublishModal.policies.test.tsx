import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PublishModal } from './PublishModal';
import PolicyService from '@/services/PolicyService';
import WorldStorageService from '@/services/WorldStorageService';
import type { PolicyState } from '@/types';
import type { PublishPayload } from '@/lib/publishPayload';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="markdown">{text}</div>,
}));

const payload: PublishPayload = {
  kind: 'world',
  name: 'A World',
  description: 'Blurb.',
  contentData: { worldOverview: { name: 'A World', tags: ['Mature'] } },
};

const GATE: PolicyState = {
  uploadGate: { title: 'Contributor terms', body: 'Be excellent.', tags: [], accepted: false },
  tagNotice: null,
};

const NOTICE: PolicyState = {
  uploadGate: null,
  tagNotice: { title: 'Tagged content', body: 'Take care.', tags: ['mature'] },
};

const NOTHING: PolicyState = { uploadGate: null, tagNotice: null };

const stubPolicies = (state: PolicyState) =>
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(state);

/** The modal fetches the user's overwrite targets whenever it opens. */
const stubListings = () =>
  vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([]);

const renderModal = () =>
  render(<PublishModal open onOpenChange={() => {}} isAuthenticated payload={payload} />);

const publishButton = () => screen.getByRole('button', { name: 'Publish' });

/**
 * Click a button inside a named popup, once that popup is on screen.
 *
 * Scoped on purpose: the publish modal has its own Cancel, and querying globally can resolve to it in
 * the moment before the popup mounts — the click then lands on the wrong dialog and the test passes or
 * fails for reasons that have nothing to do with the popup.
 */
const clickIn = async (popupTitle: string, buttonName: string) => {
  await screen.findByText(popupTitle);
  const popup = [...document.querySelectorAll('[role=dialog]')]
    .find((d) => d.querySelector('h2')?.textContent === popupTitle);
  if (!popup) throw new Error(`popup "${popupTitle}" not found`);

  const button = [...popup.querySelectorAll('button')].find((b) => b.textContent === buttonName);
  if (!button) throw new Error(`button "${buttonName}" not in "${popupTitle}"`);

  fireEvent.click(button);
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  stubListings();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('with no policy authored', () => {
  it('publishes straight away', async () => {
    stubPolicies(NOTHING);
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());

    await waitFor(() => expect(publish).toHaveBeenCalled());
  });

  it('publishes even when the policy fetch fails', async () => {
    // Fail open: the server is the gate, so an unreadable policy endpoint must not block anyone.
    vi.spyOn(PolicyService, 'fetchPolicies').mockRejectedValue(new Error('offline'));
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    fireEvent.click(publishButton());

    await waitFor(() => expect(publish).toHaveBeenCalled());
  });
});

describe('the upload gate', () => {
  it('interrupts the publish', async () => {
    stubPolicies(GATE);
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());

    expect(await screen.findByText('Contributor terms')).toBeTruthy();
    expect(publish).not.toHaveBeenCalled();
  });

  it('records the acceptance and then publishes', async () => {
    stubPolicies(GATE);
    const accept = vi.spyOn(PolicyService, 'acceptUploadGate').mockResolvedValue();
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());
    await clickIn('Contributor terms', 'Accept');

    await waitFor(() => expect(accept).toHaveBeenCalled());
    await waitFor(() => expect(publish).toHaveBeenCalled());
  });

  it('does not publish when declined', async () => {
    stubPolicies(GATE);
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());
    await clickIn('Contributor terms', 'Decline');

    // The title survives in the blocked notice, so the dialog's own button is what proves it closed.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull());
    expect(publish).not.toHaveBeenCalled();
  });

  it('records the refusal on the server', async () => {
    // The gate blocks an unanswered user anyway; this is what lets an admin tell a refusal from silence.
    stubPolicies(GATE);
    const decline = vi.spyOn(PolicyService, 'declineUploadGate').mockResolvedValue(undefined);

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());
    await clickIn('Contributor terms', 'Decline');

    await waitFor(() => expect(decline).toHaveBeenCalled());
  });

  it('still blocks locally when recording the refusal fails', async () => {
    stubPolicies(GATE);
    vi.spyOn(PolicyService, 'declineUploadGate').mockRejectedValue(new Error('offline'));

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());
    await clickIn('Contributor terms', 'Decline');

    expect(await screen.findByText(/You declined these terms/)).toBeTruthy();
  });

  it('shows a short blocked notice after declining, not the wall again', async () => {
    stubPolicies(GATE);

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());
    await clickIn('Contributor terms', 'Decline');

    expect(await screen.findByText(/You declined these terms/)).toBeTruthy();
    expect(publishButton().hasAttribute('disabled')).toBe(true);
  });

  it('reopens the full terms from the blocked notice', async () => {
    stubPolicies(GATE);

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());
    await clickIn('Contributor terms', 'Decline');
    fireEvent.click(await screen.findByRole('button', { name: 'Review the terms' }));

    expect(await screen.findByRole('button', { name: 'Accept' })).toBeTruthy();
  });

  it('remembers the refusal across a remount', async () => {
    stubPolicies(GATE);

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());
    await clickIn('Contributor terms', 'Decline');
    cleanup();

    renderModal();

    expect(await screen.findByText(/You declined these terms/)).toBeTruthy();
  });

  it('never appears once accepted', async () => {
    stubPolicies({ ...GATE, uploadGate: { ...GATE.uploadGate!, accepted: true } });
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());

    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
  });

  it('reopens when the server refuses a publish it thought was allowed', async () => {
    // An admin can reset an acceptance after this modal read its state; the server is the authority.
    stubPolicies({ ...GATE, uploadGate: { ...GATE.uploadGate!, accepted: true } });
    const refused = Object.assign(new Error('Terms required'), { code: 'TERMS_REQUIRED' });
    vi.spyOn(WorldStorageService, 'publishItem').mockRejectedValue(refused);

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());

    expect(await screen.findByRole('button', { name: 'Accept' })).toBeTruthy();
  });
});

describe('the tag notice', () => {
  it('interrupts a publish carrying a listed tag', async () => {
    stubPolicies(NOTICE);
    vi.spyOn(PolicyService, 'matchTags').mockResolvedValue(['mature']);
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());

    expect(await screen.findByText('Tagged content')).toBeTruthy();
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes on Continue', async () => {
    stubPolicies(NOTICE);
    vi.spyOn(PolicyService, 'matchTags').mockResolvedValue(['mature']);
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());
    await clickIn('Tagged content', 'Continue');

    await waitFor(() => expect(publish).toHaveBeenCalled());
  });

  it('abandons only this upload on Cancel', async () => {
    stubPolicies(NOTICE);
    vi.spyOn(PolicyService, 'matchTags').mockResolvedValue(['mature']);
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());
    await clickIn('Tagged content', 'Cancel');

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull());
    expect(publish).not.toHaveBeenCalled();
    // Nothing is blocked — they can publish again.
    expect(publishButton().hasAttribute('disabled')).toBe(false);
  });

  it('stays out of the way when no tag matches', async () => {
    stubPolicies(NOTICE);
    vi.spyOn(PolicyService, 'matchTags').mockResolvedValue([]);
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());

    await waitFor(() => expect(publish).toHaveBeenCalled());
  });

  it('publishes anyway when the tag check fails', async () => {
    // Advisory only: a broken check must never stop an upload the server would have accepted.
    stubPolicies(NOTICE);
    vi.spyOn(PolicyService, 'matchTags').mockRejectedValue(new Error('offline'));
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());

    await waitFor(() => expect(publish).toHaveBeenCalled());
  });

  it('sends the payload tags to be matched', async () => {
    stubPolicies(NOTICE);
    const matchTags = vi.spyOn(PolicyService, 'matchTags').mockResolvedValue([]);
    vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());

    await waitFor(() => expect(matchTags).toHaveBeenCalledWith(['Mature']));
  });
});

describe('both popups at once', () => {
  it('asks for the terms first, then the tag notice', async () => {
    stubPolicies({ uploadGate: GATE.uploadGate, tagNotice: NOTICE.tagNotice });
    vi.spyOn(PolicyService, 'acceptUploadGate').mockResolvedValue();
    vi.spyOn(PolicyService, 'matchTags').mockResolvedValue(['mature']);
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());

    expect(await screen.findByText('Contributor terms')).toBeTruthy();
    await clickIn('Contributor terms', 'Accept');

    expect(await screen.findByText('Tagged content')).toBeTruthy();
    expect(publish).not.toHaveBeenCalled();

    await clickIn('Tagged content', 'Continue');
    await waitFor(() => expect(publish).toHaveBeenCalled());
  });

  it('leaves the acceptance standing when the tag notice is cancelled', async () => {
    // Agreeing to the terms and going through with this upload are separate outcomes.
    stubPolicies({ uploadGate: GATE.uploadGate, tagNotice: NOTICE.tagNotice });
    const accept = vi.spyOn(PolicyService, 'acceptUploadGate').mockResolvedValue();
    vi.spyOn(PolicyService, 'matchTags').mockResolvedValue(['mature']);
    const publish = vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});

    renderModal();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(publishButton());
    await clickIn('Contributor terms', 'Accept');
    await clickIn('Tagged content', 'Cancel');

    expect(accept).toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();

    // The gate is behind them: publishing again goes straight to the tag notice.
    fireEvent.click(publishButton());
    expect(await screen.findByText('Tagged content')).toBeTruthy();
  });
});
