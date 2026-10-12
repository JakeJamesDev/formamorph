# 05: Open Wiki

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player opens the wiki in the browser from help (Q2, Q13, Q15, Q18).

- **Open Wiki** in the ⋮ menu of both chromes, and a button in the full-screen Guide header.
- It opens the wiki page and heading the reader shows. With no section open, it opens the wiki home. A split section's part suffix drops from the anchor.
- A confirm in the help window's layer names the target page, with Open, Cancel and a **Don't Ask Again** checkbox.
- A switch in the help window's General settings turns the confirm back on. It is on by default.
- One shared function opens external links. Desktop already sends `window.open` to the system browser. Check first whether Android's WebView opens the browser for `window.open`; fix it if not.

Spec: Implementation Decisions → Open Wiki; The wiki confirm.

Recommended model rationale: a URL builder, a small dialog and a setting; the Android check is the one unknown.

## Acceptance criteria

- [ ] The URL is correct for a section, a split section and no section.
- [ ] Confirm shows by default; Don't Ask Again skips it on later opens; the settings switch brings it back.
- [ ] Desktop opens the system browser; the Android result is stated with how it was checked.
- [ ] Confirm verified through the dev-router in both themes; copy-sweep pass.
- [ ] Changelog fragment written; four gates green.
