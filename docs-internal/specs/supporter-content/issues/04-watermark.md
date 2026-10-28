# 04: Server: watermark module and leak CLI

Status: done
Base: 4260262
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

- [x] `read(embed(x, id))` returns `id` for every Morphie layer. — `reads the exact copy of %s`, all 26 layers.
- [ ] The mark reads back after WebP re-encoding at quality 50, a 50% downscale, and a 20% crop, on the full composite (all layers over a background, then re-encoded) and on every layer at or above the measured opaque-area floor. Smaller layers need only the round-trip. The Landed section states the floor (Q28).
- [x] An unmarked image reads as `null`; two accounts' copies read as two different mark numbers; no false positive across all fixtures (Q28). — `reads unmarked %s as no mark` (26 layers), the unmarked composite under every attack, `tells two accounts apart`.
- [x] The marked image differs from the source by a PSNR of at least 40 dB per layer, and transparent pixels stay transparent. — `keeps %s within 40 dB…`, lowest 42.4 dB (mouth-small-o); alpha and the color of transparent pixels are unchanged, bit for bit.
- [x] The CLI prints the account for a marked file and a no-mark line for an unmarked one. — `read-leak` tests: account id and username from a WebP leak, `No mark found` from the spawned command.
- [x] The server docs name the library and the CLI usage. — `docs-internal/server.md`, Reading a leaked image (sharp 0.35.5).

For you: compare a marked and an unmarked layer at full size and confirm you can't see the mark.

## Landed

**Floor:** an attacked layer reads back from about 340k opaque pixels: a window of base with 341k read 12 of 12 attacked copies, one with 270k read 11. Among Morphie's layers only base (474k) is above it; the next largest, arms-wave (56k), reads only as the exact file.

**Measured, 6 random marks × 3 rigs × 3 backgrounds:** base and the composite each read after WebP q50, a 50% downscale, and a 20% crop (center and corner), every time; so do the composite as a lossless screenshot inside a larger window and at twice its size. Unmarked images clear the pilot gate about once in 100 tries, so with CRC-32 an unmarked image reads as marked near once in four billion.

**Not verified**

- Criterion 2, the composite "then re-encoded" and attacked again: a composite saved as WebP q50 and then re-encoded or downscaled read 6 of 18 (only the crop passes). It reads after each change alone. Same family as the gap below.
- Q32 gap, accepted by the user: a shift off the 4 px grid (a real screenshot or crop) and then a lossy save loses the mark (4–6 of 6 fail), as does a resize plus a lossy save in either order. Ticket 14 hardens the coarse band behind the same `embed`/`read`.

**For you**

- For you: compare a marked and an unmarked layer at full size and confirm you can't see the mark. Look at `.scratch/supporter-content-04/frames/face-unmarked-vs-marked.png` (left unmarked, right marked) and the full rigs, `.scratch/supporter-content-04/frames/composite-unmarked.png` and `composite-marked.png`. At this strength I see a faint grain on flat skin and hair side by side; you chose it over a weaker mark that fails WebP q50.
- Erasure deletes the account's `watermark_marks` row, so a leak from an erased account prints `no account holds it`. Keep, or keep the number past erasure?
- The spec's Per-account processing bullet still says the watermark step "embeds the account id"; since Q27 it embeds the account's mark number from `WatermarkMark.markFor`.
