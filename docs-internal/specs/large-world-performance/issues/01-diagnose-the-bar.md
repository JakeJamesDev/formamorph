# 01: Diagnose the Bar

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: open-ended profiling: heap retainer analysis and IndexedDB timing decide whether the effort's bar holds, and a wrong read misdirects ticket 13.

## What to build

Measure what the Q1/Q8 bar rests on before tickets aim at it (Q19). Using the editor-speed harness world and a production build at 6x:

- Take a heap snapshot on the Main Menu with the bench world in the library and name the top retainers of the 823 MB. Run the same with an empty library as the control, so "menu heap no longer grows with library size" can be checked.
- Time a bare IndexedDB get and put of the bench world record at 6x, outside the app, to find the structured-clone floor for open and save.
- Add the empty-library control and any needed measurement to the harness so later tickets can re-run it.

Write the findings in this ticket under `## Findings` and fold a summary into the spec's Further Notes. If the get or put alone blocks over 1 s, or the menu heap has a retainer this effort can't remove, say so: the spec session brings Q1/Q8 back to the user before ticket 13 starts. No product code changes.

## Acceptance criteria

- [x] Findings name the top Main Menu heap retainers with sizes, for the bench library and the empty library.
- [x] Findings give bare IndexedDB get and put times of the bench world at 6x (median of 3).
- [x] The harness can run with an empty library (documented flag) and reports Main Menu heap.
- [x] Findings state, for each of Q1 (open, save) and Q8, whether the bar is reachable without the blob store, with the evidence.
- [x] No change under `src/`.

## Findings

Measured 2026-10-06 on the bench world (126 MB, `genLargeWorld.mjs` defaults), production build, 6x CPU. Commands are in `testing/editor-speed/README.md`. Step times vary between runs on this machine: the open step's worst block was 2.0 s, 2.3 s and 2.8 s in three runs.

### The 823 MB is the open editor, not the Main Menu

The baseline run already reported `heapMenuMb: 70`. The 823 MB in the spec's table is the heap after the **open** step. The spec's Problem Statement said the Main Menu held it. It now says the editor does.

| Library | Worlds | Main Menu heap after GC |
|---|---|---|
| `empty` | 0 | 27 MB |
| `defaults` | 8 | 67 MB |
| `bench` (defaults + bench world) | 9 | 68–71 MB |

The bench world adds 1–4 MB to the menu heap: its thumbnail in the menu's `worldMetadata` list. The menu heap does not grow with library size today.

### Main Menu retainers

Snapshot totals include external memory (script sources, array buffers), so they exceed the JS heap figure.

**Empty library** (snapshot 80 MB):

| Retained | Retainer |
|---|---|
| 34 MB | The main bundle script (`index-*.js`). Its source string alone is 32.7 MB. |
| 22 MB | One bundle module scope, mostly a 16.8 MB `Float32Array`. |
| ~4 MB | Code and small objects. |

**Bench library** (snapshot 162 MB) adds, beside the same two:

| Retained | Retainer |
|---|---|
| 73 MB | The bundled default worlds as loaded ES modules. Each holds its script source and its JSON as a module string: Veilwood 16 + 16 MB, Sugarscape 9.2 + 9.2 MB, and six smaller ones. The default-world seeder imports all eight on every launch. |
| 3.1 MB | Thumbnails in the menu's `worldMetadata` list (7 strings over 100 KB). |

The default-world modules are a fixed ~40 MB cost. They don't grow with the library, and no ticket targets them.

The menu also pays a transient cost that a snapshot after GC can't show. `getWorldMetadata` reads every record with `getAll`, so each menu mount deserializes every stored world in full. From the bare get time below, that is an estimated 0.33 s of main-thread block and 126 MB of garbage per bench-sized world. This was not measured on the menu itself. Ticket 05 removes it.

### Open-editor retainers (the 823 MB)

