# 04: Server: watermark module and leak CLI

Status: ready-for-agent
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: the effort's main technical risk; needs a library choice from live sources and a frequency-domain mark that meets a hard robustness bar.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. The spec's largest risk (Q7): prove the bar before ticket 10 builds on it.

## What to build

A pure module with `embed(image, payload) → image` and `read(image) → payload | null`. The mark is invisible, in the frequency domain, with error correction, and carries an account id. It survives WebP re-encoding, scaling, moderate cropping and a screenshot of the composed Mascot. Choose the server image library by checking its current release and Node support live (`npm view`); confirm the package identity before install.

A CLI script takes an image file and prints the account id and username it reads, or that no mark was found (Q9).

Test on real Mascot layers: Morphie's bundled `.webp` layers from the client repo, copied as fixtures.

## Acceptance criteria

- [ ] `read(embed(x, id))` returns `id` for every Morphie layer.
- [ ] The mark reads back after WebP re-encoding at quality 50, a 50% downscale, a 20% crop, and compositing all layers over a background then re-encoding.
- [ ] An unmarked image reads as `null`; two accounts' copies read as two different ids; no false positive across all fixtures.
- [ ] The marked image differs from the source by a PSNR of at least 40 dB per layer, and transparent pixels stay transparent.
- [ ] The CLI prints the account for a marked file and a no-mark line for an unmarked one.
- [ ] The server docs name the library and the CLI usage.

For you: compare a marked and an unmarked layer at full size and confirm you can't see the mark.
