/**
 * The code test's work: the analysis, then a Test Code run. The help session imports this module only at the
 * first code test call, since it pulls in the analysis and the sandbox engine.
 */
import { statCodeDiagnostics, type AnalysisOptions, type CodeDiagnostic } from '@/lib/statCodeAnalysis';
import { statCodeName } from '@/lib/statCodeNames';
import { analysisOptionsOf, runTestCode, statCodeNames, statNamed, type StatCodeWorld, type TestCodeReport } from '@/lib/statCodeTestRun';
import type { StatCodeTiming } from '@/lib/statCodeTiming';

/** The most characters of code one finding quotes. */
const FINDING_TEXT_MAX = 60;

/** One analysis finding, at its 1-based line, with the code it marks. */
export interface CodeTestFinding {
  line: number;
  text?: string;
  message: string;
}

export interface CodeTestResult {
  /** False: no world is open, so names went unchecked and nothing ran. */
  world: boolean;
  errors: CodeTestFinding[];
  warnings: CodeTestFinding[];
  run: TestCodeReport | null;
}

function findingOf(code: string, { from, to, message }: CodeDiagnostic): CodeTestFinding {
  const text = code.slice(from, to).trim().slice(0, FINDING_TEXT_MAX);
  return { line: code.slice(0, from).split('\n').length, ...(text && { text }), message };
}

function findings(code: string, options: AnalysisOptions): Pick<CodeTestResult, 'errors' | 'warnings'> {
  const diagnostics = statCodeDiagnostics(code, options);
  const of = (severity: CodeDiagnostic['severity']) => diagnostics.filter((d) => d.severity === severity).map((d) => findingOf(code, d));
  return { errors: of('error'), warnings: of('warning') };
}

/**
 * Tests `code` from the `box` box of the stat `statName` names. With no world, the analysis runs with every
 * name check off and the run is skipped. An unknown stat reads as a blank `self`.
 */
export async function testStatCode(code: string, box: StatCodeTiming, statName: string, world: StatCodeWorld | undefined): Promise<CodeTestResult> {
  if (!world) return { world: false, ...findings(code, {}), run: null };
  const names = statCodeNames(world);
  const stat = statNamed(world, statName.trim());
  const selfName = stat ? statCodeName(stat.name, names.placeholders.list) : '';
  return {
    world: true,
    ...findings(code, analysisOptionsOf(names, selfName)),
    run: await runTestCode(code, box, stat ? { ...stat, name: selfName } : { id: crypto.randomUUID(), name: '' }, names),
  };
}
