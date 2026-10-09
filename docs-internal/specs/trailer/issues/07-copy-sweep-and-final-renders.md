# 07: Copy Sweep And Final Renders

Status: ready-for-human
Blocked by: 05, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a copy pass and a spec check; no new components.

Parent: [Trailer spec](../spec.md)

## What to build

The final pass before the trailer is handed over.

- Every line of on-screen copy goes through the copy sweep.
- Both cuts re-render after the sweep.
- The wide cut is checked line by line against the Steam spec in the spec file: resolution, frame rate, bitrate, container, codec, aspect ratio.
- The package README records where the renders land and how to re-render after a release.

## Acceptance criteria

- [x] The copy sweep passes on every scene's copy.
- [x] Both final MP4s and the poster frame exist from a fresh render.
- [x] The Steam spec check is recorded in the ticket with the measured values.

## Copy sweep

`npm run copy:sweep` does not read JSX string props, so the sweep ran by hand against the Writing Guide. The script ran on `marketing/trailer/src` too (20 files, 0 notices), but that proves nothing for these lines.

| Check | Result |
|---|---|
| Sentences | Every line is one idea, active, at most 9 words |
| Controlled terms | No "character", "phone" or "picture"; "entity" is avoided with "anyone" and "who" |
| Figurative words | None |
| Pair 1: "AI text RPG" or "AI text roleplay" | "AI text RPG". The landing page uses "AI text RPG"; the README and wiki call the app a "text RPG". The end card (`TitleCard.tsx`) now matches W04 |
| Pair 2: "Type" or "Write" | "Type". The storyboard's feature list ranks "Type any action" first. W05's typed prompt now matches W01 |
| "Hundreds of worlds" (W14) | True. The live community list reports `total` 677 (`/api/worlds?page=1&limit=1`, 2026-10-08) |

Every on-screen string, wide cut (the tall cut reuses them):

| Shot | Copy |
|---|---|
| W01 | Type any action. |
| W02 | An AI narrator writes what happens. |
| W04 | An AI text RPG. / Play any world you can imagine. |
| W05 | Type any action. / The narrator continues the story. |
| W06 | Every turn updates your stats. |
| W07 | Talk to anyone you meet. |
| W08 | Chat with anyone in your library. |
| W09 | Build your own world. |
| W10 | Place locations on a map. |
| W11 | Write who lives there. |
| W12 | Let players pick a race and a class. |
| W13 | Ask Morphie for help at any step. |
| W14 | Download hundreds of worlds from the community. |
| W15 | Enter contests. / Share what you make. |
| W16 | Use any AI model. |
| W17 | Play in your browser or offline on your desktop. |
| W18 | Pick a 3D avatar. |
| W19 | AI text RPG / formamorph.ai |

Stacked tall-cut captions (T06, T10, T11) reuse the W06, W07, W11, W12, W14 and W15 lines. The Scene-library entries in `library.tsx` are studio samples and never render in a cut.

## Steam spec check (wide cut)

Spec: partner docs, read 2026-10-08. Measured on `out/TrailerWide.mp4` from a fresh `npm run render`, with `remotion ffprobe`.

| Spec line | Steam | Measured | Result |
|---|---|---|---|
| Resolution | up to 1920x1080 | 1920x1080 | ✅ |
| Aspect ratio | 16:9 preferred | 16:9, square pixels (1:1) | ✅ |
| Frame rate | 30, 29.97, 60 or 59.94 fps | 60/1 fps, constant | ✅ |
| Bitrate | 5,000+ Kbps | 12,017 Kbps | ✅ |
| Container | `.mp4` | MP4 (`mov,mp4`) | ✅ |
| Codec | H.264 video, AAC audio preferred | H.264 High profile, no audio track (Q4) | ✅ video; audio is a later ticket |
| Length | no limit stated; storyboard target under 90 s | 63.05 s (3,783 frames) | ✅ |
| File size | no limit stated | 94.7 MB | ✅ |
| Poster | 1920x1080 frame of the video | `out/TrailerWide-poster.png`, 1920x1080, frame 3782 | ✅ |
| Microtrailer | first 6 s loop | frame 0 and frame 359 identical | ✅ |

Tall cut (no store spec): 1080x1920, 60 fps, 47.80 s, 4,663 Kbps, H.264, no audio, 27.9 MB; the 6 s loop passes.

- ⚠️ The pixel format is `yuvj420p` (full-range). The spec does not name a range. It is not a spec violation, but the user should decide before upload whether to force `yuv420p`.
