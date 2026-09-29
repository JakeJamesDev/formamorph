import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/typography';
import { TravelHintPair } from '@/components/editor/TravelHintPair';
import type { Connection } from '@/types';

const SAMPLES: { title: string; connection: Connection }[] = [
  { title: 'Linked', connection: { id: 'linked', a: 'quay', b: 'garden', aToB: { hint: 'along the footbridge' }, bToA: { hint: 'along the footbridge' } } },
  { title: 'Unlinked', connection: { id: 'unlinked', a: 'quay', b: 'garden', aToB: { hint: 'up the survey steps' }, bToA: { hint: 'down the survey steps' } } },
  { title: 'One-Way', connection: { id: 'one-way', a: 'quay', b: 'garden', aToB: { hint: 'through the sea gate' } } },
];

/** One sample, edited in local state and shown from the Lower Quay panel. */
function Sample({ title, connection: initial }: { title: string; connection: Connection }) {
  const [connection, setConnection] = useState(initial);
  const legs = [
    ...(connection.aToB ? [{ key: 'aToB' as const, label: 'To Hill Garden', name: 'Travel Hint to Hill Garden' }] : []),
    ...(connection.bToA ? [{ key: 'bToA' as const, label: 'From Hill Garden', name: 'Travel Hint from Hill Garden' }] : []),
  ];
  return (
    <section aria-label={title} className="space-y-2 rounded-md border p-3">
      <SectionTitle>{title}</SectionTitle>
      <TravelHintPair connection={connection} legs={legs} idPrefix={`travel-hints-${connection.id}`} onChange={setConnection} />
    </section>
  );
}

export function TravelHintPairReference() {
  return (
    <Card role="region" aria-labelledby="travel-hints-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="travel-hints-reference-title" className="text-heading">Travel Hint Pair Reference</CardTitle>
        <CardDescription>Select the link toggle to link or unlink a pair.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3 md:grid-cols-3">
        {SAMPLES.map((sample) => <Sample key={sample.connection.id} {...sample} />)}
      </CardContent>
    </Card>
  );
}
