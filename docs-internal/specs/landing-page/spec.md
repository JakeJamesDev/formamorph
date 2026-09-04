# Spec: The formamorph.ai site — landing page first

Status: ready-for-agent

## Problem Statement

`formamorph.ai/` redirects straight into the game. A first-time visitor gets no pitch, no screenshots, no download links — just an app they have not been sold on. The 302 on the root was always a placeholder for a landing page. The finalized prototype (branch `prototype/landing-page`) settled the design; nothing serves it yet, and there is no way to update site pages without cutting a full release.

## Solution

Serve a static landing page at the `formamorph.ai` root, deployed from the repo by the existing release workflow. The deploy now has two named halves: the **app** (the `/play/` build) and the **site** (every page and config file in the tracked hosting directory — the landing page today, more pages later). A release tag ships both. A new `site_only` dispatch path redeploys the site with the **latest released** app build, so a site edit never ships unreleased app code.

## User Stories

1. As a player, I want the formamorph.ai root to show a landing page, so that I understand the game before I play it.
2. As a player, I want a Play button that opens `/play/`, so that I reach the game in one click.
3. As a player, I want per-OS download buttons for the desktop builds, so that I get the right file without hunting through GitHub.
4. As a player, I want the download buttons to fall back to the releases page when the GitHub API is unavailable, so that a rate limit never leaves me stranded.
5. As a player, I want the gallery's light/dark slider and palette slideshow, so that I see the app's theming before I install anything.
6. As a player, I want the gallery screenshots to show real gameplay, the library, world details, settings, and the avatar screen, so that the pitch is the product and not marketing art.
7. As a player, I want the page to work on my phone, so that a shared link is not desktop-only.
8. As a player with motion sensitivity, I want the palette slideshow to respect reduced-motion, so that the page does not animate at me.
9. As a player who bookmarked `formamorph.ai/`, I want my old bookmark to land on the site root, so that nothing breaks when the redirect goes away.
10. As a player with saves, I want my IndexedDB library untouched by the site's arrival, so that the root changing never resets my progress.
11. As a player sharing the link, I want title, description, and social-embed tags, so that the page unfurls properly in chat apps.
12. As the maintainer, I want the site tracked in the app repo, so that one push updates code and site together with no second repo.
13. As the maintainer, I want a release tag to ship the current site with the new app build, so that the site never lags a release.
14. As the maintainer, I want a `site_only` dispatch that pairs the current site with the latest released app build, so that a landing tweak never ships unreleased app code.
15. As the maintainer, I want the deploy's live checks updated for the new root behavior, so that a broken landing page fails the workflow instead of waiting for a report.
16. As the maintainer, I want the site's images committed at their display resolution, so that the repo does not carry 25 MB of screenshots.
17. As the maintainer, I want the avatar screenshots to show the alternate VRM avatar, so that the site shows what players on formamorph.ai actually get.
18. As a future maintainer, I want the naming and layout to accommodate more site pages, so that page two needs no restructuring.

## Implementation Decisions

- **Vocabulary: "site" and "app".** The dispatch input is `site_only`, not `landing_only`. The tracked hosting directory is the site's source of truth and keeps its current name.
- **The page is the prototype's variant A**, translated to production: hero over blurred library art, the settled three-sentence tagline verbatim, Play + Download buttons, the onion-skin gallery with the palette slideshow, minimal footer. No feature blurbs.
- **Fade is IN-only.** The old palette layer stays fully opaque beneath the incoming one. A true cross-fade dips brightness at the midpoint and was rejected. From the prototype, the decision-rich part:

  ```js
  // On each tick: raise the incoming layer, fade it in, and only after the
  // fade lands (>= transition duration) drop the covered layer's visibility.
  imgs[next].style.zIndex = ++z;
  imgs[next].classList.add('on');
  setTimeout(() => imgs[prev].classList.remove('on'), FADE_MS + margin);
  ```

  The slideshow pauses while the divider is being dragged, and does not run at all under `prefers-reduced-motion`.
