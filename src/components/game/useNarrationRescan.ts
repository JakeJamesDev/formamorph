import { useCallback } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { narrationOf } from '@/lib/aiResponse';
import type { CandidateExclusions } from '@/lib/characterCandidates';
import { normalizeVisibleEntities } from '@/lib/sceneEntities';
import { pageAssistantIndex, placeSnapshot } from '@/lib/turnHistory';
import { readEditedNarration } from '@/lib/turnPipeline/narrationReading';
import type { Entity } from '@/types';

/**
 * The rescan a narration edit runs on save. It rebuilds the edited page's scene list in that page's snapshot,
 * and in the live list when the page is the latest, then returns the turn's participants for the caller to
 * store. Discovered entities are left alone: a name the edit removed only leaves the list.
 */
export function useNarrationRescan({ entities, exclusions }: { entities: Entity[]; exclusions: CandidateExclusions }) {
  const { fullMessageHistory, gameStates, setGameStates, visibleEntities, setVisibleEntities, totalPages } = useGameplay();
  return useCallback((page: number, narration: string): string[] => {
    const priorNarration = fullMessageHistory
      .slice(0, pageAssistantIndex(page, 2))
      .filter((m) => m.role === 'assistant')
      .map((m) => narrationOf(m.content) ?? '')
      .join('\n');
    const latest = page === totalPages;
    const idx = page - 1;
    const previousScene = latest ? visibleEntities : normalizeVisibleEntities(gameStates[idx]?.visibleEntities);
    const reading = readEditedNarration({ narration, priorNarration, entities, exclusions, previousScene });
    // A page with no captured snapshot is left without one.
    setGameStates((prev) => (idx < prev.length
      ? placeSnapshot(prev, idx, { ...prev[idx], visibleEntities: reading.visibleEntities })
      : prev));
    if (latest) setVisibleEntities(reading.visibleEntities);
    return reading.participants;
  }, [fullMessageHistory, gameStates, setGameStates, visibleEntities, setVisibleEntities, totalPages, entities, exclusions]);
}
