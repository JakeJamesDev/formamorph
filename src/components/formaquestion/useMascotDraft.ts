import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import type { MascotRig } from '@/lib/formaquestion/mascot';
import {
  cancelMascotDraft, editMascotDraft, isMascotDraftDirty, openMascotDraft, resetMascotDraft, saveMascotDraft, touchMascotDraft, type MascotDraft,
} from '@/lib/formaquestion/mascotDraft';
import {
  EMPTY_HISTORY, canRedo, canUndo, closeHistoryStep, pushHistory, redoHistory, undoHistory, type History,
} from '@/lib/formaquestion/mascotHistory';
import { deleteMascotImage } from '@/lib/formaquestion/mascotImageStore';
import {
  activeMascotPreset, addMascotPreset, deleteMascotPreset, duplicateMascotPreset, linkMascotPreset, mascotAllows, mascotPresetKind, mascotPresetOf,
  renameMascotPreset, selectMascotPreset, uniqueMascotName, unreferencedMascotImages, type MascotListingLink, type MascotPreset,
  type MascotPresetKind, type MascotPresetStore,
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
  /** The selected mascot's kind, which decides the preset actions it takes. */
  readonly kind: MascotPresetKind;
  /** The selected mascot refuses edits: the Default or a Supporter mascot. */
  readonly readOnly: boolean;
  /** Bumped when the draft is dropped or reset, so an upload that started before it lands nowhere. */
  readonly generation: MutableRefObject<number>;
  /**
   * Applies an edit to the latest draft as one undo step. Edits that share a `group` join one step until
   * `closeStep`. The Default refuses it.
   */
  readonly edit: (apply: (rig: MascotRig) => MascotRig, group?: string) => void;
  /** Marks stored uploads as the draft's, so Save or Cancel deletes them even when an Undo or a removal left no rig holding them. */
  readonly adopt: (ids: readonly string[]) => void;
  /** Ends the open step: the next edit starts a new one. */
  readonly closeStep: () => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
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
  /** The selected mascot as the store holds it now, for a guarded action that runs after a Save. */
  readonly selected: () => MascotPreset;
  /** Links the mascot `id` to the listing it was just published as. */
  readonly link: (id: string, link: MascotListingLink) => void;
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

  // The undo history belongs to one draft; a draft the store replaced under it starts a new one.
  const historyRef = useRef<{ history: History<MascotRig>; saved: MascotRig; mascotId: string }>({
    history: EMPTY_HISTORY, saved: draft.saved, mascotId: draft.mascotId,
  });
  const historyOf = (of: MascotDraft): History<MascotRig> =>
    historyRef.current.saved === of.saved && historyRef.current.mascotId === of.mascotId ? historyRef.current.history : EMPTY_HISTORY;
  const keepHistory = (of: MascotDraft, history: History<MascotRig>) => {
    historyRef.current = { history, saved: of.saved, mascotId: of.mascotId };
  };
  /** Holds a clean draft of the store's active mascot, with no history. */
  const reopen = (store: MascotPresetStore) => {
    const fresh = openMascotDraft(store);
    keepHistory(fresh, EMPTY_HISTORY);
    hold(fresh);
  };
  /** Holds `rig` over the held draft as a new step, joining the open step when `group` matches. */
  const recordEdit = (rig: MascotRig, group: string | null) => {
    const before = heldRef.current;
    if (rig !== before.rig) keepHistory(before, pushHistory(historyOf(before), before.rig, group));
    hold(editMascotDraft(before, rig));
  };
  /** Holds the rig a history step gives. Uploads in flight stay valid, so `generation` stays. */
  const stepTo = (step: { history: History<MascotRig>; value: MascotRig } | null) => {
    if (!step) return;
    keepHistory(heldRef.current, step.history);
    hold(editMascotDraft(heldRef.current, step.value));
  };
  const closeStep = () => keepHistory(heldRef.current, closeHistoryStep(historyOf(heldRef.current)));
  // A pointer release ends a drag's step wherever it lands, so a drag that leaves the control still closes.
  useEffect(() => {
    window.addEventListener('pointerup', closeStep);
    window.addEventListener('pointercancel', closeStep);
    return () => {
      window.removeEventListener('pointerup', closeStep);
      window.removeEventListener('pointercancel', closeStep);
    };
  });

  const writeStore = (next: MascotPresetStore) => {
    storeRef.current = next;
    onChange({ mascotPresets: next });
  };
  /** Writes a store whose selection moved, with a fresh draft. The dropped draft's images go unless a mascot holds them. */
  const switchTo = (next: MascotPresetStore) => {
    generation.current += 1;
    const dropped = heldRef.current.touched;
    writeStore(next);
    reopen(next);
    dropMascotImages(unreferencedMascotImages(dropped, next));
  };

  const kind = mascotPresetKind(storeRef.current, draft.mascotId);
  const readOnly = !mascotAllows(kind, 'edit');
  const editable = () => mascotAllows(mascotPresetKind(storeRef.current, heldRef.current.mascotId), 'edit');
  const edit = (apply: (rig: MascotRig) => MascotRig, group?: string) => {
    if (!editable()) return;
    recordEdit(apply(heldRef.current.rig), group ?? null);
  };
  const save = () => {
    const { store: next, orphans } = saveMascotDraft(storeRef.current, heldRef.current);
    writeStore(next);
    reopen(next);
    dropMascotImages(orphans);
  };
  const cancel = () => {
    generation.current += 1;
    dropMascotImages(cancelMascotDraft(storeRef.current, heldRef.current));
    reopen(storeRef.current);
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
    kind,
    readOnly,
    generation,
    edit,
    adopt: (ids) => hold(touchMascotDraft(heldRef.current, ids)),
    closeStep,
    undo: () => stepTo(undoHistory(historyOf(heldRef.current), heldRef.current.rig)),
    redo: () => stepTo(redoHistory(historyOf(heldRef.current), heldRef.current.rig)),
    canUndo: canUndo(historyOf(draft)),
    canRedo: canRedo(historyOf(draft)),
    reset: () => {
      if (!editable()) return;
      generation.current += 1;
      recordEdit(resetMascotDraft(heldRef.current).rig, null);
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
      if (!mascotAllows(mascotPresetKind(storeRef.current, source.id), 'duplicate')) return;
      switchTo(duplicateMascotPreset(storeRef.current, source.id, randomUUID(), uniqueMascotName(storeRef.current, source.name)));
    }),
    rename: (name) => writeStore(renameMascotPreset(storeRef.current, heldRef.current.mascotId, name)),
    remove: () => switchTo(deleteMascotPreset(storeRef.current, heldRef.current.mascotId)),
    selected: () => mascotPresetOf(storeRef.current, heldRef.current.mascotId),
    link: (id, link) => writeStore(linkMascotPreset(storeRef.current, id, link)),
    add: (name, rig) => switchTo(addMascotPreset(storeRef.current, { id: randomUUID(), name: uniqueMascotName(storeRef.current, name), rig })),
  };
}
