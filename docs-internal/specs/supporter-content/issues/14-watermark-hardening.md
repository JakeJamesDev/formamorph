# 14: Server: harden the watermark against shifted lossy copies

Status: ready-for-agent
Repo: FormamorphServer
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: a codec-aware redesign of the mark's coarse band, judged against a hard robustness bar.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Closes the gap ticket 04 landed with (Q32), restoring the full Q7 bar.

## What to build

Ticket 04's mark survives every case in its bar, but a copy shifted by an offset that is not a multiple of 4 px and then saved lossy mostly loses it. WebP's 4×4 transform blocks spare the mark only when they line up with its cells. Redesign the mark so it survives arbitrary offsets followed by lossy re-encoding, keeping the `embed(image, mark)` and `read(image)` interface and the mark table unchanged. Ticket 04's Landed section holds the measured failures; start from them.

## Acceptance criteria

- [ ] On base and on the full composite, the mark reads back after an offset of 1, 2 and 3 px on each axis followed by WebP q50, and followed by JPEG q75.
- [ ] It reads back after a 50% downscale combined with WebP q50.
- [ ] Every case ticket 04 passes still passes, with no false reads and at least 40 dB per layer.
- [ ] Copies marked by ticket 04's version still read, or the Landed section states that they don't and why.
- [ ] The server docs state the new robustness bar.

For you: compare a marked and an unmarked layer at full size and confirm you can't see the mark.
