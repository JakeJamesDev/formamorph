/**
 * The Issues instrument's on-demand half: actually running every script in the real sandbox, every timing, and
 * reporting what came back. On demand rather than live because each script costs a QuickJS VM, and the badge
 * has to answer instantly on every keystroke.
 *
 * Pure with respect to the world: it takes the turn-one state Test Code takes, runs each script over a fresh Sandbox
 * Snapshot of what the scripts above it left, and returns findings. The rules module owns the rows this raises ({@link SCRIPT_EXECUTION},
 * {@link SCRIPT_UNKNOWN_NAME}), so an execution failure lists, groups and sorts exactly like a static finding.
 */
import type { StatCodeFailure, StatCodeResult } from '@/lib/statCodeExecutor';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { SAMPLE_SENTENCE, sampleTurn } from '@/lib/scriptTestSamples';
import { askedBy, type ScriptPromptHost } from '@/lib/scriptPrompts';
import {
  ruleScripts, scriptFinding, scriptTreeWorldOf, SCRIPT_EXECUTION, SCRIPT_UNKNOWN_NAME, type Finding, type FindingItem, type RuleWorld,
} from './rules';
import { boxHomeOf } from '@/lib/codeBoxOwner';
import { openingHomeOf, openingStateOf, type OpeningPersona } from '@/lib/openingState';
import { snapshotOf, type SandboxSnapshot, type UnitHome } from '@/lib/sandboxSnapshot';
import { SCRIPT_TIMINGS } from '@/lib/scripts';
import { turnOneClock, type RunTiming } from '@/lib/statCodeTiming';
import { afterScript, chainSnapshotOf, playedScripts, type SandboxState, type StatCodeTurn } from '@/lib/statCodeTurn';
import { runRowKeys, runRowPlace } from '@/lib/worldScripts';
import type { Script, ScriptTiming } from '@/types';

export { SCRIPT_EXECUTION, SCRIPT_UNKNOWN_NAME } from './rules';

/** How a run failed, in the author's words. */
const FAILURE: Record<StatCodeFailure, string> = {
  timeout: 'times out and never finishes',
  'non-number': 'doesn’t return a number',
  throw: 'throws when it runs',
  'bad-write': 'writes a placeholder or trait a value of the wrong type',
  canceled: 'asked the player and the prompt was closed',
};

/** What a stat script's failure leaves behind. */
const STAT_LEFT: Record<StatCodeFailure, string> = {
  timeout: 'so the stat keeps its value',
  'non-number': 'so the stat keeps its manual value',
  throw: 'so the stat keeps its manual value',
  'bad-write': 'so the run’s writes are ignored',
  canceled: 'so the run’s writes are ignored',
};

/** One script the check runs, named as its row names it. */
type ScriptUnit = {
  /** Its row in the Scripts tab. */
  key: string;
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
  ? 'so its sentence passes unchanged' : 'stat' in home ? STAT_LEFT[kind] : 'so the run’s writes are ignored');

const quote = (name: string) => `“${name}”`;
const quoteAll = (names: readonly string[]) => names.map(quote).join(', ');

/** The names a run wrote that the world lacks, phrased for the row; null when every write applied. */
function unknownNames({ unknownPlaceholders = [], unknownTraits = [] }: StatCodeResult): string | null {
  const parts = [
    ...(unknownPlaceholders.length ? [`no placeholder is named ${quoteAll(unknownPlaceholders)}`] : []),
    ...(unknownTraits.length ? [`no trait is named ${quoteAll(unknownTraits)}`] : []),
  ];
  return parts.length ? parts.join(' and ') : null;
}

/** The diary writes an open-cast run could not place, phrased for the row; null when there are none (Q2). */
const diaryNames = ({ maybeDiary = [] }: StatCodeResult): string | null => {
  if (!maybeDiary.length) return null;
  const one = maybeDiary.length === 1;
  return `a diary for ${quoteAll(maybeDiary)}, ${one ? 'a name' : 'names'} no entity has yet. ${one ? 'An entity with that name' : 'Entities with those names'} can appear during play.`;
};

/** Every filled script in the world, in check order: the world's, then each stat's, then each trait's. A linked
 *  stat runs only scripts its link overrides; a Blueprint box runs once, under the Owner its home derives (Q11). */
