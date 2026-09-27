import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';

vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { ThemedToastContainer } from '@/components/ThemedToastContainer';
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

describe('toastError', () => {
  it('shows only the message of a DetailedError, with a View Details link to the rest', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError(new DetailedError('ComfyUI rejected the workflow: Bad graph', 'Node #4: missing'), 'fallback'));

    await screen.findByText('ComfyUI rejected the workflow: Bad graph');
    expect(screen.queryByText('Node #4: missing')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View Details →' }));
    const dialog = await screen.findByRole('dialog', { name: 'Error Details' });
    expect(dialog.textContent).toContain('Node #4: missing');
  });

  it('copies the message and the details together', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError(new DetailedError('ComfyUI rejected the workflow: Bad graph', 'Node #4: missing'), 'fallback'));
    fireEvent.click(await screen.findByRole('button', { name: 'View Details →' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('ComfyUI rejected the workflow: Bad graph\n\nNode #4: missing');
    await screen.findByText('Copied');
  });

  it('shows a plain error without a link, and the fallback when it has no message', async () => {
    render(<ThemedToastContainer />);
    act(() => toastError(new Error('Server offline'), 'fallback'));
    await screen.findByText('Server offline');
    expect(screen.queryByRole('button', { name: 'View Details →' })).toBeNull();

    act(() => toastError(new Error(''), 'Image generation failed.'));
    await screen.findByText('Image generation failed.');
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
