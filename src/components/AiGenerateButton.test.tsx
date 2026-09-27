import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import AiGenerateButton from './AiGenerateButton';
import { openLatestDetails, toastTexts } from '@/test/toastText';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ activeEndpointUrl: 'http://x', activeApiToken: '', activeModelName: 'm', imageTagPrompt: 'p' }),
}));

const summarizeDescription = vi.hoisted(() => vi.fn());
// The model call is the seam; everything above it is the button's own.
vi.mock('@/lib/summarize', () => ({ summarizeDescription }));

function press(onChange = vi.fn()) {
  render(<AiGenerateButton mode="summary" source="A marsh guide." onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate summary' }));
  return onChange;
}

describe('AiGenerateButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps its headline for a failed generation and puts the cause behind View Details', async () => {
    summarizeDescription.mockRejectedValue(new Error('HTTP 503: model is loading'));
    const onChange = press();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toastTexts(vi.mocked(toast.error))).toEqual(['Failed to generate summary.View Details →']);
    expect(openLatestDetails(vi.mocked(toast.error))?.details).toContain('HTTP 503: model is loading');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows no toast for a canceled generation', async () => {
    summarizeDescription.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
    press();

    await waitFor(() => expect(summarizeDescription).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate summary' })).toBeEnabled());
    expect(toast.error).not.toHaveBeenCalled();
  });
});
