# Spec: Scripts

Status: done
Status note: Closed on 2026-10-15. Tickets 01–16 landed; the last landing is 4f99507be. Closed red: the full test run timed out in 18 files under load from parallel sessions (33 timeouts, 382 s); typecheck, lint and build were green, and the 18 files pass alone (420 tests, 53 s).
Spec session: scripts — spec

## Problem Statement

Stat code is a feature with a small name. A stat has two fixed boxes, Before the AI and After the AI, and nothing else in the world can hold code. An author who wants a world-wide rule writes it on whichever stat is handy. A trait that should carry its own logic cannot. Run order across owners is a fixed rule the author cannot see or change. A script can read the world but cannot touch what the player reads or ask the player anything. The Tool editor has a second sandbox with its own runtime for the same language.

## Solution

Stat code becomes **Scripts**. A script is one box of code with a timing. Scripts live on a stat, on a trait, or on the world. A World Editor **Scripts** tab lists every script by timing, in run order, and edits any of them in place. Five timings exist: Before the AI, After the AI, During AI Output, At Game Start, and When a Trait Switches. During AI Output runs once per completed narration sentence and may rewrite that sentence. A `player` object lets a script tell the player something or ask them something. A world rule strips links and images from narration history before the AI reads it. The Tool script runtime merges into the one executor.

## Rulings

Settled with the user on 2026-10-14. R rulings came from the design discussion; Q rulings from the grill.

