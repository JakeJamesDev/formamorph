/**
 * The Issues instrument's on-demand half: actually running every script in the real sandbox, every timing, and
 * reporting what came back. On demand rather than live because each script costs a QuickJS VM, and the badge
 * has to answer instantly on every keystroke.
 *
 * Pure with respect to the world: it takes the turn-one Sandbox Snapshot Test Code takes, runs each script through
 * it, and returns findings. The rules module owns the rows this raises ({@link SCRIPT_EXECUTION},
 * {@link SCRIPT_UNKNOWN_NAME}), so an execution failure lists, groups and sorts exactly like a static finding.
 */
import type { StatCodeFailure, StatCodeResult } from '@/lib/statCodeExecutor';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { SAMPLE_SENTENCE, sampleTurn } from '@/lib/scriptTestSamples';
import { askedBy, type ScriptPromptHost } from '@/lib/scriptPrompts';
import {
  ruleScripts, scriptFinding, SCRIPT_EXECUTION, SCRIPT_UNKNOWN_NAME, type Finding, type FindingItem, type RuleWorld,
} from './rules';
import { boxHomeOf } from '@/lib/codeBoxOwner';
import { openingHomeOf, openingStateOf } from '@/lib/openingState';
import { snapshotOf, type SandboxSnapshot, type UnitHome } from '@/lib/sandboxSnapshot';
import { turnOneClock, type RunTiming } from '@/lib/statCodeTiming';
import type { Script } from '@/types';

export { SCRIPT_EXECUTION, SCRIPT_UNKNOWN_NAME } from './rules';

/** How a run failed, in the author's words. */
const FAILURE: Record<StatCodeFailure, string> = {
  timeout: 'times out — it never finishes',
  'non-number': 'doesn’t return a number',
  throw: 'throws when it runs',
  'bad-write': 'writes a placeholder or trait a value of the wrong type',
  canceled: 'asked the player and the prompt was closed',
};

/** What a stat script's failure leaves behind. */
const STAT_LEFT: Record<StatCodeFailure, string> = {
  timeout: 'so the value is left as it was',
  'non-number': 'so the stat keeps its manual value',
  throw: 'so the stat keeps its manual value',
  'bad-write': 'so the run changes nothing',
  canceled: 'so the run changes nothing',
};

/** One script the check runs, named as its row names it. */
type ScriptUnit = {
  script: Script;
  /** Where the script lives, its stats at their opening values. */
  home: UnitHome;
  /** The script by its name or its owner-and-timing fallback, then its owner (Q22, Q49). */
  ref: string;
  /** The script's display name, shown beside its prompts (Q9). */
  label: string;
  item: FindingItem;
};

/** What a failure leaves behind: a During AI Output sentence passes unchanged (Q22); a trait or world script,
 *  which sets no value, changes nothing. */
const leftBehind = ({ script, home }: ScriptUnit, kind: StatCodeFailure) => (script.timing === 'output'
  ? 'so its sentence passes unchanged' : 'stat' in home ? STAT_LEFT[kind] : 'so the run changes nothing');

const quote = (name: string) => `“${name}”`;
const quoteAll = (names: readonly string[]) => names.map(quote).join(', ');

/** The names a run wrote that the world lacks, phrased for the row; null when every write landed. */
function unknownNames({ unknownPlaceholders = [], unknownTraits = [] }: StatCodeResult): string | null {
  const parts = [
    ...(unknownPlaceholders.length ? [`no placeholder answers ${quoteAll(unknownPlaceholders)}`] : []),
    ...(unknownTraits.length ? [`no trait is named ${quoteAll(unknownTraits)}`] : []),
  ];
  return parts.length ? parts.join(' and ') : null;
}

/** The diary writes an open-cast run could not place, phrased for the row; null when there are none (Q2). */
const diaryNames = ({ maybeDiary = [] }: StatCodeResult): string | null => {
  if (!maybeDiary.length) return null;
  const one = maybeDiary.length === 1;
  return `a diary for ${quoteAll(maybeDiary)}, ${one ? 'a name' : 'names'} the cast lacks. Play may discover ${one ? 'it' : 'them'}.`;
};

/** Every filled script in the world, in check order: the world's, then each stat's, then each trait's. A linked
 *  stat runs only scripts its link overrides; a Blueprint box runs once, under the Owner its home derives (Q11). */
const scriptUnits = (world: RuleWorld): ScriptUnit[] => {
  const placeholders = allPlaceholders(world);
  return ruleScripts(world).map(({ listed, ref, label, item }): ScriptUnit => ({
    script: listed.box,
    home: listed.kind === 'world' ? { kind: 'world' } : openingHomeOf(boxHomeOf(listed.box, placeholders)),
    ref, label, item,
  }));
};

/** How many scripts a check runs. */
export const checkedScriptCount = (world: RuleWorld): number => scriptUnits(world).length;

/** The Bench's snapshot of `world` at turn one for a `timing` run: Test Code's clock, the authored enabled map and
 *  the open cast, with no editor overlays (Q2, Q6). */
export const benchSnapshotOf = (world: RuleWorld, timing: RunTiming): SandboxSnapshot =>
  snapshotOf({ ...openingStateOf(world), clock: turnOneClock(timing), turn: sampleTurn(world.worldOverview, timing) }, { openCast: true });

/**
 * Run each filled script once, in its own timing, and report the ones that fail, then the ones whose writes
 * named nothing. A blank script never reaches the sandbox, so a world of plain stats costs nothing. A During AI
 * Output script rewrites a sample sentence and a switch script fires on a sample trait (Q49). `prompts` answers
 * `player.*`.
 */
export async function checkScripts(world: RuleWorld, prompts?: ScriptPromptHost): Promise<Finding[]> {
  const units = scriptUnits(world);
  if (!units.length) return [];
  // One snapshot per timing, since each timing reads its own clock.
  const snapshots = new Map<RunTiming, SandboxSnapshot>();
  const snapshotFor = (timing: RunTiming) => {
    const found = snapshots.get(timing);
    if (found) return found;
    const made = benchSnapshotOf(world, timing);
    snapshots.set(timing, made);
    return made;
  };

  const results = await Promise.all(units.map(async (unit) => {
    const { script: { code, timing }, home, ref, label, item } = unit;
    const result = await snapshotFor(timing).run({
      home, timing, code,
      ...(prompts && { prompts: askedBy(prompts, label) }),
      ...(timing === 'output' && { narration: SAMPLE_SENTENCE }),
      ...(timing === 'switch' && { switched: 'sample' as const }),
    });
    if (result.error) {
      const kind = result.kind ?? 'throw';
      return scriptFinding(SCRIPT_EXECUTION, `${ref} ${FAILURE[kind]}, ${leftBehind(unit, kind)}`, item);
    }
    const unknown = unknownNames(result);
    const diary = diaryNames(result);
    const ignored = `${ref} writes to unknown names. Writes ignored: ${unknown}`;
    if (unknown && diary) return scriptFinding(SCRIPT_UNKNOWN_NAME, `${ignored}. It also writes ${diary}`, item);
    if (unknown) return scriptFinding(SCRIPT_UNKNOWN_NAME, ignored, item);
    if (diary) return scriptFinding(SCRIPT_UNKNOWN_NAME, `${ref} writes ${diary}`, item);
    return null;
  }));
  return results.filter((found): found is Finding => found !== null);
}
