import { useCallback, useMemo, useState } from "react";
import type { VariableTreeOwner } from "@/lib/statCodeVariableTree";
import { Button } from "@/components/ui/button";
import { SquareFunction } from "lucide-react";
import { migrateStatCodeRoutes } from "@/lib/statCodeRoutes";
import { runTestCode } from "@/lib/statCodeTestRun";
import { statBoxAnalysisOptions, type StatCodeNames } from "@/lib/statCodeBoxOptions";
import type { CodeTraitPlace } from "@/lib/statCodeAnalysis";
import { StatCodeTemplateDialog } from "@/components/modals/StatCodeTemplateDialog";
import { CodeArea } from "@/components/prompt/CodeArea";
import { CODE_BOX_TARGET, TIMING_LABEL, type StatCodeTiming } from "@/lib/statCodeTiming";
import { targetAttribute } from "@/lib/surface/surfaceTargets";
import type { CodeBoxOwner, CodeWorldLookup } from "@/lib/codeWorldLookup";
import { useCodeCardNavigation } from "@/lib/codeCardNavigation";
import { settleCodeUseReveal, type CodeUseReveal } from "@/lib/codeUseReveal";
import type { Stat } from "@/types";

export type { CodeBoxOwner as StatCodeBoxOwner } from "@/lib/codeWorldLookup";

/** Everything both boxes complete against and run under, derived once by the panel that holds them. */
export interface StatCodeBoxContext {
  /** Whose code the boxes hold. Null for a world stat. */
  owner: CodeBoxOwner | null;
  /** The world's names: what completes, what the checks read, and what a run's entries hold. */
  names: StatCodeNames;
  /** What `owner.stats` keys, under their code names: the entity's own stats, or a Blueprint group's. None in a
   *  world stat's box. */
  ownerStats: Stat[];
  ownerStatNames: string[];
  /** The edited stat's own code name. */
  selfName: string;
  /** What a template's placeholder slot picks from. */
  placeholderPlaces: CodeTraitPlace[];
  /** Each box's card lookup. Absent in the library, which has no world. */
  lookup?: (timing: StatCodeTiming) => CodeWorldLookup;
}

/**
 * One of a stat's two code boxes: the editor, its own Templates menu, its own Test Code button, and the
 * report that run left. Each box holds its own report, so editing one leaves the other's standing.
 *
 * A run here is handed no turn, so `previous` reads as the stat itself and every `delta` reads zero, which
 * is what the before box reads in play too.
 */