| # | Ruling |
|---|---|
| R1 | The feature is **Scripts**. "Stat code" goes on the glossary's _Avoid_ line. A script is one box of code with a timing |
| R2 | A script lives on a stat, on a trait, or on the world. A home decides two things: what `self` is, and when the script is in force. The surface is otherwise the same |
| R3 | A stat, a trait and the world each show a Scripts section: an **Add Script** button adds a box with a timing dropdown, an optional name, and a remove action |
| R4 | During AI Output fires once per completed narration sentence, never per token. The script writes the new sentence only. Sentences already buffered or shown are read-only |
| R5 | The sandbox already ships the ES2020 string, array and regex built-ins; nothing is added for text work. `Intl` stays out |
| Q1 | Five timings at launch: Before the AI, After the AI, During AI Output, At Game Start, When a Trait Switches. No choices hook |
| Q2 | A During AI Output rewrite is the one copy: the screen, the save, TTS and the AI's recap all carry it |
| Q3 | A trait's scripts run only while the trait is active, as a stat with `enabled: false` pauses its code |
| Q4 | The timing dropdown is the only way to move a script between timings. Drag in the Scripts tab reorders within one timing |
| Q5 | Each script carries an optional `order`. Within a timing, scripts run by `order`; scripts without one fall into today's order, owner first then stat order, after any ordered ones. Drag writes `order`. An imported entity's scripts append at the end |
| Q6 | A script's name is optional. A blank name reads as the owner and timing, such as "Health · After the AI" |
| Q7 | The Tool script runtime merges into the one executor. Tool scripts keep their own surface: `args`, `world`, `scene`, `placeholders` |
| Q8 | Prompt functions live on one `player` object: `player.tell`, `player.toast`, `player.confirm`, `player.ask`, `player.askText`. `player` is the human; `persona` stays the played entity. `prompt` is never a function name |
| Q9 | A built-in setting, **Strip Links And Images** (Settings → Display → Narration, Advanced), removes markdown links and images from narration history before any request. Links become their text; images are removed. No script category for this. Moved from a world option to a setting on 2026-10-16: the need follows the model, not the world |
| Q10 | The strip rule covers narration history only: last story, turn digests, diary entries, recall results. Authored text is never touched |
| Q11 | At Game Start fires once per new playthrough, after setup, before the opening AI call. Never on load of a save |
| Q12 | When a Trait Switches fires on in-game switches in both directions. A trait's own script sees its own switches with the trait as `self`. A stat or world script sees every switch through `trait`, the trait that switched, with `enabled` giving the direction. Setup picks do not fire it |
| Q13 | A trait's own When a Trait Switches script runs on its own switch-off. For this timing only, the Q3 gate reads the state before the switch |
| Q14 | `player.*` is allowed in every timing except During AI Output, where the call fails the script |
| Q15 | Cancel on a prompt, or Escape while focus is inside it, fails the script as canceled. Its writes drop, as on any script error. The turn continues |
| Q16 | `player.tell` renders a message card in the turn column, saved with history. `player.toast` shows a toast and saves nothing |
| Q17 | Reopened by the ticket 14 verdict (B3). Every prompt kind is the **inline prompt line**: a left-ruled italic line in the turn column under the narration, the control under the question, text-link actions. `confirm` and a single `ask` with up to four options are pill buttons that answer on one press; an `ask` with five or more is an inline dropdown; a multiple `ask` is toggle pills plus OK; `askText` is a text field plus OK, Enter submits. `tell` is the same line with text alone. No dialog. The user's pick is the pattern approval; ticket 10 writes the Design System entry |
| Q18 | The World Editor gets a top-level Scripts tab: a tree of the five timings with each script as a row. Its Add Script creates a world-owned script in the picked timing. Stat and trait editors keep their own Scripts section |
| Q19 | `beforeCode` and `code` rewrite to `scripts[]` on load. Export writes the list only. A world saved by the new build does not run its scripts in an older build |
| Q20 | During AI Output variables live on `narration`: `narration.sentence` is writable; `narration.sent`, `narration.buffered`, `narration.full` and `narration.index` are read-only |
| Q21 | With a During AI Output script in the world, the smooth crawl holds to complete sentences, as the fade reveal does. Worlds without one keep today's crawl |
| Q22 | A During AI Output script that throws or times out passes its sentence unchanged. The error logs and the Test Bench reports it |
| Q23 | A `player.tell` card never enters a request. A script that wants the AI to know something writes a stat or a placeholder |
| Q24 | Test Code and the Test Bench show the real prompt lines in the editor |
| Q25 | Clicking a row in the Scripts tab edits the script inline, in the same box the owner's editor shows. The box carries a jump-to-owner link |
| Q27 | A During AI Output result is one sentence whatever it holds. The reveal and TTS release it as one unit; `index` never shifts |
| Q28 | Strip Links And Images defaults to on (2026-10-16, replacing the per-world default) |
| Q29 | A Blueprint stat's script runs once per owner in every timing, owner order, During AI Output included |
| Q30 | Later writes win a field, as today; `order` decides who runs later. A world script ordered before a stat script loses the field to it; flip the orders and the world script wins (ticket 01 ruling) |
| Q31 | A world script runs with `self` and `owner` as empty objects, matching the Surface table. A return value and a `self` write are ignored, never a non-number failure. Ticket 01 runs stat and world scripts; trait scripts arrive with ticket 02 and the Q3 gate (ticket 01 ruling) |
| Q32 | A Blueprint link overrides `scripts` as one whole list, not per script. Migration folds the two old field overrides into it and keeps each one's `blueprint` value for staleness (ticket 01 ruling) |
| Q33 | Migrated scripts take deterministic ids, `<statId>:before` and `<statId>:after`, so a shipped world gets the same ids on every load. New scripts mint `crypto.randomUUID()`. Bundled world files stay in the old form; the load path migrates them (ticket 01 ruling) |
| Q34 | Until ticket 02 lands, the stat Code tab keeps its two boxes: each edits the stat's first script of its timing, typing into an empty box adds a script, clearing a box removes it. Templates and help Insert write the same way (ticket 01 ruling) |
| Q35 | The strip rule follows the text, not the request: any past passage, diary entry or digest in any request is stripped, the discovered-entity note request included. Q9 says "before any request" (ticket 08 ruling) |
| Q36 | Off-world, a link override of one old box stays on its old key until the entity enters a world, where the original is in reach and the fold into the whole-list `scripts` override is exact. A fold that blanks the other box is a silent break of a shipped card, which the stat-code-entities Q19 precedent rules out (ticket 01 ruling, option B) |
| Q37 | On a trait script, `self` is the trait's sandbox entry, read-only, as `traits[name]` reads it; a return value is ignored. Switching the trait goes through `traits` or `owner` as today. A global trait's scripts run in the global run with `owner` empty; an entity's active trait, owned or linked, runs under that entity as `owner`, once per owner that holds it (ticket 02 ruling) |
| Q38 | Scripts without `order` run: world scripts, then per owner its stats' scripts in stat order, then its active traits' scripts in tree order (ticket 02 ruling) |
| Q39 | A trait link overrides `scripts` as one whole list, as a stat link does (Q32). Find All Uses rows carry the script id so the reveal opens the right box. Stat rename and Find All Uses cover trait scripts in ticket 02; the Test Bench stays ticket 11 (ticket 02 ruling) |
| Q40 | The stat tab label reads **Scripts** with its route value unchanged; a trait gets an advanced-only **Scripts** tab after Pins. Help Insert adds a new script with its timing at the end and focuses it, with no replace confirm; templates stay per box with the replace confirm. The remove confirm is titled "Remove This Script" with "This script has code. Removing it deletes the code." and a destructive **Remove** (ticket 02 ruling) |
| Q41 | At Game Start runs on the opening turn, before the Before-the-AI scripts, on live state. Regenerating the opening in a fresh game restores the pre-start state, so the start scripts run again over it, prompts included. Regenerating the opening of a loaded save runs nothing: its baseline already holds the start writes (ticket 04 ruling) |
| Q42 | An output script's stat, placeholder and trait writes land. They collect during the stream in sentence order and apply with the turn's After-the-AI batch, before the After scripts run, so the landing point is the one the Surface table names and no write is dropped. Ticket 06 owns this. In the output run, `player.*` is a stub whose five calls throw "player.<name> can't run in During AI Output"; ticket 09 keeps that throw (ticket 06 ruling) |
| Q43 | Output scripts on one sentence chain: each reads `narration.sentence` as the earlier script left it, in run order, so a filter and a link maker compose. Within one sentence, stat writes keep the one-snapshot, later-wins rule of every other timing (Q30); across sentences, sentence N+1 reads the stats as sentences 0..N left them, so per-sentence writes sum and the sum lands once with the After batch (Q42). `narration.full` is the narration as it stands: earlier sentences as rewritten, then the current sentence and the partial tail as the model wrote them. The model's original earlier sentences are not exposed (ticket 06 ruling) |
| Q44 | A stopped turn that keeps its narration lands no output-script writes. It gets no AI asks, no regen and no After scripts, so the kept text shows the rewritten sentences and their stat, pin and trait writes drop with the rest of the batch (ticket 06 ruling) |
| Q45 | With no prompt listener, `ask`, `confirm` and `askText` fail the script as canceled at once (Q15); `tell` and `toast` resolve and show nothing. A turn never hangs on a prompt. The async-engine gate is `/\bplayer\s*\./` over the code outside During AI Output; a script that reaches `player` another way runs sync and fails with "player is not defined". The canceled failure is a script failure kind `canceled` with the text "The player closed the prompt"; other scripts in the timing still land. A non-string question, an `ask` with no options, or an option that is neither a string nor `{ label, value }` throws a TypeError in the script. A multiple pick with nothing chosen is an empty array; a single `ask` always returns one value. The one-second budget extends by the time a host call took. The async engine suspends one host call at a time, so prompting scripts run one after another on the shared module: an open prompt holds every other prompting script, concurrent requests included, until it is answered. Prompts reach the UI one at a time; sync-engine scripts are unaffected (ticket 09 ruling) |
| Q46 | Scripts tab: a Blueprint script draws one row at the end of its timing's unordered tail. The unordered tail reads world scripts, then global stats' scripts in stat order, then global traits' in tree order, then each entity in authored order (its stats, then its traits), then Blueprints; the played persona's play-time position is not drawn. A drop writes `order` = index for every script of the timing whose `order` differs, as one undo step; a script added later lands at the end. The tab sits in the Logic group, advanced-only. The list's + opens a menu of the five timings and the typed search text becomes the name; the new script is selected and focused. A world script's box has no jump link; a stat or trait script's link opens its owner's Scripts tab with the script revealed (ticket 03 ruling) |
| Q47 | When a Trait Switches fires once for every trait whose on/off state changes in play, whatever moved it: the player's toggle, a script's switch, retired exclusive siblings, gate cascades, the per-turn settle, and a persona change. Setup picks and the load settle fire nothing. The switched traits are found by diffing trait state before and after the action, so one rule covers every path, Hidden traits included. Several switches from one action run one per trait, offs first then ons, each in owner order (global, then owners in play order), each over the state the previous run left, writes landing after each. A trait that switches and switches back inside one action fires nothing. The diffed state is **active**, in force in the tree, the same state Q3 gates on: a global trait that leaves the tree on a persona change fires an off, and fires an on when the persona returns, although its stored pick never changed (ticket 05 review ruling). A switch made by a switch script applies and fires its own run, to a depth of 8 nested rounds; past the cap the switch applies, no script fires, and a console warning names the cap. A switch made by a script in another timing fires its runs right after that run's writes land, inside the same step; an output script's switches fire with the After batch (Q42). Every script in this timing reads `trait`, the switched trait's sandbox entry with `enabled` as the new state and the holder's owner name, null for global; a trait's own script also has `self` (ticket 05 ruling) |
| Q48 | "Reveal off" means the smooth crawl, Fade-in Narration with no effect on. With the crawl, `buffered` is empty and `sent` is every earlier sentence, drawn or not. With the fade reveal, `sent` and `buffered` split at the pacer's release count. A sentence that completes only at stream end has not reached the pacer, so it reads as `buffered` (ticket 07 ruling) |
| Q49 | Test Code and the Test Bench run prompts on a per-run prompt store the editor subscribes to. `confirm` and an `ask` with up to four options show as a choice row under the box, the game's rows; `askText`, a longer `ask` and a multiple `ask` cancel with "the prompt was closed" until ticket 10 mounts the inline prompt line in the editor too; `tell` and `toast` list as report lines. Editing the code or unmounting cancels an open prompt. The bench shows the real prompts one after another during its run (Q24 as the user accepted it, cost included), never stand-ins. The bench runs stat, trait and world scripts in every timing. An output script reads a sample: in the bench `narration.sentence` and `full` are "The door opens.", in Test Code a per-box, unsaved **Sample Sentence** field that gates Test Code; `sent` and `buffered` are empty and `index` 0; the report leads with "Sentence: <rewritten>". A switch script reads a sample `trait`: the trait itself for its own script, else the world's first trait in tree order with `enabled: true` and `owner` empty, or a blank one. Findings lead with the script's label, the name with the timing in parentheses or the Q6 fallback, then its home: `on “Health”`, `of “Entity”`, the trait's name, or `on the world`. The two-writers warning keys on owner, stat, field and timing, and counts trait and world scripts as writers. A multiple `ask` takes the dialog path whatever its option count, since the choice row picks one row and has no submit; ticket 14's prototype decides how a multi-pick looks. In the editor, Escape on a focused choice row cancels the prompt, so a Test Code or bench prompt can always be dropped; whether play's choice row cancels on Escape is ticket 14's to show and ticket 10's to build (ticket 11 ruling) |
| Q50 | "Tree order" for traits is the Traits tab's order: siblings sorted by `order`, else array index, groups and leaves interleaved with a group winning a tie, walked depth-first, as `traitOrderIndex` computes it. The runner and the Scripts tab both use it for global traits; ticket 15 sorts both, with a test that a folder or a dragged `order` changes the tab and the runner the same way (ticket 15 ruling) |
| Q51 | A world script's Variable menu has no `self` group, as it has no `owner` group. Find All Uses and the rename offer both walk world scripts: a stat, trait, placeholder, entity or dictionary rename rewrites a world script's code like a stat script's, and a world-script Find All Uses row opens the Scripts tab with the row selected and the line revealed (ticket 16 ruling) |
| Q52 | The Stats tab draws no disabled marker, so a disabled stat's script row in the Scripts tab uses the existing dim, the Dictionary tree's 50% opacity, and nothing new. An "Off" meta text and a matching marker on the Stats tab's own rows are a user design call, listed in the Backlog (ticket 16 ruling) |
| Q53 | The editor shows every prompt kind through the inline prompt line, so Test Code and the Test Bench match play; the choice-row path from Q49 goes. A tell belongs to the turn that runs when it is made: a Before, During or After tell to that turn, an At Game Start tell to the opening turn, a When a Trait Switches tell between turns to the latest turn on screen. Tells live in a save-envelope map keyed by turn id beside history, as scene images do, so a rollback or a regenerate drops them with their turn. In chat, each turn's tells show under that turn's narration at bubble width. No global Escape; the prompt takes focus when it opens. A Stop on the turn or leaving the game cancels an open prompt (ticket 10 ruling) |
| Q54 | Each saved tell records its timing, `{ text, timing }`. A stats re-roll replaces the tells of the timings it replays (Before the AI, At Game Start on page one, After the AI) and keeps During AI Output tells, so a tell whose text depends on stats reads the re-rolled value. In the editor, `tell` and `toast` stay report lines (Q49); only the asking kinds use the inline line there. The open prompt line shows on whatever Pages page is open (ticket 10 ruling) |
| Q55 | The Stat Code Guide becomes `docs/ScriptsGuide.md`. `docs/StatCodeGuide.md` stays as a short moved-to stub, listed as a non-guide page, so old wiki links open something. The app's old ids stay as aliases of the new ones: the `worldEditorStat.code` surface route, the `worldEditor.statCode` help topic as an alias of `worldEditor.scripts`, and the route lines; only their targets move (ticket 13 ruling) |

