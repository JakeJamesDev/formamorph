import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { textEndpointPresetCodec, DEFAULT_TEXT_ENDPOINT_VALUES, BUILTIN_ENGINE_PRESET_ID, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';

// The provider probes endpoints for reasoning support; keep the network out of it. `detectSupported…` is
// the one routing calls lazily, so it stays a spy the cases below assert against.
const detectEfforts = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return {
    ...actual,
    detectReasoningCapability: vi.fn().mockResolvedValue(null),
    detectSupportedReasoningEfforts: (...args: unknown[]) => detectEfforts(...args),
  };
});

// The context-window probe. Routed targets are probed lazily on first resolve; the active endpoint has its
// own effect. Returns a distinct window so a routed resolve can be told apart from the shipped default.
const fetchContextLength = vi.fn().mockResolvedValue(32768);
vi.mock('@/lib/contextLength', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/contextLength');
  return { ...actual, fetchContextLength: (...args: unknown[]) => fetchContextLength(...args) };
});

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

/** An endpoint-preset id that cannot occur naturally in prompt text, for the leak probes. */
const SENTINEL_ID = 'zzz-endpoint-leak-canary-9x7q';

const ENDPOINTS_KEY = 'FORMAMORPH_textEndpointPresets';
const PROMPTS_KEY = 'FORMAMORPH_promptPresets';
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

/** Two endpoint presets with the big one active — the arrangement each case routes away from. */
function seedEndpoints() {
  const store: TextEndpointPresetStore = {
    activeId: 'big',
    presets: [
      { id: 'big', name: 'Big Model', values: { endpoint: 'http://big.test/v1', apiToken: 'big-key', model: 'big-24b', contextWindowOverride: 16384, maxTokens: 900 } },
      { id: 'small', name: 'Small Model', values: { endpoint: 'http://small.test/v1', apiToken: 'small-key', model: 'small-1b', contextWindowOverride: 4096, maxTokens: 200 } },
      // Distinctive id for the export/import leak checks: ordinary words like "small" occur in the shipped
      // prompt text a shared preset legitimately carries, so a substring probe needs something unmistakable.
      { id: SENTINEL_ID, name: 'Sentinel', values: { endpoint: 'http://sentinel.test/v1', apiToken: '', model: 'sentinel-m', contextWindowOverride: 2048, maxTokens: 100 } },
    ],
  };
  localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize(store));
}

/** Two user prompt presets, the first selected. Routing is preset-scoped, so a user preset must be active
 *  for it to be settable at all — the built-in case is its own test below. */
function seedPromptPresets(activeId = 'mine') {
  const store: PromptPresetStore = {
    activeId,
    presets: [
      { id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as never, style: 'markdown' },
      { id: 'other', name: 'Other', values: { systemPrompt: 'B' } as never, style: 'markdown' },
    ],
  };
  localStorage.setItem(PROMPTS_KEY, presetStoreCodec.serialize(store));
}

const storedRouting = (id: string) =>
  presetStoreCodec.parse(localStorage.getItem(PROMPTS_KEY)!).presets.find((p) => p.id === id)?.promptEndpoints;