const scriptUnits = (world: RuleWorld): ScriptUnit[] => {
  const placeholders = allPlaceholders(world);
  return ruleScripts(world).map(({ listed, ref, label, item }): ScriptUnit => ({
    key: listed.key,
    script: listed.box,
    home: listed.kind === 'world' ? { kind: 'world' } : openingHomeOf(boxHomeOf(listed.box, placeholders)),
    ref, label, item,
  }));
};

/** How many scripts a check runs. */
export const checkedScriptCount = (world: RuleWorld): number => scriptUnits(world).length;

/** The Bench's state of `world` at turn one for a `timing` run: Test Code's clock and the authored enabled map. */
const benchStateOf = (world: RuleWorld, timing: RunTiming, persona: OpeningPersona | undefined): SandboxState =>
  ({ ...openingStateOf(world, undefined, persona), clock: turnOneClock(timing), turn: sampleTurn(world.worldOverview, timing) });

/** The Bench's snapshot of `world` at turn one for a `timing` run: its state and the open cast, with no editor
 *  overlays (Q2, Q6). */
export const benchSnapshotOf = (world: RuleWorld, timing: RunTiming, { persona }: { persona?: OpeningPersona } = {}): SandboxSnapshot =>
  snapshotOf(benchStateOf(world, timing, persona), { openCast: true });

/** What a run of `unit` reports, or null when it ran clean and every write named something. */
function findingOf(unit: ScriptUnit, result: StatCodeResult): Finding | null {
  const { ref, item } = unit;
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
}

/** The turn a check walks one timing with, from the world at turn one. */
const benchTurnOf = (world: RuleWorld, timing: ScriptTiming, persona: OpeningPersona | undefined): StatCodeTurn => {
  const state = benchStateOf(world, timing, persona);
  return {
    state, timing, worldScripts: world.scripts, switchRowOrder: runRowKeys(scriptTreeWorldOf(world), 'switch'), previous: state.stats, asks: [], regenApplied: {},
    statNameOf: (stat) => stat.name, traitNameOf: (trait) => trait.name,
  };
};

/** A Blueprint box runs once under its own Owner, not under the first owner a play run reaches it through. */
const isBlueprintHome = ({ kind }: UnitHome) => kind === 'blueprintStat' || kind === 'blueprintTrait';

/**
 * Run each filled script once, in its own timing, and report the ones that fail, then the ones whose writes
 * named nothing. Each timing walks the Scripts tab's order from the world at turn one, every script reading the writes
 * of the scripts above it. A script play wouldn't run now, such as one on an off trait, still runs and reports but
 * adds nothing (Q26). A blank script never reaches the sandbox, so a world of plain stats costs nothing. A During AI
 * Output script rewrites a sample sentence and a switch script fires on a sample trait (Q49). `prompts` answers
 * `player.*`.
 */
export async function checkScripts(
  world: RuleWorld, { prompts, persona }: { prompts?: ScriptPromptHost; persona?: OpeningPersona } = {},
): Promise<Finding[]> {
  const units = scriptUnits(world);
  if (!units.length) return [];
  const treeWorld = scriptTreeWorldOf(world);
  const found = new Map<ScriptUnit, Finding | null>();
  for (const timing of SCRIPT_TIMINGS) {
    const placeOf = runRowPlace(treeWorld, timing);
    const rows = units.filter((unit) => unit.script.timing === timing).sort((a, b) => placeOf(a.key) - placeOf(b.key));
    if (!rows.length) continue;
    let now = benchTurnOf(world, timing, persona);
    let sentence = SAMPLE_SENTENCE;
    let choices: readonly string[] | undefined;
    for (const unit of rows) {
      const played = playedScripts(now).get(unit.key);
      const result = await chainSnapshotOf(now, { openCast: true }).run({
        // A script in play reads its own stat as the chain left it.
        home: played && !isBlueprintHome(unit.home) ? played.unit.home : unit.home, timing, code: unit.script.code,
        ...(prompts && { prompts: askedBy(prompts, unit.label) }),
        ...(timing === 'output' && { narration: sentence }),
        ...(timing === 'switch' && { switched: 'sample' as const }),
        ...(choices && { choices }),
      });
      found.set(unit, findingOf(unit, result));
      if (!played || result.error) continue;
      now = afterScript(now, played, result);
      sentence = result.sentence ?? sentence;
      choices = result.choices ?? choices;
    }
  }
  return units.flatMap((unit) => found.get(unit) ?? []);
}