Q26 was not used.

## Surface

### Script shape

```ts
interface Script {
  id: string;
  name?: string;
  timing: 'before' | 'after' | 'output' | 'start' | 'switch';
  code: string;
  order?: number;
}
```

`Stat.scripts`, `Trait.scripts` and `World.scripts` hold the lists. The stored timing keys are the ones above; the labels are **Before the AI**, **After the AI**, **During AI Output**, **At Game Start**, **When a Trait Switches**.

### Per-timing surface

| Timing | `self` | Extra variables | Writes land |
|---|---|---|---|
| Before the AI | the stat or trait; empty on a world script | today's surface | that turn's prompt |
| After the AI | same | today's surface | after the AI's asks and regen |
| During AI Output | same | `narration` | the sentence, then stats as After the AI |
| At Game Start | same | today's surface | the opening prompt |
| When a Trait Switches | same | `trait` | at once |

`narration`:

| Field | Access | Holds |
|---|---|---|
| `sentence` | read and write | the sentence that just completed |
| `sent` | read | sentences the reveal already released |
| `buffered` | read | complete sentences the pacer holds, already past the script |
| `full` | read | the narration as it stands: earlier sentences as rewritten, then the current sentence and the partial tail as the model wrote them (Q43) |
| `index` | read | the sentence's position in the reply, from 0 |

