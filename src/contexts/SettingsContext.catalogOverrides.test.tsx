import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import { SettingsProvider, useSettings } from './SettingsContext';

// Keep the provider's endpoint probes off the network.
vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return { ...actual, detectReasoningCapability: vi.fn().mockResolvedValue(null), resolveReasoningCapability: vi.fn().mockResolvedValue(null) };
});
vi.mock('@/lib/contextLength', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/contextLength');
  return { ...actual, fetchContextLength: vi.fn().mockResolvedValue(32768) };
});

const OVERRIDES_KEY = 'FORMAMORPH_toolCatalogOverrides';
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;
const GET_ENTITY = TOOL_CATALOG.find((t) => t.id === 'get_entity')!;

describe('SettingsContext: catalog Tool overrides', () => {
  beforeEach(() => localStorage.clear());

  it('saves a catalog Tool as a stored override that survives a reload, not as a user Tool', () => {
    const shipped = structuredClone(GET_ENTITY);
    const { result, unmount } = renderHook(() => useSettings(), { wrapper });
    act(() => { result.current.saveTool({ ...GET_ENTITY, description: 'changed', offeredTo: ['choices'], callLimit: 2 }); });

    expect(result.current.userTools).toEqual([]);
    expect(result.current.catalogTools).toEqual([{ ...shipped, offeredTo: ['choices'], callLimit: 2 }]);
    // The list play offers from.
    expect(result.current.allTools).toEqual(result.current.catalogTools);
    expect(JSON.parse(localStorage.getItem(OVERRIDES_KEY)!)).toEqual({ get_entity: { offeredTo: ['choices'], callLimit: 2 } });
    expect(GET_ENTITY).toEqual(shipped);

    unmount();
    const reloaded = renderHook(() => useSettings(), { wrapper });
    expect(reloaded.result.current.catalogTools[0].offeredTo).toEqual(['choices']);
  });
});
