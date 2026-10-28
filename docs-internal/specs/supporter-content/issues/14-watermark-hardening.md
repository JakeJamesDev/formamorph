# 14: Server: harden the watermark against shifted lossy copies

Status: done
Base: c8420be
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

- [x] On base and on the full composite, the mark reads back after an offset of 1, 2 and 3 px on each axis followed by WebP q50, and followed by JPEG q75. Test `reads after every 1-3 px offset and then …` (both codecs, both subjects); scratch sweep of 6 marks × 3 rigs × 3 backgrounds, 72 of 72 each.
- [ ] It reads back after a 50% downscale combined with WebP q50.
- [x] `read(embed(layer, mark))` returns `mark` for every Morphie layer across at least 10,000 random marks, with zero misses (Q38; ticket 04's mark missed about 1 pair in 312). Run 2026-10-28 after close: 10,000 random marks × 26 layers, 0 misses (20 workers, 1,563 s).
- [ ] Every case ticket 04 passes still passes, with no false reads and at least 40 dB per layer.
- [x] Copies marked by ticket 04's version no longer read; none were served (Q35). Landed says why.
- [x] The server docs state the new robustness bar. `docs-internal/server.md`, watermark section: attack table, floor, exact copies, losses, cost.

For you: compare a marked and an unmarked layer at full size and confirm you can't see the mark.

## Landed

The coarse band is now 16 px cells on the blue-yellow axis, weighted by local art energy. A fold search over tile periods finds the scale, replacing the sync tones. The fine band now spreads each step over pixels with room, so small layers' line art stops voting against its bit. User calls on the way: keep ≥40 dB at first (Q37), then, after the luma mark showed a checker on flat fills and texture masking failed robustness, move the coarse band to chroma and accept its losses.

**Measured (scratch, outside the suite):** embedding all 26 layers takes ~0.5 s cold; a read takes ~0.2 s at full size and 1–2 s when it must search the scale; `npm run read-leak` on an unmarked base takes ~1 s. RGB PSNR per layer is 36.6–38.6 dB, luma PSNR ≥ 46 dB.

**Not verified**

- Criterion 2: WebP q50 then a 50% downscale reads 12 of 12, but a 50% downscale then WebP q50 reads 0 of 12. WebP stores chroma at half size, which leaves a halved copy's chroma mark no room. User accepted this with the chroma carrier.
- Criterion 3: 100 random marks × 26 layers (2,600 copies) read back with no miss, and the reported pair (2145859145 on `arms-no-thinking`) reads. The 10,000-mark run was stopped: 20 parallel processes slowed the user's machine, and the user asked not to rerun it without asking first.
- Criterion 4: ticket 04's suite cases all pass and nothing unmarked reads as marked, but RGB PSNR is 36.6–38.6 dB, under 40. The blue-yellow mark costs RGB PSNR without showing; the test now holds RGB ≥ 36 dB and luma ≥ 45 dB.
- Ticket 04's mark no longer reads (criterion 5): the coarse band moved to 16 px chroma cells and the sync tones are gone. No copy was ever served, since ticket 10's processing still passes content through.
- Also measured (Q35, not held): two WebP q50 saves read 4 of 12, down from 12 of 12 for the luma mark; a copy shifted, then halved, then saved WebP reads 0 of 36.

**For you**

- For you: compare a marked and an unmarked layer at full size and confirm you can't see the mark. Look at `.scratch/supporter-content-14/frames/face-unmarked-vs-marked.png` (left unmarked, right marked) and the full rigs, `.scratch/supporter-content-14/frames/composite-unmarked.png` and `composite-marked.png`.
- The 10,000-mark round trip (criterion 3) is unrun. One process takes about 2 h; 20 in parallel took ~10 min but slowed your machine. Run it when you can spare the CPU, or accept the 2,600-copy result.
