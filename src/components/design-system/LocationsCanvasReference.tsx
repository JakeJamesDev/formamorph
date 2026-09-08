import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta } from '@/components/ui/typography';
import { LocationCanvasWorkspace } from '@/managers/LocationCanvas';
import type { CanvasHistory } from '@/lib/canvasHistory';
import { EMPTY_LETTERS } from '@/lib/placementLetters';
import { NO_OWNERS } from '@/lib/placeholderHomes';
import {
  DEFAULT_CANVAS_CONNECTION_STYLE, DEFAULT_CANVAS_GRID_VISIBLE, DEFAULT_CANVAS_SNAP,
} from '@/contexts/settingsDefaults';
import type { ConnectionStyle } from '@/lib/canvasEdgePath';
import type { Connection, GameLocation } from '@/types';

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
  { id: 'market-archive', from: 'market', to: 'archive', twoWay: false, aiHint: 'through the covered east passage' },
  { id: 'quay-garden', from: 'quay', to: 'garden', twoWay: true, aiHint: 'along the elevated footbridge above the harbor warehouses and winter storage yards' },
  { id: 'garden-station', from: 'garden', to: 'station', twoWay: false, aiHint: 'up the survey steps' },
];

export function LocationsCanvasReference() {
  const [locations, setLocations] = useState(() => structuredClone(SAMPLE_LOCATIONS));
  const [connections, setConnections] = useState(() => structuredClone(SAMPLE_CONNECTIONS));
  const [selectedId, setSelectedId] = useState<string | null>('reading');
  const historyRef = useRef<CanvasHistory>({ past: [], future: [] });
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
        <div className="h-[34rem] min-w-0 overflow-hidden rounded-md border border-border">
          <LocationCanvasWorkspace
            selectedId={selectedId}
            onSelect={setSelectedId}
            data={{ locations, setLocations, connections, setConnections,
              placeholders: [], placementLetters: EMPTY_LETTERS, placeholderOwners: NO_OWNERS }}
            preferences={{ snap, grid, connectionStyle }}
            historyRef={historyRef}
          />
        </div>
        <Meta as="output" aria-label="Selected Location" className="block break-words">
          {selected?.name}
          {selected?.canvasPosition && ` (${selected.canvasPosition.x}, ${selected.canvasPosition.y})`}
        </Meta>
      </CardContent>
    </Card>
  );
}
