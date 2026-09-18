import { useEffect, useRef } from 'react';
import { statsSnap, type PageView } from '@/lib/chatReadingLine';

/** Whether the stat rows snap on this render, per `statsSnap` over the previous render's page view. */
export function useStatsSnap(view: PageView, chat: boolean): boolean {
  const prev = useRef(view);
  useEffect(() => { prev.current = view; });
  return statsSnap(prev.current, view, chat);
}
