import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/ui/typography";
import { HelpButton } from "@/components/HelpButton";
import { ITEM_SCRIPT_TIMINGS } from "@/lib/scripts";
import type { ScriptHomeRef } from "@/lib/worldScripts";
import type { Item, Script } from "@/types";
import { ScriptsSection } from "./ScriptsSection";
import { useScriptBoxContext } from "./useScriptBoxContext";

/**
 * An item's Scripts tab. Its scripts run on its Item Copies' events, one timing per event (Q33), with `self` as the
 * item and `owner` as the Item Copy's owner (Q67).
 */
export function ItemScripts({ item, ownerName, onChange }: {
  item: Item;
  /** The item's name as the author reads it, which a script with a blank name reads as. */
  ownerName: string;
  onChange: (scripts: Script[] | undefined) => void;
}) {
  const home = useMemo<ScriptHomeRef>(() => ({ kind: 'item', itemId: item.id }), [item.id]);
  const context = useScriptBoxContext(home);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Scripts</Label>
          <HelpButton topicId="worldEditor.scriptBox" className="h-6 w-6" />
        </div>
        <Hint>Runs code when one of this item’s Item Copies is gained, lost, equipped, unequipped or used. Code can give or take items, set a stat, or switch a trait.</Hint>
      </div>
      <ScriptsSection
        scripts={item.scripts ?? []}
        onChange={onChange}
        ownerName={ownerName}
        context={context}
        timings={ITEM_SCRIPT_TIMINGS}
      />
    </div>
  );
}
