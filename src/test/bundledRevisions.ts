import { execFileSync } from 'node:child_process';

/** The last commit before the bundled worlds refresh changed a world file. CI fetches it into its shallow clone. */
export const PRE_REFRESH_SHA = 'ace2e02040d6e94e0367beae64e72bc0aa65bdef';

/** The last commit before the bundled worlds expansion changed a world file. CI fetches it into its shallow clone. */
export const PRE_EXPANSION_SHA = '2f45261a55abe56fc50148c08097301b57d8b05c';

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
