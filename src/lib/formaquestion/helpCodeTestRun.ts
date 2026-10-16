/**
 * The code test's work: the analysis, then a Test Code run. The help session imports this module only at the
 * first code test call, since it pulls in the analysis and the sandbox engine.
 */
import { codeDiagnostics, type SurfaceAnalysisOptions, type CodeDiagnostic, type EntryNoun, type MissingName } from '@/lib/statCodeAnalysis';
import { memberStep, placeholderPathExpression } from '@/lib/statCodePaths';
import { statBoxAnalysisOptions } from '@/lib/statCodeBoxOptions';
import {
  findStat, findTrait, missingSegments, runTestCode, statCodeNames, type StatCodeWorld, type TestCodeReport, type TestRunOwner,
} from '@/lib/statCodeTestRun';
import { SCRIPT_SURFACES, scriptSurface } from '@/lib/statCodeSurface';
import { SAMPLE_SENTENCE } from '@/lib/scriptTestSamples';
import { randomUUID } from '@/lib/uuid';
import type { ScriptTiming } from '@/types';

/** The most characters of code one finding quotes. */
const FINDING_TEXT_MAX = 60;

/** One analysis finding, at its 1-based line, with the code it marks. */
export interface CodeTestFinding {
  line: number;
  text?: string;
  message: string;
}

/** A name the world does not have yet, at the 1-based line that first names it. */
export interface CodeTestMissing {
  line: number;
  kind: EntryNoun;
  name: string;
  /** The whole path, as `persona.traits.Seasoned`. */
  path: string;
}

export interface CodeTestResult {
  /** False: no world is open, so names went unchecked and nothing ran. */
  world: boolean;
  errors: CodeTestFinding[];
  warnings: CodeTestFinding[];
  /** Absent with no world open. */
  notInWorld?: CodeTestMissing[];
  /** Absent with no world open. */
  run?: TestCodeReport;
}

const lineAt = (code: string, from: number) => code.slice(0, from).split('\n').length;

function findingOf(code: string, { from, to, message }: CodeDiagnostic): CodeTestFinding {
  const text = code.slice(from, to).trim().slice(0, FINDING_TEXT_MAX);
  return { line: lineAt(code, from), ...(text && { text }), message };
}

/** The path root each owner global takes. */
const OWNER_ROOT = { entities: 'entity', dictionaries: 'dictionary', persona: 'persona' } as const;
const isOwnerRoot = (root: MissingName['root']): root is keyof typeof OWNER_ROOT => root in OWNER_ROOT;

/** The code path of a missing name. Under an owner, a trait or placeholder follows the owner's map. */
function missingPath(name: MissingName): string {
  const { kind, root, segments } = name;
  const steps = (names: readonly string[]) => names.map(memberStep).join('');
  if (!isOwnerRoot(root) || (kind !== 'trait' && kind !== 'placeholder')) return `${root}${steps(segments)}`;
  if (kind === 'placeholder') return placeholderPathExpression(missingSegments(name), OWNER_ROOT[root]);
  return `${root}${steps(segments.slice(0, -1))}.traits${steps(segments.slice(-1))}`;
}

/** The findings and the names the world does not have yet. A missing name is neither error nor warning. */
function analysis(code: string, options: SurfaceAnalysisOptions): Omit<CodeTestResult, 'world' | 'run'> & { missing: MissingName[] } {
  const diagnostics = codeDiagnostics(code, options);
  const of = (severity: CodeDiagnostic['severity']) =>
    diagnostics.filter((d) => d.severity === severity && !d.missing).map((d) => findingOf(code, d));
  const notInWorld = new Map<string, CodeTestMissing>();
  const missing: MissingName[] = [];
  for (const { from, missing: name } of diagnostics) {
    if (!name) continue;
    const path = missingPath(name);
    if (notInWorld.has(path)) continue;
    notInWorld.set(path, { line: lineAt(code, from), kind: name.kind, name: name.segments[name.segments.length - 1], path });
    missing.push(name);
  }
  return { errors: of('error'), warnings: of('warning'), notInWorld: [...notInWorld.values()], missing };
}

/** Whose script a test runs: a stat or trait by name, or the world. */
export type CodeTestOwner = { kind: 'stat' | 'trait'; name: string } | { kind: 'world' };

/** The analysis owner of a run's owner. A Blueprint trait's owner stats go unchecked, since its owners vary. */
const analysisOwner = (owner: TestRunOwner | undefined, kind: CodeTestOwner['kind']) => owner && {
  kind: owner.entityId ? 'entity' as const : 'blueprint' as const,
  ...((owner.entityId || kind === 'stat') && { statNames: owner.stats.map((owned) => owned.name) }),
};

/**
 * Tests `code` in its `timing` on `owner`: a world stat, a Blueprint stat or an entity's own stat; a global,
 * Blueprint or entity trait; or the world. An owned stat or trait runs with its `owner`. With no world, the
 * analysis runs with every name check off and the run is skipped. An unknown stat reads as a blank `self`, and
 * an unknown trait as one not held. During AI Output rewrites the sample sentence.
 */
export async function testScript(code: string, timing: ScriptTiming, owner: CodeTestOwner, world: StatCodeWorld | undefined): Promise<CodeTestResult> {
  const surface = scriptSurface(SCRIPT_SURFACES[owner.kind], timing);
  if (!world) {
    const { errors, warnings } = analysis(code, { surface });
    return { world: false, errors, warnings };
  }
  const names = statCodeNames(world);
  const name = owner.kind === 'world' ? '' : owner.name.trim();
  const stat = owner.kind === 'stat' ? findStat(world, names, name) : undefined;
  const trait = owner.kind === 'trait' ? findTrait(world, names, name) : undefined;
  const runOwner = stat?.owner ?? trait?.owner;
  const selfName = stat?.stat.name ?? trait?.trait.name ?? (owner.kind === 'trait' ? name : '');
  const { missing, ...rest } = analysis(code, statBoxAnalysisOptions(names, { selfName, owner: analysisOwner(runOwner, owner.kind), surface }));
  const self = owner.kind === 'stat' ? stat?.stat ?? { id: randomUUID(), name: '' } : null;
  return {
    world: true,
    ...rest,
    run: await runTestCode(code, timing, self, names, {
      pendingPersona: true, missing, owner: runOwner,
      ...(owner.kind === 'trait' && { selfTrait: trait?.trait ?? { id: randomUUID(), name } }),
      ...(timing === 'output' && { sentence: SAMPLE_SENTENCE }),
    }),
  };
}
