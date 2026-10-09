#!/usr/bin/env node
// Renders each cut's contact sheet into out/sheets/, one PNG per page.
//
//   npm run sheet           both cuts
//   npm run sheet -- tall   one cut
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layouts = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['wide', 'tall'];
const outDir = path.join(root, 'out', 'sheets');
mkdirSync(outDir, { recursive: true });

console.log('Bundling…');
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public') });

for (const layout of layouts) {
  const id = `Sheet-${layout}`;
  const { pages } = (await selectComposition({ serveUrl, id })).props;
  for (let page = 0; page < pages; page++) {
    const inputProps = { layout, page, pages };
    const composition = await selectComposition({ serveUrl, id, inputProps });
    const output = path.join(outDir, `${layout}-${page + 1}.png`);
    await renderStill({ composition, serveUrl, inputProps, output, imageFormat: 'png' });
    console.log(`wrote ${path.relative(root, output)}`);
  }
}
