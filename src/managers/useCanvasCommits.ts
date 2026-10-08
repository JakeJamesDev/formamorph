import { useCallback } from 'react';
import { useWorldHistoryMoves } from '@/contexts/worldRecorder';
import type { StepKey } from '@/lib/editorHistory';
import type { Connection, GameLocation } from '@/types';

interface CanvasWrites {
  locations: GameLocation[];
  setLocations: (next: GameLocation[]) => void;
  connections: Connection[];
  setConnections: (next: Connection[]) => void;
}

/**
 * The canvas's two whole-slice writes. The world's history records them as it records any write, so a key is
 * the only thing the canvas adds: one that merges a run of writes into one Step.
 */
export function useCanvasCommits({ locations, setLocations, connections, setConnections }: CanvasWrites) {
  const { keyNext } = useWorldHistoryMoves();
  const commitLocations = useCallback((next: GameLocation[], key?: StepKey) => {
    // A write that changes nothing must not leave its key for the next one.
    if (key && next !== locations) keyNext(key);
    setLocations(next);
  }, [locations, setLocations, keyNext]);
  const commitConnections = useCallback((next: Connection[], key?: StepKey) => {
    if (key && next !== connections) keyNext(key);
    setConnections(next);
  }, [connections, setConnections, keyNext]);
  return { commitLocations, commitConnections };
}
