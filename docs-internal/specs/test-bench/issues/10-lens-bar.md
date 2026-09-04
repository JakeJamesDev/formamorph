# 10 — Lens bar

**What to build:** The Bench-level lens: `Testing as [PC] · at [location]`. The PC selector lists
the traits of any exclusive group; selecting one resolves placeholder chips through that trait's
pins (a pin naming a value not in the placeholder's list surfaces as broken instead of silently
no-oping) and exposes which stats the trait toggles for the instruments to read. The location
selector lists the world's locations. State is Bench-level: seeds from the editor's selected
location on open (starting location otherwise), then holds its own across tab switches; persists
locally per world for the session. Triggers consumes the PC lens for chip resolution immediately;
AI Context and Opening consume it when they land.

**Blocked by:** 01 — Bench surface + Issues tracer.

Status: done

- [x] Lens renders in the variant-A slot on both layouts and survives tab switches
- [x] Seeding: editor selection → that location; nothing selected → starting location
- [x] Pin resolution matches a real playthrough's (pinned value used; unpinned rolls)
- [x] A pin naming a missing value is surfaced, not silently ignored
- [x] Lens state never written into the world
