import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PersonaPicker, type PersonaOption } from './PersonaPicker';
import { personaOption, worldEntitiesOf } from '@/lib/persona';
import { useGameplay } from '@/contexts/GameplayContext';
import { useGameData } from '@/contexts/GameDataContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { useDevRoute } from '@/lib/devRouter';
import { inGamePersonas } from '@/lib/personaInGame';
import { pickedAtStart } from '@/lib/runtimeCharacters';
import { primaryImage } from '@/lib/entityImages';
import { thumbFit } from '@/lib/thumbAspect';
import { cn } from '@/lib/utils';
import { offeredPersonas, rememberWorldPersona, samePersonaRef, worldAllowedPersonas } from '@/lib/personaPick';
import EntityStorageService from '@/services/EntityStorageService';
import type { PersonaRef } from '@/types';

/** The player's persona in the side panel: portrait, name, and a Change control that opens the picker.
 *  `onChange` runs after the persona changes, with the new persona's name, or null for None. */
export function PersonaRow({ onChange }: { onChange: (ref: PersonaRef, name: string | null) => void }) {
  const { personaRef, setPersonaRef, discoveredEntities } = useGameplay();
  const { worldId, worldOverview } = useGameData();
  const { persona, entities: cast, worldPersonas, customPersona, resolveEntityText } = useResolvedWorld();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PersonaOption[]>([]);
  // Null until the player picks in this opening, so the picker starts on the current persona.
  const [draft, setDraft] = useState<PersonaRef | null>(null);
  const current: PersonaRef = personaRef ?? { source: 'none' };
  const choice = draft ?? current;

  const devRoute = useDevRoute();
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'persona') setOpen(true);
  }, [devRoute?.modal]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    EntityStorageService.getEntityMetadata().then(
      (library) => {
        if (!mounted) return;
        // The played world entity counts too: a library persona it copies stays out.
        const world = worldEntitiesOf(cast, persona);
        setOptions(inGamePersonas(library, world, pickedAtStart(discoveredEntities)).map(({ id, name, image, description }) => ({ id, name, image, description })));
      },
      () => { if (mounted) setOptions([]); },
    );
    return () => { mounted = false; };
  }, [open, cast, persona, discoveredEntities]);

  const showPicker = (next: boolean) => { setDraft(null); setOpen(next); };

  const offer = offeredPersonas(worldAllowedPersonas(worldOverview), {
    world: worldPersonas.map(personaOption(resolveEntityText)), library: options,
    custom: customPersona ? personaOption(resolveEntityText)(customPersona) : undefined,
  });

  const apply = () => {
    setPersonaRef(choice);
    if (worldId) rememberWorldPersona(worldId, choice);
    const picked = choice.source === 'none' ? (offer.custom && { name: choice.name?.trim() || offer.custom.name })
      : [...offer.world, ...offer.library].find((option) => option.id === choice.entityId);
    onChange(choice, picked?.name ?? null);
    showPicker(false);
  };
  const image = primaryImage(persona?.entity);
  return (
    <div className="flex items-center gap-2 pl-2" data-testid="persona-row">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {image
          ? <img src={image} alt="" className={cn('h-full w-full', thumbFit('portrait'))} />
          : <User aria-hidden className="h-4 w-4 text-muted-foreground" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-label">
        {persona ? persona.entity.name : <span className="text-muted-foreground">None</span>}
      </span>
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => showPicker(true)}>Change</Button>
      <Dialog open={open} onOpenChange={showPicker}>
        <DialogContent surface="persona" className="flex h-[90dvh] w-[95vw] max-w-none flex-col sm:w-[47.5vw]">
          <DialogHeader className="shrink-0 text-left">
            <DialogTitle>Change Persona</DialogTitle>
            <DialogDescription>Pick who you play. Memories written before the change keep the old name.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="-mr-3 min-h-0 flex-1 pr-3">
            <PersonaPicker
              world={offer.world}
              library={offer.library}
              none={offer.none}
              custom={offer.custom}
              value={choice}
              onChange={setDraft}
            />
          </ScrollArea>
          <DialogFooter className="shrink-0">
            <Button variant="ghost" onClick={() => showPicker(false)}>Cancel</Button>
            <Button onClick={apply} disabled={samePersonaRef(choice, current)}>Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
