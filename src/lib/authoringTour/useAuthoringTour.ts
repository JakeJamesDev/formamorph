/**
 * The Authoring Tour controller: which step shows, whether it may advance, and what each button does.
 *
 * Steps complete on the authored world and never advance on their own. Next saves the world through the
 * editor's own Save before it moves on, so a tour step is never lost and a new world is stored after the
 * first one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import WorldStorageService from '@/services/WorldStorageService';
import { useMountedRef } from '@/lib/useMountedRef';
import { AUTHORING_TOUR_SAVE_NOTE_ID, markTutorialSeen, useTutorialSeen } from '@/lib/tutorials';
import {
  TOUR_ITEM_KINDS, TOUR_STEPS, addStepIndex, liveTourItem, tourItemIds, tourStepIndex,
  type TourEditApi, type TourItem, type TourItems, type TourStep, type TourWorld,
} from './steps';
import { clearTourRecord, pruneTourRecords, useTourRecord, writeTourRecord } from './progress';

export interface AuthoringTour {
  running: boolean;
  step: TourStep | null;
  /** 1-based, for "1 / 2". */
  stepNumber: number;
  total: number;
  /** The step's field has a value, so Next is enabled. */
  complete: boolean;
  /** The step has an example and the item it fills exists. */
  canUseExample: boolean;
  saving: boolean;
  /** The Save note is up, so the step note waits behind it. */
  showSaveNote: boolean;
  dismissSaveNote: () => void;
  /** Starts at `stepId`, or the first step, following `items` as tour items. */
  start: (stepId?: string, items?: TourItems) => void;
  next: () => Promise<void>;
  prev: () => void;
  applyExample: () => void;
  end: () => void;
  /** Saves, ends the tour and enters the world. Null where the editor has no way to play. */
  play: (() => Promise<void>) | null;
}

export function useAuthoringTour({ worldId, world, api, save, showStep, onPlay }: {
  worldId: string | null;
  world: TourWorld;
  api: TourEditApi;
  /** The editor's own Save. */
  save: () => Promise<boolean>;
  /** Brings a step's field on screen, with the step's tour item selected. */
  showStep: (step: TourStep) => void;
  /** Enters the world the way the main menu does. */
  onPlay?: () => void;
}): AuthoringTour {
  const record = useTourRecord(worldId);
  const index = tourStepIndex(record?.step);
  const step = record ? TOUR_STEPS[index] : null;
  const items = record?.items;
  const complete = !!step && step.isComplete(world, items ?? {});
  const canUseExample = !!step?.useExample && (!step.item || liveTourItem(world, items ?? {}, step.item) !== null);
  const [saving, setSaving] = useState(false);
  // Session-only: the note waits for a save the author has just watched happen.
  const [saved, setSaved] = useState(false);
  const saveNoteSeen = useTutorialSeen(AUTHORING_TOUR_SAVE_NOTE_ID);
  const showSaveNote = !!record && saved && !saveNoteSeen;
  const dismissSaveNote = useCallback(() => markTutorialSeen(AUTHORING_TOUR_SAVE_NOTE_ID), []);
  const mounted = useMountedRef();

  // Registry objects are stable, so this runs once per step reached.
  useEffect(() => { step?.onReach?.(); }, [step]);

  // A record whose world is gone is dropped. The open world may not be stored yet, so it always stays.
  useEffect(() => {
    let live = true;
    void WorldStorageService.getWorldMetadata().then((stored) => {
      if (!live) return;
      const keep = new Set(stored.map((w) => w.id));
      if (worldId) keep.add(worldId);
      pruneTourRecords(keep);
    }).catch(() => {});
    return () => { live = false; };
  }, [worldId]);

  // A reopened world resumes with its step's field on screen.
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!worldId || !step || shownFor.current === worldId) return;
    shownFor.current = worldId;
    showStep(step);
  }, [worldId, step, showStep]);

  // Tour items follow the world by id. Each kind's ids from the last world seen tell an add from a delete, so
  // an item the world has not caught up with yet is never mistaken for a deleted one.
  const seenIds = useRef<Partial<Record<TourItem, Set<string>>>>({});
  useEffect(() => {
    const before = seenIds.current;
    const now = Object.fromEntries(TOUR_ITEM_KINDS.map((k) => [k, new Set(tourItemIds(world, k))])) as
      Record<TourItem, Set<string>>;
    seenIds.current = now;
    if (!worldId || !record || !step) return;

    // A deleted tour item sends the tour back to the step that added it.
    const gone = TOUR_ITEM_KINDS.filter((k) => {
      const id = record.items[k];
      return !!id && !!before[k]?.has(id) && !now[k].has(id);
    });
    if (gone.length) {
      const kept = { ...record.items };
      gone.forEach((k) => { delete kept[k]; });
      const at = Math.min(index, ...gone.map(addStepIndex).filter((i) => i >= 0));
      writeTourRecord(worldId, { step: TOUR_STEPS[at].id, items: kept });
      if (at !== index) showStep(TOUR_STEPS[at]);
      return;
    }

    // On an add step, the first item new since the last world seen becomes the tour's.
    const kind = step.add ? step.item : null;
    if (!kind || !before[kind] || liveTourItem(world, record.items, kind)) return;
    const taken = new Set(Object.values(record.items));
    const added = [...now[kind]].find((id) => !before[kind]!.has(id) && !taken.has(id));
    if (!added) return;
    writeTourRecord(worldId, { ...record, items: { ...record.items, [kind]: added } });
    showStep(step);
  }, [world, worldId, record, step, index, showStep]);

  const goTo = useCallback((at: number) => {
    if (!worldId || !record) return;
    writeTourRecord(worldId, { ...record, step: TOUR_STEPS[at].id });
    showStep(TOUR_STEPS[at]);
  }, [worldId, record, showStep]);

  const start = useCallback((stepId?: string, startItems: TourItems = {}) => {
    if (!worldId) return;
    const at = tourStepIndex(stepId);
    writeTourRecord(worldId, { step: TOUR_STEPS[at].id, items: startItems });
    showStep(TOUR_STEPS[at]);
  }, [worldId, showStep]);

  const end = useCallback(() => { if (worldId) clearTourRecord(worldId); }, [worldId]);

  // A failed save keeps the step, so the author can press the button again.
  const saveThen = useCallback(async (then: () => void) => {
    if (!complete || saving) return;
    setSaving(true);
    const ok = await save();
    if (!mounted.current) return;
    setSaving(false);
    if (!ok) return;
    setSaved(true);
    then();
  }, [complete, saving, save, mounted]);

  const next = useCallback(() => saveThen(() => {
    if (index + 1 >= TOUR_STEPS.length) end();
    else goTo(index + 1);
  }), [saveThen, index, end, goTo]);

  const play = useCallback(() => saveThen(() => {
    end();
    onPlay?.();
  }), [saveThen, end, onPlay]);

  const prev = useCallback(() => { if (index > 0) goTo(index - 1); }, [index, goTo]);

  const applyExample = useCallback(() => {
    if (canUseExample) step?.useExample?.(api, world, items ?? {});
  }, [canUseExample, step, api, world, items]);

  return {
    running: !!record, step, stepNumber: index + 1, total: TOUR_STEPS.length, complete, canUseExample, saving,
    showSaveNote, dismissSaveNote, start, next, prev, applyExample, end, play: onPlay ? play : null,
  };
}
