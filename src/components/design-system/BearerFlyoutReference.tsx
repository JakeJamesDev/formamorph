import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListAddButton } from '@/components/ListToolbar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Hint } from '@/components/ui/typography';
import { MENU_ROW } from '@/components/menuRow';
import { DrillSlide, type SlideFrom } from '@/components/DrillSlide';
import { BearerList } from '@/managers/BearerPicker';
import { bearerChoices } from '@/lib/bearerChoices';
import type { Entity, EntityGroup } from '@/types';

const GROUPS: EntityGroup[] = [
  { id: 'heroes', name: 'Heroes', parentId: null, order: 0 },
  { id: 'guard', name: 'City Guard', parentId: 'heroes', order: 2 },
  { id: 'villains', name: 'Villains', parentId: null, order: 1 },
];
const ENTITIES: Entity[] = [
  { id: 'albus', name: 'Albus', groupId: 'heroes', order: 0, persona: true },
  { id: 'mira', name: 'Mira', groupId: 'heroes', order: 1 },
  { id: 'tomas', name: 'Captain Tomas Wexley of the Lower Ward', groupId: 'guard', order: 0 },
  { id: 'vex', name: 'Vex', groupId: 'villains', order: 0 },
  { id: 'sam', name: 'Sam', groupId: null, order: 3 },
  { id: 'newcomer', name: 'Newcomer', groupId: null, order: 4, customPersona: true },
];
const nameOf = (id: string) => ENTITIES.find((e) => e.id === id)?.name ?? id;

/** The Traits tab's two bearer flyouts over sample entities: the + menu's drill-in and the link button's. */
export function BearerFlyoutReference() {
  const [addOpen, setAddOpen] = useState(false);
  const [drilled, setDrilled] = useState(false);
  const [from, setFrom] = useState<SlideFrom>(null);
  const drill = (on: boolean) => { setDrilled(on); setFrom(on ? 'right' : 'left'); };
  const [linked, setLinked] = useState(() => new Set(['albus']));
  const [status, setStatus] = useState('The sample has no new trait.');
  return (
    <section aria-label="Bearer Flyouts" className="flex flex-wrap items-start gap-6 rounded-lg border bg-background p-4">
      <div className="space-y-2">
        <Popover open={addOpen} onOpenChange={(open) => { setAddOpen(open); setDrilled(false); setFrom(null); }}>
          <PopoverTrigger asChild><ListAddButton label="Add to Traits" /></PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-56 overflow-hidden p-1">
            <DrillSlide key={String(drilled)} from={from}>
              {drilled ? (
                <BearerList
                  choices={bearerChoices(GROUPS, ENTITIES)}
                  label="Entities"
                  back={{ label: 'Add Trait to Entity', onBack: () => drill(false) }}
                  onPick={(id) => { setStatus(`The sample added a trait to ${nameOf(id)}.`); setAddOpen(false); setDrilled(false); }}
                />
              ) : (
                <button type="button" className={MENU_ROW} onClick={() => drill(true)}>
                  Add Trait to Entity
                </button>
              )}
            </DrillSlide>
          </PopoverContent>
        </Popover>
        <Hint role="status">{status}</Hint>
      </div>
      <div className="space-y-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1"><Link2 className="h-3.5 w-3.5" aria-hidden />Link To…</Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-60 overflow-hidden p-1">
            <BearerList
              choices={bearerChoices(GROUPS, ENTITIES)}
              label="Link To"
              held={(id) => linked.has(id)}
              onPick={(id) => setLinked(new Set([...linked, id]))}
            />
          </PopoverContent>
        </Popover>
        <Hint>The sample links {[...linked].map(nameOf).join(', ')}.</Hint>
      </div>
    </section>
  );
}
