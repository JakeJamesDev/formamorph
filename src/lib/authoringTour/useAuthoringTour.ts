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
  start: (stepId?: string) => void;
  next: () => Promise<void>;
  prev: () => void;
  applyExample: () => void;
  end: () => void;
}

export function useAuthoringTour({ worldId, world, api, save, showStep }: {
  worldId: string | null;
  world: TourWorld;
  api: TourEditApi;
  /** The editor's own Save. */
  save: () => Promise<boolean>;
  /** Brings a step's field on screen. */
  showStep: (step: TourStep) => void;
}): AuthoringTour {
  const record = useTourRecord(worldId);
  const index = tourStepIndex(record?.step);
  const step = record ? TOUR_STEPS[index] : null;
  const items = record?.items;
  const complete = !!step && step.isComplete(world, items ?? {});
  const [saving, setSaving] = useState(false);
  const mounted = useMountedRef();

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

  const next = useCallback(async () => {
    if (!complete || saving) return;
    setSaving(true);
    const ok = await save();
    if (!mounted.current) return;
    setSaving(false);
    // A failed save keeps the step, so the author can press Next again.
    if (!ok) return;
    if (index + 1 >= TOUR_STEPS.length) end();
    else goTo(index + 1);
  }, [complete, saving, save, mounted, index, end, goTo]);

  const prev = useCallback(() => { if (index > 0) goTo(index - 1); }, [index, goTo]);

  const applyExample = useCallback(() => {
    if (step) step.write(api, step.example, items ?? {});
  }, [step, api, items]);

  return {
    running: !!record, step, stepNumber: index + 1, total: TOUR_STEPS.length, complete, saving,
    start, next, prev, applyExample, end,
  };
}
