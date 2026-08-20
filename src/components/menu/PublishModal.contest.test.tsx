import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { PublishModal } from './PublishModal';
import WorldStorageService, { CONTEST_ALREADY_ENTERED, CONTEST_NOT_ACTIVE } from '@/services/WorldStorageService';
import PolicyService, { TERMS_REQUIRED } from '@/services/PolicyService';
import type { PublishPayload } from '@/lib/publishPayload';
import type { WorldRecord } from '@/components/WorldDetails';
import type { PolicyState, ServerEvent } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const day = 86_400_000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

const worldPayload: PublishPayload = { kind: 'world', name: 'My World', description: 'd', contentData: {} };
const dictPayload: PublishPayload = { kind: 'dictionary', name: 'My Book', description: '', contentData: {} };

const contest = (over: Partial<ServerEvent> = {}): ServerEvent => ({
  id: 'e1',
  type: 'contest',
  title: 'Summer Isles Contest',
  bannerText: 'Build a world among the isles.',
  body: 'The long version.',
  rulesText: 'One entry per creator.',
  startsAt: at(-2),
  endsAt: at(10),
  cancelledAt: null,
  startMessageId: null,
  endMessageId: null,
  winnerMessageId: null,
  winnerWorldId: null,
  winnerName: null,
  winnerAuthorName: null,
  ...over,
});

const listing = (id: string, name: string, over: Partial<WorldRecord> = {}): WorldRecord =>
  ({ _id: id, name, downloads: 0, ...over });

const NO_POLICIES: PolicyState = { uploadGate: null, tagNotice: null };

const view = (props: { payload?: PublishPayload | null; events?: ServerEvent[]; open?: boolean } = {}) =>
  render(
    <PublishModal
      open={props.open ?? true}
      onOpenChange={() => {}}
      isAuthenticated
      payload={props.payload === undefined ? worldPayload : props.payload}
      events={props.events ?? [contest()]}
    />,
  );

const theSwitch = () => screen.queryByRole('switch');

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(NO_POLICIES);
  vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([]);
  vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('when the contest opt-in is offered', () => {
  it('offers it for a world while a contest is running', async () => {
    view();

    expect(await screen.findByText('Summer Isles Contest')).toBeTruthy();
    expect(theSwitch()).toBeTruthy();
  });

  it('is absent for a kind contests do not take', async () => {
    view({ payload: dictPayload });

    await screen.findByText('Publish Dictionary');
    expect(screen.queryByText('Summer Isles Contest')).toBeNull();
    expect(theSwitch()).toBeNull();
  });

  it('is absent when no event is running', async () => {
    view({ events: [] });

    await screen.findByText('Publish World');
    expect(theSwitch()).toBeNull();
  });

  it('is absent when the only running event is an announcement', async () => {
    view({ events: [contest({ type: 'announcement' })] });

    await screen.findByText('Publish World');
    expect(theSwitch()).toBeNull();
  });

  it('is absent for a contest whose window has closed, even if the poll still lists it', async () => {
    view({ events: [contest({ startsAt: at(-20), endsAt: at(-1) })] });

    await screen.findByText('Publish World');
    expect(theSwitch()).toBeNull();
  });

  it('is absent once an existing listing is picked to be replaced', async () => {
    // Entering happens at publish time: a flag on an overwrite would mean moving a listing that is
    // already out there into the contest, which nothing supports.
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([listing('w1', 'Salt-Bright Reaches')]);
    view();

    expect(await screen.findByRole('switch')).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Salt-Bright Reaches (w1, 0 downloads)'));

    expect(theSwitch()).toBeNull();
  });
});

