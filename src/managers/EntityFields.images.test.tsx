import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntityGalleryField } from './EntityFields';
import type { Entity } from '@/types';

// The real uploader renders each slot; the canvas encode, the image cache, and the AI buttons are stood in for.
vi.mock('@/lib/useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({
    promptImage: async (url: string) => url,
    promptImagesBatch: async () => 'off',
    dialog: null,
    promptWorld: vi.fn(),
  }),
}));
vi.mock('@/lib/useRemoteImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/useRemoteImage')>()),
  useRemoteImage: (url: string) => ({ src: url || '', status: url?.startsWith('http') ? 'cached' : 'embedded' }),
  RemoteImg: ({ src }: { src?: string }) => <img src={src} alt="" />,
}));
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => <div /> }));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => <div /> }));

const A = 'data:image/webp;base64,AAAA';
const B = 'data:image/webp;base64,BBBB';

describe('EntityGalleryField open slot', () => {
  it('offers the upload prompt and the link box as its alternative on an entity with two uploads', () => {
    render(<EntityGalleryField value={{ id: 'e1', name: 'Ada', images: [A, B] } as Entity} onChange={vi.fn()} />);

    expect(screen.getByText('Click to upload image')).toBeTruthy();
    expect(screen.getByLabelText('Image URL').getAttribute('placeholder')).toBe('Or paste an image URL');
    expect(screen.queryByText(/Upload limit reached/)).toBeNull();
  });
});
