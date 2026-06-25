import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { streamingMarkdown } from './autoCloseMarkdown';
import { MARKDOWN_SAMPLE } from './markdownSample';
import { GameText } from '../components/game/GameText';

// Inline/block constructs that must never tear down and rebuild mid-reveal — that teardown is the
// visible "flicker". Tables are deliberately excluded: reflowing (columns/rows expanding as text
// types) is the desired behavior, so their internal remounts are expected and allowed.
const STABLE = new Set([
  'STRONG', 'EM', 'DEL', 'CODE', 'A',
  'UL', 'OL', 'LI', 'HR', 'BLOCKQUOTE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
]);

/**
 * Drives the sample through `GameText` one character at a time (simulating the reveal) and asserts the
 * user's three streaming invariants hold at every prefix:
 *   1. Non-table constructs never remount (no flicker).
 *   2. A table never reverts to literal-pipe plain text (no `<p>` ever contains a `|`).
 *   3. A task item never leaks its checkbox as text (no `[x]`/`[ ]` literal in a list item).
 * It is deterministic, unlike the live reveal (whose rAF is throttled in headless preview).
 */
describe('streaming markdown holds its no-flicker invariants', () => {
  it('never remounts a non-table construct, reverts a table to text, or leaks checkbox markup', () => {
    const { container, rerender } = render(<GameText text="" />);
    const observer = new MutationObserver(() => {});
    observer.observe(container, { childList: true, subtree: true });

    const remounted: string[] = [];
    const reverts: string[] = [];
    const leaks: string[] = [];

    for (let i = 1; i <= MARKDOWN_SAMPLE.length; i++) {
      rerender(<GameText text={streamingMarkdown(MARKDOWN_SAMPLE.slice(0, i), MARKDOWN_SAMPLE)} />);

      for (const record of observer.takeRecords()) {
        for (const node of record.removedNodes) {
          const el = node as Element;
          if (el.nodeType === 1 && STABLE.has(el.tagName)) {
            remounted.push(`len${i} ${el.tagName} "${(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20)}"`);
          }
        }
      }
      // A real revert = a formed table header/row leaking as a paragraph, i.e. a pipe sitting next to
      // cell text. A lone structural `|` at the table's leading edge (before any cell exists) is fine.
      for (const p of container.querySelectorAll('p')) {
        const t = p.textContent || '';
        if (/\|/.test(t) && /[A-Za-z0-9]/.test(t)) reverts.push(`len${i}: ${t.slice(0, 24)}`);
      }
      // A task item whose checkbox leaked as text contains a literal `[x]`/`[ ]`.
      for (const li of container.querySelectorAll('li')) {
        if (/\[[ xX]\]/.test(li.textContent || '')) leaks.push(`len${i}: ${(li.textContent || '').slice(0, 24)}`);
      }
    }
    observer.disconnect();

    expect(remounted).toEqual([]);
    expect(reverts).toEqual([]);
    expect(leaks).toEqual([]);
  });
});
