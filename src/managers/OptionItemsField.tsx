import { useId } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Meta } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import { fieldFrame } from '@/lib/historyField';
import { labelPlaceholders } from '@/lib/placementLetters';
import { PlacementRows } from '@/managers/PlacementsSection';
import type { Placement, PlacementWhere } from '@/types';

/** A recipient's select value. */
const whereKey = (where: PlacementWhere) => (where.kind === 'you' ? 'you' : `${where.kind}:${where.id}`);

function keyWhere(key: string): PlacementWhere {
  if (key === 'you') return { kind: 'you' };
  const [kind, ...rest] = key.split(':');
  return { kind: kind === 'location' ? 'location' : 'entity', id: rest.join(':') };
}

/** One Option value's Starting Items, each with who gets it. */
export function OptionItemsField({ when, name, placements, onChange, valueId }: {
  /** The heading's tail, such as "When On". Absent for a choice value. */
  when?: string;
  /** What each control is named after. */
  name: string;
  placements: readonly Placement[] | undefined;
  onChange: (next: Placement[] | undefined) => void;
  valueId: string;
}) {
  const { entities, locations, placeholders } = useGameData();
  const labelId = useId();
  const label = (text: string, fallback: string) => labelPlaceholders(text, placeholders) || fallback;
  const recipient = (p: Placement, onWhere: (where: PlacementWhere) => void) => (
    <Select value={whereKey(p.where)} onValueChange={(key) => onWhere(keyWhere(key))}>
      <SelectTrigger className="w-44 min-w-0 shrink" aria-label={`${name} Recipient`}>
        <SelectValue placeholder="Select Recipient" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="you">You</SelectItem>
        {entities.length > 0 && (
          <SelectGroup>
            <SelectLabel>Entities</SelectLabel>
            {entities.map((e) => <SelectItem key={e.id} value={`entity:${e.id}`}>{label(e.name, 'Unnamed Entity')}</SelectItem>)}
          </SelectGroup>
        )}
        {locations.length > 0 && (
          <SelectGroup>
            <SelectLabel>Locations</SelectLabel>
            {locations.map((l) => <SelectItem key={l.id} value={`location:${l.id}`}>{label(l.name, 'Unnamed Location')}</SelectItem>)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
  return (
    <div className="space-y-2" {...fieldFrame('placements', valueId)}>
      <Meta as="p" id={labelId} className="font-medium">{when ? `Starting Items ${when}` : 'Starting Items'}</Meta>
      <PlacementRows
        rows={placements ?? []} onRowsChange={(next) => onChange(next.length ? next : undefined)}
        where={{ kind: 'you' }} recipient={recipient} ariaPrefix={`${name} `} labelledBy={labelId}
      />
    </div>
  );
}
