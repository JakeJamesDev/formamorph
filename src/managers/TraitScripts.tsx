import { useEffect, useRef, useState, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/ui/typography";
import { HelpButton } from "@/components/HelpButton";
import { LabelRow } from "@/components/editor/BlueprintReset";
import { registerScriptInsert, reportScriptInsert } from "@/lib/formaquestion/scriptInsert";
import { newScript, noFocus, scriptRow } from "@/lib/scriptRows";
import { useLanding } from "@/lib/surface/useLanding";
import type { CodeUseReveal } from "@/lib/codeUseReveal";
import type { ScriptBoxWorld } from "@/lib/scriptBoxHome";
import type { ScriptHomeRef } from "@/lib/worldScripts";
import type { Script, Trait } from "@/types";
import { ScriptsSection } from "./ScriptsSection";
import { useScriptBoxContext } from "./useScriptBoxContext";

/**
 * A trait's Scripts tab. Its scripts run only while the trait is active (Q3), with `self` as the trait. An
 * owner's trait runs under that owner; a Blueprint trait under each owner that links it; a global trait under none.
 */
export function TraitScripts({ trait, home, offWorld, ownerName, onChange, reset, reveal }: {
  trait: Trait;
  /** Where the trait's scripts live: the world's, an entity's own, or a link's. Pass a stable ref. */
  home: ScriptHomeRef;
  /** What the boxes read with no world loaded, as in the library. */
  offWorld?: ScriptBoxWorld;
  /** The trait's name as the author reads it, which a script with a blank name reads as. */
  ownerName: string;
  onChange: (scripts: Script[] | undefined) => void;
  /** The Reset a link shows while it overrides the scripts. */
  reset?: ReactNode;
  /** A Find All Uses row bound for one of these scripts. */
  reveal?: CodeUseReveal | null;
}) {
  const context = useScriptBoxContext(home, offWorld);

  // The help window's Insert adds a script of its timing to this trait and lands on it. This tab mounts only while shown.
  const landOnScript = useLanding(scriptRow, { focus: noFocus });
  const [inserted, setInserted] = useState<string | null>(null);
  // Read at insert time, so the registration does not change with each keystroke.
  const latest = useRef({ scripts: trait.scripts, onChange });
  latest.current = { scripts: trait.scripts, onChange };
  useEffect(() => registerScriptInsert({
    homeName: ownerName,
    insert: (timing, code) => {
      const script = newScript(timing, code);
      latest.current.onChange([...latest.current.scripts ?? [], script]);
      setInserted(script.id);
      landOnScript(script.id);
      reportScriptInsert('written');
    },
  }), [ownerName, landOnScript]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <LabelRow reset={reset}>
          <div className="flex items-center gap-2">
            <Label>Scripts</Label>
            <HelpButton topicId="worldEditor.scriptBox" className="h-6 w-6" />
          </div>
        </LabelRow>
        <Hint>Runs code at the timing you select, while this trait is active. Code can set a stat, pin a placeholder, or switch a trait.</Hint>
      </div>
      <ScriptsSection
        scripts={trait.scripts ?? []}
        onChange={onChange}
        ownerName={ownerName}
        context={context}
        reveal={reveal}
        focusId={inserted}
      />
    </div>
  );
}
