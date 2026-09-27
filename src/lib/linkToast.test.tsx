import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';

vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { ThemedToastContainer } from '@/components/ThemedToastContainer';
import { APP_VERSION } from './version';
import { DetailedError, closeErrorDetails } from './errorDetails';
import { linkToast, toastError } from './linkToast';

const writeText = vi.fn(async (_text: string) => {});

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => act(() => {
  toast.dismiss();
  closeErrorDetails();
}));

async function openDetails(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: 'View Details →' }));
  return screen.findByRole('dialog', { name: 'Error Details' });
}

describe('toastError', () => {
  it('shows only the message of an error with details, with a View Details link to the rest', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError(new DetailedError('ComfyUI rejected the workflow: Bad graph', 'Node #4: missing'), 'fallback'));

    await screen.findByText('ComfyUI rejected the workflow: Bad graph');
    expect(screen.queryByText('Node #4: missing')).toBeNull();

    const dialog = await openDetails();
    expect(dialog.textContent).toContain('Node #4: missing');
  });

  it('reads details from a string field on any error, not from its class', async () => {
    const error = Object.assign(new TypeError('Stream failed'), { details: 'Status: 404\nmodel not found' });
    render(<ThemedToastContainer />);
    act(() => toastError(error, 'fallback'));

    await screen.findByText('Stream failed');
    const dialog = await openDetails();
    expect(dialog.textContent).toContain('Status: 404\nmodel not found');
    expect(dialog.textContent).not.toContain('    at ');
  });

  it('builds details for a plain error: name, message, cause chain and at most 10 stack frames', async () => {
    const root = new TypeError('Failed to fetch');
    const error = new Error('Server offline', { cause: root });
    error.stack = ['Error: Server offline', ...Array.from({ length: 14 }, (_, i) => `    at frame${i} (app.js:${i}:1)`)].join('\n');
    render(<ThemedToastContainer />);
    act(() => toastError(error, 'fallback'));

    await screen.findByText('Server offline');
    const text = (await openDetails()).textContent ?? '';
    expect(text).toContain('Error: Server offline');
    expect(text).toContain('Caused by: TypeError: Failed to fetch');
    expect(text).toContain('at frame9 ');
    expect(text).not.toContain('at frame10 ');
  });

  it('keeps the details a cause carries, and names a cause cycle once', async () => {
    const server = Object.assign(new Error('HTTP 404'), { details: 'model not found' });
    const error = new Error('Request failed', { cause: server });
    (server as Error & { cause?: unknown }).cause = error;
    render(<ThemedToastContainer />);
    act(() => toastError(error, 'fallback'));

    const text = (await openDetails()).textContent ?? '';
    expect(text).toContain('Caused by: Error: HTTP 404\nmodel not found');
    expect(text.match(/Caused by:/g)).toHaveLength(1);
  });

  it('lists every failure an aggregate error holds, each with its name and its own details', async () => {
    const refused = Object.assign(new Error('HTTP 403'), { details: 'Route: /api/addons/a\nStatus: 403' });
    const error = new AggregateError([
      new Error('Add-on A', { cause: refused }),
      new TypeError('Failed to fetch'),
    ], 'Two add-on reviews failed');
    render(<ThemedToastContainer />);
    act(() => toastError(error, { headline: 'Could not save: Add-on A, Add-on B. Try again.' }));

    await screen.findByText('Could not save: Add-on A, Add-on B. Try again.');
    const text = (await openDetails()).textContent ?? '';
    expect(text).toContain('AggregateError: Two add-on reviews failed');
    expect(text).toContain('Failure 1 of 2:\nError: Add-on A\nCaused by: Error: HTTP 403\nRoute: /api/addons/a\nStatus: 403');
    expect(text).toContain('Failure 2 of 2:\nTypeError: Failed to fetch');
  });

  it('reads V8 frames only below the message, whose lines can look like frames', async () => {
    const error = new Error('Bad body:\n   at least one field is required');
    error.stack = `Error: ${error.message}\n    at send (api.js:1:1)`;
    render(<ThemedToastContainer />);
    act(() => toastError(error, 'fallback'));

    const text = (await openDetails()).textContent ?? '';
    expect(text).toContain('Stack:\n    at send (api.js:1:1)');
  });

  it('reads Firefox frames', async () => {
    const error = new Error('Boom');
    error.stack = 'send@http://localhost/api.js:1:1\nrun@http://localhost/app.js:2:2';
    render(<ThemedToastContainer />);
    act(() => toastError(error, 'fallback'));

    const text = (await openDetails()).textContent ?? '';
    expect(text).toContain('Stack:\nsend@http://localhost/api.js:1:1\nrun@http://localhost/app.js:2:2');
  });

  it('keeps the message of a thrown plain object behind a headline', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError({ message: 'Quota exceeded', code: 507 }, { headline: 'Failed to save' }));

    await screen.findByText('Failed to save');
    const text = (await openDetails()).textContent ?? '';
    expect(text).toContain('Quota exceeded');
    expect(text).toContain('"code":507');
  });

  it('shows a headline as the toast text and moves the error message into the details', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError(new Error('QuotaExceededError: disk full'), { headline: 'Failed to save' }));

    await screen.findByText('Failed to save');
    expect(screen.queryByText('QuotaExceededError: disk full')).toBeNull();
    const dialog = await openDetails();
    expect(dialog.textContent).toContain('QuotaExceededError: disk full');
  });

  it('keeps the message of an error with its own details when a headline replaces it', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError(new DetailedError('Bad graph', 'Node #4: missing'), { headline: "Couldn't draw this scene." }));

    await screen.findByText("Couldn't draw this scene.");
    const text = (await openDetails()).textContent ?? '';
    expect(text).toContain('Bad graph');
    expect(text).toContain('Node #4: missing');
  });

  it('wraps a string failure reason so it still gets the link', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError('Listing not found', 'fallback'));

    await screen.findByText('Listing not found');
    const dialog = await openDetails();
    expect(dialog.textContent).toContain('Listing not found');
  });

  it('shows the fallback when the error has no message', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError(new Error(''), 'Image generation failed.'));
    await screen.findByText('Image generation failed.');
    await openDetails();
  });

  it('ends the details with the diagnostics block', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError(new Error('Server offline'), 'fallback'));

    const text = (await openDetails()).textContent ?? '';
    expect(text).toMatch(new RegExp(`Version: ${APP_VERSION}\\nPlatform: Browser\\nSystem: .+`));
  });

  it('copies the message, the details and the diagnostics block together', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError(new DetailedError('ComfyUI rejected the workflow: Bad graph', 'Node #4: missing'), 'fallback'));
    await openDetails();

    fireEvent.click(await screen.findByRole('button', { name: 'Copy' }));
    const copied = writeText.mock.calls[0][0];
    expect(copied).toMatch(/^ComfyUI rejected the workflow: Bad graph\n\nNode #4: missing\n\nVersion: /);
    expect(copied).toContain('Platform: Browser');
    await screen.findByText('Copied');
  });
});

