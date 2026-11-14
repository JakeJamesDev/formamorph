import { describe, expect, it, vi } from 'vitest';
import { unscrambleWorldContent } from './worldContent';

const layer = (seed: number) => ({ dataUrl: 'data:image/png;base64,SCRAMBLED', seed, version: 1, sourceWidth: 8, sourceHeight: 8 });
const render = async (l: { seed: number }) => `data:image/png;base64,PLAIN${l.seed}`;

describe('unscrambleWorldContent', () => {
  it('replaces each scrambled layer where it sits, nested in objects and arrays', async () => {
    const out = await unscrambleWorldContent({ a: layer(1), list: [{ b: layer(2) }, layer(3)] }, render);

    expect(out).toEqual({
      a: 'data:image/png;base64,PLAIN1',
      list: [{ b: 'data:image/png;base64,PLAIN2' }, 'data:image/png;base64,PLAIN3'],
    });
  });

  it('passes everything that is not a scrambled layer through unchanged', async () => {
    const media = { audio: 'data:audio/mpeg;base64,QUJD', model: 'data:model/gltf-binary;base64,QUJD', text: 'plain', n: 4, yes: true, none: null, partial: { dataUrl: 'x', seed: 1 } };
    const draw = vi.fn(render);

    expect(await unscrambleWorldContent(media, draw)).toEqual(media);
    expect(draw).not.toHaveBeenCalled();
  });

  it('rejects when a layer will not rebuild, so no half-plain world is stored', async () => {
    const bad = vi.fn(async () => { throw new RangeError('The scrambled image is 1×1'); });

    await expect(unscrambleWorldContent({ a: layer(1) }, bad)).rejects.toThrow(RangeError);
  });
});
