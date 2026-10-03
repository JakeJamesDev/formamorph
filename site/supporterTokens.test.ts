import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The site draws its own stylesheet, so a tier color the app defines is invisible here until the site does too. */
const strip = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The tier tokens of the first block whose selector list names `selector`. */
const tokens = (css: string, selector: string) => {
  const block = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .find(([, list]) => list.trim().split(/\s*,\s*/).includes(selector));
  const body = block?.[2] ?? '';
  return Object.fromEntries(
    [...body.matchAll(/--(supporter(?:-plus)?):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
};

describe('the site stylesheet defines the Supporter Flair colors', () => {
  const app = strip('../src/index.css');
  const site = strip('./site.css');

  it.each([':root', '.dark'])('in %s, with the same values as the app', (selector) => {
    const expected = tokens(app, selector);

    expect(Object.keys(expected).sort()).toEqual(['supporter', 'supporter-plus']);
    expect(tokens(site, selector)).toEqual(expected);
  });
});
