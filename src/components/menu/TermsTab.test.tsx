import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TermsTab } from './TermsTab';
import PolicyService from '@/services/PolicyService';
import { isUploadTermsDeclined, setUploadTermsDeclined } from '@/lib/uploadTermsDeclined';
import type { PolicyState } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));

const state = (accepted: boolean): PolicyState => ({
  uploadGate: { title: 'Contributor Terms', body: 'Be excellent.', tags: [], accepted },
  tagNotice: null,
  privacyPolicy: null,
});

const stubGate = (accepted: boolean) =>
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(state(accepted));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('before answering', () => {
  it('shows the terms with both choices', async () => {
    stubGate(false);

    render(<TermsTab active />);

    expect(await screen.findByText('Contributor Terms')).toBeTruthy();
    expect(screen.getByText('Be excellent.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Accept/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Decline/ })).toBeTruthy();
  });

  it('says what accepting is actually for', async () => {
    // Nothing but publishing is gated, and a wall of terms in a profile reads as more than it is.
    stubGate(false);

    render(<TermsTab active />);

    expect(await screen.findByText(/only needed to publish/)).toBeTruthy();
  });
});

describe('accepting', () => {
  it('records it and switches to the read-only view', async () => {
    stubGate(false);
    const accept = vi.spyOn(PolicyService, 'acceptUploadGate').mockResolvedValue(undefined);

    render(<TermsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Accept/ }));

    await waitFor(() => expect(accept).toHaveBeenCalled());
    expect(await screen.findByText('You have accepted these terms.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Decline/ })).toBeNull();
  });

  it('clears a refusal this browser was still remembering', async () => {
    // Left set, publishing would keep showing "you declined these terms" despite the server having
    // the acceptance — the two surfaces have to agree.
    setUploadTermsDeclined(true);
    stubGate(false);
    vi.spyOn(PolicyService, 'acceptUploadGate').mockResolvedValue(undefined);

    render(<TermsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Accept/ }));

    await waitFor(() => expect(isUploadTermsDeclined()).toBe(false));
  });

  it('tells the host, so a tab that no longer applies can be re-checked', async () => {
    stubGate(false);
    vi.spyOn(PolicyService, 'acceptUploadGate').mockResolvedValue(undefined);
    const onAnswered = vi.fn();

    render(<TermsTab active onAnswered={onAnswered} />);
    fireEvent.click(await screen.findByRole('button', { name: /Accept/ }));

    await waitFor(() => expect(onAnswered).toHaveBeenCalled());
  });

  it('stays offering the choice when the server refuses', async () => {
    stubGate(false);
    vi.spyOn(PolicyService, 'acceptUploadGate').mockRejectedValue(new Error('offline'));

    render(<TermsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Accept/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Accept/ })).toBeTruthy());
    expect(screen.queryByText('You have accepted these terms.')).toBeNull();
  });
});

describe('declining', () => {
  it('records it and says what it cost', async () => {
    stubGate(false);
    const decline = vi.spyOn(PolicyService, 'declineUploadGate').mockResolvedValue(undefined);

    render(<TermsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Decline/ }));

    await waitFor(() => expect(decline).toHaveBeenCalled());
    expect(await screen.findByText(/publishing stays unavailable/)).toBeTruthy();
  });

  it('leaves Accept available afterwards', async () => {
    // Declining here interrupts nothing, so it must never be a one-way door.
    stubGate(false);
    vi.spyOn(PolicyService, 'declineUploadGate').mockResolvedValue(undefined);

    render(<TermsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Decline/ }));

    expect(await screen.findByRole('button', { name: /Accept/ })).toBeTruthy();
  });

  it('remembers the refusal for the publish flow', async () => {
    stubGate(false);
    vi.spyOn(PolicyService, 'declineUploadGate').mockResolvedValue(undefined);

    render(<TermsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Decline/ }));

    await waitFor(() => expect(isUploadTermsDeclined()).toBe(true));
  });
});

describe('after accepting', () => {
  it('still shows the terms, with no decision to make', async () => {
    // They are bound by this and have to be able to look it up.
    stubGate(true);

    render(<TermsTab active />);

    expect(await screen.findByText('Be excellent.')).toBeTruthy();
    expect(screen.getByText('You have accepted these terms.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Decline/ })).toBeNull();
  });
});

describe('when there is nothing to show', () => {
  it('says so rather than rendering an empty panel', async () => {
    vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue({ uploadGate: null, tagNotice: null, privacyPolicy: null });

    render(<TermsTab active />);

    expect(await screen.findByText('There are no terms to show.')).toBeTruthy();
  });

  it('fetches nothing while the tab is off screen', async () => {
    const fetchPolicies = stubGate(false);

    render(<TermsTab active={false} />);

    await waitFor(() => expect(fetchPolicies).not.toHaveBeenCalled());
  });
});
