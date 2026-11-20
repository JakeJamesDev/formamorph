import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('changelog panel typography', () => {
  // Streamdown sizes the rendered markdown off the raw Tailwind scale, so every element in the panel needs a
  // size of ours to land on a role. A literal font-size is invisible to the role system, and nothing else lints CSS.
  it('sizes .changelog-body through the font roles, never a literal font-size', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    const offenders = [...css.matchAll(/(\.changelog-body[^{]*)\{([^}]*)\}/g)]
      .filter(([, , body]) => /(^|[;\s])font-size\s*:/.test(body))
      .map(([, selector]) => selector.trim());
    expect(offenders).toEqual([]);
  });

  it('pins the elements Streamdown sizes to a role', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    const roleFor = (selector: string) => {
      const m = new RegExp(`\\.changelog-body ${selector}\\s*\\{([^}]*)\\}`).exec(css);
      return /@apply\s+([\w-]*text-[\w-]+)/.exec(m?.[1] ?? '')?.[1];
    };
    // The version headings and inline code. `h2` is the one that rendered at 24px in a 14px panel.
    expect(roleFor('h2')).toBe('text-title');
    expect(roleFor('h3')).toBe('text-meta');
    expect(roleFor('code')).toBe('text-label');
  });
});
