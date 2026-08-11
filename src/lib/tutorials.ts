/**
 * One-time tutorial popovers — short explanations anchored to a control the first time a screen shows it.
 *
 * Seen-state is keyed per entry id, so shipping a new entry surfaces it to everyone, including users who
 * have already dismissed every earlier one. Nothing here touches world or save data; the list of seen ids
 * is a device-local preference.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** Screens that host tutorials. One popover shows at a time, per screen. */
export type TutorialScreen = 'worldEditor' | 'community' | 'mainMenu';

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
  {
    id: 'community-kind-tabs',
    screen: 'community',
    title: 'Worlds, Entities & Dictionaries',
    points: [
      { term: 'Worlds', text: 'Complete adventures to play' },
      { term: 'Entities', text: 'Characters and creatures to add to yours' },
      { term: 'Dictionaries', text: "Lore books that teach the AI your world's terms" },
    ],
  },
  {
    id: 'community-filters',
    screen: 'community',
    title: 'Narrow the Catalog',
    body: 'Filter by author, tag, or download status, in any combination. Your filters stick around between visits.',
  },
  {
    id: 'community-like',
    screen: 'community',
    title: 'Show Some Love',
    body: 'Tap the heart on anything you enjoyed. Likes help other players find the good stuff — and you can sort the catalog by them.',
  },
  {
    id: 'community-search-prefixes',
    screen: 'community',
    title: 'Search Shortcuts',
    body: 'Type author:, tag:, or status: in the search box to turn what follows into a filter chip.',
  },
  {
    id: 'community-hidden',
    screen: 'community',
    title: "Hide What You're Done With",
    body: "Hide individual items, whole tags, or authors you'd rather not see. Undo it all from the same panel.",
  },
  {
    id: 'main-menu-sign-in',
    screen: 'mainMenu',
    title: 'Sign In',
    body: 'Create a free account to like and comment on community creations — and publish your own!',
  },
  {
    id: 'main-menu-feedback',
    screen: 'mainMenu',
    title: 'Bugs & Suggestions',
    body: 'Report a bug or send a suggestion straight to the developers. Replies land in your profile, and suggestions are public so everyone can read and vote on them.',
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

// Bumped by a reset so a tour already open on screen re-arms with it, rather than staying finished
// until its screen is left and come back to.
let resetGeneration = 0;

/** Clears every dismissal, re-arming all tutorials for the next visit (Settings → Reset Tutorials). */
export function resetTutorials() {
  resetGeneration += 1;
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

// Which screens are on view, innermost last. A screen layered over another — the Community Creations
// browser over the main menu — takes the tour with it, so two explanations can't share the glass.
const activeScreens: TutorialScreen[] = [];
const screenListeners = new Set<() => void>();
let topScreen: TutorialScreen | null = null;

function republishTop() {
  const next = activeScreens[activeScreens.length - 1] ?? null;
  if (next === topScreen) return;
  topScreen = next;
  screenListeners.forEach((l) => l());
}

function subscribeScreens(onChange: () => void): () => void {
  screenListeners.add(onChange);
  return () => { screenListeners.delete(onChange); };
}

/** Where the reader is in a screen's tour, and how to move. `total` is 1 for a lone explanation. */
export interface TutorialNav {
  /** 1-based, for "2 / 5". */
  step: number;
  total: number;
  /** Marks the current entry read and moves on; ends the tour on the last one. */
  next: () => void;
  /** Re-reads the one before. Already read, and staying read — going back is not un-reading. */
  prev: () => void;
}

export interface TutorialOptions {
  /** False while the screen isn't on view — a dialog that hasn't opened. The appear delay restarts from
   *  the moment this turns true, so a tutorial arrives as a change the eye catches on that screen. */
  active?: boolean;
  /** Ids that can't be explained yet: their control is absent, or does nothing for this reader. Held
   *  entries are stepped over rather than retired, so they surface on a visit that can show them. */
  held?: readonly string[];
}

/**
 * The tutorial a screen should be showing, and where it sits in that screen's tour.
 *
 * The tour is fixed when it starts rather than recomputed from what is still unread, so stepping back
 * reaches an entry the reader has already marked read. Reactive to dismissals and to a settings reset.
 */
export function useTutorial(screen: TutorialScreen, options: TutorialOptions = {}): {
  active: TutorialEntry | null;
  nav: TutorialNav;
  dismiss: (id: string) => void;
} {
  const { active = true, held } = options;
  // Subscribed for the re-render rather than the value: planning below reads `snapshot` directly, but any
  // dismissal or reset still has to re-run it.
  useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  const generation = useSyncExternalStore(subscribe, () => resetGeneration, () => 0);
  const onTop = useSyncExternalStore(subscribeScreens, () => topScreen, () => null) === screen;
  const [ready, setReady] = useState(false);
  const [tour, setTour] = useState<TutorialEntry[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) { setReady(false); return; }
    activeScreens.push(screen);
    republishTop();
    const t = setTimeout(() => setReady(true), TUTORIAL_APPEAR_DELAY_MS);
    return () => {
      clearTimeout(t);
      const at = activeScreens.indexOf(screen);
      if (at >= 0) activeScreens.splice(at, 1);
      republishTop();
    };
  }, [active, screen]);

  // A reset re-arms a tour that is already on screen, and leaving the screen re-plans it on return.
  useEffect(() => { setTour(null); setIndex(0); }, [generation, active, screen]);

  const showable = ready && active && onTop;
  const heldRef = useRef(held);
  heldRef.current = held;
  const heldKey = held ? held.join('|') : '';
  useEffect(() => {
    if (!showable) return;
    // Frozen while the reader is still walking it, so Previous keeps reaching the same steps. Once the
    // tour is done, an entry that was held and has since become explainable — signing in puts the
    // feedback button on screen — plans a fresh one rather than waiting for the screen to be left.
    // ...unless the step on screen has itself become unexplainable — signing in turns the profile
    // circle from an offer of an account into a profile, and its note has to go with it.
    if (tour && index < tour.length && !held?.includes(tour[index].id)) return;
    const planned = TUTORIALS.filter((t) => (
      // `snapshot`, not the rendered `seen`: planning must read what has been read as of right now.
      t.screen === screen && !snapshot.includes(t.id) && !heldRef.current?.includes(t.id)
    ));
    if (tour && planned.length === 0) return;
    setTour(planned);
    setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- held is tracked by heldKey, its contents
  }, [showable, tour, index, heldKey, screen]);

  const entry = showable && tour ? tour[index] ?? null : null;

  // Recording the read is done before the index moves, not inside the updater: React may run an updater
  // more than once and at a moment of its choosing, and the re-plan below reads what has been read.
  const next = useCallback(() => {
    const current = tour?.[index];
    if (current) markTutorialSeen(current.id);
    setIndex((i) => i + 1);
  }, [tour, index]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  /**
   * Using the explained control counts as reading it, and moves the tour on exactly as Next does.
   *
   * Only the entry actually on screen: a control whose explanation is held, or already read, must not
   * spend it — the reader used the control without ever being told what it does.
   */
  const dismiss = useCallback((id: string) => {
    if (entry?.id === id) next();
  }, [entry, next]);

  return {
    active: entry,
    nav: { step: index + 1, total: tour?.length ?? 0, next, prev },
    dismiss,
  };
}
