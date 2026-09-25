import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { LayoutTemplate } from "lucide-react";
import { CODE_BOUND_FIELDS, executeStatCode, type CodeBoundField } from "@/lib/statCodeExecutor";
import { codePinText } from "@/lib/placeholderPins";
import { sandboxPlaceholders } from "@/lib/statCodePlaceholders";
import { placeholderPathLabel } from "@/lib/statCodePaths";
import { sandboxTraits } from "@/lib/statCodeTraits";
import { StatCodeTemplateDialog } from "@/components/modals/StatCodeTemplateDialog";
import { CodeArea } from "@/components/prompt/CodeArea";
import { STAT_CODE_SURFACE } from "@/lib/statCodeSurface";
import { TIMING_LABEL, type StatCodeTiming } from "@/lib/statCodeTiming";
import type { PlaceholderOwners } from "@/lib/placeholderHomes";
import type { Placeholder, Stat, Trait } from "@/types";

/** Test Code names each bound a run wrote with its Details field label. */
const BOUND_LABELS: Record<CodeBoundField, string> = { min: "Min", max: "Max", regen: "Regen" };

/** The clock each box reads under Test Code: the turn start the before box gets, a one-hour turn for the
 *  after box. Zero elapsed puts the before run on the opening turn, which its templates are written for. */
const TEST_CLOCK: Record<StatCodeTiming, { deltaHours: number; elapsedHours: number }> = {
  before: { deltaHours: 0, elapsedHours: 0 },
  after: { deltaHours: 1, elapsedHours: 1 },
};

/** Everything both boxes complete against and run under, derived once by the panel that holds them. */
export interface StatCodeBoxContext {
  /** The world's stats under their code names. Completions offer these, and a run reaches them. */
  codeNamedStats: Stat[];
  /** Those code names alone, for the editor's completions and its reader. */
  statNames: string[];
  /** The edited stat's own code name. */
  selfName: string;
  /** The placeholder tree the editor completes over and a run reads. */
  placeholders: { list: readonly Placeholder[]; owners?: PlaceholderOwners };
  /** What a template's placeholder slot picks from. */
  placeholderNames: string[];
  /** Trait code names: completions, template slots, and the run's entries. */
  traitNames: string[];
  /** The world's traits, for the run's sandbox entries. */
  traits: readonly Trait[];
}

/**
 * One of a stat's two code boxes: the editor, its own Templates menu, its own Test Code button, and the
 * report that run left. Each box holds its own report, so editing one leaves the other's standing.
 *
 * A run here is handed no turn, so `previous` reads as the stat itself and every `delta` reads zero, which
 * is what the before box reads in play too.
 */
export function StatCodeBox({ timing, stat, value, onChange, context }: {
  timing: StatCodeTiming;
  /** The stat as the panel currently holds it, mid-edit: what the run reads as `self`. */
  stat: Partial<Stat> & Pick<Stat, 'id'>;
  value: string;
  onChange: (code: string) => void;
  context: StatCodeBoxContext;
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
  const { codeNamedStats, statNames, selfName, placeholders, placeholderNames, traitNames, traits } = context;

  /** Drop what the last test said. Editing the code makes every part of that report stale together. */
  const clearReport = useCallback(() => {
    setResult(null);
    setError(null);
    setWarnings([]);
    setProblems(null);
  }, []);

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
      setProblems(summarizeProblems(statCodeDiagnostics(value, {
        placeholders, traits: traitNames, statNames, selfName,
      })));
    } catch {
      // What the run itself found is the point; the count is what the editor adds to it.
    }

    try {
      // No playthrough behind the editor: an unrolled placeholder reads as a fresh draw, and the player
      // has no traits. A switch is reported here and never applied.
      const placeholderEntries = sandboxPlaceholders({
        placeholders: placeholders.list, owners: placeholders.owners, rolls: {},
      });
      const traitEntries = sandboxTraits(
        { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [...traits], groups: [] } },
        placeholders.list,
      );
      const outcome = await executeStatCode(
        // A half-filled stat still runs: the executor defaults every number it marshals, so only the id
        // and the code name have to be real.
        value, codeNamedStats, { ...stat, name: selfName } as Stat,
        { clock: TEST_CLOCK[timing], placeholders: placeholderEntries, traits: traitEntries },
      );
      if (outcome.error) {
        setError(outcome.error);
        return;
      }
      const parts = [
        ...(outcome.value !== null ? [`Result: ${outcome.value}`] : []),
        ...CODE_BOUND_FIELDS.flatMap((field) => {
          const bound = outcome.bounds?.[field];
          return bound === undefined ? [] : [`${BOUND_LABELS[field]}: ${bound}`];
        }),
        ...(outcome.placeholders ?? []).map((entry) => {
          // The path the code wrote, not the placeholder's bare name: that is what the author typed.
          const at = placeholderPathLabel(entry.path);
          return 'unpin' in entry ? `${at} unpinned` : `${at} = ${codePinText(entry.value)}`;
        }),
        ...(outcome.traits ?? []).map((entry) => `${entry.name} switched ${entry.enabled ? 'on' : 'off'}`),
      ];
      if (parts.length) setResult(parts.join(' · '));
      setWarnings([
        ...(outcome.unknownPlaceholders ? [`Unknown placeholder paths. Writes ignored: ${outcome.unknownPlaceholders.join(', ')}.`] : []),
        ...(outcome.unknownTraits ? [`Unknown trait names. Writes ignored: ${outcome.unknownTraits.join(', ')}.`] : []),
        ...(outcome.acquiredWrites ? [`acquired is read-only. Writes ignored: ${outcome.acquiredWrites.join(', ')}.`] : []),
      ]);
    } catch (thrown) {
      setError((thrown as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-2">
      <CodeArea
        value={value}
        onChange={write}
        ariaLabel={`Stat Code ${label}`}
        surface={STAT_CODE_SURFACE}
        statNames={statNames}
        selfName={selfName}
        placeholders={placeholders}
        traits={traitNames}
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
        stats={codeNamedStats}
        currentStatId={stat.id}
        hasExistingCode={!!value.trim()}
        onInsert={write}
        placeholderNames={placeholderNames}
        traitNames={traitNames}
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
            <LayoutTemplate className="h-4 w-4 mr-1" />
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
