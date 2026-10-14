import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { hasCode, SCRIPT_TIMING_LABEL, SCRIPT_TIMINGS, scriptLabel } from "@/lib/scripts";
import { useLanding } from "@/lib/surface/useLanding";
import { newScript, noFocus, SCRIPT_ROW_ATTRIBUTE, scriptRow } from "@/lib/scriptRows";
import type { TargetAttribute } from "@/lib/surface/surfaceTargets";
import type { CodeUseReveal } from "@/lib/codeUseReveal";
import type { Script, ScriptTiming } from "@/types";
import { ScriptBox, type ScriptBoxContext, type ScriptSelf } from "./ScriptBox";

/**
 * A home's scripts as rows: each with its name, its timing, a remove action and its code box, then Add Script.
 * The timing select is the only way to move a script between timings (Q4). A blank name shows the owner and
 * timing in its place (Q6).
 */
export function ScriptsSection({ scripts, onChange, ownerName, self, context, reveal, addTarget, focusId }: {
  scripts: readonly Script[];
  /** Absent once the list is empty. */
  onChange: (next: Script[] | undefined) => void;
  /** The home's name as the author reads it, for a blank name's fallback. */
  ownerName: string;
  self: ScriptSelf;
  context: ScriptBoxContext;
  /** A Find All Uses row bound for one of these scripts. */
  reveal?: CodeUseReveal | null;
  /** The surface target the Add Script button carries, on a panel that has one. */
  addTarget?: TargetAttribute;
  /** A script added from outside, such as by the help window's Insert, whose editor takes the focus. */
  focusId?: string | null;
}) {
  const [removing, setRemoving] = useState<Script | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const focused = added ?? focusId;
  const landOn = useLanding(scriptRow, { pulse: false, focus: noFocus });

  const write = (next: Script[]) => onChange(next.length ? next : undefined);
  const edit = (id: string, patch: Partial<Script>) => write(scripts.map((script) => (script.id === id ? { ...script, ...patch } : script)));
  // A cleared name is absent, so the fallback shows and nothing exports.
  const rename = (id: string, name: string) => write(scripts.map((script) => {
    if (script.id !== id) return script;
    const { name: _old, ...rest } = script;
    return name ? { ...rest, name } : rest;
  }));
  const remove = (id: string) => write(scripts.filter((script) => script.id !== id));
  const add = () => {
    const script = newScript();
    write([...scripts, script]);
    setAdded(script.id);
    landOn(script.id);
  };

  return (
    <div className="space-y-4">
      {scripts.map((script) => {
        const label = scriptLabel(script, ownerName);
        const fallback = scriptLabel({ timing: script.timing }, ownerName);
        return (
          <div key={script.id} role="group" aria-label={label} {...{ [SCRIPT_ROW_ATTRIBUTE]: script.id }} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Input
                className="min-w-0 flex-1"
                aria-label="Name"
                placeholder={fallback}
                value={script.name ?? ''}
                onChange={(e) => rename(script.id, e.target.value)}
              />
              <Select value={script.timing} onValueChange={(timing: ScriptTiming) => edit(script.id, { timing })}>
                <SelectTrigger className="w-auto shrink-0 gap-1" aria-label="Timing">
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
                onClick={() => (hasCode(script) ? setRemoving(script) : remove(script.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <ScriptBox
              script={script}
              label={label}
              self={self}
              onChange={(code) => edit(script.id, { code })}
              context={context}
              reveal={reveal?.scriptId === script.id ? reveal : null}
              autoFocus={script.id === focused}
            />
          </div>
        );
      })}

      <Button variant="outline" onClick={add} {...addTarget}>
        <Plus className="h-4 w-4 mr-1" />
        Add Script
      </Button>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Remove This Script"
        description="This script has code. Removing it erases the code."
        confirmLabel="Remove"
        destructive
        onConfirm={() => removing && remove(removing.id)}
      />
    </div>
  );
}
