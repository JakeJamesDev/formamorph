import { execFileSync } from 'node:child_process';
import pins from '../../scripts/pinnedCommits.json';

/** The last commit before the bundled worlds refresh changed a world file. */
export const PRE_REFRESH_SHA = pins.preRefresh;

/** The last commit before the bundled worlds expansion changed a world file. */
export const PRE_EXPANSION_SHA = pins.preExpansion;

/**
 * A bundled world's file as it stood at a commit, parsed. Throws when the commit is missing, so a clone without
 * it fails rather than skipping.
 *
 * @param sha - The commit to read
 * @param id - The world's file name without `.json`
 */
export function worldAt(sha: string, id: string): Record<string, unknown> {
  const text = execFileSync('git', ['show', `${sha}:src/defaultworlds/${id}.json`], { maxBuffer: 1 << 30 });
  return JSON.parse(text.toString('utf8')) as Record<string, unknown>;
}
