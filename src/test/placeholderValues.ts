import type { PlaceholderValue } from '@/types';

/**
 * Value records for a test fixture, from the texts a fixture wants to read as.
 *
 * Ids read as `v:<text>` — legible in a weight map, and deliberately *not* the text itself, so a fixture or
 * a helper that keys the wrong one of the two fails instead of passing by coincidence.
 */
export const phValues = (texts: readonly string[]): PlaceholderValue[] =>
  texts.map((text) => ({ id: `v:${text}`, text }));

/** The id `phValues` mints for one text — for a weight map or a trait pin written against a fixture. */
export const phValueId = (text: string): string => `v:${text}`;
