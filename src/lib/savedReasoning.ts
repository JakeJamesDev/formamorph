/** A turn's reasoning aside: the scratchpad text and how long the model thought. */
export interface SavedReasoning {
  text: string;
  ms: number;
}

/** A committed turn's saved reasoning (from its assistant-message JSON), or null. */
export function parseSavedReasoning(content: string): SavedReasoning | null {
  try {
    const r = JSON.parse(content)?.reasoning;
    return r && typeof r.text === 'string' ? { text: r.text, ms: typeof r.ms === 'number' ? r.ms : 0 } : null;
  } catch { return null; }
}