describe('#dev?modal=errorDetails', () => {
  afterEach(() => { window.location.hash = ''; window.dispatchEvent(new HashChangeEvent('hashchange')); });

  it('raises the sample toast, whose dialog ends with the diagnostics block', async () => {
    window.location.hash = '#dev?modal=errorDetails';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    render(<ThemedToastContainer />);

    await screen.findByText(/^ComfyUI rejected the workflow/);
    const text = (await openDetails()).textContent ?? '';
    expect(text).toContain('CheckpointLoaderSimple');
    expect(text).toContain(`Version: ${APP_VERSION}`);
  });
});

describe('plain toast.error', () => {
  it('has no link when no error is behind it', async () => {
    render(<ThemedToastContainer />);
    act(() => { toast.error('A title is required'); });
    await screen.findByText('A title is required');
    expect(screen.queryByRole('button', { name: 'View Details →' })).toBeNull();
  });
});

describe('linkToast', () => {
  it('runs the link action and keeps the toast open', async () => {
    const onLink = vi.fn();
    render(<ThemedToastContainer closeOnClick />);
    act(() => linkToast("Couldn't reach your AI server.", 'Fix connection →', onLink));

    fireEvent.click(await screen.findByRole('button', { name: 'Fix connection →' }));
    expect(onLink).toHaveBeenCalledTimes(1);
    // A closing toast first takes its exit-animation class; jsdom never ends the animation that removes it.
    expect(document.querySelector('.Toastify__toast')?.className).not.toMatch(/-exit/);
  });
});
