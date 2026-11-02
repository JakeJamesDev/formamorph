import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toastTexts, openLatestDetails } from '@/test/toastText';

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() }));
vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));

const fromPretrained = vi.hoisted(() => vi.fn());
vi.mock('@/lib/tts/kokoroClient', () => ({
  KokoroClient: { from_pretrained: fromPretrained },
  KOKORO_VOICES: ['af_heart'],
}));

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    vramHelperUrl: '', setVramHelperUrl: vi.fn(), ttsSpeed: 1, setTtsSpeed: vi.fn(),
    streamNarrationAudio: false, setStreamNarrationAudio: vi.fn(), ttsHighlight: false, setTtsHighlight: vi.fn(),
  }),
}));
vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({ ttsPlayback: { reset: vi.fn(), append: vi.fn(), finalize: vi.fn() } }),
}));
vi.mock('@/lib/useVramStats', () => ({
  useVramStats: () => ({ status: 'offline', gpus: [], processes: [], selfPid: null, lastUpdated: null }),
}));

import TTSModal from './TTSModal';

beforeEach(() => {
  Object.values(toast).forEach((f) => f.mockClear());
  fromPretrained.mockReset();
  Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: () => Promise.resolve({}) } });
});
afterEach(() => { Reflect.deleteProperty(navigator, 'gpu'); });

describe('loading the model', () => {
  it('toasts the failure with its details and returns to the Load Model button', async () => {
    fromPretrained.mockRejectedValue(new Error('WebGPU device lost'));
    render(<TTSModal isOpen onOpenChange={() => {}} />);
    const load = screen.getByRole('button', { name: 'Load Model' });
    await waitFor(() => expect(load).toBeEnabled());

    fireEvent.click(load);

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toastTexts(toast.error)).toEqual(["Couldn't load the Text to Speech model. Try again.View Details →"]);
    expect(openLatestDetails(toast.error)?.details).toContain('WebGPU device lost');
    expect(await screen.findByRole('button', { name: 'Load Model' })).toBeEnabled();
  });
});
