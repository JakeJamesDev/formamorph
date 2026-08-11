import { describe, it, expect } from 'vitest';
import { SETTINGS_COPY, SETTINGS_BUTTONS, SETTINGS_CONFIRMS, type SettingCopy } from './settingsCopy';

/**
 * The Settings modal's copy rules, asserted rather than reviewed. Their point is that consistency
 * survives the next setting somebody adds: a row without a description, a description that grew a second
 * sentence, or a sentence-case label all fail here rather than quietly landing in the modal.
 */

/** Words that stay lowercase inside a title — never at either end, where they take the capital. */
const LOWERCASE_WORDS = new Set([
  'a', 'an', 'and', 'the', 'to', 'of', 'in', 'for', 'with', 'or', 'on', 'at', 'by', 'per',
]);

/** The description column fits this many words on one line at the modal's width. Wrapping is what makes
 *  rows unequal heights, so anything longer belongs in the `ⓘ` instead. */
const MAX_DESCRIPTION_WORDS = 12;

/**
 * Title Case by shape rather than by allowlist: a word passes if its first letter is a capital, which
 * lets `AI`, `URL`, `Top-p`, `CFG` and `Qwen3` through without naming any of them. Parentheticals are
 * unit qualifiers (`(tokens)`, `(W × H)`), not title words, so they are dropped first.
 */
function titleCaseViolations(text: string): string[] {
  const words = text
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9-]/g, ''))
    .filter(Boolean);
  return words.filter((word, i) => {
    const first = word.match(/[A-Za-z]/)?.[0];
    if (!first) return false;
    const isEdge = i === 0 || i === words.length - 1;
    if (!isEdge && LOWERCASE_WORDS.has(word.toLowerCase())) return false;
    return first !== first.toUpperCase();
  });
}

const entries = Object.entries(SETTINGS_COPY) as [string, SettingCopy][];

describe('settings copy', () => {
  it('covers every setting with a description', () => {
    // R1 — a bare row leaves the reader to infer the setting from its label alone.
    expect(entries.filter(([, c]) => !c.description.trim()).map(([k]) => k)).toEqual([]);
  });

  it('keeps every description to one sentence that ends with a period', () => {
    // R2 — the interior check catches a description that grew a second sentence.
    const bad = entries.filter(([, c]) =>
      !c.description.endsWith('.') || c.description.slice(0, -1).includes('. '));
    expect(bad.map(([k, c]) => `${k}: ${c.description}`)).toEqual([]);
  });

  it('keeps every description within one line of the description column', () => {
    // R2 — the ceiling that stops rows growing unequal heights.
    const bad = entries.filter(([, c]) => c.description.trim().split(/\s+/).length > MAX_DESCRIPTION_WORDS);
    expect(bad.map(([k, c]) => `${k}: ${c.description.trim().split(/\s+/).length} words`)).toEqual([]);
  });

  it('titles every setting label', () => {
    // R4 — a casing split between neighboring rows is the most visible inconsistency a reader meets.
    const bad = entries.flatMap(([k, c]) => {
      const v = titleCaseViolations(c.label);
      return v.length ? [`${k}: ${c.label} → ${v.join(', ')}`] : [];
    });
    expect(bad).toEqual([]);
  });

  it('titles every button label and confirmation title', () => {
    // R4 — buttons sit beside each other, so one in sentence case is read against its neighbor.
    const bad = [
      ...Object.entries(SETTINGS_BUTTONS).map(([k, label]) => [k, label] as const),
      ...Object.entries(SETTINGS_CONFIRMS).map(([k, c]) => [k, c.title] as const),
    ].flatMap(([k, label]) => {
      const v = titleCaseViolations(label);
      return v.length ? [`${k}: ${label} → ${v.join(', ')}`] : [];
    });
    expect(bad).toEqual([]);
  });

  it('carries experimental as a flag rather than a word in the copy', () => {
    // R6 — the badge carries this, so the description spends all twelve words on what the setting does.
    const bad = entries.filter(([, c]) => /experimental/i.test(c.description));
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  it('gives every confirmation a body that reads as a sentence', () => {
    // Bodies are exempt from the length rule — a destructive action earns its explanation — but not from
    // being a finished sentence.
    const bad = Object.entries(SETTINGS_CONFIRMS).filter(([, c]) => !/[.?]$/.test(c.description));
    expect(bad.map(([k]) => k)).toEqual([]);
  });
});
