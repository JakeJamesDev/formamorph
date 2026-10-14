import { useCallback, useMemo, useState } from "react";
import type { VariableTreeOwner } from "@/lib/statCodeVariableTree";
import { Button } from "@/components/ui/button";
import { SquareFunction } from "lucide-react";
import { migrateStatCodeRoutes } from "@/lib/statCodeRoutes";
import { runTestCode } from "@/lib/statCodeTestRun";
import { statBoxAnalysisOptions, type StatCodeNames } from "@/lib/statCodeBoxOptions";
import type { CodeTraitPlace } from "@/lib/statCodeAnalysis";
import { STAT_CODE_SURFACE, TRAIT_SCRIPT_SURFACE } from "@/lib/statCodeSurface";
import { StatCodeTemplateDialog } from "@/components/modals/StatCodeTemplateDialog";
import { CodeArea } from "@/components/prompt/CodeArea";
import type { CodeBoxOwner, CodeWorldLookup } from "@/lib/codeWorldLookup";
import { useCodeCardNavigation } from "@/lib/codeCardNavigation";
import { statCodeTimingOf } from "@/lib/statCodeTiming";
import { settleCodeUseReveal, type CodeUseReveal } from "@/lib/codeUseReveal";
import type { Script, ScriptTiming, Stat } from "@/types";

export type { CodeBoxOwner as ScriptBoxOwner } from "@/lib/codeWorldLookup";

/** Everything a home's boxes complete against and run under, derived once by the panel that holds them. */
export interface ScriptBoxContext {
  /** Whose code the boxes hold. Null for a global stat or trait. */
  owner: CodeBoxOwner | null;
  /** The world's names: what completes, what the checks read, and what a run's entries hold. */
  names: StatCodeNames;
  /** What `owner.stats` keys, under their code names: the entity's own stats, or a Blueprint group's. None in a
   *  global box. */
  ownerStats: Stat[];
  /** Absent where `owner.stats` names go unchecked, as on a Blueprint trait, whose owners vary. */
  ownerStatNames?: string[];
  /** The home's own code name. */
  selfName: string;
  /** What a template's placeholder slot picks from. */
  placeholderPlaces: CodeTraitPlace[];
  /** Each box's card lookup. Absent in the library, which has no world. */
  lookup?: (timing: ScriptTiming) => CodeWorldLookup;
}

/** What `self` is in a box: the stat as the panel holds it mid-edit, or a trait. */
export type ScriptSelf = { kind: 'stat'; stat: Partial<Stat> & Pick<Stat, 'id'> } | { kind: 'trait'; id: string };

/**
 * One script's code box: the editor, the Templates menu on a stat, its own Test Code button, and the report
 * that run left. Each box holds its own report, so editing one leaves another's standing.
 *
 * A run here is handed no turn, so `previous` reads as the stat itself and every `delta` reads zero, which
 * is what the before box reads in play too.
 */
export function ScriptBox({ script, label, self, onChange, context, reveal, autoFocus }: {
  script: Script;
  /** The script's name, or its owner and timing. Each box's controls carry it. */
  label: string;
  self: ScriptSelf;
  onChange: (code: string) => void;
  context: ScriptBoxContext;
  /** A Find All Uses row bound for this box. */
  reveal?: CodeUseReveal | null;
  /** Focus the editor once it loads, as for a script just added. */
  autoFocus?: boolean;
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

  const { timing, code: value } = script;
  const isStat = self.kind === 'stat';
  const { selfName, names, placeholderPlaces, owner, ownerStats, ownerStatNames, lookup } = context;
  const { codeNamedStats: worldStats, traitPlaces, entities } = names;
  // The one build of this box's options: the editor and Test Code's problem count both read these.
  const analysis = useMemo(() => statBoxAnalysisOptions(names, {
    selfName, surface: isStat ? STAT_CODE_SURFACE : TRAIT_SCRIPT_SURFACE,
    ...(owner && { owner: { kind: owner.kind, statNames: ownerStatNames } }), lookup: lookup?.(timing),
  }), [names, selfName, isStat, owner, ownerStatNames, lookup, timing]);
  const navigation = useCodeCardNavigation();

  // What the Variable menu's Owner group lists. An entity the editor has no names for, as in the library, still lists its stats.
  const treeOwner = useMemo<VariableTreeOwner | null>(() => {
    if (!owner) return null;
    if (owner.kind === 'blueprint') return { kind: 'blueprint', statNames: ownerStatNames ?? null };
    const named = entities.find((entity) => entity.id === owner.entityId)
      ?? { id: owner.entityId, name: '', traits: [], persona: false };
    return { kind: 'entity', entity: { ...named, stats: ownerStatNames ?? [] } };
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
      const { codeDiagnostics, summarizeProblems } = await import('@/lib/statCodeAnalysis');
      setProblems(summarizeProblems(codeDiagnostics(value, analysis)));
    } catch {
      // What the run itself found is the point; the count is what the editor adds to it.
    }

    try {
      // A switch is reported here and never applied.
      const report = await runTestCode(
        value, timing, self.kind === 'stat' ? { ...self.stat, name: selfName } : null, names,
        {
          ...(owner && { owner: { ...(owner.kind === 'entity' && { entityId: owner.entityId }), stats: ownerStats } }),
          ...(self.kind === 'trait' && { selfTrait: { id: self.id, name: selfName } }),
        },
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

  // One line per box. The completions, the ? and Templates teach the rest of the sandbox.
  const hint = !isStat
    ? '// Set a stat, pin a placeholder, or switch a trait. Start typing to see what you can use.'
    : timing === 'before'
      ? '// Set self, pin a placeholder, or switch a trait. Start typing to see what you can use.'
      : '// Return a number, or set self. Start typing to see what you can use.';

  return (
    <div className="space-y-2">
      <CodeArea
        value={value}
        onChange={write}
        ariaLabel={`Code ${label}`}
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
        // Full screen leaves the row's name field behind, so the field names itself in the toolbar.
        label={label}
        placeholder={hint}
        rows={6}
        autoFocus={autoFocus}
      />

      {self.kind === 'stat' && (
        <StatCodeTemplateDialog
          open={templatesOpen}
          onOpenChange={setTemplatesOpen}
          timing={statCodeTimingOf(timing)}
          stats={worldStats}
          owner={owner?.kind}
          ownerStats={ownerStats}
          currentStatId={self.stat.id}
          hasExistingCode={!!value.trim()}
          onInsert={(code) => write(migrateStatCodeRoutes(code, names.placeholders))}
          placeholderPlaces={placeholderPlaces}
          traitPlaces={traitPlaces}
          entities={entities}
        />
      )}

      <div className="flex flex-wrap justify-between items-center gap-2">
        {/* Each button acts on this box alone, so each names it: a home can hold several. */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void run()}
            disabled={testing || !value.trim()}
            variant="outline"
            aria-label={`Test Code ${label}`}
          >
            {testing ? "Testing..." : "Test Code"}
          </Button>
          {isStat && (
            <Button variant="outline" onClick={() => setTemplatesOpen(true)} aria-label={`Templates ${label}`}>
              <SquareFunction className="h-4 w-4 mr-1" />
              Templates
            </Button>
          )}
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

export default ScriptBox;
