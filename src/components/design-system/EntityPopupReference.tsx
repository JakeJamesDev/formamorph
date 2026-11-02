import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityCardBody, EntityDescription } from '@/components/game/EntityCard';
import type { Entity } from '@/types';

const art = (width: number, height: number, fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`)}`;

const SAMPLES: { title: string; entity: Entity }[] = [
  {
    title: 'Portrait Art',
    entity: {
      id: 'portrait',
      name: 'Bram',
      images: [{ data: art(832, 1216, '#7a5c3e') }],
      playerDescription: 'A ferryman who watches the water while he talks. People here trust him with their boats and little else.',
    },
  },
  {
    title: 'Landscape Art',
    entity: {
      id: 'landscape',
      name: 'Wick',
      images: [{ data: art(1216, 832, '#3e5c7a') }],
      playerDescription: 'A thin runner with a satchel strapped tight across the chest.',
    },
  },
  {
    title: 'No Picture',
    entity: { id: 'text', name: 'Mara', playerDescription: 'A voice from behind the counter, and no one has seen more of her.' },
  },
];

/** The production card body in the popup's fixed height, with each kind of picture. */
export function EntityPopupReference() {
  return (
    <Card role="region" aria-labelledby="entity-popup-title">
      <CardHeader>
        <CardTitle id="entity-popup-title" className="text-heading">Entity Popup Reference</CardTitle>
        <CardDescription>The picture sits beside the text on large screens and above it on smaller ones.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {SAMPLES.map(({ title, entity }) => (
          <section key={entity.id} aria-label={title} className="flex h-96 flex-col rounded-md border border-border">
            <h3 className="border-b border-border px-4 py-2 text-label font-semibold">{title}</h3>
            <EntityCardBody entity={entity} sideBySide>
              <EntityDescription text={entity.playerDescription ?? ''} />
            </EntityCardBody>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
