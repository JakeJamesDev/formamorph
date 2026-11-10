import type { IndividualStates } from "@/types";
import { isStrictNow, type Routine } from "./positionEngine";

/** An Individual's follow state and whether its row in force is Strict. */
export interface MovementState { follow?: "following" | "waiting"; strict: boolean }

/** Each Individual's movement state, by id. A Group has no entry. */
export type MovementStates = Readonly<Record<string, MovementState>>;

/** Each Individual's state at `now`, read from its saved engine state and its routine. */
export function movementStates(
  routines: readonly Routine[], individuals: Readonly<IndividualStates>, now: number,
): MovementStates {
  const out: Record<string, MovementState> = {};
  for (const routine of routines) {
    const st = individuals[routine.id];
    out[routine.id] = { ...(st?.follow && { follow: st.follow.mode }), strict: isStrictNow(routine, st, now) };
  }
  return out;
}

/** The Movement tag each listed Individual carries, by id: the full set at the player's place, Strict alone in
 *  a Nearby place, none elsewhere (Q21, Q47, Q112). Following wins over Strict. */
export function movementLabels(
  states: MovementStates, hereIds: readonly string[], nearbyIds: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of nearbyIds) {
    if (states[id]?.strict && states[id].follow !== "following") out[id] = "stays there";
  }
  for (const id of hereIds) {
    const state = states[id];
    const label = !state ? undefined
      : state.follow === "following" ? "following the player"
      : state.follow === "waiting" ? "waiting here"
      : state.strict ? "stays here"
      : undefined;
    if (label) out[id] = label;
    else delete out[id];
  }
  return out;
}
