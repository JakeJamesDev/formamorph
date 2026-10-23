import { useCallback, useId, useMemo, useState } from "react";
import type { VariableTreeOwner } from "@/lib/statCodeVariableTree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScriptPromptLine } from "@/components/game/ScriptPromptLine";
import { useEditorPromptRun } from "@/lib/useEditorPromptRun";
import { useMountedRef } from "@/lib/useMountedRef";
import { SquareFunction } from "lucide-react";
import { migrateStatCodeRoutes } from "@/lib/statCodeRoutes";
import { runTestCode } from "@/lib/statCodeTestRun";
import type { OpeningFoldWorld } from "@/lib/openingState";
import type { UnitHome } from "@/lib/sandboxSnapshot";
import { statBoxAnalysisOptions, type StatCodeNames } from "@/lib/statCodeBoxOptions";
import type { CodeTraitPlace } from "@/lib/statCodeAnalysis";
import { SCRIPT_SURFACES, scriptSurface } from "@/lib/statCodeSurface";
import { StatCodeTemplateDialog } from "@/components/modals/StatCodeTemplateDialog";
import { CodeArea } from "@/components/prompt/CodeArea";
import type { CodeBoxOwner, CodeWorldLookup } from "@/lib/codeWorldLookup";
import { useCodeCardNavigation } from "@/lib/codeCardNavigation";
import { settleCodeUseReveal, type CodeUseReveal } from "@/lib/codeUseReveal";
import type { HistoryFieldAttribute } from "@/lib/historyField";
import type { Entity, Script, ScriptTiming, Stat } from "@/types";

export type { CodeBoxOwner as ScriptBoxOwner } from "@/lib/codeWorldLookup";

/** Everything a home's boxes complete against and run under, as `useScriptBoxContext` builds it. */
export interface ScriptBoxContext {
  /** Whose code the boxes hold. Null for a global stat or trait. */
  owner: CodeBoxOwner | null;
  /** The world's names: what completes and what the checks read. */
  names: StatCodeNames;
  /** The authored world Test Code opens at turn one. */
  world: OpeningFoldWorld;
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
  /** Where the box's Script lives, which Test Code runs it from. */
  home: UnitHome;
}

/** What `self` is in a box: a stat, a trait, or nothing on a world script. */
const selfKindOf = (home: UnitHome): keyof typeof SCRIPT_SURFACES =>
  ('stat' in home ? 'stat' : 'trait' in home ? 'trait' : 'world');

/** `world` with an entity Owner holding the stats the panel holds, so a library entity, which no world has,
 *  still runs with its `owner.stats`. */
function withOwnerStats(world: OpeningFoldWorld, owner: CodeBoxOwner | null, ownerStats: Stat[]): OpeningFoldWorld {
  if (owner?.kind !== 'entity') return world;
  const entities = world.entities ?? [];
  const own = (entity: Entity): Entity => (entity.id === owner.entityId ? { ...entity, stats: ownerStats } : entity);
  return {
    ...world,
    entities: entities.some((entity) => entity.id === owner.entityId) ? entities.map(own) : [...entities, { id: owner.entityId, name: '', stats: ownerStats }],
  };
}

/**
 * One script's code box: the editor, the Templates menu on a stat or world script, its own Test Code button, and the report
 * that run left. Each box holds its own report, so editing one leaves another's standing.
 *
 * A run here is handed no turn, so `previous` reads as the stat itself and every `delta` reads zero, which
 * is what the before box reads in play too.
 */
