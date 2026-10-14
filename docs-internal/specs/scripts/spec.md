# Spec: Scripts

Status: ready-for-agent
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
| Q9 | A built-in world rule, **Strip Links And Images**, removes markdown links and images from narration history before any request. Links become their text; images are removed. No script category for this |
| Q10 | The strip rule covers narration history only: last story, turn digests, diary entries, recall results. Authored text is never touched |
| Q11 | At Game Start fires once per new playthrough, after setup, before the opening AI call. Never on load of a save |
| Q12 | When a Trait Switches fires on in-game switches in both directions. A trait's own script sees its own switches with the trait as `self`. A stat or world script sees every switch through `trait`, the trait that switched, with `enabled` giving the direction. Setup picks do not fire it |
| Q13 | A trait's own When a Trait Switches script runs on its own switch-off. For this timing only, the Q3 gate reads the state before the switch |
| Q14 | `player.*` is allowed in every timing except During AI Output, where the call fails the script |
| Q15 | Escape or closing a prompt dialog fails the script as canceled. Its writes drop, as on any script error. The turn continues |
| Q16 | `player.tell` renders a message card in the turn column, saved with history. `player.toast` shows a toast and saves nothing |
| Q17 | `confirm` and an `ask` with up to four options reuse the choice row under the narration. `askText` and a longer `ask` open one small dialog with the question as its title. The dialog is a new pattern and needs design-system approval before it ships |
| Q18 | The World Editor gets a top-level Scripts tab: a tree of the five timings with each script as a row. Its Add Script creates a world-owned script in the picked timing. Stat and trait editors keep their own Scripts section |
| Q19 | `beforeCode` and `code` rewrite to `scripts[]` on load. Export writes the list only. A world saved by the new build does not run its scripts in an older build |
| Q20 | During AI Output variables live on `narration`: `narration.sentence` is writable; `narration.sent`, `narration.buffered`, `narration.full` and `narration.index` are read-only |
| Q21 | With a During AI Output script in the world, the smooth crawl holds to complete sentences, as the fade reveal does. Worlds without one keep today's crawl |
| Q22 | A During AI Output script that throws or times out passes its sentence unchanged. The error logs and the Test Bench reports it |
| Q23 | A `player.tell` card never enters a request. A script that wants the AI to know something writes a stat or a placeholder |
| Q24 | Test Code and the Test Bench show the real prompt dialogs in the editor |
| Q25 | Clicking a row in the Scripts tab edits the script inline, in the same box the owner's editor shows. The box carries a jump-to-owner link |
| Q27 | A During AI Output result is one sentence whatever it holds. The reveal and TTS release it as one unit; `index` never shifts |
| Q28 | Strip Links And Images is on for a new world and off for an existing one, so an update changes no request |
| Q29 | A Blueprint stat's script runs once per owner in every timing, owner order, During AI Output included |
| Q30 | Later writes win a field, as today; `order` decides who runs later. A world script ordered before a stat script loses the field to it; flip the orders and the world script wins (ticket 01 ruling) |
| Q31 | A world script runs with `self` and `owner` as empty objects, matching the Surface table. A return value and a `self` write are ignored, never a non-number failure. Ticket 01 runs stat and world scripts; trait scripts arrive with ticket 02 and the Q3 gate (ticket 01 ruling) |
| Q32 | A Blueprint link overrides `scripts` as one whole list, not per script. Migration folds the two old field overrides into it and keeps each one's `blueprint` value for staleness (ticket 01 ruling) |
| Q33 | Migrated scripts take deterministic ids, `<statId>:before` and `<statId>:after`, so a shipped world gets the same ids on every load. New scripts mint `crypto.randomUUID()`. Bundled world files stay in the old form; the load path migrates them (ticket 01 ruling) |
| Q37 | On a trait script, `self` is the trait's sandbox entry, read-only, as `traits[name]` reads it; a return value is ignored. Switching the trait goes through `traits` or `owner` as today. A global trait's scripts run in the global run with `owner` empty; an entity's active trait, owned or linked, runs under that entity as `owner`, once per owner that holds it (ticket 02 ruling) |
| Q38 | Scripts without `order` run: world scripts, then per owner its stats' scripts in stat order, then its active traits' scripts in tree order (ticket 02 ruling) |
| Q39 | A trait link overrides `scripts` as one whole list, as a stat link does (Q32). Find All Uses rows carry the script id so the reveal opens the right box. Stat rename and Find All Uses cover trait scripts in ticket 02; the Test Bench stays ticket 11 (ticket 02 ruling) |
| Q40 | The stat tab label reads **Scripts** with its route value unchanged; a trait gets an advanced-only **Scripts** tab after Pins. Help Insert adds a new script with its timing at the end and focuses it, with no replace confirm; templates stay per box with the replace confirm. The remove confirm is titled "Remove This Script" with "This script has code. Removing it deletes the code." and a destructive **Remove** (ticket 02 ruling) |
| Q41 | At Game Start runs on the opening turn, before the Before-the-AI scripts, on live state. Regenerating the opening in a fresh game restores the pre-start state, so the start scripts run again over it, prompts included. Regenerating the opening of a loaded save runs nothing: its baseline already holds the start writes (ticket 04 ruling) |
| Q42 | An output script's stat, placeholder and trait writes land. They collect during the stream in sentence order and apply with the turn's After-the-AI batch, before the After scripts run, so the landing point is the one the Surface table names and no write is dropped. Ticket 06 owns this. In the output run, `player.*` is a stub whose five calls throw "player.<name> can't run in During AI Output"; ticket 09 keeps that throw (ticket 06 ruling) |
| Q43 | Output scripts on one sentence chain: each reads `narration.sentence` as the earlier script left it, in run order, so a filter and a link maker compose. Within one sentence, stat writes keep the one-snapshot, later-wins rule of every other timing (Q30); across sentences, sentence N+1 reads the stats as sentences 0..N left them, so per-sentence writes sum and the sum lands once with the After batch (Q42). `narration.full` is the narration as it stands: earlier sentences as rewritten, then the current sentence and the partial tail as the model wrote them. The model's original earlier sentences are not exposed (ticket 06 ruling) |
| Q44 | A stopped turn that keeps its narration lands no output-script writes. It gets no AI asks, no regen and no After scripts, so the kept text shows the rewritten sentences and their stat, pin and trait writes drop with the rest of the batch (ticket 06 ruling) |
| Q45 | With no prompt listener, `ask`, `confirm` and `askText` fail the script as canceled at once (Q15); `tell` and `toast` resolve and show nothing. A turn never hangs on a prompt. The async-engine gate is `/\bplayer\s*\./` over the code outside During AI Output; a script that reaches `player` another way runs sync and fails with "player is not defined". The canceled failure is a script failure kind `canceled` with the text "The player closed the prompt"; other scripts in the timing still land. A non-string question, an `ask` with no options, or an option that is neither a string nor `{ label, value }` throws a TypeError in the script. A multiple pick with nothing chosen is an empty array; a single `ask` always returns one value. The one-second budget extends by the time a host call took. The async engine suspends one host call at a time, so prompting scripts run one after another on the shared module: an open prompt holds every other prompting script, concurrent requests included, until it is answered. Prompts reach the UI one at a time; sync-engine scripts are unaffected (ticket 09 ruling) |
| Q36 | Off-world, a link override of one old box stays on its old key until the entity enters a world, where the original is in reach and the fold into the whole-list `scripts` override is exact. A fold that blanks the other box is a silent break of a shipped card, which the stat-code-entities Q19 precedent rules out (ticket 01 ruling, option B) |
| Q35 | The strip rule follows the text, not the request: any past passage, diary entry or digest in any request is stripped, the discovered-entity note request included. Q9 says "before any request" (ticket 08 ruling) |
| Q34 | Until ticket 02 lands, the stat Code tab keeps its two boxes: each edits the stat's first script of its timing, typing into an empty box adds a script, clearing a box removes it. Templates and help Insert write the same way (ticket 01 ruling) |

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
| `full` | read | everything received so far, partial tail included |
| `index` | read | the sentence's position in the reply, from 0 |

`player`:

| Call | Returns | Shows |
|---|---|---|
| `player.tell(text)` | nothing | a message card in the turn column, saved |
| `player.toast(text)` | nothing | a toast, not saved |
| `player.confirm(question)` | `true` or `false` | two buttons |
| `player.ask(question, options, { multiple? })` | the picked value, or an array with `multiple` | buttons up to four options, a dropdown past that |
| `player.askText(question, placeholder?)` | the typed string | a text field |

`options` takes strings or `{ label, value }`. The script waits for the answer with no `await`: the executor runs a script that names `player.` on the async engine, where a host function suspends the VM. The one-second timeout pauses while a dialog is open. Scripts that never name `player.` keep today's sync engine.

### Run order

Within a timing: scripts with `order`, ascending; then scripts without one in owner order (global scripts, then the player's persona, then entities) and stat order within an owner. Later writes win a field, as today.

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
