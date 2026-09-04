# 04 — Capacitor scaffold

Status: ready-for-human
Status note: Scaffold, icons, splash, manifest, build class and scripts are done and the four gates are green. Three items are the maintainer's: the cleartext bound below, installing Android Studio, and the first run on a real phone.
Type: task
Spec: ../spec.md (Implementation Decisions › The Android App)

## Task

- Add Capacitor core and android at the live latest versions (check `npm view`). App id `ai.formamorph.app`, app name `Formamorph`, web dir `dist`.
- Commit the generated `android/` project. Set the icon and splash from the existing icon assets.
- Network security config: cleartext permitted to localhost and RFC 1918 ranges only.
- Manifest: add the install-packages permission. Nothing else beyond defaults.
- Build class `android` for the footer. Add npm scripts in the `desktop:*` style: `android:sync`, `android:open`, `android:run`.
- Confirm the desktop check stays false in the WebView so the local engine and catalog stay hidden.
- Install Android Studio on the dev machine and run the app on the real phone once. Note the SDK path in a memory file.
- Changelog In-Progress entry, 🛠️ bucket.

## Acceptance

- `npx cap run android` installs and opens the app on the phone. Main menu, a bundled world, and one AI turn against the cloud endpoint work.
- A LAN LM Studio endpoint over http works from the phone.
- Four gates green.


## Comments

### The cleartext bound cannot be written as an address range

The task asked for a network security config permitting cleartext to localhost and the RFC 1918 ranges
only. Android cannot express that. Two sources agree:

- AOSP `ApplicationConfig.getConfigForHostname` matches a `<domain>` by exact string or by DNS suffix
  (`hostname.endsWith(domain)` with a `.` before it). An IPv4 literal reads most-general-first, so a
  suffix rule can never mean `192.168.*`.
- `NetworkSecurityConfigParser.parseDomain` does no IP handling at all; it lowercases the text and stores
  it. The Android documentation shows only exact domains, `includeSubdomains`, and an all-or-nothing
  `base-config`.

So permitting the LAN means permitting every host. The shipped config does that, and denies cleartext to
`formamorph.ai` and its subdomains, which is the one bound the file *can* express and the one that matters
most: the community server is never reached over http.

The app is the only layer that can express the intended bound, and the predicate already exists:
`classifyEndpointAddress` in `src/lib/localNetworkEmbed.ts` returns `loopback` / `private` / `public` over
exactly the RFC 1918 set. Refusing an `http:` endpoint that classifies as `public` when the build class is
`android` would restore the intent. That is app behavior the task did not ask for, so it is left for the
maintainer to decide, either here or as its own ticket.

### Left to the maintainer

- Install Android Studio and the SDK, then run the app on the phone once. Nothing in the repo can do this.
  The memory file recording the SDK path waits on that install.
- `versionCode` and `versionName` are still the generated `1` / `"1.0"`. Ticket 08 owns deriving them from
  the package version; a locally built APK reports 1.0 until then.
- `@capacitor/cli@8.5.1` declares `engines.node >= 22`, while this package declares `>= 20.19`. Raising the
  floor is a user-facing constraint change, so it is not done here. Ticket 08's CI job needs Node 22.

### Notes on what was built

- The launcher icons and the splash icon are generated from `public/icon.png` by
  `scripts/genAndroidIcons.mjs`. Run it again only when the source icon changes.
- The Capacitor template's splash is a bitmap set as the launch window background, which Android stretches
  to fill the screen. It is replaced by `drawable/splash.xml`, a layer list holding the brand color and a
  centered, unscaled icon, so no aspect ratio distorts it.
- `android.allowMixedContent` is on. The app is served from `https://localhost`, so without it the WebView
  blocks a player's own http endpoint as mixed content before the network security config is consulted.
