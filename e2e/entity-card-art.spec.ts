import { expect, test } from '@playwright/test';
import { openApp } from './app';

// Canvas drawing and WebP encoding only exist in a real browser.
test('a blank entity exports as a 480 × 720 WebP card of Morph art that reimports', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'The export does not depend on the viewport');
  await openApp(page);

  const result = await page.evaluate(async () => {
    const fileModule = '/src/lib/entityFile.ts';
    const { exportEntityCard, importEntityCard } = await import(/* @vite-ignore */ fileModule);
    const entity = { id: 'e1', name: 'Mara', aiDescription: 'A ferry keeper.', tags: ['River'] };
    const root = document.documentElement;
    const exportIn = async (dark: boolean) => {
      root.classList.toggle('dark', dark);
      return new Uint8Array(await (await exportEntityCard(entity)).arrayBuffer());
    };
    const dark = await exportIn(true);
    const light = await exportIn(false);
    const blob = new Blob([dark], { type: 'image/webp' });
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const colors = new Set<string>();
    const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    for (let i = 0; i < pixels.length; i += 4 * 97) colors.add(`${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`);
    const back = await importEntityCard(new File([dark], 'Mara.webp', { type: 'image/webp' }));
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    return {
      riff: new TextDecoder().decode(dark.slice(0, 4)) + new TextDecoder().decode(dark.slice(8, 12)),
      size: [bitmap.width, bitmap.height],
      sameInBothThemes: dark.length === light.length && dark.every((b, i) => b === light[i]),
      colorCount: colors.size,
      back: { name: back.name, aiDescription: back.aiDescription, tags: back.tags, images: back.images?.length },
      dataUrl,
    };
  });

  expect(result.riff).toBe('RIFFWEBP');
  expect(result.size).toEqual([480, 720]);
  expect(result.sameInBothThemes).toBe(true);
  // A background gradient, a letter and clusters: far more than the two tones of a flat initials card.
  expect(result.colorCount).toBeGreaterThan(8);
  expect(result.back).toEqual({ name: 'Mara', aiDescription: 'A ferry keeper.', tags: ['River'], images: 1 });
  await page.setContent(`<img src="${result.dataUrl}">`);
  await page.screenshot({ path: info.outputPath('blank-entity-card.png') });
});
