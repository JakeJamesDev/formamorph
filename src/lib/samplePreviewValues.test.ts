import { describe, it, expect } from 'vitest';
import { SAMPLE_PREVIEW_VALUES } from './samplePreviewValues';
import { ALL_PROMPT_VARIABLES, variableVariantIds, withVariant, baseToken } from './promptVariables';
import { resolveToken } from './promptTemplate';

/** Every concrete token the chip vocabulary can produce, variants and all. */
const everyToken = ALL_PROMPT_VARIABLES.flatMap((v) =>
  [null, ...variableVariantIds(v)].map((id) => withVariant(baseToken(v.token), id)),
);

describe('SAMPLE_PREVIEW_VALUES', () => {
  it('covers every token the vocabulary can render', () => {
    // The guard that matters: a token added to the registry later must not reach a preview with no value
    // and render as a raw `<TOKEN>` to someone writing a prompt.
    const missing = everyToken.filter((t) => SAMPLE_PREVIEW_VALUES[t] === undefined);
    expect(missing).toEqual([]);
  });

  it('gives every token non-empty content', () => {
    const blank = everyToken.filter((t) => !SAMPLE_PREVIEW_VALUES[t]?.trim());
    expect(blank).toEqual([]);
  });

  it('resolves through the same path the preview uses, affixes included', () => {
    expect(resolveToken('<LOCATION>', SAMPLE_PREVIEW_VALUES)).toContain('The Landing');
    // An affixed placement wraps the value rather than replacing it.
    expect(resolveToken('<LOCATION|name|pre=", in "|post=" now">', SAMPLE_PREVIEW_VALUES))
      .toBe(', in The Landing now');
  });

  it('varies by scope, so a prompt using two scopes does not show the same block twice', () => {
    const here = SAMPLE_PREVIEW_VALUES['<LOCATION>'];
    const reachable = SAMPLE_PREVIEW_VALUES['<LOCATION|reachable>'];
    const sub = SAMPLE_PREVIEW_VALUES['<LOCATION|sublocations>'];
    expect(new Set([here, reachable, sub]).size).toBe(3);
  });

  it('shortens for the summary and name variants', () => {
    const full = SAMPLE_PREVIEW_VALUES['<ENTITIES>'];
    const summary = SAMPLE_PREVIEW_VALUES['<ENTITIES|summary>'];
    const name = SAMPLE_PREVIEW_VALUES['<ENTITIES|name>'];
    expect(summary.length).toBeLessThan(full.length);
    expect(name.length).toBeLessThan(summary.length);
    expect(name).not.toContain('\n'); // names go inside a sentence
  });

  it('honors the stats toggles rather than always printing everything', () => {
    expect(SAMPLE_PREVIEW_VALUES['<STATS DESCRIPTION|numbers>']).toContain('82/100');
    expect(SAMPLE_PREVIEW_VALUES['<STATS DESCRIPTION|numbers>']).not.toContain('Bruised');
    expect(SAMPLE_PREVIEW_VALUES['<STATS DESCRIPTION|descriptions>']).toContain('Bruised');
    expect(SAMPLE_PREVIEW_VALUES['<STATS DESCRIPTION|meaning>']).toContain('punishment');
  });

  it('shapes the block the way the format axis asks', () => {
    expect(SAMPLE_PREVIEW_VALUES['<ENTITIES|markdown>']).toContain('- ');
    expect(SAMPLE_PREVIEW_VALUES['<ENTITIES|xml>']).toContain('<entity>');
  });
});
