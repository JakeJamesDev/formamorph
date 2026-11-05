/** Loads a world into the data providers and reports their live handles. Both benches mount their tree inside it. */
import { useEffect, type ReactNode } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useWorldHistory, useWorldHistoryMoves } from '@/contexts/worldRecorder';
import type { World } from '@/types';

type GameDataHandle = ReturnType<typeof useGameData>;
type HistoryMoves = ReturnType<typeof useWorldHistoryMoves>;
type HistoryState = ReturnType<typeof useWorldHistory>;

export const Harness = ({ world, children, onReady }: {
  world: World;
  children?: ReactNode;
  onReady: (ctx: GameDataHandle, moves: HistoryMoves, state: HistoryState) => void;
}) => {
  const ctx = useGameData();
  const moves = useWorldHistoryMoves();
  const state = useWorldHistory();
  useEffect(() => { ctx.loadWorldData(world); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx, moves, state);
  return <>{children}</>;
};