export function StatCodeBox({ timing, stat, value, onChange, context, reveal }: {
  timing: StatCodeTiming;
  /** The stat as the panel currently holds it, mid-edit: what the run reads as `self`. */
  stat: Partial<Stat> & Pick<Stat, 'id'>;
  value: string;
  onChange: (code: string) => void;
  context: StatCodeBoxContext;
  /** A Find All Uses row bound for this box. */
  reveal?: CodeUseReveal | null;
}) {
  /** What the last run wrote: the value, each bound, each placeholder, then each trait switch, as one
   *  line. Null when it wrote nothing. */
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The writes the last run made that did nothing: unknown names, and `acquired`. */
  const [warnings, setWarnings] = useState<string[]>([]);
  /** What the editor's own reader found, phrased for the test row. Null when it found nothing. */
  const [problems, setProblems] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const label = TIMING_LABEL[timing];
  const { selfName, names, placeholderPlaces, owner, ownerStats, ownerStatNames, lookup } = context;
  const { codeNamedStats: worldStats, traitPlaces, entities } = names;
  // The one build of this box's options: the editor and Test Code's problem count both read these.
  const analysis = useMemo(() => statBoxAnalysisOptions(names, {
    selfName, ...(owner && { owner: { kind: owner.kind, statNames: ownerStatNames } }), lookup: lookup?.(timing),
  }), [names, selfName, owner, ownerStatNames, lookup, timing]);
  const navigation = useCodeCardNavigation();

  // What the Variable menu's Owner group lists. An entity the editor has no names for, as in the library, still lists its stats.
  const treeOwner = useMemo<VariableTreeOwner | null>(() => {
    if (!owner) return null;
    if (owner.kind === 'blueprint') return { kind: 'blueprint', statNames: ownerStatNames };
    const named = entities.find((entity) => entity.id === owner.entityId)
      ?? { id: owner.entityId, name: '', traits: [], persona: false };
    return { kind: 'entity', entity: { ...named, stats: ownerStatNames } };
  }, [owner, entities, ownerStatNames]);

  /** Drop what the last test said. Editing the code makes every part of that report stale together. */
  const clearReport = useCallback(() => {
    setResult(null);
    setError(null);
    setWarnings([]);
    setProblems(null);
  }, []);

  // A write from outside the box, such as the help window's Insert, makes the report stale as typing does.
  const [reportedCode, setReportedCode] = useState(value);
  if (reportedCode !== value) {
    setReportedCode(value);
    clearReport();
  }

  const write = (code: string) => {
    clearReport();
    onChange(code);
  };

  const run = async () => {
    setTesting(true);
    clearReport();

    try {
      // Only the editor's chunk holds the reader, and CodeArea fetches that chunk on demand — so this
      // stays off the world editor's own bundle.
      const { statCodeDiagnostics, summarizeProblems } = await import('@/lib/statCodeAnalysis');
      setProblems(summarizeProblems(statCodeDiagnostics(value, analysis)));
    } catch {
      // What the run itself found is the point; the count is what the editor adds to it.
    }

    try {
      // A switch is reported here and never applied.
      const report = await runTestCode(
        value, timing, { ...stat, name: selfName }, names,
        { ...(owner && { owner: { ...(owner.kind === 'entity' && { entityId: owner.entityId }), stats: ownerStats } }) },
      );
      if (report.error) {
        setError(report.error);
        return;
      }
      const parts = [...(report.value !== null ? [`Result: ${report.value}`] : []), ...report.writes];
      if (parts.length) setResult(parts.join(' · '));
      setWarnings(report.dropped);
    } catch (thrown) {
      setError((thrown as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-2" {...targetAttribute('worldEditorStat.code', CODE_BOX_TARGET[timing])}>
      <CodeArea
        value={value}
        onChange={write}
        ariaLabel={`Stat Code ${label}`}
        surface={analysis.surface}
        statNames={analysis.statNames}
        owner={treeOwner}
        selfName={analysis.selfName}
        placeholders={analysis.placeholders}
        traits={traitPlaces}
        entities={analysis.entities}
        lookup={analysis.lookup}
        navigation={navigation}
        revealLine={reveal?.line}
        onLineRevealed={() => { if (reveal) settleCodeUseReveal(reveal); }}
        // Its caption is the section heading, which full screen leaves behind — so the field names
        // itself in the toolbar and stays labeled in both states.
        label={label}
        // One line per box. The completions, the ? and Templates teach the rest of the sandbox.
        placeholder={timing === 'before'
          ? '// Set self, pin a placeholder, or switch a trait. Start typing to see what you can use.'
          : '// Return a number, or set self. Start typing to see what you can use.'}
        rows={6}
      />

      <StatCodeTemplateDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        timing={timing}
        stats={worldStats}
        owner={owner?.kind}
        ownerStats={ownerStats}
        currentStatId={stat.id}
        hasExistingCode={!!value.trim()}
        onInsert={(code) => write(migrateStatCodeRoutes(code, names.placeholders))}
        placeholderPlaces={placeholderPlaces}
        traitPlaces={traitPlaces}
        entities={entities}
      />

      <div className="flex flex-wrap justify-between items-center gap-2">
        {/* Both buttons act on this box alone, so both name it: two Test Code buttons are on the tab. */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void run()}
            disabled={testing || !value.trim()}
            variant="outline"
            aria-label={`Test Code ${label}`}
          >
            {testing ? "Testing..." : "Test Code"}
          </Button>
          <Button variant="outline" onClick={() => setTemplatesOpen(true)} aria-label={`Templates ${label}`}>
            <SquareFunction className="h-4 w-4 mr-1" />
            Templates
          </Button>
        </div>

        <div className="min-w-0 text-right">
          {result !== null && <div className="text-success">{result}</div>}
          {error && <div className="text-destructive text-label">Error: {error}</div>}
          {warnings.map((warning) => <div key={warning} className="text-warning text-label">{warning}</div>)}
          {/* Always beside what the run reported, never instead of it: a run says what the code did
              this once, which is silent about a typo on a branch it didn't take. */}
          {problems && <div className="text-warning text-label">{problems}</div>}
        </div>
      </div>
    </div>
  );
}

export default StatCodeBox;
