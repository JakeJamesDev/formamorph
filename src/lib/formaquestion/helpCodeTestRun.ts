/**
 * The code test's work: the analysis, then a Test Code run. The help session imports this module only at the
 * first code test call, since it pulls in the analysis and the sandbox engine.
 */
import { statCodeDiagnostics, type AnalysisOptions, type CodeDiagnostic, type EntryNoun, type MissingName } from '@/lib/statCodeAnalysis';
import { statCodeName } from '@/lib/statCodeNames';
import { memberStep, placeholderPathExpression } from '@/lib/statCodePaths';
import { analysisOptionsOf, missingSegments, runTestCode, statCodeNames, statNamed, type StatCodeWorld, type TestCodeReport } from '@/lib/statCodeTestRun';
import type { StatCodeTiming } from '@/lib/statCodeTiming';

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
function analysis(code: string, options: AnalysisOptions): Omit<CodeTestResult, 'world' | 'run'> & { missing: MissingName[] } {
  const diagnostics = statCodeDiagnostics(code, options);
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

/**
 * Tests `code` from the `box` box of the stat `statName` names. With no world, the analysis runs with every
 * name check off and the run is skipped. An unknown stat reads as a blank `self`.
 */
export async function testStatCode(code: string, box: StatCodeTiming, statName: string, world: StatCodeWorld | undefined): Promise<CodeTestResult> {
  if (!world) {
    const { errors, warnings } = analysis(code, {});
    return { world: false, errors, warnings };
  }
  const names = statCodeNames(world);
  const stat = statNamed(world, statName.trim());
  const selfName = stat ? statCodeName(stat.name, names.placeholders.list) : '';
  const { missing, ...found } = analysis(code, analysisOptionsOf(names, selfName));
  return {
    world: true,
    ...found,
    run: await runTestCode(code, box, stat ? { ...stat, name: selfName } : { id: crypto.randomUUID(), name: '' }, names, { pendingPersona: true, missing }),
  };
}
