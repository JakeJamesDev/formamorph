import { describe, it, expect } from 'vitest';
import { extractSdPrompt } from './sdMetadata';

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const enc = new TextEncoder();

function chunk(type: string, data: Uint8Array): number[] {
  const len = data.length;
  return [
    (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
    ...enc.encode(type),
    ...data,
    0, 0, 0, 0, // CRC (parser ignores it)
  ];
}

/** PNG with a single tEXt chunk (keyword\0text). */
function pngText(keyword: string, text: string): Uint8Array {
  return new Uint8Array([...PNG_SIG, ...chunk('tEXt', enc.encode(`${keyword}\0${text}`)), ...chunk('IEND', new Uint8Array())]);
}

/** PNG with a single uncompressed iTXt chunk (keyword\0 0 0 lang\0 trans\0 text). */
function pngITxt(keyword: string, text: string): Uint8Array {
  const data = new Uint8Array([...enc.encode(keyword), 0, 0, 0, 0, 0, ...enc.encode(text)]);
  return new Uint8Array([...PNG_SIG, ...chunk('iTXt', data), ...chunk('IEND', new Uint8Array())]);
}

describe('extractSdPrompt', () => {
  it('A1111/Forge: pulls the positive, cut at the negative marker and trimmed', () => {
    const params = '1girl, silver hair, outdoors \nNegative prompt: lowres, blurry\nSteps: 25';
    expect(extractSdPrompt(pngText('parameters', params))).toBe('1girl, silver hair, outdoors');
  });

  it('A1111: returns the whole value when there is no negative marker', () => {
    expect(extractSdPrompt(pngText('parameters', 'a knight, castle'))).toBe('a knight, castle');
  });

  it('InvokeAI: reads positive_prompt from the invokeai_metadata JSON', () => {
    const meta = JSON.stringify({ positive_prompt: '1girl, red hair, green eyes', negative_prompt: 'blurry', width: 1024 });
    expect(extractSdPrompt(pngText('invokeai_metadata', meta))).toBe('1girl, red hair, green eyes');
  });

  it('reads JSON metadata from an iTXt chunk too', () => {
    expect(extractSdPrompt(pngITxt('invokeai_metadata', JSON.stringify({ positive_prompt: 'a fox' })))).toBe('a fox');
  });

  it('NovelAI-style: falls back to a generic prompt string field', () => {
    expect(extractSdPrompt(pngText('Comment', JSON.stringify({ prompt: 'a knight', uc: 'bad quality' })))).toBe('a knight');
  });

  it('ComfyUI graph object under "prompt" is not mistaken for a prompt string', () => {
    const graph = JSON.stringify({ '3': { class_type: 'KSampler' }, '6': { class_type: 'CLIPTextEncode' } });
    expect(extractSdPrompt(pngText('prompt', graph))).toBeNull();
  });

  it('returns null for a non-PNG', () => {
    expect(extractSdPrompt(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]))).toBeNull(); // JPEG signature
  });

  it('returns null when there is no recognizable prompt metadata', () => {
    expect(extractSdPrompt(pngText('Software', 'Photoshop'))).toBeNull();
  });
});
