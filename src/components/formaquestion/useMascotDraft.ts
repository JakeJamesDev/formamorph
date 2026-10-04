import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import type { MascotRig } from '@/lib/formaquestion/mascot';
import {
  cancelMascotDraft, editMascotDraft, isMascotDraftDirty, openMascotDraft, resetMascotDraft, saveMascotDraft, type MascotDraft,
} from '@/lib/formaquestion/mascotDraft';
import { deleteMascotImage } from '@/lib/formaquestion/mascotImageStore';
import {
  activeMascotPreset, addMascotPreset, deleteMascotPreset, duplicateMascotPreset, isDefaultMascot, mascotPresetOf, renameMascotPreset,
  selectMascotPreset, uniqueMascotName, unreferencedMascotImages, type MascotPreset, type MascotPresetStore,
} from '@/lib/formaquestion/mascotPresets';
import { randomUUID } from '@/lib/uuid';

/** The unsaved-changes prompt's props, open while a guarded action waits. */
export interface MascotLeavePrompt {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: () => void;
  readonly onExit: () => void;
}

export interface MascotDraftControl {
  readonly draft: MascotDraft;
  /** The mascot the draft edits, with its saved rig. */
  readonly mascot: MascotPreset;
  readonly store: MascotPresetStore;
  readonly dirty: boolean;
  /** The Default mascot is selected, which refuses edits. */
  readonly readOnly: boolean;
  /** Bumped when the draft is dropped or reset, so an upload that started before it lands nowhere. */
  readonly generation: MutableRefObject<number>;
  /** Applies an edit to the latest draft. The Default refuses it. */
  readonly edit: (apply: (rig: MascotRig) => MascotRig) => void;
  readonly reset: () => void;
  readonly save: () => void;
  readonly cancel: () => void;
  /** Runs `action` at once on a clean draft; on a dirty one, after the player saves or discards. */
  readonly guard: (action: () => void) => void;
  readonly leavePrompt: MascotLeavePrompt;
  readonly select: (id: string) => void;
  readonly duplicate: () => void;
  readonly rename: (name: string) => void;
  /** Deletes the selected mascot, its draft, and the images no other mascot references. */
  readonly remove: () => void;
  /** Adds an imported mascot under a free name and selects it. */
  readonly add: (name: string, rig: MascotRig) => void;
}

/** Deletes images from the mascot image store, logging a failure. */
export const dropMascotImages = (ids: Iterable<string>) => {
  for (const id of ids) void deleteMascotImage(id).catch((cause: unknown) => console.error('Could not delete a mascot image:', cause));
};

/**
 * The Mascot tab's draft over the help settings' mascot store. The store changes only through Save and the
 * preset actions; each action that changes the selection drops the draft.
 */
export function useMascotDraft(settings: HelpSettings, onChange: (change: HelpSettingsChange) => void): MascotDraftControl {
  // Written ahead of the next render, so an action that follows a Save in one handler reads the saved store.
  const storeRef = useRef(settings.mascotPresets);
  storeRef.current = settings.mascotPresets;
  const [held, setHeld] = useState(() => openMascotDraft(settings.mascotPresets));
  const generation = useRef(0);
  const [pending, setPending] = useState<(() => void) | null>(null);

  /** The held draft while it still matches the store's active mascot; a clean one follows the store. */
  const synced = (draft: MascotDraft): MascotDraft => {
    const active = activeMascotPreset(storeRef.current);
    if (draft.mascotId === active.id && (draft.saved === active.rig || isMascotDraftDirty(draft))) return draft;
    return openMascotDraft(storeRef.current);
  };
  const draft = synced(held);
  const heldRef = useRef(draft);
  heldRef.current = draft;
  // Written ahead of the next render too, so a guarded action after a Save reads the fresh draft.
  const hold = (next: MascotDraft) => {
    heldRef.current = next;
    setHeld(next);
  };

  const writeStore = (next: MascotPresetStore) => {
    storeRef.current = next;
    onChange({ mascotPresets: next });
  };
  /** Writes a store whose selection moved, with a fresh draft. The dropped draft's images go unless a mascot holds them. */
  const switchTo = (next: MascotPresetStore) => {
    generation.current += 1;
    const dropped = heldRef.current.touched;
    writeStore(next);
    hold(openMascotDraft(next));
    dropMascotImages(unreferencedMascotImages(dropped, next));
  };

  const readOnly = isDefaultMascot(storeRef.current, draft.mascotId);
  const edit = (apply: (rig: MascotRig) => MascotRig) => {
    if (isDefaultMascot(storeRef.current, heldRef.current.mascotId)) return;
    hold(editMascotDraft(heldRef.current, apply(heldRef.current.rig)));
  };
  const save = () => {
    const { store: next, orphans } = saveMascotDraft(storeRef.current, heldRef.current);
    writeStore(next);
    hold(openMascotDraft(next));
    dropMascotImages(orphans);
  };
  const cancel = () => {
    generation.current += 1;
    dropMascotImages(cancelMascotDraft(storeRef.current, heldRef.current));
    hold(openMascotDraft(storeRef.current));
  };
  const guard = (action: () => void) => {
    if (isMascotDraftDirty(heldRef.current)) setPending(() => action);
    else action();
  };

  // A draft dropped by an unmount takes its unsaved uploads with it.
  useEffect(() => () => dropMascotImages(cancelMascotDraft(storeRef.current, heldRef.current)), []);

  return {
    draft,
    mascot: mascotPresetOf(storeRef.current, draft.mascotId),
    store: storeRef.current,
    dirty: isMascotDraftDirty(draft),
    readOnly,
    generation,
    edit,
    reset: () => {
      if (isDefaultMascot(storeRef.current, heldRef.current.mascotId)) return;
      generation.current += 1;
      hold(resetMascotDraft(heldRef.current));
    },
    save,
    cancel,
    guard,
    leavePrompt: {
      open: pending !== null,
      onOpenChange: (open) => { if (!open) setPending(null); },
      onSave: () => { save(); pending?.(); setPending(null); },
      onExit: () => { cancel(); pending?.(); setPending(null); },
    },
    select: (id) => guard(() => switchTo(selectMascotPreset(storeRef.current, id))),
    duplicate: () => guard(() => {
      const source = activeMascotPreset(storeRef.current);
      switchTo(duplicateMascotPreset(storeRef.current, source.id, randomUUID(), uniqueMascotName(storeRef.current, `${source.name} (copy)`)));
    }),
    rename: (name) => writeStore(renameMascotPreset(storeRef.current, heldRef.current.mascotId, name)),
    remove: () => switchTo(deleteMascotPreset(storeRef.current, heldRef.current.mascotId)),
    add: (name, rig) => switchTo(addMascotPreset(storeRef.current, { id: randomUUID(), name: uniqueMascotName(storeRef.current, name), rig })),
  };
}