Snapshot after the `open` step: 918 MB, of which 787 MB is strings. The world's content appears about five times:

| Size | Copy | Source |
|---|---|---|
| 126 MB | The live world: 400 entity images (105 MB), 75 location backgrounds and the thumbnail (21 MB) | GameDataContext state |
| 126 MB | `savedSnapshot`: one JSON string of the whole world | `GameDataContext.tsx` `savedSnapshot` |
| 126 MB | `savedCanonical`: one canonical string of the whole world | `GameDataContext.tsx` `savedCanonical` |
| ~355 MB | The dirty check's per-object canonical cache: one string per record (474 strings, 125 MB), one per array (2 strings, 125 MB), and quoted copies of every image (400 strings, 105 MB) | `GameDataContext.tsx` `stringifyCache` |

The app itself is the other ~70 MB. Every extra copy is a serialization of the world, not media the world needs to hold. Ticket 13 owns all three.

### After save (the 1491 MB)

Snapshot after the `save` step, with the canvas step before it. Strings over 100 KB total about 1090 MB. Only the live world (126 MB) is content:

| Size | Copy |
|---|---|
| 253 MB | Two `savedSnapshot` strings: the one before the save and the one after |
| 253 MB | Two `savedCanonical` strings, the same two generations |
| ~460 MB | The canonical cache for both generations of the entity and location arrays |

Stale render closures keep the old generation alive. One path runs from a file input's `onChange` through `loadWorld` to the old `discardChanges` and `getWorldData` scopes. When ticket 13 removes the copies, both generations go.

### Bare IndexedDB at 6x (median of 3)

Blank page on the app's origin, the bench world record as the library stores it. Two independent runs:

| Operation | Run A: block (wall) | Run B: block (wall) |
|---|---|---|
| `put` | 759 ms (761 ms) | 812 ms (813 ms) |
| `get` | 329 ms (463 ms) | 359 ms (491 ms) |
| `get`, then `put` from its success handler | 1097 ms (1233 ms) | 1095 ms (1237 ms) |

- Run A ran with the editor page on the Main Menu (68 MB heap).
- Run B ran at the end of a full run, with the editor page at 1491 MB.
- Per-run values are in `.out/results.json` under `idb`.

The `put` blocks inside the call itself: the structured clone runs synchronously. The third row is the shape of the library's `storeWorld`. It reads the whole existing record to keep its sticky fields. Then it puts the new record in the same task.

### Verdict on the bar

Neither a bare `get` nor a bare `put` blocks over 1 s. No retainer in the open or save heaps needs the blob store to remove. **Q1 and Q8 stand.**

- **Q1, open:** reachable. The storage floor is a 0.33–0.36 s block. Today's worst block is 2.0–2.8 s, so most of it is app work after the read.
- **Q1, save:** reachable, but only just.
  - The bare `put` floor is a 0.76–0.81 s block. Anything else in that task must fit in the remaining 0.2 s.
  - Today's `storeWorld` shape alone blocks 1.1 s. The save path must drop the full-record read before its put. The metadata store of ticket 05 can supply the sticky fields.
  - The clone time grows with world size. A world about a quarter larger than the bench world can put the bare `put` over 1 s at 6x. Only the blob store lowers that floor.
- **Q8, Main Menu heap:** already holds after GC. The bench world adds 1–4 MB. The transient full read on every mount remains for ticket 05.
- **Q8, editor peak ≤ 1 GB through save:** reachable, by projection. Today the heap is 1491 MB after save.
  - Measured: about 970 MB of the post-save strings are serialized copies, which ticket 13 removes.
  - Projected: without them, the heap after save is about 520 MB. That is the 1491 MB minus those copies. The canvas step's growth (+243 MB) is part of the 520 MB, and ticket 03 reduces it.
  - The harness reads the heap after GC at the end of each step. It does not read the transient peak inside a step, so Q8's "peak" is checked at step ends only.
