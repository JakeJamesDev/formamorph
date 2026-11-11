import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/typography';
import { DistanceMark } from '@/components/editor/DistanceMark';
import { ConnectionFields } from '@/components/editor/ConnectionFields';
import { PANEL_TRAVEL_LABELS } from '@/components/editor/connectionTravel';
import type { Connection, Placeholder } from '@/types';

const NO_PLACEHOLDERS: Placeholder[] = [];

/** The widget as the Lower Quay panel shows it, edited in local state. */
function PanelSample() {
  const [connection, setConnection] = useState<Connection>({
    id: 'fields', a: 'quay', b: 'garden', aToB: { hint: 'up the survey steps' }, bToA: { hint: 'up the survey steps' }, distance: 'far',
  });
  const legs = [
    ...(connection.aToB ? [{ key: 'aToB' as const, label: 'To Hill Garden', name: 'Travel Hint to Hill Garden' }] : []),
    ...(connection.bToA ? [{ key: 'bToA' as const, label: 'From Hill Garden', name: 'Travel Hint from Hill Garden' }] : []),
  ];
  return (
    <section aria-label="Connection Widget" className="space-y-2 rounded-md border p-3">
      <SectionTitle>Connection Widget</SectionTitle>
      <ConnectionFields
        connection={connection}
        viewpoint="quay"
        travelLabels={PANEL_TRAVEL_LABELS}
        groupNames={{ travel: 'Travel between here and Hill Garden', distance: 'Distance to Hill Garden' }}
        legs={legs}
        idPrefix="connection-fields-reference"
        placeholders={NO_PLACEHOLDERS}
        onChange={setConnection}
      />
    </section>
  );
}

export function ConnectionFieldsReference() {
  return (
    <Card role="region" aria-labelledby="connection-fields-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="connection-fields-reference-title" className="text-heading">Connection Widget Reference</CardTitle>
        <CardDescription>Select a Travel or Distance choice, or type a Travel Hint</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3 md:grid-cols-2">
        <section aria-label="Distance Mark" className="space-y-2 rounded-md border p-3">
          <SectionTitle>Distance Mark</SectionTitle>
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground"><DistanceMark distance="nearby" /></span>
            <span className="text-muted-foreground"><DistanceMark distance="far" /></span>
            <span className="text-foreground"><DistanceMark distance="nearby" /></span>
            <span className="text-foreground"><DistanceMark distance="far" /></span>
          </div>
        </section>
        <PanelSample />
      </CardContent>
    </Card>
  );
}
