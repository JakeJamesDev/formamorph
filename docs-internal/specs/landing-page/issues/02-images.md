# 02 — Gallery images at display resolution

Status: done
Spec: ../spec.md
Blocked by: 01

## Task

Commit the 5 screens x 5 palettes x 2 themes gallery set, captured at display resolution
(~1280 wide), plus the hero art, the favicon, and the social-embed image.

- Recapture at the smaller viewport. Do not downscale the 1920-wide prototype shots.
- Screens: library, in-game (drone world, real narration, location backdrop), Veilwood world
  details, settings, avatar customization with `build-assets/alternate-avatar.vrm`.
- The avatar capture swaps the default VRM for the duration of the capture only.
- The capture script is committed so the set is regenerable.

## Done

- 50 gallery images plus icon and social image, all present and non-empty.
- Total committed image weight well under the 25 MB the prototype carried.

## Comments

**Implemented.** `scripts/captureSiteShots.mjs` writes `hosting/site/`. Captured at 1280x720 against the local dev server, with the cloud default endpoint (`api.lyonade.net`) supplying the real narration for the in-game screen.

Two decisions worth recording:

- **WebP, encoded by Chromium itself.** Playwright screenshots only PNG or JPEG. Rather than take a dependency on `sharp` (present in the tree only transitively), the script draws each frame into a canvas in a blank page and calls `toDataURL('image/webp', 0.86)`. The same path makes the 300px thumbnails and the 1200x630 JPEG social card. Resolution is unchanged; only the container differs, so this is not the downscaling the spec ruled out.
- **The alternate avatar is served by a request intercept, not a file swap.** The prototype swapped `public/default-avatar.vrm`. Doing that mid-run wrote 18 MB into `public/`, restarted Vite's watcher, and killed the dev server under the capture — the avatar sweep died with `ERR_CONNECTION_REFUSED`. The script now routes `**/default-avatar.vrm` to `build-assets/alternate-avatar.vrm` in a browser context of its own, because the app seeds that model into IndexedDB once per profile and a page sharing the earlier context would never re-fetch it.

### Evidence

| Claim | How it was checked | Result |
| --- | --- | --- |
| The set is complete | `find hosting/site -type f` | 57 files: 50 shots (5 screens x 5 palettes x 2 themes), 5 thumbnails, icon, social card |
| Weight | `du -sh hosting/site` | **3.6 MB** total, vs the ~25 MB the 1920-wide PNG set carried |
| Captured, not downscaled | PNG/WebP header read | every shot 1280x720; largest is 111 KB (`02-game`) |
| Derived files are right | header read | `icon.png` 256x256 58 KB · `og.jpg` **1200x630** 149 KB, matching the `og:image:width/height` tags |
| The avatar screen really shows the alternate VRM | Captured the same screen twice, with and without the intercept, and compared | route fired 3x in both runs; frame hashes differ (`010bec1a` vs `d770e96e`); the intercepted frame shows the Elaina model |
| The tracked avatar is untouched | `git status --short public/` | clean |
