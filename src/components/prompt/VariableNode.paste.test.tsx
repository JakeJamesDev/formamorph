import { describe, it, expect } from 'vitest';
import { createEditor } from 'lexical';
import { VariableNode, $createVariableNode } from './VariableNode';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';

// importJSON is the clipboard's only deserialization route (fields load via parsePlaceholderText, drags
// move live nodes), so a token arriving there is a pasted copy and must not keep the source chip's Unique
// placement. These drive the same exportJSON → importJSON round-trip the clipboard performs.

function makeEditor() {
  return createEditor({ nodes: [VariableNode], onError: (e) => { throw e; } });
}

/** Run `fn` inside a discrete update so node construction has an active editor. */
function inEditor<T>(fn: () => T): T {
  let out!: T;
  makeEditor().update(() => { out = fn(); }, { discrete: true });
  return out;
}

const UNIQUE = encodePlaceholderToken({ id: 'name', mode: 'unique', placementId: 'p1' });

describe('VariableNode paste round-trip', () => {
  it('re-mints a placeholder chip placement id on importJSON', () => {
    const token = inEditor(() => VariableNode.importJSON($createVariableNode(UNIQUE).exportJSON()).getToken());
    const pasted = decodePlaceholderToken(token)!;
    expect(pasted.id).toBe('name');
    expect(pasted.mode).toBe('unique');
    expect(pasted.placementId).not.toBe('p1');
  });

  it('passes a prompt token through unchanged', () => {
    const token = inEditor(() => VariableNode.importJSON($createVariableNode('<STATS>').exportJSON()).getToken());
    expect(token).toBe('<STATS>');
  });

  it('clone keeps the token byte-identical (edits must never re-mint)', () => {
    const token = inEditor(() => VariableNode.clone($createVariableNode(UNIQUE)).getToken());
    expect(token).toBe(UNIQUE);
  });
});
