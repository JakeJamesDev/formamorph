import type { RegenUnit, Stat } from '@/types';
import { TURN_TIME_UNITS, TURN_TIME_UNIT_HOURS } from './gameClock';

export const REGEN_UNITS: readonly RegenUnit[] = TURN_TIME_UNITS;

export const REGEN_UNIT_LABELS: Record<RegenUnit, string> = {
  minutes: 'Minute',
  hours: 'Hour',
  days: 'Day',
  weeks: 'Week',
};

export const regenUnitOf = (stat: Pick<Stat, 'regenUnit'>): RegenUnit =>
  stat.regenUnit && stat.regenUnit in TURN_TIME_UNIT_HOURS ? stat.regenUnit : 'hours';

// Twelve significant digits hide the float noise of a per-hour round trip, so 1 per day reads back as 1.
const tidy = (n: number) => Number(n.toPrecision(12));

/** The stored per-hour `regen` as the amount per `unit`. */
export const regenPer = (regenPerHour: number, unit: RegenUnit): number => tidy(regenPerHour * TURN_TIME_UNIT_HOURS[unit]);

/** An amount per `unit` as the per-hour `regen` the turn applies. */
export const regenPerHour = (amount: number, unit: RegenUnit): number => amount / TURN_TIME_UNIT_HOURS[unit];
