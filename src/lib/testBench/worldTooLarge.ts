/**
 * The Issues instrument's out-of-band publish-size finding: the world's measured publish bytes checked
 * against its limit. Out of band because the size comes from the debounced worker measure the Bench hook
 * holds, not from the synchronous pure pass. The rules module owns the row this raises
 * ({@link WORLD_TOO_LARGE}), so it groups, sorts, and dismisses exactly like a static finding.
 */
import { formatPublishBytes, PUBLISH_LIMITS } from '@/lib/publishLimits';
import { finding, WORLD_TOO_LARGE, worldItem, type Finding, type RuleWorld } from './rules';

/** One finding when `bytes` has reached the world limit, none below it or while a measure is still pending. */
export function checkWorldSize(world: RuleWorld, bytes: number | null): Finding[] {
  if (bytes === null || bytes < PUBLISH_LIMITS.world) return [];
  const message = `The world is ${formatPublishBytes(bytes)}, over the ${formatPublishBytes(PUBLISH_LIMITS.world)} publish limit.`;
  return [finding(WORLD_TOO_LARGE, message, [worldItem(world)])];
}
