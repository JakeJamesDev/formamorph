/**
 * The Authoring Tour controller: which step shows, whether it may advance, and what each button does.
 *
 * Steps complete on the authored world and never advance on their own. Next saves the world through the
 * editor's own Save before it moves on, so a tour step is never lost and a new world is stored after the
 * first one.
 */
import { useCallback, useEffect, useState } from 'react';
import WorldStorageService from '@/services/WorldStorageService';
import { useMountedRef } from '@/lib/useMountedRef';
import { AUTHORING_TOUR_SAVE_NOTE_ID, markTutorialSeen, useTutorialSeen } from '@/lib/tutorials';
import { TOUR_STEPS, tourStepIndex, type TourEditApi, type TourStep, type TourWorld } from './steps';
import { clearTourRecord, pruneTourRecords, useTourRecord, writeTourRecord } from './progress';

export interface AuthoringTour {
  running: boolean;
  step: TourStep | null;
  /** 1-based, for "1 / 2". */
  stepNumber: number;
  total: number;
  /** The step's field has a value, so Next is enabled. */
  complete: boolean;
  saving: boolean;
  /** The Save note is up, so the step note waits behind it. */
  showSaveNote: boolean;
  dismissSaveNote: () => void;
  start: (stepId?: string) => void;
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
  /** Brings a step's field on screen. */
  showStep: (step: TourStep) => void;
  /** Enters the world the way the main menu does. */
  onPlay?: () => void;
}): AuthoringTour {
  const record = useTourRecord(worldId);
  const index = tourStepIndex(record?.step);
  const step = record ? TOUR_STEPS[index] : null;
  const items = record?.items;
  const complete = !!step && step.isComplete(world, items ?? {});
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

  const goTo = useCallback((at: number) => {
    if (!worldId || !record) return;
    writeTourRecord(worldId, { ...record, step: TOUR_STEPS[at].id });
    showStep(TOUR_STEPS[at]);
  }, [worldId, record, showStep]);

  const start = useCallback((stepId?: string) => {
    if (!worldId) return;
    const at = tourStepIndex(stepId);
    writeTourRecord(worldId, { step: TOUR_STEPS[at].id, items: {} });
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
    if (step?.write && step.example !== undefined) step.write(api, step.example, items ?? {});
  }, [step, api, items]);

  return {
    running: !!record, step, stepNumber: index + 1, total: TOUR_STEPS.length, complete, saving,
    showSaveNote, dismissSaveNote, start, next, prev, applyExample, end, play: onPlay ? play : null,
  };
}
