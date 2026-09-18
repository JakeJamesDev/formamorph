import { ChartColumn, Copy, Dices, Headphones, ImagePlus, Pencil, RefreshCw, Undo2, type LucideIcon } from 'lucide-react';

/** One action on a Chat narration bubble. The icon row and the bubble menu both render the same list. */
export interface BubbleAction {
  key: string;
  label: string;
  icon: LucideIcon;
  section: 'generate' | 'content' | 'destructive';
  disabled?: boolean;
  /** The action's own job is running, so its icon shows a spinner. */
  spinning?: boolean;
  /** Listed under the row's More icon and in the menu, not as a row icon. */
  menuOnly?: boolean;
  run: () => void;
}

/** What one bubble's actions depend on. */
export interface BubbleState {
  isLatest: boolean;
  /** The turn is still streaming. */
  live: boolean;
  /** A reply is in flight. */
  busy: boolean;
  hasImage: boolean;
  canRegenStats: boolean;
  sceneImagesAvailable: boolean;
  sceneJob: 'tags' | 'image' | null;
  ttsLoaded: boolean;
  ttsGenerating: boolean;
}

/** The handlers, each already bound to the bubble's own turn. */
export interface BubbleActionHandlers {
  regenerate: () => void;
  regenerateStats: () => void;
  sceneImage: () => void;
  sceneTags: () => void;
  edit: () => void;
  textToSpeech: () => void;
  regenerateAudio: () => void;
  copy: () => void;
  rewind: () => void;
}

/**
 * The actions of one narration bubble, in menu order: generate, content, then destructive. The latest turn
 * gets the re-generate actions; a past turn gets Rewind to Here. A live turn gets none.
 */
export function bubbleActions(state: BubbleState, h: BubbleActionHandlers): BubbleAction[] {
  if (state.live) return [];
  const { busy, sceneJob } = state;
  const sceneBlocked = busy || sceneJob !== null;
  const actions: BubbleAction[] = [];
  if (state.isLatest) {
    actions.push({ key: 'regenerate', label: 'Re-generate Narration', icon: RefreshCw, section: 'generate', disabled: busy, run: h.regenerate });
    if (state.canRegenStats) {
      // A running scene render holds the graphics card, and the re-roll keeps the turn its picture belongs to.
      actions.push({ key: 'stats', label: 'Re-generate Stats', icon: ChartColumn, section: 'generate', disabled: sceneBlocked, run: h.regenerateStats });
    }
  }
  if (state.sceneImagesAvailable) {
    if (!state.hasImage) {
      actions.push({ key: 'image', label: 'Generate Scene Image', icon: ImagePlus, section: 'generate', disabled: sceneBlocked, spinning: sceneJob === 'image', run: h.sceneImage });
    }
    actions.push({ key: 'tags', label: 'Write Scene Tags', icon: Dices, section: 'generate', disabled: sceneBlocked, spinning: sceneJob === 'tags', menuOnly: true, run: h.sceneTags });
  }
  actions.push({ key: 'edit', label: 'Edit', icon: Pencil, section: 'content', run: h.edit });
  // The TTS modal reads the latest turn's text, so only the latest bubble offers it.
  if (state.isLatest) actions.push({ key: 'tts', label: 'Text to Speech', icon: Headphones, section: 'content', run: h.textToSpeech });
  actions.push({ key: 'copy', label: 'Copy Text', icon: Copy, section: 'content', run: h.copy });
  if (state.ttsLoaded) {
    actions.push({ key: 'regenerateAudio', label: 'Regenerate Audio', icon: RefreshCw, section: 'content', disabled: state.ttsGenerating, spinning: state.ttsGenerating, menuOnly: true, run: h.regenerateAudio });
  }
  if (!state.isLatest) {
    actions.push({ key: 'rewind', label: 'Rewind to Here', icon: Undo2, section: 'destructive', disabled: busy, run: h.rewind });
  }
  return actions;
}
