import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Trait, TraitGroup, Stat } from "@/types";

const GENERAL = 'general';

/** A reachable tab in the selection flow: General (ungrouped) or a group, with its ancestor path. */
interface Section {
  id: string | null; // null = General
  group?: TraitGroup;
  path: string[]; // group ids from the root down to this section
}

const TraitSelectionModal = ({
  traits,
  traitGroups,
  stats,
  selectedTraits,
  onTraitSelect,
  onAbort,
  onConfirm,
}: {
  traits: Trait[];
  traitGroups: TraitGroup[];
  stats: Stat[];
  selectedTraits: string[];
  onTraitSelect: (traitId: string) => void;
  onAbort: () => void;
  onConfirm: () => void;
}) => {
  const getStatName = (statId: string) => stats.find((s) => s.id === statId)?.name ?? statId;

  const directTraits = (groupId: string | null) =>
    traits.filter((t) => (t.groupId ?? null) === groupId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const childGroups = (parentId: string | null) =>
    traitGroups
      .filter((g) => (g.parentId ?? null) === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // A group is shown only when its subtree contains at least one trait (empty groups are hidden).
  const hasTraitsDeep = (groupId: string): boolean =>
    directTraits(groupId).length > 0 || childGroups(groupId).some((c) => hasTraitsDeep(c.id));
  const visibleChildren = (parentId: string | null) => childGroups(parentId).filter((g) => hasTraitsDeep(g.id));

  // "General" tab value for a parent context: a group's own direct traits live behind a General tab
  // in its child row (root ungrouped traits use the bare GENERAL sentinel).
  const generalValue = (parentId: string | null) => (parentId === null ? GENERAL : `general:${parentId}`);

  // General (ungrouped) only exists as a section when there are ungrouped traits.
  const hasUngrouped = traits.some((t) => (t.groupId ?? null) === null);

  // Content stops, depth-first. A visible group with direct traits is a stop (its own traits); we then
  // recurse into its children. A pure container (no direct traits) isn't a stop — selecting it drills
  // to its first descendant stop. Root ungrouped traits are the leading General stop.
  const stops = useMemo(() => {
    const out: Section[] = hasUngrouped ? [{ id: null, path: [] }] : [];
    const walk = (parentId: string | null, path: string[]) => {
      for (const g of visibleChildren(parentId)) {
        const newPath = [...path, g.id];
        if (directTraits(g.id).length > 0) out.push({ id: g.id, group: g, path: newPath });
        walk(g.id, newPath);
      }
    };
    walk(null, []);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitGroups, traits, hasUngrouped]);

  const [index, setIndex] = useState(0);
  const current = stops[Math.min(index, stops.length - 1)];

  // Defensive: the parent skips this modal entirely when the world has no traits.
  if (!current) return null;

  const sectionTraits = directTraits(current.id);

  // Tab rows: row 0 = (General if ungrouped) + top groups; each ancestor with visible children adds a
  // row of its children, prefixed by a General tab when that ancestor also has its own direct traits.
  const rows: { parentId: string | null; active: string }[] = [
    { parentId: null, active: current.path[0] ?? generalValue(null) },
  ];
  current.path.forEach((pid, level) => {
    if (visibleChildren(pid).length) {
      rows.push({ parentId: pid, active: current.path[level + 1] ?? generalValue(pid) });
    }
  });

  // Selecting a group drills to the first stop under it; selecting a General lands on that group's
  // own-traits stop (root General → the ungrouped stop).
  const goToValue = (value: string) => {
    let target: number;
    if (value === GENERAL) target = stops.findIndex((s) => s.id === null);
    else if (value.startsWith('general:')) target = stops.findIndex((s) => s.id === value.slice('general:'.length));
    else target = stops.findIndex((s) => s.path.includes(value));
    if (target >= 0) setIndex(target);
  };

  const isLast = index >= stops.length - 1;
  const next = () => (isLast ? onConfirm() : setIndex((i) => i + 1));

  return (
    <Card className="fixed inset-0 m-auto w-[95%] max-w-[600px] h-[90vh] max-h-[800px] z-50">
      <CardContent className="p-3 sm:p-6 h-full flex flex-col">
        <h2 className="text-lg sm:text-xl font-semibold mb-3">Select Starting Traits</h2>

        {/* Tab rows — one per nesting level, styled like the editor/settings tabs. The active group's
            player description sits under its own row; the row reserves the height of its tallest
            description (stacked, the inactive ones kept `invisible`) so switching tabs never reflows. */}
        <div className="space-y-1 mb-3 flex-shrink-0">
          {rows.map((row, i) => {
            const describedGroups = visibleChildren(row.parentId).filter((g) => g.playerDescription?.trim());
            return (
              <div key={i}>
                <Tabs value={row.active || undefined} onValueChange={goToValue}>
                  <TabsList className="h-auto flex-wrap justify-start">
                    {((row.parentId === null && hasUngrouped) ||
                      (row.parentId !== null && directTraits(row.parentId).length > 0)) && (
                      <TabsTrigger value={generalValue(row.parentId)}>General</TabsTrigger>
                    )}
                    {visibleChildren(row.parentId).map((g) => (
                      <TabsTrigger key={g.id} value={g.id}>{g.name}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                {describedGroups.length > 0 && (
                  <div className="grid mt-1">
                    {describedGroups.map((g) => (
                      <p
                        key={g.id}
                        className={`col-start-1 row-start-1 text-sm text-muted-foreground ${
                          g.id === row.active ? '' : 'invisible'
                        }`}
                      >
                        {g.playerDescription}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <ScrollArea className="flex-1 mb-4">
          {sectionTraits.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">No traits in this section.</p>
          ) : (
            sectionTraits.map((trait) => (
              <div key={trait.id} className="mb-2 sm:mb-4 p-2 border rounded">
                <div className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id={`trait-${trait.id}`}
                    checked={selectedTraits.includes(trait.id)}
                    onCheckedChange={() => onTraitSelect(trait.id)}
                  />
                  <label htmlFor={`trait-${trait.id}`} className="font-semibold">{trait.name}</label>
                </div>
                {trait.playerDescription?.trim() && (
                  <p className="text-xs sm:text-sm mb-2">{trait.playerDescription}</p>
                )}
                {trait.statChanges.length > 0 && (
                  <div className="text-xs sm:text-sm">
                    <strong>Stat Changes:</strong>
                    <ul className="list-disc list-inside">
                      {trait.statChanges.map((change, idx) => (
                        <li key={idx}>
                          {getStatName(change.statId)}: {change.value > 0 ? '+' : ''}{change.value} ({change.type})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </ScrollArea>

        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={onAbort} variant="destructive" className="flex-1">Abort</Button>
          <Button onClick={onConfirm} variant="outline" className="flex-1">Skip</Button>
          <Button onClick={next} className="flex-1">{isLast ? 'Start' : 'Next'}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TraitSelectionModal;
