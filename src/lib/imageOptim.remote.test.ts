import { describe, it, expect, vi } from 'vitest';

// The measure step runs in a worker; if a linked image ever reaches it, this spy sees it.
const measureInWorker = vi.fn(async () => ({ w: 4000, h: 4000, bytes: 9_000_000 }));
vi.mock('./imageOptimWorkerClient', () => ({
  measureInWorker: () => measureInWorker(),
  encodeInWorker: vi.fn(async (url: string) => url),
}));

const { isOversized, scanImages, IMAGE_CAPS } = await import('./imageOptim');

describe('linked images are outside the size budget', () => {
  it('never calls the measure worker for a link', async () => {
    await isOversized('https://files.example/huge.png', IMAGE_CAPS.entity);

    expect(measureInWorker).not.toHaveBeenCalled();
  });

  it('reports a link as within budget — it contributes no bytes to the world', async () => {
    await expect(isOversized('https://files.example/huge.png', IMAGE_CAPS.entity)).resolves.toBe(false);
  });

  it('still measures embedded images alongside it', async () => {
    const found = await scanImages(['https://files.example/huge.png', 'data:image/png;base64,AAAA'], IMAGE_CAPS.entity);

    expect(measureInWorker).toHaveBeenCalledTimes(1);
    expect(found).toHaveLength(1);
  });
});
