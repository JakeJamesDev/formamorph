import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The settings the hook reads. Each test sets the active endpoint here; every help route follows it.
const settings = vi.hoisted(() => {
  const state = {
    localModelActive: false,
    activeEndpointUrl: 'http://localhost:1234/v1/chat/completions',
    activeApiToken: '',
    activeModelName: 'default',
    activeTextEndpointIsDemoAI: false,
    language: 'Spanish',
    claimEngine: () => {},
    resolveEndpointForKind: () => ({
      endpointId: state.activeTextEndpointIsDemoAI ? 'default' : 'mine',
      endpoint: state.activeTextEndpointIsDemoAI ? 'https://api.lyonade.net/v1' : state.activeEndpointUrl,
      url: state.activeEndpointUrl,
      apiToken: state.activeApiToken,
      model: state.activeModelName,
      localEngine: state.localModelActive,
    }),
  };
  return state;
});
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => settings }));
vi.mock('@/lib/aiRequest/useAiSettingsSnapshot', () => ({ useAiSettingsSnapshot: () => ({}) }));
vi.mock('@/lib/useLocalLlmStatus', () => ({ useLocalLlmStatus: () => ({ status: 'stopped' }) }));
vi.mock('@/lib/imageGen/desktop', async () => ({
  ...await vi.importActual<object>('@/lib/imageGen/desktop'),
  isDesktop: () => false, listLocalModels: async () => [], localLlmStatus: async () => ({ status: 'stopped' }),
}));
import { DEFAULT_HELP_SETTINGS } from '@/lib/formaquestion/helpSettings';
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
    const { result } = renderHook(() => useHelpAi(true, DEFAULT_HELP_SETTINGS));
    await waitFor(() => expect(result.current.reachable).toBe(false));
    expect(fetchMock).toHaveBeenCalled();
  });

  it('checks nothing while the window is closed', async () => {
    const fetchMock = deadServer();
    const { result } = renderHook(() => useHelpAi(false, DEFAULT_HELP_SETTINGS));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.reachable).toBeNull();
  });

  it('counts the default cloud endpoint as connected, with no check', async () => {
    settings.activeTextEndpointIsDemoAI = true;
    const fetchMock = deadServer();
    const { result } = renderHook(() => useHelpAi(true, DEFAULT_HELP_SETTINGS));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.reachable).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the AI Language setting', () => {
    deadServer();
    const { result } = renderHook(() => useHelpAi(false, DEFAULT_HELP_SETTINGS));
    expect(result.current.language).toBe('Spanish');
  });
});
