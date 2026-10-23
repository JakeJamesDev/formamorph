import { describe, it, expect } from 'vitest';
import chatShape from './chatShape.cjs';

const { shapeChatBody } = chatShape;
const image = { type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } };

// The engine routes cover the no-projector path; this is the one a projector opens.
describe('shapeChatBody with a projector', () => {
  it('keeps the parts array on a message that still holds an image, and flattens the rest', () => {
    const { body, droppedImages } = shapeChatBody({ messages: [
      { role: 'system', content: [{ type: 'text', text: 'Rules.' }, image] },
      { role: 'user', content: [{ type: 'text', text: 'Look.' }, image] },
      { role: 'user', content: [{ type: 'text', text: 'A' }, { type: 'text', text: 'B' }] },
    ] }, { modelId: 'm', keepImages: true });
    expect(body.messages).toEqual([
      { role: 'system', content: 'Rules.' },
      { role: 'user', content: [{ type: 'text', text: 'Look.' }, image] },
      { role: 'user', content: 'A\n\nB' },
    ]);
    // A system message merges as text, so its image is counted as dropped.
    expect(droppedImages).toBe(1);
  });
});
