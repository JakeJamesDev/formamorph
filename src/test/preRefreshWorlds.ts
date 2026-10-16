import { execFileSync } from 'node:child_process';

/** The last commit before the bundled worlds refresh changed a world file. CI fetches it into its shallow clone. */
export const PRE_REFRESH_SHA = 'ace2e02040d6e94e0367beae64e72bc0aa65bdef';

/**
 * A bundled world's file as it stood before the refresh, parsed. Throws when the commit is missing, so a clone
 * without it fails rather than skipping.
 *
 * @param id - The world's file name without `.json`
 */
export function preRefreshWorld(id: string): Record<string, unknown> {
  const text = execFileSync('git', ['show', `${PRE_REFRESH_SHA}:src/defaultworlds/${id}.json`], { maxBuffer: 1 << 30 });
  return JSON.parse(text.toString('utf8')) as Record<string, unknown>;
}