describe('SettingsContext: per-prompt endpoint routing', () => {
  beforeEach(() => {
    localStorage.clear();
    detectEfforts.mockClear();
    fetchContextLength.mockClear();
    seedEndpoints();
    seedPromptPresets();
  });

  it('sends every prompt to the active endpoint until something is routed', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    for (const kind of ['narration', 'summary', 'statUpdates'] as const) {
      const r = result.current.resolveEndpointForKind(kind);
      expect(r.presetId).toBeNull();
      expect(r.model).toBe('big-24b');
      expect(r.apiToken).toBe('big-key');
    }
  });

  it('routes only the pinned prompt and leaves the rest on the active endpoint', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => result.current.setPromptEndpoint('summary', 'small'));

    const summary = result.current.resolveEndpointForKind('summary');
    expect(summary.model).toBe('small-1b');
    expect(summary.apiToken).toBe('small-key');
    expect(summary.maxTokens).toBe(200);
    expect(summary.url).toContain('small.test');

    const narration = result.current.resolveEndpointForKind('narration');
    expect(narration.model).toBe('big-24b');
    expect(narration.url).toContain('big.test');
  });

  it('stores routing on the active prompt preset, not globally', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'small'));

    expect(storedRouting('mine')).toEqual({ summary: 'small' });
    expect(storedRouting('other')).toBeUndefined();
    // The standalone key the pre-preset version used must not come back.
    expect(localStorage.getItem('FORMAMORPH_promptEndpoints')).toBeNull();
  });

  it('gives each prompt preset its own routing', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'small'));
    expect(result.current.resolveEndpointForKind('summary').model).toBe('small-1b');

    // Switching preset switches the routing with it.
    act(() => result.current.selectPreset('other'));
    expect(result.current.resolveEndpointForKind('summary').model).toBe('big-24b');

    act(() => result.current.selectPreset('mine'));
    expect(result.current.resolveEndpointForKind('summary').model).toBe('small-1b');
  });

  it('carries no routing under a built-in preset, and refuses to set any', () => {
    seedPromptPresets('default'); // the read-only built-in
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => result.current.setPromptEndpoint('summary', 'small'));

    expect(result.current.promptEndpoints).toEqual({});
    expect(result.current.resolveEndpointForKind('summary').model).toBe('big-24b');
    expect(storedRouting('mine')).toBeUndefined();
  });

  it('pins a prompt to the built-in Default endpoint even while a user endpoint is active', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('sceneTags', 'default'));

    const r = result.current.resolveEndpointForKind('sceneTags');
    expect(r.isBuiltIn).toBe(true);
    expect(r.model).toBe(DEFAULT_TEXT_ENDPOINT_VALUES.model);
  });

  it('returns a routed prompt to the active endpoint when unpinned', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'small'));
    expect(result.current.resolveEndpointForKind('summary').model).toBe('small-1b');

    act(() => result.current.setPromptEndpoint('summary', null));

    expect(result.current.resolveEndpointForKind('summary').model).toBe('big-24b');
    expect(storedRouting('mine')).toEqual({});
  });

  it('falls back to the active endpoint when the routed endpoint preset is deleted', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'small'));

    act(() => result.current.deleteTextEndpointPreset('small'));

    const r = result.current.resolveEndpointForKind('summary');
    expect(r.presetId).toBeNull();
    expect(r.model).toBe('big-24b');
  });

  it("uses the routed preset's own context window rather than the active endpoint's", () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'small'));
    // The preset carries a manual override, which beats any probe.
    expect(result.current.resolveEndpointForKind('summary').contextWindow).toBe(4096);
  });

  // Routing now lives ON the preset object, so the export path is one careless spread away from shipping
  // someone's endpoint ids (and the preset names they imply) to whoever they share with.
  it('never exports routing with a shared preset', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', SENTINEL_ID));
    expect(storedRouting('mine')).toEqual({ summary: SENTINEL_ID });

    const shared = result.current.exportActivePreset('2.9.2') as unknown as Record<string, unknown>;

    expect(shared.promptEndpoints).toBeUndefined();
    expect(JSON.stringify(shared)).not.toContain(SENTINEL_ID);
  });

  it('never adopts routing from an imported preset', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    // A crafted payload claiming routing — the parser drops unknown keys, and the importer never reads it.
    const crafted = { name: 'Gift', style: 'markdown' as const, values: { systemPrompt: 'X' } as never, promptEndpoints: { narration: SENTINEL_ID } };
    let id = '';
    act(() => { id = result.current.importPreset(crafted, { includeTuning: true, name: 'Gift' }); });

    expect(storedRouting(id)).toBeUndefined();
    expect(result.current.resolveEndpointForKind('narration').model).toBe('big-24b');
  });

  it('probes a routed endpoint once and then serves the detected window', async () => {
    // No manual override on this preset, so the probe is what supplies its window.
    const store: TextEndpointPresetStore = {
      activeId: 'big',
      presets: [
        { id: 'big', name: 'Big Model', values: { endpoint: 'http://big.test/v1', apiToken: 'big-key', model: 'big-24b', contextWindowOverride: 16384, maxTokens: 900 } },
        { id: 'unprobed', name: 'Unprobed', values: { endpoint: 'http://new.test/v1', apiToken: '', model: 'new-8b', contextWindowOverride: null, maxTokens: 500 } },
      ],
    };
    localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize(store));

    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'unprobed'));

    // Resolving repeatedly must not re-probe the same target.
    act(() => { result.current.resolveEndpointForKind('summary'); });
    act(() => { result.current.resolveEndpointForKind('summary'); });

    await waitFor(() => expect(result.current.resolveEndpointForKind('summary').contextWindow).toBe(32768));
    const routedProbes = fetchContextLength.mock.calls.filter((c) => String(c[0]).includes('new.test'));
    expect(routedProbes).toHaveLength(1);
    // The capability probe rides the same lazy path, keyed to the routed target.
    expect(detectEfforts.mock.calls.some((c) => String(c[0]).includes('new.test'))).toBe(true);
  });
});

