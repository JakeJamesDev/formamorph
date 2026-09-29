import { useSyncExternalStore } from 'react';

/** One action the player sent, and when. */
export interface SentPrompt {
  text: string;
  at: number;
}

const STORAGE_KEY = 'FORMAMORPH_sentPromptLog';
/** How many sent prompts are kept, newest first. */
export const SENT_PROMPT_LIMIT = 100;

// Every action the player typed and sent, recorded at Send, before the turn can fail: the input box is
// cleared when a turn starts, so a failed request would otherwise take the text with it. Kept in a module
// store like the other live stores, so the recorder in GameViewer and the list beside Send share one copy.
let entries: SentPrompt[] = load();
const listeners = new Set<() => void>();

function load(): SentPrompt[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((e): e is SentPrompt => typeof e?.text === 'string' && typeof e?.at === 'number')
      : [];
  } catch {
    return [];
  }
}

function update(next: SentPrompt[]): void {
  entries = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Full or blocked storage costs only persistence; the session keeps the list.
  }
  for (const listener of listeners) listener();
}

/** Record a sent action. Sending the same text twice in a row keeps one entry, moved to now. */
export function recordSentPrompt(text: string, now = Date.now()): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const rest = entries[0]?.text === trimmed ? entries.slice(1) : entries;
  update([{ text: trimmed, at: now }, ...rest].slice(0, SENT_PROMPT_LIMIT));
}

export function clearSentPrompts(): void {
  update([]);
}

export function getSentPrompts(): SentPrompt[] {
  return entries;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The sent prompts, newest first, re-rendering when one is recorded. */
export function useSentPrompts(): SentPrompt[] {
  return useSyncExternalStore(subscribe, getSentPrompts);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** When a prompt was sent: `14:05` today, `28.09 14:05` before. 24-hour, day before month. */
export function formatSentAt(at: number, now = Date.now()): string {
  const d = new Date(at);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return new Date(now).toDateString() === d.toDateString() ? time : `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${time}`;
}
