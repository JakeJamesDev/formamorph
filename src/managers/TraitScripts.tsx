import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useGameDataOptional } from "@/contexts/GameDataContext";
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/ui/typography";
import { HelpButton } from "@/components/HelpButton";
import { LabelRow } from "@/components/editor/BlueprintReset";
import { statBoxLookups } from "@/lib/codeWorldLookup";
import { registerScriptInsert, reportScriptInsert } from "@/lib/formaquestion/scriptInsert";
import { newScript, noFocus, scriptRow } from "@/lib/scriptRows";
import { useLanding } from "@/lib/surface/useLanding";
import type { CodeUseReveal } from "@/lib/codeUseReveal";
import { useScriptWorldNames } from "@/lib/useScriptWorldNames";
import type { Entity, Script, Trait } from "@/types";
import { traitTabBoxContext } from "./scriptBoxBuilders";
import { ScriptsSection } from "./ScriptsSection";

/**
 * A trait's Scripts tab. Its scripts run only while the trait is active (Q3), with `self` as the trait. An
 * owner's trait runs under that owner; a Blueprint trait under each owner that links it; a global trait under none.
 */
export function TraitScripts({ trait, owner, ownerName, onChange, reset, reveal }: {
  trait: Trait;
  /** The entity that owns or links the trait. Absent for a global or Blueprint trait. */
  owner?: Entity;
  /** The trait's name as the author reads it, which a script with a blank name reads as. */
  ownerName: string;
  onChange: (scripts: Script[] | undefined) => void;
  /** The Reset a link shows while it overrides the scripts. */
  reset?: ReactNode;
  /** A Find All Uses row bound for one of these scripts. */
  reveal?: CodeUseReveal | null;
}) {
  const world = useGameDataOptional();
  const { names, placeholderPlaces, world: foldWorld } = useScriptWorldNames();
  // Cards read the authored world, so the library, which has none, gets no lookup.
  const lookups = useMemo(() => world && statBoxLookups(world), [world]);
  const { self, context } = useMemo(
    () => traitTabBoxContext({ trait, owner, world, lookups, shared: { names, placeholderPlaces, world: foldWorld } }),
    [trait, owner, world, lookups, names, placeholderPlaces, foldWorld],
  );

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
        self={self}
        context={context}
        reveal={reveal}
        focusId={inserted}
      />
    </div>
  );
}
