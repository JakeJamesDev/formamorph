import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { hasCode, patchScript, SCRIPT_TIMING_LABEL, SCRIPT_TIMINGS, scriptLabel, type ScriptPatch } from "@/lib/scripts";
import { useLanding } from "@/lib/surface/useLanding";
import { fieldFrame } from "@/lib/historyField";
import { newScript, noFocus, SCRIPT_ROW_ATTRIBUTE, scriptRow } from "@/lib/scriptRows";
import type { TargetAttribute } from "@/lib/surface/surfaceTargets";
import type { CodeUseReveal } from "@/lib/codeUseReveal";
import type { Script, ScriptTiming } from "@/types";
import { ScriptBox, type ScriptBoxContext } from "./ScriptBox";

/**
 * One script: its name, its timing, a remove action and its code box. The owner's Scripts section and the World
 * Editor's Scripts tab both draw this row, so an author edits the same box from either place. A change reports
 * only the field it edits; a cleared name reports the name absent, so the fallback shows and nothing exports.
 */
export function ScriptRow({ script, ownerName, context, onChange, onRemove, reveal, autoFocus }: {
  script: Script;
  /** The home's name as the author reads it, for a blank name's fallback. */
  ownerName: string;
  context: ScriptBoxContext;
  onChange: (patch: ScriptPatch) => void;
  onRemove: () => void;
  /** A Find All Uses row bound for this script. */
  reveal?: CodeUseReveal | null;
  autoFocus?: boolean;
}) {
  const [removing, setRemoving] = useState(false);
  const label = scriptLabel(script, ownerName);
  const fallback = scriptLabel({ timing: script.timing }, ownerName);
  return (
    <div role="group" aria-label={label} {...{ [SCRIPT_ROW_ATTRIBUTE]: script.id }} className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Input
          className="min-w-0 flex-1"
          {...fieldFrame('scripts', script.id, 'name')}
          aria-label="Name"
          placeholder={fallback}
          value={script.name ?? ''}
          onChange={(e) => onChange({ name: e.target.value || undefined })}
        />
        <Select value={script.timing} onValueChange={(timing: ScriptTiming) => onChange({ timing })}>
          <SelectTrigger className="w-auto shrink-0 gap-1" aria-label="Timing" {...fieldFrame('scripts', script.id, 'timing')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCRIPT_TIMINGS.map((timing) => (
              <SelectItem key={timing} value={timing}>{SCRIPT_TIMING_LABEL[timing]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Remove Script"
          onClick={() => (hasCode(script) ? setRemoving(true) : onRemove())}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <ScriptBox
        frame={fieldFrame('scripts', script.id, 'code')}
        script={script}
        label={label}
        onChange={(code) => onChange({ code })}
        context={context}
        reveal={reveal}
        autoFocus={autoFocus}
      />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Remove This Script"
        description="This script has code. Removing it erases the code."
        confirmLabel="Remove"
        destructive
        onConfirm={onRemove}
      />
    </div>
  );
}

/**
 * A home's scripts as rows, then Add Script. The timing select is the only way to move a script between timings
 * (Q4). A blank name shows the owner and timing in its place (Q6).
 */
export function ScriptsSection({ scripts, onChange, ownerName, context, reveal, addTarget, focusId }: {
  scripts: readonly Script[];
  /** Absent once the list is empty. */
  onChange: (next: Script[] | undefined) => void;
  /** The home's name as the author reads it, for a blank name's fallback. */
  ownerName: string;
  context: ScriptBoxContext;
  /** A Find All Uses row bound for one of these scripts. */
  reveal?: CodeUseReveal | null;
  /** The surface target the Add Script button carries, on a panel that has one. */
  addTarget?: TargetAttribute;
  /** A script added from outside, such as by the help window's Insert, whose editor takes the focus. */
  focusId?: string | null;
}) {
  const [added, setAdded] = useState<string | null>(null);
  const focused = added ?? focusId;
  const landOn = useLanding(scriptRow, { pulse: false, focus: noFocus });

  const write = (next: Script[]) => onChange(next.length ? next : undefined);
  const add = () => {
    const script = newScript();
    write([...scripts, script]);
    setAdded(script.id);
    landOn(script.id);
  };

  return (
    <div className="space-y-4">
      {scripts.map((script) => (
        <ScriptRow
          key={script.id}
          script={script}
          ownerName={ownerName}
          context={context}
          onChange={(patch) => {
            const next = patchScript(scripts, script.id, patch);
            if (next !== scripts) write([...next]);
          }}
          onRemove={() => write(scripts.filter((entry) => entry.id !== script.id))}
          reveal={reveal?.scriptId === script.id ? reveal : null}
          autoFocus={script.id === focused}
        />
      ))}

      <Button variant="outline" onClick={add} {...addTarget}>
        <Plus className="h-4 w-4 mr-1" />
        Add Script
      </Button>
    </div>
  );
}
