import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// A multi-line field draws its own caption into the row it shares with undo/redo (and, on a markdown
// field, the formatting buttons). Captioning one with a sibling <Label> instead puts the caption on a
// line of its own and leaves that row holding nothing but the two history buttons — which is how the
// trait and trait-group panels came to look different from every other panel in the editor.
const CAPTION_BEFORE_FIELD = /<Label[^>]*>[^<]*<\/Label>\s*<(?:PlaceholderField|PromptField)\b/g;

const MANAGERS = join(process.cwd(), 'src', 'managers');

describe('editor field captions', () => {
  const files = readdirSync(MANAGERS).filter((f) => f.endsWith('.tsx') && !f.includes('.test.'));

  it('covers every manager panel', () => {
    // Guards the guard: a glob that silently matched nothing would pass forever.
    expect(files.length).toBeGreaterThan(8);
  });

  it.each(files)('%s captions multi-line fields with the label prop, not a sibling Label', (file) => {
    const source = readFileSync(join(MANAGERS, file), 'utf8');
    expect([...source.matchAll(CAPTION_BEFORE_FIELD)].map((m) => m[0])).toEqual([]);
  });
});
