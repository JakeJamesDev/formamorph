# 11: New pages, Avatars and Image Generation

Status: done
Base: 748f020c
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A player can read how to use a 3D avatar and how to connect an image provider. Two new docs pages cover them.

**Avatars** covers: what an Avatar is, loading a VRM file, Character Customization, model details, the Profile Picture, the Permissive License rule for sharing, and how an Avatar differs from an entity's 3D model.

**Image Generation** covers: the supported providers (Automatic1111, ComfyUI, InvokeAI, an OpenAI-style image API), the setup steps for each, the ComfyUI workflow rules, Scene Images, image presets, and that one GPU serves text and images in turn. The app has in-app setup guides for some providers; keep the page and those guides in agreement.

Use the glossary's words: Avatar, Profile Picture, Permissive License.

Add "How to…" sections: load an avatar, customize it, connect each provider, turn on Scene Images.

Recommended model rationale: two contained surfaces; the provider steps need care but the volume is moderate.

## Acceptance criteria

- [ ] Both pages exist, follow the writing guide and use exact control names
- [ ] Every avatar dialog and every image setting section maps to a heading
- [ ] The provider steps agree with the in-app setup guides
- [ ] The sidebar and the home index list both pages
- [ ] The known-gaps entries for these surfaces are removed, and the coverage test passes
- [ ] Four gates green
