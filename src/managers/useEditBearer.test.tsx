import { describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import { CUSTOM_PERSONA_ID } from '@/lib/traitTree';
import { setLinkDefault } from '@/lib/traitLinks';
import { useEditBearer } from './useEditBearer';
import type { CustomPersonaNode } from '@/types';

const start: CustomPersonaNode = { traitLinks: [
  { id: 'l1', originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null },
  { id: 'l2', originalId: 'wizard', kind: 'trait', originalName: 'Wizard', groupId: null },
] };

describe('useEditBearer', () => {
  it('lands two edits to Custom Persona in one tick', () => {
    let node: CustomPersonaNode | undefined;
    function Store({ children }: { children: ReactNode }) {
      const [customPersona, setCustomPersona] = useState<CustomPersonaNode | undefined>(start);
      node = customPersona;
      const store = { customPersona, setCustomPersona, editEntity: vi.fn() } as unknown as TraitStore;
      return <TraitStoreContext.Provider value={store}>{children}</TraitStoreContext.Provider>;
    }
    const { result } = renderHook(() => useEditBearer(), { wrapper: Store });
    act(() => {
      result.current(CUSTOM_PERSONA_ID, (e) => setLinkDefault(e, 'l1', 'paladin', true));
      result.current(CUSTOM_PERSONA_ID, (e) => setLinkDefault(e, 'l2', 'wizard', true));
    });
    expect(node?.traitLinks.map((l) => l.defaults)).toEqual([{ paladin: true }, { wizard: true }]);
  });
});