// The bundled engine is an endpoint preset, not a mode. These cover the two things that follow from that:
// the old desktop checkbox becoming a selection, and the engine running whenever anything references it.
describe('SettingsContext: the bundled engine as an endpoint', () => {
  const asDesktop = () => { (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {}; };

  beforeEach(() => {
    localStorage.clear();
    detectEfforts.mockClear();
    fetchContextLength.mockClear();
    asDesktop();
    seedEndpoints();
    seedPromptPresets();
  });
  afterEach(() => { delete (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop; });

  it('keeps an engine-mode desktop user on the engine instead of moving them to the hosted endpoint', () => {
    // Pre-upgrade state: the checkbox was off, meaning "run the bundled engine".
    localStorage.setItem('FORMAMORPH_useCustomEndpoint', 'false');
    localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize({ activeId: 'default', presets: [] }));

    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.localModelActive).toBe(true);
    expect(result.current.resolveEndpointForKind('narration').localEngine).toBe(true);
    // The checkbox is retired, not left behind to disagree with the selection.
    expect(localStorage.getItem('FORMAMORPH_useCustomEndpoint')).toBeNull();
  });

  it('leaves a desktop user who was on their own endpoint where they were', () => {
    localStorage.setItem('FORMAMORPH_useCustomEndpoint', 'true');
    localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize({
      activeId: 'small',
      presets: [{ id: 'small', name: 'Small Model', values: { endpoint: 'http://small.test/v1', apiToken: '', model: 'small-1b', contextWindowOverride: 4096, maxTokens: 200 } }],
    }));

    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.localModelActive).toBe(false);
    expect(result.current.resolveEndpointForKind('narration').model).toBe('small-1b');
  });

  // These two are about the lifecycle after upgrading, so the migration is already done — otherwise it
  // claims the fresh-install default (engine selected) and there is no "active endpoint is elsewhere" to test.
  it('wants the engine running when a prompt is routed to it, even from another active endpoint', () => {
    localStorage.setItem('FORMAMORPH_engineIsPresetMigrated', '1');
    const { result } = renderHook(() => useSettings(), { wrapper });
    // Active endpoint is the user's "Big Model" — before, this stopped the engine outright.
    expect(result.current.localModelActive).toBe(false);
    expect(result.current.engineWanted).toBe(false);

    act(() => result.current.setPromptEndpoint('summary', BUILTIN_ENGINE_PRESET_ID));

    expect(result.current.engineWanted).toBe(true);
    const summary = result.current.resolveEndpointForKind('summary');
    expect(summary.localEngine).toBe(true);
    expect(summary.url).toContain('8977');
    // Everything else still goes to the active endpoint.
    expect(result.current.resolveEndpointForKind('narration').localEngine).toBe(false);
  });

  it('stops wanting the engine once nothing references it', () => {
    localStorage.setItem('FORMAMORPH_engineIsPresetMigrated', '1');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', BUILTIN_ENGINE_PRESET_ID));
    expect(result.current.engineWanted).toBe(true);

    act(() => result.current.setPromptEndpoint('summary', null));
    expect(result.current.engineWanted).toBe(false);
  });
});
