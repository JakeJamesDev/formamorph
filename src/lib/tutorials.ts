/**
 * One-time tutorial popovers — short explanations anchored to a control the first time a screen shows it.
 *
 * Seen-state is keyed per entry id, so shipping a new entry surfaces it to everyone, including users who
 * have already dismissed every earlier one. Nothing here touches world or save data; the list of seen ids
 * is a device-local preference.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/** Screens that host tutorials. One popover shows at a time, per screen. */
export type TutorialScreen = 'worldEditor';

export interface TutorialEntry {
  id: string;
  screen: TutorialScreen;
  title: string;
  /** A sentence or two. Omit when `points` says it better. */
  body?: string;
  /** Term-and-gloss lines, for a control whose sides are worth naming side by side. */
  points?: { term: string; text: string }[];
}

/** Registry order is display order: the first unseen entry for a screen is the one that shows. */
export const TUTORIALS: readonly TutorialEntry[] = [
  {
    id: 'world-editor-mode-toggle',
    screen: 'worldEditor',
    title: 'Simple vs. Advanced',
    points: [
      { term: 'Simple', text: 'Just the Essentials' },
      { term: 'Advanced', text: 'Powerful but Complex' },
    ],
  },
];

const STORAGE_KEY = 'formamorph.tutorialsSeen';

/** Milliseconds after the screen mounts before the popover appears, so it arrives as a change the eye
 *  catches rather than as part of the first paint. */
export const TUTORIAL_APPEAR_DELAY_MS = 600;

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();
let snapshot: string[] = read();

function publish(next: string[]) {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private-mode storage denial: the dismissal still holds for this session.
  }
  listeners.forEach((l) => l());
}

export function markTutorialSeen(id: string) {
  if (snapshot.includes(id)) return;
  publish([...snapshot, id]);
}

/** Clears every dismissal, re-arming all tutorials for the next visit (Settings → Reset Tutorials). */
export function resetTutorials() {
  publish([]);
}

export function seenTutorials(): readonly string[] {
  return snapshot;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}

const EMPTY: string[] = [];

/** How many tutorials have been dismissed — drives the Settings reset control's state and hint. */
export function useSeenTutorialCount(): number {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY).length;
}

/** The first unseen tutorial for a screen, or null. Reactive to dismissals and to a settings reset. */
export function useTutorial(screen: TutorialScreen): {
  active: TutorialEntry | null;
  dismiss: (id: string) => void;
} {
  const seen = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), TUTORIAL_APPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  const next = TUTORIALS.find((t) => t.screen === screen && !seen.includes(t.id)) ?? null;
  const dismiss = useCallback((id: string) => markTutorialSeen(id), []);
  return { active: ready ? next : null, dismiss };
}
