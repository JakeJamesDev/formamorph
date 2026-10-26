# Ship-time Downscale 📦

The bundled worlds in `src/defaultworlds/` hold lossless, full-size art. Every production build ships them smaller: each world goes through the World Editor's **Downscale** rule before Vite bundles it. The source files never change.

## Where it runs

| Build | Bundled worlds |
|---|---|
| `npm run build` (web), `scripts/buildAndroid.mjs`, the desktop builds | Downscaled |
| `FORMAMORPH_LOSSLESS_WORLDS=1 npm run build` (a future Steam build) | Lossless source files |
| Dev server, tests, the world probe | Lossless source files |

Each production build prints a size table: every world's source size, its shipped size, and the total.

## The rule

- 🎯 Only an image the editor's Downscale scan selects changes (`downscaleDeps` in `src/lib/imageOptimCore.ts`). The slot budgets are `IMAGE_CAPS` in `src/lib/imageSlots.ts`.
- 🖼️ The image is resized to fit its slot's long edge, then encoded as lossy WebP at Downscale's quality (`QUALITY` in `src/lib/imageEncode.ts`).
- 📉 A result that isn't smaller than the source is dropped, and the source ships.
- 🎞️ **Animated images ship unchanged**, even over budget. The build lists each one it skipped as a warning.
- 🛑 An image the scan selects that the codec can't read fails the build. The codec reads static WebP, JPEG and PNG, not BMP.

The encode runs in Node, through the app's own libwebp (`wasm-webp`) and a fixed resize, so every machine makes the same bytes. It is not byte-identical to a Downscale click in the editor, which uses the browser's canvas.

## Fingerprints

`npm run fingerprints` records each world's shipped form next to its source form, so the publish check knows both. A world carries a shipped form as it stood at `cd6fe508c` (the last commit before this step), at every later commit that changed it, and in the working tree. A test fails when the list misses a shipped fingerprint: run `npm run fingerprints` after any world edit.

## Cache

Shipped copies are cached in `node_modules/.cache/formamorph-shipped-worlds/`. The key covers the source text, the code that decides the shipped bytes, and the codec packages' versions. Delete the folder to force a fresh encode.
