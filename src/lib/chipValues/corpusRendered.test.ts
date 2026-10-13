import { describe, expect, it } from 'vitest';
import { TOKEN_PATTERN, splitToken } from '../promptVariables';
import { corpusTokens } from '@/test/tokenCorpus';
import { chipValues } from './chipValues';
import { sampleChipScene } from './sampleScene';

/**
 * Pins what every shipped token renders to over the sample scene. A renderer change that moves a shipped
 * prompt's text fails here. Regenerate with `npx vitest run src/lib/chipValues/corpusRendered.test.ts -u`
 * only when the change is meant to alter it. Tokens the scene gives no text (per-turn values) are left out.
 */
describe('the rendered corpus', () => {
  it('renders every shipped token to its recorded text', async () => {
    const values = chipValues(sampleChipScene());
    const rendered: Record<string, string> = {};
    for (const token of corpusTokens(TOKEN_PATTERN)) {
      const parts = splitToken(token);
      expect(parts, token).not.toBeNull();
      const value = values(parts!.key);
      if (value) rendered[parts!.key] = value;
    }
    expect(Object.keys(rendered).length).toBeGreaterThan(25);
    await expect(`${JSON.stringify(rendered, null, 1)}\n`).toMatchFileSnapshot('../../test/tokenCorpus.rendered.json');
  });
});
