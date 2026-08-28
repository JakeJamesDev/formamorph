import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'FORMAMORPH_promptSplitMode';

/** What the author asked for. `auto` lets the field's own width decide; the others pin it. */
export type PromptSplitMode = 'auto' | 'split' | 'tabs';

/** How a prompt field is actually laid out this render. */
export type PromptLayout = 'split' | 'tabs';

/**
 * Narrowest a single pane may get before the split stops earning its width. Below this the two panes
 * wrap prompt text so hard that one wider pane reads better — which is also what makes mobile and
 * shrunken desktop windows fall back on their own, with no device check involved.
 */
export const MIN_PANE_WIDTH = 420;

/** Gap + borders between the two panes; excluded before the width is halved. */
const SPLIT_GUTTER = 12;

/**
 * The layout for a field of `containerWidth`.
 *
 * Splitting is a full-screen affair. Inline, a field is one column of a panel that has other things to
 * show — the world editor's is 545px of a form — so halving it produces two columns too narrow to read
 * and takes the width from whichever one you were actually using. `hasPreview` is false for fields with
 * nothing to preview, which can never split however wide they get.
 */
export function resolveLayout(
  mode: PromptSplitMode,
  containerWidth: number,
  hasPreview: boolean,
  fullscreen: boolean,
): PromptLayout {
  if (!hasPreview || !fullscreen) return 'tabs';
  if (mode === 'split') return 'split';
  if (mode === 'tabs') return 'tabs';
  return splitAvailable(containerWidth, fullscreen) ? 'split' : 'tabs';
}

/** Whether the split can be offered at all — the toggle's own gate, and what `auto` picks by. One
 *  predicate, so a surface can never offer a toggle for a layout `resolveLayout` would refuse. */
export function splitAvailable(containerWidth: number, fullscreen: boolean): boolean {
  return fullscreen && (containerWidth - SPLIT_GUTTER) / 2 >= MIN_PANE_WIDTH;
}

/** Read a stored mode, treating anything unrecognized as `auto`. */
export function parseSplitMode(raw: string | null): PromptSplitMode {
  return raw === 'split' || raw === 'tabs' ? raw : 'auto';
}

/**
 * The author's split preference, shared by every prompt field: this is a statement about how they like to
 * edit, not a per-field setting. Persisted so it survives a reload; `auto` until they touch the toggle.
 */
export function usePromptSplitMode(): [PromptSplitMode, (m: PromptSplitMode) => void] {
  const [mode, setMode] = useState<PromptSplitMode>(() => {
    try {
      return parseSplitMode(localStorage.getItem(STORAGE_KEY));
    } catch {
      return 'auto';
    }
  });

  // Other fields on screen share the preference, so a change in one has to reach the rest.
  useEffect(() => {
    const onChange = (e: Event) => setMode((e as CustomEvent<PromptSplitMode>).detail);
    window.addEventListener('fm-prompt-split-mode', onChange);
    return () => window.removeEventListener('fm-prompt-split-mode', onChange);
  }, []);

  const update = useCallback((m: PromptSplitMode) => {
    setMode(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // A blocked localStorage costs only persistence; this session still honors the choice.
    }
    window.dispatchEvent(new CustomEvent('fm-prompt-split-mode', { detail: m }));
  }, []);

  return [mode, update];
}

/**
 * The element's live content width, measured rather than assumed so a resized window re-decides.
 *
 * Layout width (`clientWidth`, and the observer's own content rect), never a client rect: the fullscreen
 * window animates in on a transform, and a rect taken mid-animation reports the scaled box.
 *
 * `remeasureKey` forces a fresh measure when it changes — for a move the observer cannot see, like the
 * fullscreen toggle re-parenting the element into an overlay without remounting it.
 */
export function useContainerWidth(remeasureKey?: unknown): [(el: HTMLElement | null) => void, number] {
  const [width, setWidth] = useState(0);
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!node) return;
    setWidth(node.clientWidth);
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node, remeasureKey]);

  return [setNode, width];
}
