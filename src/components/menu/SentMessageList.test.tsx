import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SentMessageList } from './SentMessageList';
import MessageService from '@/services/MessageService';
import type { SentMessage } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));

/** Mirrors what `PAGE_SIZE` is in the component; a pager only appears once the total exceeds it. */
const PAGE_SIZE = 10;

const sent = (over: Partial<SentMessage> = {}): SentMessage => ({
  id: 'm1',
  subject: 'A subject',
  body: 'A body.',
  severity: 'info',
  scope: 'existing',
  broadcast: false,
  senderAs: 'username',
  senderName: 'root-admin',
  createdAt: '2026-07-01T00:00:00.000Z',
  editedAt: null,
  recalledAt: null,
  recipient: { id: 'u1', username: 'alice', readAt: null, dismissedAt: null },
  readCount: null,
  eligibleCount: null,
  ...over,
});

const page = (count: number, total = count) =>
  ({ messages: Array.from({ length: count }, (_, i) => sent({ id: `m${i}`, subject: `Subject ${i}` })), total });

/**
 * Stub `fetchSent` so the second call hangs, letting the loading state be inspected mid-flight.
 * Returns the release for the hung call.
 */
const stubDeferred = (result: { messages: SentMessage[]; total: number }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let served = 0;

  vi.spyOn(MessageService, 'fetchSent').mockImplementation(async () => {
    if (served++ > 0) await gate;
    return result;
  });

  return { release };
};

const list = () => document.querySelector('[aria-busy]') as HTMLElement;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('reloading the list', () => {
  it('keeps the messages on screen while they reload', async () => {
    // Swapping in the skeleton collapsed a full page of ten to three fixed rows and sprang it back.
    const { release } = stubDeferred(page(PAGE_SIZE, PAGE_SIZE + 5));

    render(<SentMessageList audience="direct" refreshNonce={0} />);
    await screen.findByText('Subject 0');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(list().getAttribute('aria-busy')).toBe('true'));
    expect(screen.getByText('Subject 0')).toBeTruthy();
    expect(screen.getAllByText(/^Subject \d+$/)).toHaveLength(PAGE_SIZE);

    release();
    await waitFor(() => expect(list().getAttribute('aria-busy')).toBe('false'));
  });

  it('dims the messages and stops them being clicked while reloading', async () => {
    const { release } = stubDeferred(page(PAGE_SIZE, PAGE_SIZE + 5));

    render(<SentMessageList audience="direct" refreshNonce={0} />);
    await screen.findByText('Subject 0');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(list().className).toContain('opacity-50'));
    // Recalling a message that is about to be replaced would recall the wrong one.
    expect(list().className).toContain('pointer-events-none');

    release();
    await waitFor(() => expect(list().className).not.toContain('opacity-50'));
  });

  it('keeps the pager mounted while the list reloads', async () => {
    const { release } = stubDeferred(page(PAGE_SIZE, PAGE_SIZE + 5));

    render(<SentMessageList audience="direct" refreshNonce={0} />);
    await screen.findByText('Subject 0');
    const pager = screen.getByText(/^Page \d+ of/);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(list().getAttribute('aria-busy')).toBe('true'));
    // The same node, not a replacement mounted after the fact.
    expect(screen.getByText(/^Page \d+ of/)).toBe(pager);

    release();
    await waitFor(() => expect(list().getAttribute('aria-busy')).toBe('false'));
  });

  it('dims the pager with the list', async () => {
    const { release } = stubDeferred(page(PAGE_SIZE, PAGE_SIZE + 5));

    render(<SentMessageList audience="direct" refreshNonce={0} />);
    await screen.findByText('Subject 0');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const pager = () => screen.getByText(/^Page \d+ of/).parentElement!;
    await waitFor(() => expect(pager().className).toContain('opacity-50'));
    expect(pager().className).toContain('pointer-events-none');

    release();
    await waitFor(() => expect(pager().className).not.toContain('opacity-50'));
  });

  it('still shows the skeleton on the very first load', async () => {
    // Nothing is on screen to dim, so the skeleton is all there is to show.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(MessageService, 'fetchSent').mockImplementation(async () => {
      await gate;
      return { messages: [], total: 0 };
    });

    render(<SentMessageList audience="direct" refreshNonce={0} />);

    await waitFor(() => expect(list().children.length).toBeGreaterThan(0));
    expect(list().className).not.toContain('opacity-50');

    release();
    await waitFor(() => expect(screen.getByText('Nothing sent yet.')).toBeTruthy());
  });

  it('shows no pager when everything fits one page', async () => {
    vi.spyOn(MessageService, 'fetchSent').mockResolvedValue(page(3));

    render(<SentMessageList audience="direct" refreshNonce={0} />);
    await screen.findByText('Subject 0');

    expect(screen.queryByText(/^Page \d+ of/)).toBeNull();
  });
});
