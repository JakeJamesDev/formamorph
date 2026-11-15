import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishModal } from './PublishModal';
import WorldStorageService from '@/services/WorldStorageService';
import PolicyService from '@/services/PolicyService';
import AuthService from '@/services/AuthService';
import { buildPublishBody } from '@/lib/publishBody';
import type { PublishPayload } from '@/lib/publishPayload';
import type { WorldRecord } from '@/components/WorldDetails';
import { daysFrom, serverEvent } from '@/test/serverEvents';
import type { PolicyState } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const mascot: PublishPayload = { kind: 'mascot', name: 'Captain', description: '', contentData: { images: [] } };
const world: PublishPayload = { kind: 'world', name: 'My World', description: 'd', contentData: {} };
const dictionary: PublishPayload = { kind: 'dictionary', name: 'Terms', description: 'd', contentData: {} };
const NO_POLICIES: PolicyState = { uploadGate: null, tagNotice: null, privacyPolicy: null };
const listing = (id: string, name: string): WorldRecord => ({ _id: id, name, downloads: 0 });

const signInAs = (accountType: string) =>
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u1', username: 'staff', accountType });

const view = (payload: PublishPayload = mascot, open = true) => (
  <PublishModal open={open} onOpenChange={() => {}} isAuthenticated payload={payload} events={[]} />
);

const theSwitch = () => screen.queryByRole('switch', { name: 'Publish Supporter-only' });
const sent = () => vi.mocked(WorldStorageService.publishItem).mock.calls[0];

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(NO_POLICIES);
  vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([]);
  vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the Supporter-Only switch', () => {
  it('publishes an admin\'s new Mascot Supporter-only once turned on', async () => {
    signInAs('admin');
    render(view());

    await userEvent.click(await screen.findByRole('switch', { name: 'Publish Supporter-only' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publish Supporter-Only' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(sent()[0].supporterOnly).toBe(true);
    expect(sent()[1]).toBeNull();
  });

  it('starts off, and an admin\'s publish without it sends no flag (control)', async () => {
    signInAs('admin');
    render(view());

    expect((await screen.findByRole('switch', { name: 'Publish Supporter-only' })).getAttribute('aria-checked')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(sent()[0].supporterOnly).toBeUndefined();
  });

  it.each(['mod', 'dev', 'normal'])('is absent for a %s account', async (accountType) => {
    signInAs(accountType);
    render(view());

    await screen.findByText('Publish Mascot');
    expect(theSwitch()).toBeNull();
  });

  it('is absent for a kind that cannot be Supporter-only', async () => {
    signInAs('admin');
    render(view(dictionary));

    await screen.findByText('Publish Dictionary');
    expect(theSwitch()).toBeNull();
  });

  it("shows for an admin's new World listing", async () => {
    signInAs('admin');
    render(view(world));

    expect(await screen.findByRole('switch', { name: 'Publish Supporter-only' })).toBeTruthy();
  });

  it('hides on an update and sends no flag, even after being turned on', async () => {
    signInAs('admin');
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([listing('m1', 'Willow')]);
    vi.spyOn(WorldStorageService, 'fetchListingDetails').mockResolvedValue(null);
    render(view());

    await userEvent.click(await screen.findByRole('switch', { name: 'Publish Supporter-only' }));
    await userEvent.click(await screen.findByLabelText('Willow (m1, 0 downloads)'));
    expect(theSwitch()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(sent()[1]).toBe('m1');
    expect(sent()[0].supporterOnly).toBeUndefined();
  });

  it('turns off again when the dialog reopens', async () => {
    signInAs('admin');
    const { rerender } = render(view());

    await userEvent.click(await screen.findByRole('switch', { name: 'Publish Supporter-only' }));
    rerender(view(mascot, false));
    rerender(view(mascot, true));

    await waitFor(() => expect(theSwitch()?.getAttribute('aria-checked')).toBe('false'));
  });
});

describe('the duration field', () => {
  const days = () => screen.queryByLabelText('Days Until It Opens') as HTMLInputElement | null;

  it.each([['mascot', mascot], ['world', world]])('sends the days of a new %s and shows the end date', async (_kind, payload) => {
    signInAs('admin');
    render(view(payload));

    expect(days()).toBeNull();
    await userEvent.click(await screen.findByRole('switch', { name: 'Publish Supporter-only' }));
    await userEvent.type(days()!, '14');
    expect(screen.getByText(/^Opens to everyone on /)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Publish Supporter-Only' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(sent()[0].supporterOnly).toBe(true);
    expect(sent()[0].supporterDays).toBe(14);
  });

  it('sends no days when left blank, and says there is no end', async () => {
    signInAs('admin');
    render(view());

    await userEvent.click(await screen.findByRole('switch', { name: 'Publish Supporter-only' }));
    expect(screen.getByText(/^No end date/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Publish Supporter-Only' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(sent()[0].supporterOnly).toBe(true);
    expect(sent()[0].supporterDays).toBeUndefined();
  });

  it('holds the publish back for a number the server would refuse', async () => {
    signInAs('admin');
    render(view());

    await userEvent.click(await screen.findByRole('switch', { name: 'Publish Supporter-only' }));
    await userEvent.type(days()!, '0');

    expect((screen.getByRole('button', { name: 'Publish Supporter-Only' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toMatch(/whole number/);
  });

  it('sends no days once the switch is turned back off', async () => {
    signInAs('admin');
    render(view());

    const toggle = await screen.findByRole('switch', { name: 'Publish Supporter-only' });
    await userEvent.click(toggle);
    await userEvent.type(days()!, '7');
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(sent()[0].supporterOnly).toBeUndefined();
    expect(sent()[0].supporterDays).toBeUndefined();
  });
});

describe('with a contest running', () => {
  const contestSwitch = () => screen.getByRole('switch', { name: /enter/i });

  it('turns the contest entry off when Supporter-only goes on, and the reverse', async () => {
    signInAs('admin');
    render(<PublishModal open onOpenChange={() => {}} isAuthenticated payload={world} events={[serverEvent({ title: 'Summer Isles Contest', startsAt: daysFrom(-2), endsAt: daysFrom(10) })]} />);

    await userEvent.click(await screen.findByRole('switch', { name: 'Publish Supporter-only' }));
    await userEvent.click(contestSwitch());
    expect(theSwitch()?.getAttribute('aria-checked')).toBe('false');
    expect(contestSwitch().getAttribute('aria-checked')).toBe('true');

    await userEvent.click(theSwitch()!);
    expect(contestSwitch().getAttribute('aria-checked')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: 'Publish Supporter-Only' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(sent()[2]).toBeNull();
  });
});

describe('the publish body', () => {
  it('carries the flag only when set', async () => {
    const read = async (payload: PublishPayload) => JSON.parse(await buildPublishBody(payload, null).body.text()) as Record<string, unknown>;

    expect((await read({ ...mascot, supporterOnly: true })).supporterOnly).toBe(true);
    expect('supporterOnly' in (await read(mascot))).toBe(false);
  });

  it('carries the days only with the flag', async () => {
    const read = async (payload: PublishPayload) => JSON.parse(await buildPublishBody(payload, null).body.text()) as Record<string, unknown>;

    expect((await read({ ...world, supporterOnly: true, supporterDays: 5 })).supporterDays).toBe(5);
    expect('supporterDays' in (await read({ ...world, supporterDays: 5 }))).toBe(false);
  });
});
