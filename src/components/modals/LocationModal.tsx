import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, List, Map as MapIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LocationMap from "@/components/game/LocationMap";
import { UNNAMED_LOCATION } from "@/lib/locationCanvas";
import { defaultCollapsedLocations, locationRows, removeCollapsedChildren } from "@/lib/locationTree";
import { useTravelView, type TravelView } from "@/lib/travelPrefs";
import { cn } from "@/lib/utils";
import type { Connection, GameLocation } from "@/types";

/**
 * Where the player goes, in the two ways a world can be read: the List, which is the location tree with each
 * sublocation sitting under the place that holds it, and the Map, which is the world laid out as its author
 * arranged it. Travel from either is silent and instant, to anywhere, with no turn and no narration behind
 * it (ADR-0006).
 */

/** How far one level of nesting sets a row in, and where the shallowest row starts. */
const INDENT_REM = 1.25;
const ROW_INSET_REM = 0.75;

export const LocationModal = ({
  isOpen, onOpenChange, locations, connections, currentLocationId, changeLocation, resolveText,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  locations: GameLocation[];
  connections: Connection[];
  currentLocationId: string | null;
  changeLocation: (location: GameLocation) => void;
  resolveText: (text: string) => string;
}) => {
  const [view, setView] = useTravelView();

  const allRows = useMemo(() => locationRows(locations), [locations]);

  // Folded branches: recomputed from wherever the player stands each time the dialog opens, then theirs to
  // work while it stays open. Nothing about it outlives the dialog.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (isOpen) setCollapsed(defaultCollapsedLocations(locations, connections, currentLocationId));
    // The defaults follow the player, not the world: only reopening recomputes them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const rows = useMemo(() => removeCollapsedChildren(allRows, collapsed), [allRows, collapsed]);

  // How many places each branch holds all the way down, so a folded row can say what it hides.
  const descendantCount = useMemo(() => {
    const counts = new Map<string, number>();
    const parentOf = new Map(allRows.map((r) => [r.id, r.parentId]));
    for (const row of allRows) {
      for (let cur = row.parentId; cur; cur = parentOf.get(cur) ?? null) {
        counts.set(cur, (counts.get(cur) ?? 0) + 1);
      }
    }
    return counts;
  }, [allRows]);

  const toggle = useCallback((id: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  }), []);

  // Held steady across renders: the Map hands it down to every box on it as context.
  const travel = useCallback((location: GameLocation) => {
    changeLocation(location);
    onOpenChange(false);
  }, [changeLocation, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[85dvh] w-[95vw] max-w-[900px] flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="px-6 pb-3 pt-6">
          <DialogTitle>Change Location</DialogTitle>
        </DialogHeader>
        <Tabs
          value={view}
          onValueChange={(next) => setView(next as TravelView)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-6 self-start">
            <TabsTrigger value="list" className="gap-1.5">
              <List className="h-4 w-4" aria-hidden="true" />
              List
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5">
              <MapIcon className="h-4 w-4" aria-hidden="true" />
              Map
            </TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="min-h-0 flex-1">
            {/* Padding on the Root, so the overlay scrollbar sits beside the rows rather than out on the
                dialog's own edge. */}
            <ScrollArea className="h-full px-6 pb-6">
              <ul className="space-y-1">
                {rows.map(({ id, depth, location }) => {
                  const here = id === currentLocationId;
                  const description = resolveText(location.playerDescription || location.description || "").trim();
                  const name = location.name || UNNAMED_LOCATION;
                  const hidden = descendantCount.get(id) ?? 0;
                  const isParent = hidden > 0;
                  const isCollapsed = collapsed.has(id);
                  const Chevron = isCollapsed ? ChevronRight : ChevronDown;
                  return (
                    <li key={id} aria-level={depth + 1}>
                      <div
                        className={cn(
                          "flex items-center rounded-md",
                          here ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground",
                        )}
                        style={{ paddingLeft: `${ROW_INSET_REM + depth * INDENT_REM}rem` }}
                      >
                        {isParent ? (
                          <button
                            type="button"
                            aria-expanded={!isCollapsed}
                            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${name}`}
                            onClick={(event) => { event.stopPropagation(); toggle(id); }}
                            className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
                          >
                            <Chevron className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : (
                          <span className="-ml-1 h-11 w-11 shrink-0" aria-hidden="true" />
                        )}
                        <button
                          type="button"
                          aria-current={here ? "location" : undefined}
                          onClick={() => travel(location)}
                          className="min-w-0 flex-1 rounded-md py-2 pr-3 text-left text-label"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-semibold">{name}</span>
                            {isCollapsed && (
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-1 text-meta font-medium",
                                  here ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                                )}
                              >
                                {hidden}
                                <span className="sr-only">{hidden === 1 ? " place" : " places"}</span>
                              </span>
                            )}
                          </span>
                          {description && (
                            <span
                              className={cn(
                                "block truncate font-normal text-helper",
                                here ? "text-primary-foreground/75" : "text-muted-foreground",
                              )}
                            >
                              {description}
                            </span>
                          )}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="map" className="min-h-0 flex-1 px-6 pb-6">
            <div className="h-full w-full overflow-hidden rounded-md border">
              <LocationMap
                locations={locations}
                connections={connections}
                currentLocationId={currentLocationId}
                onTravel={travel}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
