import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Signed stat changes by owner id, then by the key that owner's rows read. */
export type OwnerStatDeltas = Record<string, Record<string, number>>;

/** How long a turn's change chip stays up once the stat response lands. */
export const CHIP_MS = 10000;
/** How long the chips take to fade out when a new turn starts. */
export const FADE_MS = 350;
/** How long the bands take to drain at a submit (matches `.stat-delta-drain`). */
export const DRAIN_MS = 550;

interface StatDeltaState {
  /** The change chips. */
  recent: OwnerStatDeltas;
  /** The chips are on their way out, because a new turn started. */
  fading: boolean;
  /** The bands, held until the next turn. */
  held: OwnerStatDeltas;
  /** Last turn's bands, collapsing at a submit. */
  draining: OwnerStatDeltas;
  /** A chip write landed since the last close, so followed owners show their chips too. */
  chipsOpen: boolean;
}

export interface StatDeltas extends Omit<StatDeltaState, 'chipsOpen'> {
  /** The stat response landed: `owner`'s chips become `changes`, its bands take them, and the chips time out. */
  show: (owner: string, changes: Record<string, number>) => void;
  /** Add `changes` to `owner`'s chips and bands. Read when the update applies, so a sibling updater can fill it. */
  add: (owner: string, changes: Record<string, number>) => void;
  /** Replace `owner`'s bands. */
  hold: (owner: string, changes: Record<string, number>) => void;
  /** Stop a chip fade, because the turn's changes are landing. */
  settle: () => void;
  /** A turn starts: every band drains and every chip fades. */
  drain: () => void;
  /** A turn is abandoned: every chip and band goes, with no motion. */
  drop: () => void;
  /** A full load: nothing shows for anyone, and no timer is left. */
  clear: () => void;
}

const EMPTY: StatDeltaState = { recent: {}, fading: false, held: {}, draining: {}, chipsOpen: false };

const anyMoved = (deltas: OwnerStatDeltas) => Object.values(deltas).some((changes) => Object.keys(changes).length > 0);

const sum = (a: Record<string, number> | undefined, b: Record<string, number>) => {
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) out[key] = (out[key] || 0) + value;
  return out;
};

/** What the rows read: a followed owner's band is its total, and so is its chip while the chips are open. */
const shown = (s: StatDeltaState, followed: OwnerStatDeltas) => ({
  recent: s.chipsOpen ? { ...s.recent, ...followed } : s.recent,
  held: { ...s.held, ...followed },
});

/**
 * The live change feedback of every owner's stat rows: the chip, the held band and the draining band, with
 * their timers. Event owners (the player) write through the calls. Followed owners take `followed`, each
 * owner's change this turn, as their band, and as their chip while a chip write keeps the chips open. Read in
 * the render that moves them, so a followed row never paints a frame behind its value.
 */
export function useStatDeltas(followed: OwnerStatDeltas): StatDeltas {
  const [state, setState] = useState<StatDeltaState>(EMPTY);
  const stateRef = useRef(state);
  stateRef.current = state;
  const followedRef = useRef(followed);
  followedRef.current = followed;
  // One timer for the chips: the 10 s clear or the submit fade, whichever was set last.
  const chipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopChipTimer = () => { if (chipTimer.current) clearTimeout(chipTimer.current); chipTimer.current = null; };
  const stopDrainTimer = () => { if (drainTimer.current) clearTimeout(drainTimer.current); drainTimer.current = null; };

  useEffect(() => () => { stopChipTimer(); stopDrainTimer(); }, []);

  const show = useCallback((owner: string, changes: Record<string, number>) => {
    setState((s) => ({
      ...s,
      recent: { [owner]: changes },
      held: { ...s.held, [owner]: { ...s.held[owner], ...changes } },
      chipsOpen: true,
    }));
    stopChipTimer();
    chipTimer.current = setTimeout(() => {
      chipTimer.current = null;
      setState((s) => ({ ...s, recent: {}, chipsOpen: false }));
    }, CHIP_MS);
  }, []);

  const add = useCallback((owner: string, changes: Record<string, number>) => {
    setState((s) => ({
      ...s,
      recent: { ...s.recent, [owner]: sum(s.recent[owner], changes) },
      held: { ...s.held, [owner]: sum(s.held[owner], changes) },
      chipsOpen: true,
    }));
  }, []);

  const hold = useCallback((owner: string, changes: Record<string, number>) => {
    setState((s) => ({ ...s, held: { ...s.held, [owner]: changes } }));
  }, []);

  const settle = useCallback(() => setState((s) => (s.fading ? { ...s, fading: false } : s)), []);

  const drain = useCallback(() => {
    // The totals as this render read them, before the turn's new baseline zeroes them.
    const totals = followedRef.current;
    const now = shown(stateRef.current, totals);
    if (anyMoved(now.held)) {
      setState((prev) => ({ ...prev, draining: shown(prev, totals).held, held: {} }));
      stopDrainTimer();
      drainTimer.current = setTimeout(() => {
        drainTimer.current = null;
        setState((prev) => ({ ...prev, draining: {} }));
      }, DRAIN_MS);
    }
    if (anyMoved(now.recent)) {
      // The chips freeze as they stand, so followed owners' chips fade too.
      setState((prev) => ({ ...prev, recent: shown(prev, totals).recent, fading: true, chipsOpen: false }));
      stopChipTimer();
      chipTimer.current = setTimeout(() => {
        chipTimer.current = null;
        setState((prev) => ({ ...prev, recent: {}, fading: false, chipsOpen: false }));
      }, FADE_MS);
    }
  }, []);

  const drop = useCallback(() => setState((s) => ({ ...s, recent: {}, held: {}, chipsOpen: false })), []);

  const clear = useCallback(() => {
    stopChipTimer();
    stopDrainTimer();
    setState(EMPTY);
  }, []);

  const { recent, held } = useMemo(() => shown(state, followed), [state, followed]);
  const { fading, draining } = state;
  return useMemo(
    () => ({ recent, fading, held, draining, show, add, hold, settle, drain, drop, clear }),
    [recent, fading, held, draining, show, add, hold, settle, drain, drop, clear],
  );
}

const NONE: Record<string, number> = {};

/** One owner's changes, with a stable empty value. */
export const deltasOf = (deltas: OwnerStatDeltas, owner: string): Record<string, number> => deltas[owner] ?? NONE;

/**
 * The delta props of one stat row. `past` is the viewed turn's recorded change, or null while live; a past
 * turn's band grows in and never drains.
 */
export function rowDelta(deltas: StatDeltas, owner: string, key: string, past: number | null) {
  if (past !== null) return { change: past, barDelta: past, draining: false, fading: deltas.fading };
  const held = deltas.held[owner]?.[key] || 0;
  const drainingBy = deltas.draining[owner]?.[key] || 0;
  return {
    change: deltas.recent[owner]?.[key] || 0,
    barDelta: held || drainingBy,
    draining: !held && !!drainingBy,
    fading: deltas.fading,
  };
}