- **Gallery content:** 5 screens × 5 palettes (graphite, purple, forest, rose, monochrome) × 2 themes. Screens: library, in-game (drone world with real narration and a location backdrop), Veilwood world details, settings, avatar customization showing the alternate VRM avatar from the build assets.
- **Images are separate committed files, captured at display resolution** (~1280 wide), lazy-loaded except the first visible pair. No inlining — the 33 MB single-file prototype is a prototype artifact only. The capture scripts on the prototype branch regenerate everything; recapture happens at the smaller viewport rather than downscaling.
- **Downloads resolve client-side** from the GitHub releases API (latest release, per-OS asset match: `.exe`/win zip, `.AppImage`, `.dmg`), with the releases page as fallback for a missing asset or a failed request. No build-time version baking — the dispatch path would have none to bake.
- **Redirect contract change:** the root 302 is removed from the redirects file. `/play → /play/` 301 stays. The root serves the landing page as a 200.
- **Cache contract addition:** site assets get a day of cache (they are not content-hashed); the landing HTML keeps Pages' default no-store-ish revalidation.
- **Workflow: one deploy path, two sources.** The assemble-guard-deploy-check step sequence is shared (composite action or equivalent). The release path feeds it the freshly built web artifact. The `site_only` dispatch path feeds it the `formamorph-web-<version>.zip` asset downloaded from the latest GitHub release — that artifact already exists on every release. The size guard and live checks run on both paths.
- **Live-check update:** the `/` probe expects `200` with `text/html` instead of `302`, plus a content probe (the page names Formamorph) and a site-asset cache-header probe. All existing `/play/` and `.com` probes stay. The full-battery retry stays.
- **SEO/meta:** title, description, canonical, Open Graph + Twitter card with one gallery screenshot as the embed image, favicon reusing the app icon.
- **Zero app code.** No version bump, no export-shape change. The avatar screenshot capture swaps the default VRM temporarily during capture only, exactly as the prototype did.

## Testing Decisions

- **One seam: the assembled upload root.** Tests build `out/` exactly as the workflow's assemble step does (site files + an app build), serve it through the local Pages emulator built on Cloudflare's own parsers (prior art: the cloudflare-web-hosting effort's evidence), and probe behavior from outside: root serves the page, `/play` still 301s, headers match, and the live-check script passes against the emulator via its env-overridable hosts.
- **The page itself is tested in a real browser** (Playwright, prior art: the repo's e2e suite and the prototype's verify scripts): gallery renders, divider drags, palette fade advances with the old layer held opaque mid-fade (the trace assertion from the prototype), download buttons resolve or fall back, reduced-motion disables the slideshow, and a mobile viewport lays out sanely.
- **Bite checks over coverage:** each live-check change is proven to fail against a mutated contract (root serving a 302 again, missing cache header), matching the prior effort's evidence style.
- **No vitest tests.** Static files and CI config; a repo test asserting file content would mirror the file. Behavioral verification only.
- **First `site_only` smoke:** the initial deploy of the landing page runs through the `site_only` path, proving it end to end without cutting a release.

## Out of Scope

- Additional site pages (about, docs, blog). The naming and layout accommodate them; nothing builds them.
- Retiring the GitHub Pages dev build or itch channels.
- Analytics, COOP/COEP, custom fonts.
- Server-side rendering or any build step for the site — static files only.
- Localizing the landing page.

## Further Notes

- The finalized prototype and its capture scripts live on branch `prototype/landing-page`; the built 33 MB single-file version is regenerable and intentionally uncommitted.
- The `site_only` path depends on release assets staying named `formamorph-web-<version>.zip`; the release workflow's tag-version guard already pins that.
- The community catalog count in the tagline ("hundreds") was verified live at 648 published worlds.
- Once the root serves 200, the arming variable and checks from the cloudflare-web-hosting effort stay as they are; only the step's expectations move with this spec.
