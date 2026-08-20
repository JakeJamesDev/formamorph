import type { ServerEventPhase } from '@/types';

/** The phases the acknowledge modal renders, in the order an event passes through them. Exported so the
 *  dev-router ledger can be held in lockstep with what the modal can actually be opened on. */
export const EVENT_ACK_PHASES: readonly ServerEventPhase[] = ['start', 'end'];
