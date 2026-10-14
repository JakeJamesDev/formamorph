import { useMemo, type ReactNode } from "react";
import { useGameDataOptional } from "@/contexts/GameDataContext";
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/ui/typography";
import { HelpButton } from "@/components/HelpButton";
import { LabelRow } from "@/components/editor/BlueprintReset";
import { statBoxLookups, traitBoxSelf } from "@/lib/codeWorldLookup";
import { statCodeName, statCodeNamed } from "@/lib/statCodeNames";
import { resolvedEntityStats } from "@/lib/statLinks";
import { isBlueprintItem } from "@/lib/traitTree";
import type { CodeUseReveal } from "@/lib/codeUseReveal";
import { useScriptWorldNames } from "@/lib/useScriptWorldNames";
import type { Entity, Script, ScriptTiming, Trait } from "@/types";
import type { ScriptBoxContext, ScriptBoxOwner } from "./ScriptBox";
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
  const { names, placeholderPlaces } = useScriptWorldNames();
  const placeholders = names.placeholders.list;
  const selfName = statCodeName(trait.name, placeholders);
  const blueprint = !owner && isBlueprintItem({ traits: [...names.traits], traitGroups: world?.traitGroups ?? [] }, trait.id);
  const ownerId = owner?.id;
  const boxOwner = useMemo<ScriptBoxOwner | null>(
    () => (ownerId ? { kind: 'entity', entityId: ownerId } : blueprint ? { kind: 'blueprint' } : null),
    [ownerId, blueprint],
  );
  // `owner.stats` is the owner's own; a Blueprint trait's owners vary, so its names go unchecked.
  const ownerStats = useMemo(() => (owner
    ? statCodeNamed(resolvedEntityStats({ stats: world?.stats ?? [], statGroups: world?.statGroups ?? [] }, owner), placeholders)
    : []), [owner, world?.stats, world?.statGroups, placeholders]);
  const ownerStatNames = useMemo(
    () => (owner ? ownerStats.map((stat) => stat.name).filter(Boolean) : undefined),
    [owner, ownerStats],
  );
  // Cards read the authored world, so the library, which has none, gets no lookup.
  const lookup = useMemo(() => {
    if (!world) return undefined;
    const lookups = statBoxLookups(world);
    const self = traitBoxSelf(trait.id, selfName);
    return (timing: ScriptTiming) => lookups({ owner: boxOwner, timing, self });
  }, [world, trait.id, selfName, boxOwner]);
  const context = useMemo<ScriptBoxContext>(() => ({
    selfName, owner: boxOwner, names, ownerStats, ...(ownerStatNames && { ownerStatNames }), placeholderPlaces, lookup,
  }), [selfName, boxOwner, names, ownerStats, ownerStatNames, placeholderPlaces, lookup]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <LabelRow reset={reset}>
          <div className="flex items-center gap-2">
            <Label>Scripts</Label>
            <HelpButton topicId="worldEditor.statCode" className="h-6 w-6" />
          </div>
        </LabelRow>
        <Hint>Runs code at the timing you select, while this trait is active. Code can set a stat, pin a placeholder, or switch a trait.</Hint>
      </div>
      <ScriptsSection
        scripts={trait.scripts ?? []}
        onChange={onChange}
        ownerName={ownerName}
        self={{ kind: 'trait', id: trait.id }}
        context={context}
        reveal={reveal}
      />
    </div>
  );
}
