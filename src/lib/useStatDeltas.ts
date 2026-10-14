import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { partOf, scoped, scopedEntries, withPart, type OwnerId, type Scoped } from './scope';

/** One scope's signed stat changes, by the key its rows read. */
type Changes = Readonly<Record<string, number>>;

/** Signed stat changes: global scope's, and each entity owner's by its id. */
export type ScopedStatDeltas = Scoped<Changes>;

/** Each entity owner's change this turn, by its id. */
export type FollowedStatDeltas = Readonly<Record<string, Changes>>;

/** No change anywhere. */
export const NO_DELTAS: ScopedStatDeltas = scoped({});

/** How long a turn's change chip stays up once the stat response lands. */
export const CHIP_MS = 10000;
/** How long the chips take to fade out when a new turn starts. */
export const FADE_MS = 350;
/** How long the bands take to drain at a submit (matches `.stat-delta-drain`). */
export const DRAIN_MS = 550;

interface StatDeltaState {
  /** The change chips. */
  recent: ScopedStatDeltas;
  /** The chips are on their way out, because a new turn started. */
  fading: boolean;
  /** The bands, held until the next turn. */
  held: ScopedStatDeltas;
  /** Last turn's bands, collapsing at a submit. */
  draining: ScopedStatDeltas;
  /** A chip write landed since the last close, so followed owners show their chips too. */
  chipsOpen: boolean;
}

export interface StatDeltas extends Omit<StatDeltaState, 'chipsOpen'> {
  /** The stat response landed: `owner`'s chips become `changes`, its bands take them, and the chips time out. */
  show: (owner: OwnerId, changes: Record<string, number>) => void;
  /** Add `changes` to `owner`'s chips and bands. Read when the update applies, so a sibling updater can fill it. */
  add: (owner: OwnerId, changes: Record<string, number>) => void;
  /** Replace `owner`'s bands. */
  hold: (owner: OwnerId, changes: Record<string, number>) => void;
  /** Stop a chip fade, because the turn's changes are landing. */
  settle: () => void;
  /** A turn starts: every band drains and every chip fades. */
  drain: () => void;
  /** A turn is abandoned: every chip and band goes, with no motion. */
  drop: () => void;
  /** A full load: nothing shows for anyone, and no timer is left. */
  clear: () => void;
}

const EMPTY: StatDeltaState = { recent: NO_DELTAS, fading: false, held: NO_DELTAS, draining: NO_DELTAS, chipsOpen: false };

const anyMoved = (deltas: ScopedStatDeltas) => scopedEntries(deltas).some(([, changes]) => Object.keys(changes).length > 0);

const sum = (a: Changes | undefined, b: Changes) => {
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) out[key] = (out[key] || 0) + value;
  return out;
};

/** `deltas` with each followed owner's part replaced by its total. */
const following = (deltas: ScopedStatDeltas, followed: FollowedStatDeltas): ScopedStatDeltas =>
  ({ ...deltas, owners: { ...deltas.owners, ...followed } });

/** What the rows read: a followed owner's band is its total, and so is its chip while the chips are open. */
const shown = (s: StatDeltaState, followed: FollowedStatDeltas) => ({
  recent: s.chipsOpen ? following(s.recent, followed) : s.recent,
  held: following(s.held, followed),
});

/**
 * The live change feedback of every scope's stat rows: the chip, the held band and the draining band, with
 * their timers. Event scopes (global scope) write through the calls. Followed owners take `followed`, each
 * owner's change this turn, as their band, and as their chip while a chip write keeps the chips open. Read in
 * the render that moves them, so a followed row never paints a frame behind its value.
 */
export function useStatDeltas(followed: FollowedStatDeltas): StatDeltas {
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

  const show = useCallback((owner: OwnerId, changes: Record<string, number>) => {
    setState((s) => ({
      ...s,
      recent: withPart(NO_DELTAS, owner, changes),
      held: withPart(s.held, owner, { ...partOf(s.held, owner), ...changes }),
      chipsOpen: true,
    }));
    stopChipTimer();
    chipTimer.current = setTimeout(() => {
      chipTimer.current = null;
      setState((s) => ({ ...s, recent: NO_DELTAS, chipsOpen: false }));
    }, CHIP_MS);
  }, []);

  const add = useCallback((owner: OwnerId, changes: Record<string, number>) => {
    setState((s) => ({
      ...s,
      recent: withPart(s.recent, owner, sum(partOf(s.recent, owner), changes)),
      held: withPart(s.held, owner, sum(partOf(s.held, owner), changes)),
      chipsOpen: true,
    }));
  }, []);

  const hold = useCallback((owner: OwnerId, changes: Record<string, number>) => {
    setState((s) => ({ ...s, held: withPart(s.held, owner, changes) }));
  }, []);

  const settle = useCallback(() => setState((s) => (s.fading ? { ...s, fading: false } : s)), []);

  const drain = useCallback(() => {
    // The totals as this render read them, before the turn's new baseline zeroes them.
    const totals = followedRef.current;
    const now = shown(stateRef.current, totals);
    if (anyMoved(now.held)) {
      setState((prev) => ({ ...prev, draining: shown(prev, totals).held, held: NO_DELTAS }));
      stopDrainTimer();
      drainTimer.current = setTimeout(() => {
        drainTimer.current = null;
        setState((prev) => ({ ...prev, draining: NO_DELTAS }));
      }, DRAIN_MS);
    }
    if (anyMoved(now.recent)) {
      // The chips freeze as they stand, so followed owners' chips fade too.
      setState((prev) => ({ ...prev, recent: shown(prev, totals).recent, fading: true, chipsOpen: false }));
      stopChipTimer();
      chipTimer.current = setTimeout(() => {
        chipTimer.current = null;
        setState((prev) => ({ ...prev, recent: NO_DELTAS, fading: false, chipsOpen: false }));
      }, FADE_MS);
    }
  }, []);

  const drop = useCallback(() => setState((s) => ({ ...s, recent: NO_DELTAS, held: NO_DELTAS, chipsOpen: false })), []);

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

/** One scope's changes, with a stable empty value. */
export const deltasOf = (deltas: ScopedStatDeltas, owner: OwnerId): Changes => partOf(deltas, owner) ?? NONE;

/**
 * The delta props of one stat row. `past` is the viewed turn's recorded change, or null while live; a past
 * turn's band grows in and never drains.
 */
export function rowDelta(deltas: StatDeltas, owner: OwnerId, key: string, past: number | null) {
  if (past !== null) return { change: past, barDelta: past, draining: false, fading: deltas.fading };
  const held = partOf(deltas.held, owner)?.[key] || 0;
  const drainingBy = partOf(deltas.draining, owner)?.[key] || 0;
  return {
    change: partOf(deltas.recent, owner)?.[key] || 0,
    barDelta: held || drainingBy,
    draining: !held && !!drainingBy,
    fading: deltas.fading,
  };
}
