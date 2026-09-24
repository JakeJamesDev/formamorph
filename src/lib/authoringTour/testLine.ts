/**
 * The Dictionary steps' test line: a player message In Play scans for the tour entry's keywords. The scan is
 * the Activation Tester's own, so an entry fires here exactly when it would fire in play.
 */
import { parseKeywords } from '@/lib/dictionaryUtils';
import { buildTriggerReport, describeNearMiss, type NearMiss } from '@/lib/testBench/triggers';
import { tourEntity, tourEntry, type TourItems, type TourWorld } from './steps';

/** A player action that names the entry's first keyword, and the tour entity when it has a name. Empty with no keyword. */
export function sampleTestLine(world: TourWorld, items: TourItems): string {
  const entry = tourEntry(world, items);
  const keyword = entry ? parseKeywords(entry)[0]?.trim() : undefined;
  if (!keyword) return '';
  const who = tourEntity(world, items)?.name.trim();
  return who ? `You ask ${who} about the ${keyword}.` : `You ask about the ${keyword}.`;
}

/** What the scan made of the tour entry for one test line. */
export type TestLineRead =
  /** The entry fired, and `text` is the dictionary block that holds it. */
  | { fired: true; text: string; rendered: boolean }
  /** The entry did not fire. `reason` is the Activation Tester's sentence when a rule of the entry stopped it. */
  | { fired: false; reason?: string };

/** Near misses that mean the line has no keyword of the entry, which the pane says in its own words. */
const NO_KEYWORD: ReadonlySet<NearMiss | undefined> = new Set(['no-match', 'no-keywords']);

/** Scans `testLine` the way the Activation Tester does, with every chip read through `pins`. */
export function readTestLine(
  world: TourWorld, items: TourItems, testLine: string, pins: Record<string, string>,
): TestLineRead {
  const entry = tourEntry(world, items);
  const report = buildTriggerReport(world, testLine, { pins });
  const row = report.entries.find((e) => e.entryId === entry?.id);
  if (!entry || !row?.fired) {
    return row && !NO_KEYWORD.has(row.nearMiss) ? { fired: false, reason: describeNearMiss(row) } : { fired: false };
  }
  const position = entry.position === 'before' ? 'before' : 'after';
  const text = report.rendered.find((b) => b.position === position)?.text ?? '';
  // The game's renderer drops an entry with no Value, so a firing can add nothing to the block.
  return { fired: true, text, rendered: !!entry.value };
}