describe('what the switch sends', () => {
  it('sends no contest with the switch left alone', async () => {
    view();

    await screen.findByRole('switch');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(WorldStorageService.publishItem).toHaveBeenCalledWith(worldPayload, null, null);
  });

  it('sends the running contest once armed', async () => {
    view();

    await userEvent.click(await screen.findByRole('switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish & Enter' }));

    expect(WorldStorageService.publishItem).toHaveBeenCalledWith(worldPayload, null, 'e1');
  });

  it('sends no contest when the armed switch is turned back off', async () => {
    view();

    const control = await screen.findByRole('switch');
    await userEvent.click(control);
    await userEvent.click(control);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(WorldStorageService.publishItem).toHaveBeenCalledWith(worldPayload, null, null);
  });

  it('sends no contest when an overwrite target is picked after arming it', async () => {
    // The card hides on that pick, but the state behind it survives — the request must not.
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([listing('w1', 'Salt-Bright Reaches')]);
    view();

    await userEvent.click(await screen.findByRole('switch'));
    await userEvent.click(screen.getByLabelText('Salt-Bright Reaches (w1, 0 downloads)'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(WorldStorageService.publishItem).toHaveBeenCalledWith(worldPayload, 'w1', null);
  });

  it('forgets an armed switch when the modal is reopened', async () => {
    // The modal is mounted for the app's lifetime: anything not reset on open enters the *next* world
    // into a contest its author never opted it into.
    const { rerender } = view();
    await userEvent.click(await screen.findByRole('switch'));

    rerender(<PublishModal open={false} onOpenChange={() => {}} isAuthenticated payload={worldPayload} events={[contest()]} />);
    rerender(<PublishModal open onOpenChange={() => {}} isAuthenticated payload={worldPayload} events={[contest()]} />);

    const control = await screen.findByRole('switch');
    expect(control.getAttribute('aria-checked')).toBe('false');

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(WorldStorageService.publishItem).toHaveBeenCalledWith(worldPayload, null, null);
  });

  it('still enters after the upload gate is accepted mid-publish', async () => {
    // The gate replays the whole publish once accepted. An entry carried in the click's closure would be
    // lost on that trip and the world would publish outside the contest with the switch still on.
    vi.mocked(WorldStorageService.publishItem)
      .mockRejectedValueOnce(Object.assign(new Error('terms'), { code: TERMS_REQUIRED }))
      .mockResolvedValue({});
    vi.spyOn(PolicyService, 'acceptUploadGate').mockResolvedValue();
    // Accepted as far as this client knows: the server raised the gate after the modal read its state,
    // which is the path that replays the publish rather than stopping it before one is attempted.
    vi.mocked(PolicyService.fetchPolicies).mockResolvedValue({
      uploadGate: { title: 'Contributor terms', body: 'Be excellent.', tags: [], accepted: true },
      tagNotice: null,
    });

    view();
    await userEvent.click(await screen.findByRole('switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish & Enter' }));

    await screen.findByText('Contributor terms');
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(2));
    expect(WorldStorageService.publishItem).toHaveBeenLastCalledWith(worldPayload, null, 'e1');
  });
});

describe('an author who already has an entry', () => {
  it('is told which listing holds their slot instead of being offered the switch', async () => {
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([
      listing('w1', 'Salt-Bright Reaches', { contest_event_id: 'e1' }),
    ]);
    view();

    expect(await screen.findByText(/You already entered Salt-Bright Reaches/)).toBeTruthy();
    expect(theSwitch()).toBeNull();
  });

  it('is still offered the switch when their only entry is in an older contest', async () => {
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([
      listing('w1', 'Salt-Bright Reaches', { contest_event_id: 'last-winter' }),
    ]);
    view();

    expect(await screen.findByRole('switch')).toBeTruthy();
    expect(screen.queryByText(/You already entered/)).toBeNull();
  });
});

describe('when the server refuses the entry', () => {
  it('says so beside the contest rather than in a toast', async () => {
    vi.mocked(WorldStorageService.publishItem).mockRejectedValue(
      Object.assign(new Error('You have already entered "Salt-Bright Reaches" in Summer Isles Contest.'), {
        code: CONTEST_ALREADY_ENTERED,
      }),
    );
    view();

    await userEvent.click(await screen.findByRole('switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish & Enter' }));

    expect(await screen.findByText(/already entered "Salt-Bright Reaches"/)).toBeTruthy();
    expect(theSwitch()).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says so when the contest it named is no longer taking entries', async () => {
    vi.mocked(WorldStorageService.publishItem).mockRejectedValue(
      Object.assign(new Error('That contest is not taking entries.'), { code: CONTEST_NOT_ACTIVE }),
    );
    view();

    await userEvent.click(await screen.findByRole('switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish & Enter' }));

    expect(await screen.findByText('That contest is not taking entries.')).toBeTruthy();
    expect(theSwitch()).toBeNull();
  });
});

describe('the rules behind the switch', () => {
  it('opens and closes without taking the publish dialog with it', async () => {
    // A popup rendered inside this modal's own root once left both dialogs stuck at `data-state="closed"`
    // — which is why the policy popups are siblings of it. This one is nested, so it says so out loud.
    view();

    await userEvent.click(await screen.findByRole('button', { name: 'Contest rules' }));
    expect(await screen.findByText('One entry per creator.')).toBeTruthy();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('One entry per creator.')).toBeNull());

    // The publish dialog is still there, and still works.
    await userEvent.click(await screen.findByRole('switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish & Enter' }));
    expect(WorldStorageService.publishItem).toHaveBeenCalledWith(worldPayload, null, 'e1');
  });
});
