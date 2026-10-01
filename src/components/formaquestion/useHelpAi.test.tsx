import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The settings the hook reads. Each test sets the active endpoint here.
const settings = vi.hoisted(() => ({
  localModelActive: false,
  activeEndpointUrl: 'http://localhost:1234/v1/chat/completions',
  activeApiToken: '',
  activeModelName: 'default',
  activeTextEndpointIsDemoAI: false,
  language: 'Spanish',
}));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => settings }));
vi.mock('@/lib/aiRequest/useAiSettingsSnapshot', () => ({ useAiSettingsSnapshot: () => ({}) }));
vi.mock('@/lib/useLocalLlmStatus', () => ({ useLocalLlmStatus: () => ({ status: 'stopped' }) }));
vi.mock('@/lib/imageGen/desktop', () => ({ isDesktop: () => false, listLocalModels: async () => [], localLlmStatus: async () => ({ status: 'stopped' }) }));
import { useHelpAi } from './useHelpAi';

/** A server that is not there: every check of it fails. */
const deadServer = () => {
  const fetchMock = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => { settings.activeTextEndpointIsDemoAI = false; });
afterEach(() => vi.unstubAllGlobals());

describe('useHelpAi', () => {
  it('finds no AI when the player\'s own endpoint does not answer', async () => {
    const fetchMock = deadServer();
    const { result } = renderHook(() => useHelpAi(true));
    await waitFor(() => expect(result.current.reachable).toBe(false));
    expect(fetchMock).toHaveBeenCalled();
  });

  it('checks nothing while the window is closed', async () => {
    const fetchMock = deadServer();
    const { result } = renderHook(() => useHelpAi(false));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.reachable).toBeNull();
  });

  it('counts the default cloud endpoint as connected, with no check', async () => {
    settings.activeTextEndpointIsDemoAI = true;
    const fetchMock = deadServer();
    const { result } = renderHook(() => useHelpAi(true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.reachable).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the AI Language setting', () => {
    deadServer();
    const { result } = renderHook(() => useHelpAi(false));
    expect(result.current.language).toBe('Spanish');
  });
});
