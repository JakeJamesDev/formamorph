import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PresenceReveal } from '@/lib/entityPicking';
import { resetRoutineSelections, routineSelectionOf } from '@/lib/routineSelection';
import { useEntityPick } from './useEntityPick';

/** What an undo's Presence request does to the pick, once the Presence tab is on screen. */
describe('useEntityPick reveal', () => {
  const run = (over: { onScreen?: boolean; rows?: string[] } = {}) => {
    const { onScreen = true, rows = ['warden'] } = over;
    // The editor holds the request until the pick takes it.
    return renderHook(() => {
      const [reveal, setReveal] = useState<PresenceReveal | null>({ entityId: 'warden', mode: 'knownIn' });
      const { entityPick } = useEntityPick({
        hasPresenceRow: (id) => rows.includes(id),
        presenceAt: onScreen ? 'gate' : null,
        reveal,
        onRevealTaken: () => setReveal(null),
      });
      return { entityPick, reveal };
    });
  };

  it('selects the entity in the requested mode when it has a row', () => {
    const { result } = run();
    expect(result.current.entityPick.pick).toEqual({ entityId: 'warden', mode: 'knownIn' });
    expect(result.current.entityPick.shown).toBe(true);
    expect(result.current.reveal).toBeNull();
  });

  it('shows the Start the undo changed in the Routine editor', () => {
    resetRoutineSelections();
    const reveal: PresenceReveal = { entityId: 'warden', mode: 'locations', startId: 's2' };
    const hasPresenceRow = () => true;
    renderHook(() => useEntityPick({ hasPresenceRow, presenceAt: 'gate', reveal }));
    expect(routineSelectionOf('warden').startId).toBe('s2');
  });

  it('leaves no pick when the entity has no row, as after the undo of an add', () => {
    const { result } = run({ rows: [] });
    expect(result.current.entityPick.pick).toBeNull();
    expect(result.current.reveal).toBeNull();
  });

  it('keeps the request until the Presence tab is on screen', () => {
    const { result } = run({ onScreen: false });
    expect(result.current.entityPick.pick).toBeNull();
    expect(result.current.reveal).not.toBeNull();
  });
});
