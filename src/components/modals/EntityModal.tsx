import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, RefreshCw, Loader2 } from "lucide-react";
import { EntityVisual, hasEntityVisual } from '../game/EntityVisual';
import AudioPlayer from '../game/AudioPlayer';
import { usePlaceholderResolver } from "@/lib/usePlaceholderResolver";
import { useEntityVisualPreference } from "@/lib/useEntityVisualPreference";
import { useEntityGallery } from "@/lib/useEntityGallery";
import type { Entity } from "@/types";

/** Editing hooks for a runtime-discovered character, whose description lives in the save rather than the
 *  authored world. Absent for authored entities, which the modal renders read-only. */
export interface EntityDescriptionEditing {
  /** Write a replacement description through to the discovered entity. */
  onSave: (text: string) => void;
  /** Rewrite the description from the character's accumulated story context. Resolves to the new text,
   *  or null when the model returned nothing usable. */
  onRegenerate: (signal: AbortSignal) => Promise<string | null>;
  /** True while other AI work is in flight, which is when regeneration is unavailable. */
  busy: boolean;
}

export const EntityModal = ({ entity, isOpen, onOpenChange, editing }: {
  entity: Entity | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: EntityDescriptionEditing;
}) => {
  const resolvePH = usePlaceholderResolver();
  const { preference, onPreferenceChange } = useEntityVisualPreference(entity?.id);
  const { imageIndex, onImageStep } = useEntityGallery(entity);

  // 'edit' and 'preview' are mutually exclusive: entering one leaves the other.
  const [mode, setMode] = useState<'view' | 'edit' | 'preview'>('view');
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Closing the modal or switching entities drops any in-flight regeneration and un-kept preview, so a
  // result can never land on a character the player has moved on from.
  const entityId = entity?.id;
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMode('view');
    setDraft('');
    setPreview('');
    setRegenerating(false);
    setRegenError(false);
  }, [entityId, isOpen]);
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!entity) return null;

  const description = entity.playerDescription?.trim() ?? '';

  const startEdit = () => {
    setDraft(description);
    setRegenError(false);
    setMode('edit');
  };

  const saveEdit = () => {
    const text = draft.trim();
    if (!text) return;
    editing?.onSave(text);
    setMode('view');
  };

  const regenerate = async () => {
    if (!editing || regenerating) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRegenerating(true);
    setRegenError(false);
    try {
      const next = await editing.onRegenerate(controller.signal);
      if (controller.signal.aborted) return;
      if (!next) { setRegenError(true); return; }
      setPreview(next);
      setMode('preview');
    } catch {
      if (!controller.signal.aborted) setRegenError(true);
    } finally {
      if (!controller.signal.aborted) setRegenerating(false);
    }
  };

  const keepPreview = () => {
    editing?.onSave(preview);
    setPreview('');
    setMode('view');
  };

  const discardPreview = () => {
    setPreview('');
    setMode('view');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[800px] h-[90dvh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{entity.name}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow min-h-0 flex flex-col gap-4 p-4">
          {/* Picture takes 3/4 of the body height (aspect ratio preserved); description fills the rest. */}
          {hasEntityVisual(entity) && (
            <div className="flex-[3] min-h-0 flex items-center justify-center">
              <EntityVisual
                entity={entity}
                preference={preference}
                onPreferenceChange={onPreferenceChange}
                imageIndex={imageIndex}
                onImageStep={onImageStep}
              />
            </div>
          )}
          {/* Scroll area whose content sits vertically centered when short (min-h-full + justify-center)
              and scrolls from the top when long. */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="min-h-full flex flex-col justify-center">
              <div className="flex flex-col gap-4">
              {mode === 'edit' ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    aria-label="Description"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={6}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setMode('view')}>Cancel</Button>
                    <Button size="sm" onClick={saveEdit} disabled={!draft.trim()}>Save</Button>
                  </div>
                </div>
              ) : mode === 'preview' ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">New Description</p>
                  <p>{preview}</p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={discardPreview}>Discard</Button>
                    <Button size="sm" onClick={keepPreview}>Keep</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {description ? (
                    <p>{resolvePH(description)}</p>
                  ) : (
                    <p className="italic text-muted-foreground">No description provided.</p>
                  )}
                  {editing && (
                    <div className="flex gap-2 justify-end items-center">
                      {regenError && (
                        <span className="text-xs text-muted-foreground mr-auto">Nothing usable came back. Try again.</span>
                      )}
                      <Button variant="ghost" size="sm" onClick={startEdit} disabled={regenerating}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={regenerate}
                        disabled={regenerating || editing.busy}
                        title={editing.busy ? 'Available once the story is done generating' : undefined}
                      >
                        {regenerating
                          ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          : <RefreshCw className="h-4 w-4 mr-1" />}
                        Regenerate
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {entity.sound && (
                <AudioPlayer src={entity.sound.data} className="w-full" />
              )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
