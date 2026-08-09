import { randomUUID } from "@/lib/uuid";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User } from 'lucide-react';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity, EntityMetadata } from '@/types';

/**
 * Post-location step: choose which of the player's library characters join this playthrough. The chosen
 * characters (loaded from the library, each copied in with a fresh id) are placed into the starting
 * location as runtime-only entities — the authored world is never modified. Only shown when the library has
 * characters (see `shouldShowCharacterStep`).
 */
const CharacterSelectionModal = ({ libraryMeta, onConfirm, onAbort, onBack, confirmLabel = 'Start' }: {
  libraryMeta: EntityMetadata[];
  onConfirm: (characters: Entity[]) => void;
  onAbort: () => void;
  /** Step back in the enter-world flow. Undefined on the flow's first step (the Back button then fades). */
  onBack?: () => void;
  /** Label for the confirm button — names the next step in the flow (e.g. "Dictionaries", "Start"). */
  confirmLabel?: string;
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);

  const toggle = (id: string, checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });

  const handleConfirm = async () => {
    setResolving(true);
    try {
      // Preserve list order; skip any record that vanished between listing and confirm.
      const ordered = libraryMeta.filter((m) => selectedIds.has(m.id));
      const loaded = await Promise.all(
        ordered.map((m) => EntityStorageService.getEntityData(m.id).catch(() => null)),
      );
      const characters = loaded
        .filter((e): e is Entity => e !== null)
        .map((e) => ({ ...e, id: randomUUID() })); // fresh id: a runtime copy, independent of the library
      onConfirm(characters);
    } finally {
      setResolving(false);
    }
  };

  return (
    <Card className="fixed inset-0 m-auto w-[95%] max-w-[600px] h-[90dvh] max-h-[800px] z-50">
      <CardContent className="p-3 sm:p-6 h-full flex flex-col">
        <h2 className="text-title sm:text-heading font-semibold mb-1">Choose Characters</h2>
        <p className="text-meta sm:text-helper text-muted-foreground mb-3">
          Pick characters from your library to bring into this playthrough. They join your starting location.
        </p>

        <ScrollArea className="flex-1 mb-4">
          <div className="flex flex-col gap-2 pr-2">
            {libraryMeta.map((m) => (
              <div
                key={m.id}
                onClick={() => toggle(m.id, !selectedIds.has(m.id))}
                className="flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-secondary"
              >
                <Checkbox
                  checked={selectedIds.has(m.id)}
                  onCheckedChange={(v) => toggle(m.id, v === true)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                />
                <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center">
                  {m.image ? (
                    <img src={m.image} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <span className="min-w-0 flex-1 font-semibold truncate">{m.name || 'Untitled'}</span>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={onAbort} variant="destructive" className="flex-1" disabled={resolving}>Abort</Button>
          <Button onClick={onBack} variant="outline" className="flex-1" disabled={!onBack || resolving}>Back</Button>
          <Button onClick={handleConfirm} className="flex-1" disabled={resolving}>
            {resolving ? 'Loading…' : confirmLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CharacterSelectionModal;
