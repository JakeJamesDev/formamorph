import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';

vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
const flags = vi.hoisted(() => ({ community: true }));
vi.mock('@/lib/featureFlags', () => ({ get COMMUNITY_ENABLED() { return flags.community; } }));
// jsdom can't drive a real Lexical selection; the stub keeps the body a plain textarea whose value can be read.
vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea id="feedbackBody" aria-label={props.ariaLabel} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
  ),
}));

import { ThemedToastContainer } from './ThemedToastContainer';
import { FeedbackDialog } from './menu/FeedbackDialog';
import AuthService from '@/services/AuthService';
import { closeErrorDetails, DetailedError } from '@/lib/errorDetails';
import { closeBugReport } from '@/lib/bugReportStore';
import { saveFeedbackDraft } from '@/lib/feedbackDraft';
import { toastError } from '@/lib/linkToast';

const titleValue = () => (document.getElementById('feedbackTitle') as HTMLInputElement).value;
const bodyValue = () => (document.getElementById('feedbackBody') as HTMLTextAreaElement).value;

beforeEach(() => {
  flags.community = true;
  AuthService.token = 'token';
  localStorage.clear();
});

afterEach(() => {
  act(() => {
    toast.dismiss();
    closeErrorDetails();
    closeBugReport();
  });
  cleanup();
  AuthService.token = null;
  vi.unstubAllGlobals();
});

async function openDetails(error: unknown = new DetailedError('ComfyUI rejected the workflow', 'Node #4: missing')) {
  render(<ThemedToastContainer />);
  act(() => toastError(error, 'fallback'));
  fireEvent.click(await screen.findByRole('button', { name: 'View Details →' }));
  return screen.findByRole('dialog', { name: 'Error Details' });
}

async function reportBug() {
  await openDetails();
  fireEvent.click(screen.getByRole('button', { name: 'Report Bug' }));
  return screen.findByRole('dialog', { name: 'Send Feedback' });
}

describe('Report Bug in Error Details', () => {
  it('hands off to the bug report with the title and description filled in', async () => {
    await reportBug();

    expect(titleValue()).toBe('ComfyUI rejected the workflow');
    expect(bodyValue()).toBe('Node #4: missing');
    expect(screen.queryByRole('dialog', { name: 'Error Details' })).toBeNull();
  });

  it('leaves the diagnostics block out of the description, and the sent report carries it once', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    await reportBug();
    expect(bodyValue()).not.toContain('Version:');

    fireEvent.click(screen.getByRole('button', { name: 'Send Report' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.body).toBe('Node #4: missing');
    expect(sent.diagnostics).toEqual(expect.objectContaining({ platform: 'Browser' }));
  });

  it('replaces an unsent draft, and the filled report becomes the draft a later opening shows', async () => {
    saveFeedbackDraft({ type: 'suggestion', title: 'Old idea', category: 'gameplay', body: 'Half written' });
    await reportBug();

    expect(titleValue()).toBe('ComfyUI rejected the workflow');
    expect(screen.getByRole('tab', { name: 'Bug' }).getAttribute('data-state')).toBe('active');
    expect(screen.queryByText(/Picked up where you left off/)).toBeNull();

    act(() => closeBugReport());
    cleanup();
    // The toast may be gone by now; the report itself keeps the details.
    render(<FeedbackDialog open onOpenChange={() => {}} />);
    expect(titleValue()).toBe('ComfyUI rejected the workflow');
    expect(bodyValue()).toBe('Node #4: missing');
  });

  it('cuts details past the body limit and ends them with a note that Copy has the full text', async () => {
    await openDetails(new DetailedError('Too long', 'x'.repeat(5000)));
    fireEvent.click(screen.getByRole('button', { name: 'Report Bug' }));
    await screen.findByRole('dialog', { name: 'Send Feedback' });

    const body = bodyValue();
    expect(body.length).toBeLessThanOrEqual(4000);
    expect(body.startsWith('xxxx')).toBe(true);
    expect(body).toMatch(/“Copy” in “Error Details” has the full text\.\]$/);
  });

  it('cuts a title past the title limit', async () => {
    await openDetails(new DetailedError('y'.repeat(200), 'details'));
    fireEvent.click(screen.getByRole('button', { name: 'Report Bug' }));
    await screen.findByRole('dialog', { name: 'Send Feedback' });

    expect(titleValue()).toHaveLength(120);
    expect(titleValue().endsWith('…')).toBe(true);
  });

  it('shows Copy only when the community flag is off', async () => {
    flags.community = false;
    await openDetails();

    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Report Bug' })).toBeNull();
  });
});
