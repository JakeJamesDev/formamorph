import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { useGameplay } from '@/contexts/GameplayContext';
import { useResolvedWorld } from './useResolvedWorld';
import type { PersonaRef } from '@/types';

// Each load sets a fresh reference object, so keying on it gives one notice per load and none per turn.
const noticed = new WeakSet<PersonaRef>();

/** Warn one time per load when the save's persona no longer exists. Mount where the game stays mounted. */
export function usePersonaNotice(): void {
  const { personaRef } = useGameplay();
  const { personaUnresolved } = useResolvedWorld();
  useEffect(() => {
    if (!personaUnresolved || !personaRef || noticed.has(personaRef)) return;
    noticed.add(personaRef);
    toast.warn('Your persona for this save no longer exists. You\'re playing with no persona.');
  }, [personaUnresolved, personaRef]);
}
