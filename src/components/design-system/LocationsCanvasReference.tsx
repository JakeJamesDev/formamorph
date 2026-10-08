import { useMemo, useRef, useState } from 'react';
import { useHistoryChords } from '@/components/editor/useHistoryChords';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta } from '@/components/ui/typography';
import { LocationCanvasWorkspace } from '@/managers/LocationCanvas';
import { useWorldRecorder, WorldHistoryContext } from '@/contexts/worldRecorder';
import { EMPTY_LETTERS } from '@/lib/placementLetters';
import { NO_OWNERS } from '@/lib/placeholderHomes';
import {
  DEFAULT_CANVAS_CONNECTION_STYLE, DEFAULT_CANVAS_GRID_VISIBLE, DEFAULT_CANVAS_SNAP,
} from '@/contexts/settingsDefaults';
import type { ConnectionStyle } from '@/lib/canvasEdgePath';
import type { Connection, GameLocation, WorldOverview } from '@/types';

const SAMPLE_LOCATIONS: GameLocation[] = [
  { id: 'harbor', name: 'Harbor District', isStarting: true, canvasPosition: { x: 0, y: 0 } },
  { id: 'market', name: 'Market Courtyard', parentId: 'harbor', canvasPosition: { x: 20, y: 60 } },
  { id: 'archive', name: 'Archive and Cartography Rooms', parentId: 'harbor', canvasPosition: { x: 260, y: 60 } },
  { id: 'reading', name: 'Reading Room for Coastal Charts and Historical Navigation Records', parentId: 'archive', canvasPosition: { x: 20, y: 60 } },
  { id: 'records', name: 'Records Office', parentId: 'archive', canvasPosition: { x: 240, y: 160 } },
  { id: 'quay', name: 'Lower Quay', parentId: 'harbor', canvasPosition: { x: 20, y: 300 } },
  { id: 'garden', name: 'Hill Garden', canvasPosition: { x: 820, y: 100 } },
  { id: 'station', name: 'North Survey Station', canvasPosition: { x: 840, y: 340 } },
];

const SAMPLE_CONNECTIONS: Connection[] = [
  { id: 'market-archive', a: 'market', b: 'archive', aToB: { hint: 'through the covered east passage' } },
  { id: 'quay-garden', a: 'quay', b: 'garden', aToB: { hint: 'along the elevated footbridge above the harbor warehouses and winter storage yards' }, bToA: { hint: 'down the footbridge stairs to the quay' } },
  { id: 'garden-station', a: 'garden', b: 'station', aToB: { hint: 'up the survey steps' } },
];

function noop() { /* the sample has no such slice */ }

// The sample is a world of two slices; the recorder reads the other ten as empty and never writes them.
const NO_SLICES = {
  worldOverview: {} as WorldOverview, stats: [], entities: [], entityGroups: [], traits: [], traitGroups: [],
  statUpdates: [], dictionaries: [], placeholders: [], placeholderGroups: [],
};
const NO_WRITES = { worldOverview: noop, stats: noop, entities: noop, entityGroups: noop, traits: noop, traitGroups: noop,
  statUpdates: noop, dictionaries: noop, placeholders: noop, placeholderGroups: noop };

export function LocationsCanvasReference() {
  const [locations, setLocations] = useState(() => structuredClone(SAMPLE_LOCATIONS));
  const [connections, setConnections] = useState(() => structuredClone(SAMPLE_CONNECTIONS));
  const [selectedId, setSelectedId] = useState<string | null>('reading');
  // The canvas records into the history above it, so the sample gets its own and never touches an open world's.
  const slices = useMemo(() => ({ ...NO_SLICES, locations, connections }), [locations, connections]);
  const writes = useMemo(() => ({ ...NO_WRITES, locations: setLocations, connections: setConnections }), []);
  const { controls } = useWorldRecorder(slices, 'locations-reference', writes);
  const canvasRef = useRef<HTMLDivElement>(null);
  useHistoryChords(controls, canvasRef, { scoped: true });
  const snap = useState(DEFAULT_CANVAS_SNAP);
  const grid = useState(DEFAULT_CANVAS_GRID_VISIBLE);
  const connectionStyle = useState<ConnectionStyle>(DEFAULT_CANVAS_CONNECTION_STYLE);
  const selected = locations.find(location => location.id === selectedId);

  return (
    <Card role="region" aria-labelledby="locations-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="locations-reference-title" className="text-heading">Locations Canvas Reference</CardTitle>
        <CardDescription>Select “Edit Full Screen”.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3">
        <div ref={canvasRef} className="h-[34rem] min-w-0 overflow-hidden rounded-md border border-border">
          <WorldHistoryContext.Provider value={controls}>
            <LocationCanvasWorkspace
              selectedId={selectedId}
              onSelect={setSelectedId}
              data={{ locations, setLocations, connections, setConnections,
                placeholders: [], placementLetters: EMPTY_LETTERS, placeholderOwners: NO_OWNERS }}
              preferences={{ snap, grid, connectionStyle }}
            />
          </WorldHistoryContext.Provider>
        </div>
        <Meta as="output" aria-label="Selected Location" className="block break-words">
          {selected?.name}
          {selected?.canvasPosition && ` (${selected.canvasPosition.x}, ${selected.canvasPosition.y})`}
        </Meta>
      </CardContent>
    </Card>
  );
}
