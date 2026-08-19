import { useCallback, useMemo } from "react";
import { List, Map as MapIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LocationMap from "@/components/game/LocationMap";
import { UNNAMED_LOCATION } from "@/lib/locationCanvas";
import { buildLocationTree, flattenLocationTree } from "@/lib/locationTree";
import { usePersistentState, type Codec } from "@/lib/usePersistentState";
import { cn } from "@/lib/utils";
import type { Connection, GameLocation } from "@/types";

/**
 * Where the player goes, in the two ways a world can be read: the List, which is the location tree with each
 * sublocation sitting under the place that holds it, and the Map, which is the world laid out as its author
 * arranged it. Both travel the same way the old dropdown did — silently and at once, to anywhere, with no
 * turn and no narration behind it (ADR-0006).
 */

/** The two ways in, as they are stored. A view retired from the dialog would leave the name behind. */
type TravelView = "list" | "map";

const travelViewCodec: Codec<TravelView> = {
  parse: (raw) => {
    if (raw !== "list" && raw !== "map") throw new Error("not a travel view");
    return raw;
  },
  serialize: (value) => value,
};

/** How far one level of nesting sets a row in, and where the shallowest row starts. */
const INDENT_REM = 1.25;
const ROW_INSET_REM = 0.75;

export const LocationModal = ({
  isOpen, onOpenChange, locations, connections, currentLocationId, changeLocation,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  locations: GameLocation[];
  connections: Connection[];
  currentLocationId: string | null;
  changeLocation: (location: GameLocation) => void;
}) => {
  // The player's own preference rather than anything about the world: whichever way they traveled by last is
  // the way the dialog opens next time, and it never reaches a save.
  const [view, setView] = usePersistentState<TravelView>(
    "FORMAMORPH_travelView", "list", travelViewCodec,
  );

  const rows = useMemo(() => flattenLocationTree(buildLocationTree(locations)), [locations]);

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
          <TabsContent value="list" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <ul className="space-y-1">
              {rows.map(({ id, depth, location }) => {
                const here = id === currentLocationId;
                return (
                  <li key={id} aria-level={depth + 1}>
                    <button
                      type="button"
                      aria-current={here ? "location" : undefined}
                      onClick={() => travel(location)}
                      style={{ paddingLeft: `${ROW_INSET_REM + depth * INDENT_REM}rem` }}
                      className={cn(
                        "w-full truncate rounded-md py-2 pr-3 text-left text-label",
                        here
                          ? "bg-accent font-medium text-accent-foreground"
                          : "hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {location.name || UNNAMED_LOCATION}
                    </button>
                  </li>
                );
              })}
            </ul>
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
