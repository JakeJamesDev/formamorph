import { describe, it, expect } from 'vitest';
import {
  SAMPLE_PREVIEW_VALUES, DERIVED_TOKENS, derivedPreviewValues, composePreviewValues, languagePreviewValue,
} from './previewValuePool';
import { ALL_PROMPT_VARIABLES, variableVariantIds, withVariant, baseToken } from './promptVariables';
import { resolveToken } from './promptTemplate';

/** Every concrete token the chip vocabulary can produce, variants and all. */
const everyToken = ALL_PROMPT_VARIABLES.flatMap((v) =>
  [null, ...variableVariantIds(v)].map((id) => withVariant(baseToken(v.token), id)),
);

const SETTINGS = {
  paragraphLimit: 'auto' as const,
  maxTokens: 700,
  markdownOutput: true,
  sectionStyle: 'markdown' as const,
  limitActiveCharacters: true,
  activeCharacterLimit: 3,
  // Deliberately non-English: the language chip is the one token that renders nothing on an English game,
  // so the whole-pool coverage checks below would have a hole to walk through otherwise. The English case
  // is asserted on its own further down.
  language: 'French',
};

/** The one token whose real value is legitimately empty — on an English game the language chip renders
 *  nothing at all, which is the whole point of it. Every other token must always have something to show. */
const LANGUAGE = '<LANGUAGE>';

describe('the pool as a whole', () => {
  it('covers every token the vocabulary can render', () => {
    // The guard that matters: a token added to the registry later must not reach a preview with no value
    // and render as a raw `<TOKEN>` to someone writing a prompt.
    const pool = composePreviewValues(SETTINGS);
    const missing = everyToken.filter((t) => pool[t] === undefined);
    expect(missing).toEqual([]);
  });

  it('gives every token non-empty content', () => {
    const pool = composePreviewValues(SETTINGS);
    const blank = everyToken.filter((t) => !pool[t]?.trim());
    expect(blank).toEqual([]);
  });

  it('shows the language chip as nothing on an English game, and as the directive otherwise', () => {
    // The one token that legitimately renders empty — a preview that padded it with a stand-in would show
    // a line the model never receives.
    expect(composePreviewValues({ ...SETTINGS, language: 'English' })[LANGUAGE]).toBe('');
    expect(composePreviewValues(SETTINGS)[LANGUAGE]).toBe('Write all narration in French.');
  });
});

describe('the derived layer', () => {
  it('shows the real guidance the settings produce, not a stand-in', () => {
    const derived = derivedPreviewValues({ ...SETTINGS, activeCharacterLimit: 3 });
    expect(derived['<ACTIVE CHARACTER GUIDANCE>']).toContain('3');
    expect(derived['<LENGTH GUIDANCE>']).toBeTruthy();
    expect(derived['<MARKDOWN GUIDANCE>']).toBeTruthy();
  });

  it('tracks a settings change rather than being frozen text', () => {
    const three = derivedPreviewValues({ ...SETTINGS, activeCharacterLimit: 3 });
    const eight = derivedPreviewValues({ ...SETTINGS, activeCharacterLimit: 8 });
    expect(three['<ACTIVE CHARACTER GUIDANCE>']).not.toBe(eight['<ACTIVE CHARACTER GUIDANCE>']);
    const md = derivedPreviewValues({ ...SETTINGS, markdownOutput: false });
    expect(md['<MARKDOWN GUIDANCE>']).not.toBe(three['<MARKDOWN GUIDANCE>']);
    const spanish = derivedPreviewValues({ ...SETTINGS, language: 'Spanish' });
    expect(spanish[LANGUAGE]).toBe('Write all narration in Spanish.');
  });

  it('names the surface the chip is being previewed for', () => {
    // The two prompts that offer the chip name themselves in the directive, so the choices field cannot
    // just show the pool's narration wording.
    expect(languagePreviewValue('choices', 'French')[LANGUAGE]).toBe('Write all choices in French.');
    expect(languagePreviewValue('narration', 'French')[LANGUAGE]).toBe('Write all narration in French.');
    expect(languagePreviewValue('choices', 'English')[LANGUAGE]).toBe('');
  });

  it('is never shadowed by a sample of the same token', () => {
    // A sample here would quietly replace the player's real setting in the preview.
    for (const token of DERIVED_TOKENS) expect(SAMPLE_PREVIEW_VALUES[token]).toBeUndefined();
  });
});

describe('composePreviewValues', () => {
  it('lets a live game override the samples', () => {
    const pool = composePreviewValues(SETTINGS, { '<LOCATION>': 'The real place' });
    expect(pool['<LOCATION>']).toBe('The real place');
    expect(pool['<ENTITIES>']).toBe(SAMPLE_PREVIEW_VALUES['<ENTITIES>']); // untouched keys stay sampled
  });

  it('keeps derived guidance real even in a live game', () => {
    // The in-game map no longer carries guidance strings of its own; they must still be the true ones.
    const pool = composePreviewValues(SETTINGS, { '<LOCATION>': 'The real place' });
    expect(pool['<ACTIVE CHARACTER GUIDANCE>']).toBe(derivedPreviewValues(SETTINGS)['<ACTIVE CHARACTER GUIDANCE>']);
  });
});

describe('SAMPLE_PREVIEW_VALUES', () => {

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