export function ScriptBox({ script, label, onChange, context, reveal, autoFocus, frame }: {
  script: Script;
  /** The script's name, or its owner and timing. Each box's controls carry it. */
  label: string;
  onChange: (code: string) => void;
  context: ScriptBoxContext;
  /** A Find All Uses row bound for this box. */
  reveal?: CodeUseReveal | null;
  /** Focus the editor once it loads, as for a script just added. */
  autoFocus?: boolean;
  /** The code field's history frame. */
  frame?: HistoryFieldAttribute;
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
  /** The sentence a During AI Output test rewrites. Never saved. */
  const [sample, setSample] = useState("");
  const sampleId = useId();
  /** The running test's prompts, which its choice rows answer. */
  const prompts = useEditorPromptRun();
  const { close: closePrompts } = prompts;
  const mounted = useMountedRef();

  const { timing, code: value } = script;
  const { selfName, names, world, placeholderPlaces, owner, ownerStats, ownerStatNames, lookup, home } = context;
  const selfKind = selfKindOf(home);
  const isStat = selfKind === 'stat';
  const isOutput = timing === 'output';
  // Stat and world scripts have a Templates menu; a trait's has none.
  const hasTemplates = selfKind !== 'trait';
  const { codeNamedStats: worldStats, traitPlaces, entities } = names;
  // An entity stat's own traits, which a template's trait slot lists under Owner. A Blueprint's owners vary, so none.
  const ownerTraits = useMemo(
    () => (owner?.kind === 'entity' ? entities.find((entity) => entity.id === owner.entityId)?.traits : undefined),
    [owner, entities],
  );
  // The one build of this box's options: the editor and Test Code's problem count both read these.
  const analysis = useMemo(() => statBoxAnalysisOptions(names, {
    selfName, surface: scriptSurface(SCRIPT_SURFACES[selfKind], timing),
    ...(owner && { owner: { kind: owner.kind, statNames: ownerStatNames } }), lookup: lookup?.(timing),
  }), [names, selfName, selfKind, owner, ownerStatNames, lookup, timing]);
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
    closePrompts();
    setResult(null);
    setError(null);
    setWarnings([]);
    setProblems(null);
  }, [closePrompts]);

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

    // An unmount mid-import leaves nothing to run for.
    if (!mounted.current) return;
    const run = prompts.open();
    try {
      // A switch is reported here and never applied.
      const report = await runTestCode(value, timing, home, withOwnerStats(world, owner, ownerStats), {
        ...(isOutput && { sentence: sample }), prompts: run.host,
      });
      // An edit or an unmount mid-run closed this run, and its report is stale.
      if (!prompts.isCurrent(run)) return;
      // A tell or toast before a failure still showed, so the report keeps it.
      const parts = report.error ? run.notes : [
        ...(report.sentence !== undefined ? [`Sentence: ${report.sentence}`] : []),
        ...(report.value !== null ? [`Result: ${report.value}`] : []), ...report.writes, ...run.notes,
      ];
      if (parts.length) setResult(parts.join(' · '));
      if (report.error) setError(report.error);
      else setWarnings(report.dropped);
    } catch (thrown) {
      if (prompts.isCurrent(run)) setError(thrown instanceof Error ? thrown.message : String(thrown));
    } finally {
      if (prompts.isCurrent(run)) closePrompts();
      if (mounted.current) setTesting(false);
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
      <div {...frame}>
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
          locations={analysis.locations}
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
      </div>

      {hasTemplates && (
        <StatCodeTemplateDialog
          open={templatesOpen}
          onOpenChange={setTemplatesOpen}
          timing={timing}
          stats={worldStats}
          hasExistingCode={!!value.trim()}
          onInsert={(code) => write(migrateStatCodeRoutes(code, names.placeholders))}
          placeholderPlaces={placeholderPlaces}
          traitPlaces={traitPlaces}
          entities={entities}
          locations={names.places?.locations}
          {...('stat' in home
            ? { owner: owner?.kind, ownerStats, currentStatId: home.stat.id, ownerTraits }
            : { kind: 'worldScript' as const })}
        />
      )}

      {isOutput && (
        <div className="space-y-1">
          <Label htmlFor={sampleId}>Sample Sentence</Label>
          <Input
            id={sampleId}
            value={sample}
            onChange={(event) => { clearReport(); setSample(event.target.value); }}
            placeholder="Type a sentence for Test Code to rewrite"
          />
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-2">
        {/* Each button acts on this box alone, so each names it: a home can hold several. */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void run()}
            disabled={testing || !value.trim() || (isOutput && !sample.trim())}
            variant="outline"
            aria-label={`Test Code ${label}`}
          >
            {testing ? "Testing..." : "Test Code"}
          </Button>
          {hasTemplates && (
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

      {prompts.store && <ScriptPromptLine store={prompts.store} className="mt-3" />}
    </div>
  );
}

export default ScriptBox;