`player`:

| Call | Returns | Shows |
|---|---|---|
| `player.tell(text)` | nothing | an inline prompt line with text alone, saved |
| `player.toast(text)` | nothing | the app toast, not saved |
| `player.confirm(question)` | `true` or `false` | an inline prompt line with two pill buttons |
| `player.ask(question, options, { multiple? })` | the picked value, or an array with `multiple` | pill buttons up to four options, an inline dropdown past that, toggle pills plus OK with `multiple` |
| `player.askText(question, placeholder?)` | the typed string | an inline prompt line with a text field plus OK |

`options` takes strings or `{ label, value }`. The script waits for the answer with no `await`: the executor runs a script that names `player.` on the async engine, where a host function suspends the VM. The one-second timeout pauses while a prompt is open. Scripts that never name `player.` keep today's sync engine.

### Run order

Within a timing: scripts with `order`, ascending; then scripts without one in owner order (world scripts, then global stats and traits, then the player's persona, then entities), and within an owner its stats' scripts in stat order, then its active traits' in tree order (Q38, Q50). Later writes win a field, as today.

## Prototype

Ticket 14 asked what the `player.*` surfaces look like in play, and whether the small dialog of Q17 earns a place in the Design System.

- **Branch:** `prototype/script-prompts`, commit `31ff1bd02`. Round one (A centered dialog, C bottom sheet) is commit `c80e18c8d`.
- **Launch:** the `prototype-script-prompts` launch entry (port 5233), or from the worktree `npx vite --port 5233 --strictPort --force`.
- **Route:** `http://localhost:5233/?variant=B3#dev?view=gameViewer&fixture=whiteRoom&modal=scriptPrompt&tab=<sample>` with `sample` one of `confirm`, `ask`, `askLong`, `askMulti`, `askText`, `tell`, `toast`. The deck at the top switches variants, fires samples, toggles the theme and shows what the script read back.
- **Verdict: B3, the inline prompt line.** No dialog and no box. The prompt is a line in the turn column under the narration. It has the action line's left rule (`border-l-2 border-primary pl-3`) and italic text. Its control sits under the question. Its actions are text links, not buttons. Per kind:
  - `confirm`, and a single `ask` with up to four options: pill buttons under the question. One press answers.
  - `ask` with five or more options: the dropdown, inline under the question (Q17).
  - `ask` with `multiple`: pill buttons that toggle, and an OK text link. This is the multi-pick look Q49 left to the prototype. An empty pick submits as an empty array (Q45).
  - `askText`: the text field and an OK text link. Enter submits, an empty string included.
  - Cancel: a text link on every prompt. Escape cancels while focus is inside the prompt (Q15). The prompt takes focus when it opens. A global Escape is ticket 10's call.
  - After the answer the line leaves the column. Nothing of it is saved.
  - `tell`: the same left-ruled italic line with the text alone. It stays with its turn (Q16).
  - `toast`: the app toast.
  - Chat centers the line at bubble width. Pages spans the column. The editor mount of Q49 was not prototyped and takes the same line.
- **Design System:** the dialog of Q17 does not earn a place. The user's pick is the pattern approval Q17 asks for. Ticket 10 writes the Design System entry for the inline prompt line.
- **Folded:** Q15, Q17, Q24, Q49, the Surface table and ticket 10 say the inline prompt line.
- **Rejected:** A centered dialog and C bottom sheet (round one); B1 prompt card, B2 choice-row box, B4 docked card, B5 compact line (round two). All stay on the branch.

## User Stories

1. As an author, I want to add a script to a stat, a trait or the world and pick when it fires, so that logic sits where it belongs.
2. As an author, I want one Scripts tab that lists every script by timing in run order, so that I see the whole world's logic at once.
3. As an author, I want to drag a script within its timing, so that I set the order instead of guessing it.
4. As an author, I want to edit a script from the Scripts tab or from its owner and see the same box, so that there is one source.
5. As an author, I want a trait's scripts to run only while the trait is active, so that a trait carries its own rules.
6. As an author, I want a script that fires once when the game starts, so that I can set up the first turn or ask the player something before the story opens.
7. As an author, I want a script that fires when a trait switches, so that a gain or a loss has an effect at once.
8. As an author, I want a script that sees each narration sentence as it completes and can rewrite it, so that I can filter words or turn them into links and images.
9. As an author, I want narration links and images kept from the AI, so that the model never learns to write them.
10. As an author, I want a script to tell the player something or ask them a question, so that a world can prompt without the AI.
11. As an author, I want an exported entity to carry its stats' and traits' scripts, so that a card brings its logic along.
12. As an author with a shipped world, I want my two boxes to open as scripts with the right timing, so that nothing changes on update.
13. As an author, I want Test Code and the Test Bench to show my prompts and report script errors by script and timing, so that I can check a script before play.
14. As a player, I want a script prompt to look like a choice, so that it reads as part of the game.
15. As a player, I want a message card to stay in history, so that I can re-read what the world told me.

## Not In This Effort

- A choices output hook (Q1).
- A script category that filters AI context beyond the built-in strip rule (Q9).
- Links that open an entity card or any in-app target. Streamdown renders web links and images only.
- Any change to the Tool script surface (Q7).

## Test Seams

- World migration: two boxes become scripts with their timings; export carries the list only.
- The turn runner: a timing's scripts run in `order`, then today's order; the trait gate; once per owner.
- The narration stream: a sentence hook that rewrites one sentence and rebuilds every downstream copy.
- Request assembly: the strip rule over each history piece.
- The executor: the async engine gate, the paused timeout, the cancel path.
- The Scripts tab: tree rows, drag within a timing, inline edit, refused cross-timing drag.

## Backlog

Open edges from ticket 05:

- A toggle or persona-change run that itself switches traits sets the whole trait state when it lands, as the Before box does. A second toggle made while it runs, for example with a `player.*` prompt open, can be overwritten.
- A persona-change run reads the cast (`persona`, `entities`) from before the change; `trait` and the trait scope use the new world.

Open edges from ticket 11:

- The bench's choice row shows the question only, not which script asks.
- The static stat-code rules (unknown stat routes, Before reads delta) still read stat scripts only.
- `STAT_CODE_EXECUTION` and `STAT_CODE_UNKNOWN_NAME` keep section `stats`, so trait and world script failures group under Stats; each item still opens its own tab.
- `checkStatCode`, `runStatCodeCheck` and the `StatCodeCheck` component still say stat code.
- Disabled stat rows: the Scripts tab dims a disabled stat's script row at 50% (Q52). Whether an "Off" meta text joins it, and whether the Stats tab's own rows get the same marker, is the user's design call.
- The stat-move readers (`statMoveReaders.ts`) skip world scripts, so a stat move does not see a world script that reads it (ticket 16).
- The help window's code test (`helpCodeTestRun`) still checks only the two stat timings, and the Formaquestion code prompts still say stat code (ticket 13).
