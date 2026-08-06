import { FEEDBACK_TYPES, type FeedbackCategory, type FeedbackType } from '@/types';

const DRAFT_KEY = 'FORMAMORPH_feedbackDraft';

/** An unsent report, kept so closing the dialog to check something in game doesn't cost the writing. */
export interface FeedbackDraft {
  type: FeedbackType;
  title: string;
  category: FeedbackCategory;
  body: string;
}

/** True when there is something worth keeping — a draft of two empty fields is not a draft. */
export function hasDraftContent(draft: Pick<FeedbackDraft, 'title' | 'body'>): boolean {
  return Boolean(draft.title.trim() || draft.body.trim());
}

/** The stored draft, or null when there is none (or the stored value no longer makes sense). */
export function loadFeedbackDraft(): FeedbackDraft | null {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackDraft>;
    const { type, title, category, body } = parsed;
    // A draft whose type or fields are unrecognizable can't be restored into the form, so it's discarded
    // rather than half-applied. Category is checked by the dialog against the live options, not here.
    if (!FEEDBACK_TYPES.includes(type as FeedbackType)) return null;
    if (typeof title !== 'string' || typeof body !== 'string' || typeof category !== 'string') return null;
    const draft = { type: type as FeedbackType, title, category: category as FeedbackCategory, body };
    return hasDraftContent(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function saveFeedbackDraft(draft: FeedbackDraft): void {
  if (!hasDraftContent(draft)) {
    clearFeedbackDraft();
    return;
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearFeedbackDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}
