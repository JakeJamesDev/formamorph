# Bundled Worlds Expansion

Status: ready-for-agent
Spec session: bundled-worlds-expansion — spec

## Problem Statement

The bundled worlds are the first thing a new player explores and the first example a new author opens. After the Bundled Worlds Refresh (closed 2026-10-17) each world is in the current shape, probed, and shows its assigned features. Each world is still small: 4 to 7 locations and 6 to 10 entities. A player runs out of places and people in a few sessions.

The worlds also have almost no art. Most have one location image or none, and Emberwatch has none at all. Features that need art, such as Image Visibility rules and the Map Background, have no bundled example. Features that landed after the refresh, such as World Tools on the cloud model, Relationship labels, Time of Day gates, script control of lore and exits, and placeholder chips in Pronouns, Travel Hints and Relationship labels, have at most one example.

## Solution

Expand seven bundled worlds: Drone, Emberwatch, City Rampage, Slime Outbreak, Sugarscape Survival, Valentines Survival, and Veilwood. Open Chat stays a blank stage (Q1).

- Each world grows to about double its locations and entities (Q5). The size table below sets the number per world.
- Existing content may be rewritten where it improves the world (Q4). Each world keeps its title, hook, and core cast (Q20).
- The post-refresh features join the coverage goal (Q7, Q8). The assignment table places each in the worlds whose premise fits.
- Every location and entity in the seven worlds gets art, generated through the app's own image path on the user's local InvokeAI, in GPU windows the user names (Q2, Q10, Q11). Each world has one art-direction line, so its images read as one style (Q16).
- The art tickets show Image Visibility rules in every world and a Map Background where the premise has a map (Q6, Q12, Q18).
- Each world proves on the cloud model that it plays at least as well as the current version (Q9).

## Rulings

- **Q1** Seven worlds. Open Chat stays blank, per the refresh's ticket 05 ruling.
- **Q2** New locations and entities get app-generated art inside the effort, not `imageTags` only and not a later effort.
- **Q3** One content ticket and one art ticket per world. The art ticket is blocked by its world's content ticket.
- **Q4** Add and may rewrite. A ticket may rework existing text, side cast, stats and scripts where it improves the world.
- **Q5** About double. Roughly 10 to 14 locations and 14 to 18 entities per world. The size table sets the exact target per world.
- **Q6** The art tickets showcase Image Visibility rules and the Map Background. World Avatars and ambient sound are out.
- **Q7** The coverage goal adds World Tools on the cloud model, Relationship labels, Time of Day gates, and script control of lore and exits.
- **Q8** New placeholder chips go in Pronouns, Travel Hints and Relationship labels wherever a rolled name fits. No chip is added only for coverage.
- **Q9** The pass bar is the refresh's: no structural regression, a rubric win or tie against the current revision, 5 or more runs per arm on the cloud endpoint, arms interleaved in one batch. A tie is a pooled rubric score over the scored batches on the final text within 0.1 per run of the old world (ticket 05 ruling, after four batches landed within that band).
- **Q10** The art ticket covers every location and entity in the world, old and new. Existing art stays when it matches the entity or location it belongs to; art that contradicts the text, such as Valentines' Hana portrait showing a boy, is replaced (ticket 08 finding, ruled in the spec session).
- **Q11** Art comes from the app's InvokeAI provider on the user's local install, in an agreed GPU window. No cloud image provider.
- **Q12** A Map Background only where the premise has a natural map. The assignment table names the worlds.
- **Q13** No per-world file-size cap. Each art ticket reports the world's size before and after.
- **Q14** One Major changelog entry. Ticket 01 adds it as a fragment, since content tickets land in no fixed order. No later ticket writes a fragment: the fragment flow lands each fragment as its own entry and refuses a repeated lead, so the one entry covers all seven worlds from the start. Lead: "The seven bundled worlds are about twice as big, and every location and entity has art." (ticket 01 ruling)
- **Q15** One shared ticket first extends the bundled-world coverage test with the new features and a row per world. World tickets fill their rows.
- **Q16** One art-direction line per world, written by the content ticket and used on every generation in the art ticket.
- **Q17** One backdrop per location and one portrait per entity. A second image only where a Visibility rule shows it.
- **Q18** Visibility floor per world: at least one location backdrop that changes and one entity image that changes.
- **Q19** Art review through a contact sheet per world in a gitignored directory, every image labeled. The user rejects or redoes by name.
- **Q20** The premise holds: title, hook and the named core cast stay.
- **Q21** The art model for all seven worlds is Illustrious Nova Kemono XL 8.0 (SDXL), proven through the provider on 2026-10-26. Its Invoke defaults are euler_a, 35 steps, cfg 4, fp16 VAE.
- **Q22** The stored world files hold lossless WebP at full size. Every build that exists today, web, Android and desktop, ships the bundled worlds re-encoded with the editor's Downscale. A future Steam build ships the lossless files, since download size matters much less there. (user, on ticket 02's question)
- **Q23** The ship-time re-encode is ticket 17 in this spec. Art tickets store lossless and do not wait on it.
- **Q24** The editor's Downscale presets, the quality and long-edge values it recommends to authors, get a re-examination as their own effort, outside this spec.
- **Q26** An art ticket may move canvas nodes to fit the Map Background, as long as the overall layout stays similar. (user, in ticket 12's session, 2026-10-26: "you're allowed to move the map nodes to fit better so long as the overall layout stays similar")
- **Q25** Every location is placed on the Locations canvas where the lore puts it: north is up, east is right, and the distance between two nodes follows the distance the text describes. Each content ticket stores a `canvasPosition` for every location; a map world's Map Background then lines up with those positions. Drone, already landed, gets a placement ticket. (user, 2026-10-26)

### Size table (Q5)

| World | Locations today → target | Entities today → target |
|---|---|---|
| Drone | 4 → 10 | 6 → 14 |
| Emberwatch | 7 → 14 | 9 → 18 |
| Rampage | 6 → 12 | 9 → 16 |
| Slime | 7 → 12 | 8 → 16 |
| Sugarscape | 5 → 11 | 9 → 16 |
| Valentines | 7 → 12 | 7 → 15 |
| Veilwood | 7 → 13 | 10 → 18 |

The target is a floor. A ticket may add more where the premise supports it. Every new location joins the graph through `parentId` or a Connection with Travel Hints both ways. Every new entity lists its `locations`, and sets `knownIn` when the AI should know of it elsewhere.

### Feature assignment (Q6, Q7, Q8, Q12, Q18)

Every world: a Visibility rule on one location backdrop and one entity image (Q18), and at least one chip in a Pronouns, Travel Hint or Relationship label field (Q8).

| Feature | Worlds | Shape of the example |
|---|---|---|
| World Tools on the cloud model | Rampage, Emberwatch, Slime (Drone keeps `lock_target`) | A script Tool with a live write: Rampage logs a destroyed landmark and pins a memory; Emberwatch's chapel Tool writes Faith and adds a memory; Slime marks a block as overrun and enables its lore entry. |
| Relationship labels | Emberwatch, Valentines, Slime | Cast ties the AI reads on the persona block, with a chip where the label carries a rolled name. |
| Time of Day gates | Veilwood, Sugarscape, Slime | A trait or Visibility rule that turns on at night or evening: Veilwood's hunters, Sugarscape's Daylight Seam, Slime's Night Pharmacy. |
| Script control of lore and exits | Slime (lore), Emberwatch (lore), Rampage (exits) | A script enables a dictionary entry as a stat crosses a threshold, or reads `location.exits` to pace a pursuit. |
| Map Background | Emberwatch, Veilwood, Rampage, Sugarscape | One generated map image behind the Locations canvas, cropped and faded in the editor. Drone, Slime and Valentines skip it. |

### Art direction (Q16)

Each content ticket writes its world's art-direction line into this spec's Comments and into the ticket. The line names medium, palette, and mood in booru-style terms, and never names a subject. The art ticket uses it on every image of that world.

## User Stories

1. As a new player, I want more places in each bundled world, so that I keep finding somewhere new over several sessions.
2. As a new player, I want more people and creatures in each world, so that each place has someone or something in it.
3. As a new player, I want every location and entity to have art, so that the world looks finished when I open it.
4. As a new player, I want a world's images to share one look, so that the world reads as one place.
5. As a new player, I want a backdrop or portrait to change when the story changes, so that the picture follows the stat, trait or time of day.
6. As a new player, I want the in-game Map to show a drawn map where the world has one, so that I can place myself in it.
7. As a new player on the default cloud model, I want the expanded worlds tuned for that model, so that they play well where most players play.
8. As a new player, I want the narration to stay on the world's premise and voice, so that the expansion does not blur what the world is.
9. As a returning player, I want my save of the current world to load against the expanded world and play a turn, so that the expansion does not strand my run.
10. As a returning player, I want my deleted bundled worlds to stay deleted, so that the expansion does not restore what I removed.
11. As a returning player, I want the core cast I know to still be there, so that the world I liked is the world I return to.
12. As a Rampage player, I want the AI to log a landmark I destroy through a Tool, so that the city remembers what I did.
13. As an Emberwatch player, I want prayer at the chapel to move Faith through a Tool, so that the chapel does something.
14. As a Slime player, I want an overrun block to change the lore the narrator reads, so that the outbreak is visible in the telling.
15. As an Emberwatch, Valentines or Slime player, I want the cast's ties to each other named, so that the narrator keeps who is whose rival or mentor straight.
16. As a Veilwood, Sugarscape or Slime player, I want night to change what is possible, so that time of day matters.
17. As a Rampage player, I want the pursuit to read the exits of where I am, so that the chase follows the map.
18. As a player of any of the seven worlds, I want a rolled name in a pronoun, travel hint or relationship label, so that a replay varies in new places.
19. As a new author, I want each bundled world to show the post-refresh features, so that I have a working example of each.
20. As a new author, I want a bundled example of an Image Visibility rule on a location and on an entity, so that I can copy the pattern.
21. As a new author, I want a bundled example of a Map Background, so that I see how the frame and fade are set.
22. As a new author, I want a bundled example of a World Tool with a live write in more than one world, so that I see the shape in several premises.
23. As a new author, I want each world's readme to name the features it shows, so that I know where to look.
24. As a new author, I want every new script written as a worked example, so that I can read it step by step.
25. As a new author, I want `imageTags` on every location and entity to match the art, so that I can regenerate in the same style.
26. As the user reviewing a content ticket, I want an image-stripped diff of the world, so that I can read the change without base64 noise.
27. As the user reviewing a content ticket, I want probe numbers against the current world, so that I judge the change by evidence.
28. As the user reviewing an art ticket, I want a contact sheet with every image labeled, so that I can reject or redo by name.
29. As the user reviewing an art ticket, I want the world's size before and after, so that I see what the art costs the bundle.
30. As the user, I want art generation to run only in a GPU window I name, so that the machine stays mine the rest of the time.
31. As a ticket agent, I want the feature coverage checked in a test with a row per world, so that a world cannot land without its assigned features.
32. As a ticket agent, I want the shared suite to read each world at the pre-expansion revision for the old-save check, so that the fixture is never a stored copy.
33. As a ticket agent, I want the world probe to take the pre-expansion revision as its default before arm, so that every content ticket is judged the same way.
34. As a ticket agent, I want the art-direction line in the spec, so that the art ticket does not invent a style.
35. As a maintainer, I want fingerprints regenerated with each world, so that the seeder and the publish check know every revision.
36. As a maintainer, I want one changelog entry for the whole effort, so that the release notes stay short.
37. As a maintainer, I want every image stored as WebP through the app's own encoder, so that the Test Bench image rules stay green.

## Implementation Decisions

- **Ticket order.** Ticket 01 is the shared test ticket (Q15) and ticket 02 is the Art Harness; both can start at once. Content tickets 03 to 09, one per world, run in parallel: they edit different world files, and a fingerprint-file conflict is resolved by regenerating it. Art tickets 10 to 16, one per world, are each blocked by the harness, their content ticket, and the art ticket before them, so they run one at a time, because each holds the GPU.
- **Art Harness (ticket 02).** One command generates a world's items through the app's InvokeAI provider with the art-direction prefix, encodes WebP through the app's encoder in Chromium, writes each image into the world by item id, and builds the contact sheet. It never starts a run without a user-named GPU window.
- **Pre-expansion revision.** Ticket 01's `Base:` sha, 2f45261a5, is the pre-expansion revision (ticket 01 ruling). The old-save check gives it the base case only; the cut-a-stat drift case stays on the pre-refresh revision. The shared suite's old-save fixture list gains it, next to the pre-refresh revision it already reads. The world probe's default before arm becomes it.
- **Edits by script.** World files are edited by parsing, changing, and re-serializing. Ids and existing images are preserved. Every reference is validated before saving: connections, `parentId`, entity `locations` and `knownIn`, owners, placeholder tokens, trait groups, gates, Visibility rule targets, Tool names, relationship targets, script stat names. The `bundled-worlds` project skill holds the procedure and the strip tool.
- **Canvas layout (Q25).** Every location, old and new, stores a `canvasPosition`. Positions are author-owned per ADR-0004, so the ticket writes them by script from the lore: within each Group's canvas, north is up and east is right, a place the text calls far sits farther than one it calls near, and no two nodes overlap at the grid size. A child sits inside its parent's Group canvas, so the directions hold per Group. The ticket proves the layout with a frame of each Group's canvas. A map world's art ticket sets the Map Background frame so the drawn map agrees with those positions.
  - Ticket 18 rulings: a relational phrase counts as a direction when it anchors the place to one already placed; a place the reader cannot put on the compass gains one short compass sentence in its AI text. A positions-and-direction-words change passes on the structural bar alone, 5 runs per arm, with the rubric reported but no win-or-tie required.
- **Graph growth.** New locations nest under an existing region with `parentId` or join through a Connection. Each Connection carries Travel Hints both ways. A location set to use connections for its Nearby list says so. Every new entity lists at least one location, and a persona's new start points are deliberate.
- **Content rewrite (Q4, Q20).** A ticket may rewrite prompts, lore, side cast, stats and scripts. Title, hook, and the core cast named in the current world stay. Lore grows with the map: each new district or region gets at least one dictionary entry.
- **Scripts and Tools as worked examples.** Every new script, Tool handler included, follows the house style: full variable names, sections in the order you would explain them, a comment per section that says what it does and why. A Tool's live write uses the Tool script calls that exist today (stat writes, `memory.add`, `memory.pin`, `discover`, `location.move`, `clock.advance`, `diary`) and dictionary `enabled` writes. No new runtime call is added for a world.
- **Tools on the cloud model.** A world Tool is authored so the world still plays without it, per ADR-0013. The probe runs with Tools offered, on the cloud endpoint with its tool parser.
  - Ticket 05 finding and ruling: a Tool offered on the narration prompt that asks the model to judge whether to call it makes the cloud model spill native reasoning (7 of 10 replays of a vague opening with `log_landmark` offered, 0 of 10 without, 0 of 6 with Drone's one-line `lock_target`) and over-call on plain actions. A judgment Tool is offered to the stat pass instead, where the narration already exists and the call is a fact; the ticket proves the stat pass keeps a valid reply with the Tool round in it, at the Q9 bar. A quiet wording the model never calls is not accepted. Emberwatch and Slime follow the same rule when their probes show spills.
  - Second finding: the stat pass sends a strict JSON schema to the cloud, and with it the model never calls a Tool (0 of 6 with the schema, 4 of 4 without), so the stat pass cannot carry a Tool either. Ruling: try the choices prompt with one replay round (calls on a real landmark, quiet on a plain action, no spill, the choice list parses); if that fails, Rampage lands without `tools`, its planned `tools` row entry is dropped, the Tool script stays in the ticket comments, and the app-side handling of native reasoning around Tool offers becomes a separate task.
- **Relationship labels.** At most one label per target, in author order. A chip in a label resolves with the owning entity's placeholders. A label whose target is the played persona (`you`) pulls its owner into the known roster of every scene, so only an entity the player would think of anywhere gets one; a rival or pursuer keeps the tie in its description instead (Emberwatch draft loss and ticket 08 ruling).
- **Time of Day.** A daypart condition lives in a trait's requirement row or an image's Visibility rule. It takes no owner and no negation, so an "at night" rule lists the night dayparts.
- **Chips in new fields (Q8).** A Pronouns, Travel Hint or Relationship label chip is added only where a rolled value reads naturally. Linked hints share one roll both ways.
- **Readme split.** `introReadme` keeps trait guidance. `readme` keeps play first, then "How this world is built", which names the new features the world shows.
- **Art direction (Q16).** The content ticket writes the line. The art ticket applies it on every generation as the positive prompt prefix for the session, read from and restored to the user's active image preset afterwards, so `imageTags` stay the subject's own tags.
- **Generation path (Q2, Q11).** Art goes through the app's InvokeAI provider, from the editor's Generate control or from a harness that calls the same provider module with the same preset and prompt composition. Both are the app's path. Every art ticket uses the Q21 model, Illustrious Nova Kemono XL 8.0, with its Invoke defaults as the preset's starting point. InvokeAI runs headless, with the Invoke GUI closed, in the window the user names.
- **Image kinds (Q17).** One landscape backdrop per location, one portrait per entity, at one size per kind across the world. A Visibility variant repeats the subject's tags with the state change added. Slot 0 is the primary image and always shows outside play.
- **Visibility rules (Q18).** Each world has at least one location backdrop and one entity image with a rule. A rule reads a stat, trait, group, persona or daypart. A location rule with no owner reads the played persona. The Test Bench rules for missing targets, all-hideable entities and zero-span percent rules stay enforced.
  - Ticket 12 finding and rule: in play the backdrop and the Map show the first visible image, so a ruled slot 1 behind an unruled slot 0 never shows. A changing image uses complementary rules on slot 0 and slot 1, such as a stat below and at or above one threshold; slot 0 still shows outside play, and the Test Bench accepts the pair. Drone's two rules were built the old way and get ticket 19.
  - Map Background prompt: a map variant of the world's art-direction line keeps its palette, accents and detail words, drops view and atmosphere words, and adds top-down cartography words. The bar is that the big features agree with the compass and no inland district sits on water; mirroring after generation is allowed and recorded with the seed. Opacity about 0.6 so the nodes stay readable. Ticket 12 finding: text-to-image on the Q21 model could not place a river and a sea edge in one frame across 36 candidates and five prompt sets; a map that gets the inland features right, with the coast implied off an edge, is accepted, and the search is recorded in the ticket.
- **Map Background (Q12).** The four map worlds store one generated map image under the world overview's Map Background, with its frame in canvas units and an opacity. The art ticket sets the frame in the editor so the drawn map lines up with the Locations canvas. A second map image with a Visibility rule is allowed where the premise asks, and never required.
- **Encoding (Q22).** Every stored image is lossless WebP at full size through the app's own encoder, the same path as the `image-not-webp` fix. The harness never downscales. Existing art stays as it is. The oversized-images rule stays ignored (Q13); every other Test Bench image rule is enforced.
- **Ship-time re-encode (Q22, Q23, ticket 17).** A build step re-encodes the bundled worlds with the editor's Downscale for the web, Android and desktop builds, from the lossless source files. The bundled fingerprints know both forms, so the seeder and the publish check recognize a shipped world and a stored one. The shared suite and the world probe read the source files. The step is skipped for a Steam build when one exists.
  - Ticket 17 rulings: the step runs the Downscale rules in Node through the app's own libwebp, with the same budgets, quality and never-grow guard, so the bytes are identical across runs and build machines; it does not match an editor click byte for byte. An image within its slot's budget ships unchanged. Both forms are recorded for every revision from ticket 17 on, not for older revisions, since no earlier build shipped a downscaled form. The seeder code does not change: both fingerprints sit in the list. A test checks each world's computed shipped fingerprint is listed; a miss never fails the build. The switch is an env var that bundles the source files. An image the codec cannot decode or encode fails the build; an animated image is skipped and shipped unchanged with a log line, since Veilwood's animated WebPs stay and the budgets may move under them.
  - Cross-effort ruling (Downscale Presets spec, Q12 there): the editor's trigger today acts only on over-budget images, and a lossless 1216×832 backdrop sits under the background budget, so "within budget ships unchanged" is superseded. The presets effort's trigger-rule ticket makes one shared scan that also marks a stored-lossless image as a target. Ticket 17 calls that scan and encode, carries no trigger of its own, and lands after that ticket: Downscale Presets 01, "Trigger Rule and Budgets" (spec committed c7e11befc; ticket landed 13059703e).
- **Child entities in art (ticket 03 note for ticket 10 and every art ticket).** An entity written as a child, such as Drone's Sabi, Tamsin and Squire Wren, gets age-appropriate, fully clothed, non-sexual wording in its `imageTags` and in the art ticket's negatives, and its portrait is reviewed on the contact sheet before it is stored.
- **Prompting lesson (ticket 10 landing, for art tickets 11 to 16).** A long subject list after the eleven-tag style prefix gets diluted. Use a short subject of real Danbooru tags, put Compel weights on the one or two traits the model keeps dropping, and weight the negatives for the body parts it keeps adding. Generic words pull in their defaults: "robot" brings a humanoid body, "car" brings windows and a driver. The weights stay in the run and the ticket's comments, never in stored tags.
- **Harness negatives (ticket 10 ruling).** The harness takes a `--negative` flag of extra tags appended to its pinned negative, written to the run log so a replay keeps it. Child entities run as one pass with child-safety negatives; a subject with a known model habit, such as the drone's treads, gets its own negatives. The contact sheet resolves a placeholder-named item to the placeholder's own name; ids address it on the command line.
- **Rampage pursuit and Tool (ticket 05 ruling).** A hidden global stat Pursuit, driven by a Before the AI script that reads `location.exits`: it climbs per road in while the creature holds a place and halves on a move, with the last place and the roads pinned through existing script and placeholder calls only. Alert Level stays how large the response is; Pursuit is how tightly it boxes the creature in. The Tool `log_landmark` pins a memory and adds 5 Destruction once per landmark; the world plays with Tools off.
- **Slime features (ticket 06 ruling).** Counter Open, an always-on trait on Hollis Pratt gated on evening and night, with the clock seeded to 22:00. A world-level After the AI script reads Suspicion and sets the Wanted Notice entry's `enabled` at 75 percent of max or more, two-way, writing only on change; a lore-only script lives on the world, not on the stat, since the bundled stat-script tests require a stat script to set its own stat (prepare finding, matching Emberwatch's Founders' Pact). The Tool `mark_overrun` takes one enum of six blocks, enables that block's disabled entry in a Block Reports book and adds one memory, once per block. Sergeant Okonjo's label carries a rolled Missing Partner chip. Five new locations to 12, nine new entities to 17.
- **Disabled entries a script enables (ticket 06 ruling).** The Test Bench `dictionary-disabled` info rule flags every entry stored with `enabled: false` and has no exemption for one a script or Tool switches on. Slime and Emberwatch list those entries as by-design rows in the shared suite, reason "off until its script switches it on", in the Open Chat pattern. The rule itself is a separate task outside this spec; when it lands, the rows come out.
- **Emberwatch features (ticket 04 ruling).** `offer_prayer`, On Call on narration with a clear trigger, guarded to the Chapel of the Ember once per story day, +10 Faith and one memory line; replayed with and without the Tool first, and the world lands Tool-free if it spills. An After the AI script on Renown enables The Founders' Pact at 70 or more, two-way. A rolled Lost Sentry chip in the widow's label to Captain Blackwell, and labels on the core cast. 15 locations, 19 entities, the Boundary Wall taking the sally gate between the Watchtower and the Barrow.
- **Sugarscape features (ticket 07 ruling).** The seam's far side is a real location behind the Stalefront crust; by day the seam wins as today, at night it leads only to the far side, which connects back on foot. Two always-on traits on the Daylight Seam carry the Time of Day gate: Open to Daylight on dawn through afternoon, Dark Seam on evening and night. Eleven locations, 19 entities, a rolled Licorice Flavor chip on both legs into the Licorice Forest, the start and openings unchanged.
- **Valentines features (ticket 08 ruling).** Twelve locations with the main building north and the Front Gate on the south edge; the Bus Loop is no exit, the Front Gate stays the win. Fifteen entities with pronouns on the named cast. Relationship labels one per target, the player end on `you`, a rolled Vice President chip on Hana's label to the Swarm, no label on Sora. Scripts, stats, openings and start unchanged; no Tool.
- **World tickets never edit the spec (ticket 03 ruling).** A world ticket puts its art-direction line in its own comments and sends it to the spec session in its landing message; the spec session folds it into this spec's Comments.
- **Harness details (ticket 02 ruling).** The harness pins every preset field itself and never reads the user's settings or env. The negative prompt is the app's default. Face-detail is off. A dry run is the default and `--live` generates. Redo takes names with new seeds; replay reruns a log at its stored seeds. After a write it runs the Test Bench image rules in Node and prints the findings. Its live acceptance run writes a scratch copy of Emberwatch with a provisional art-direction line and changes nothing under the bundled world files.
- **imageTags.** The content ticket writes `imageTags` for every new location and entity, as booru-style tags consistent with the world. The art ticket may refine tags and writes them back, so the stored tags describe the stored art. Stored tags are plain and provider-neutral: no Compel or other weight syntax, since a player's scene images paste them into their own provider (ticket 10 ruling). Weights that a subject needed live in the run log and the ticket's comments.
- **Review artifacts.** A content ticket links the stripped diff and puts probe numbers in its comments. An art ticket writes one contact sheet per world under the worktree's frames directory, labeled by item name and slot, and reports the world file's size before and after.
- **Changelog (Q14).** Ticket 01 adds one Major entry as a fragment, with a lead that states the outcome for the player. No other ticket writes a fragment.
- **Coverage detectors (ticket 01 ruling).** `tools` is a Tool with a script handler. `scriptLore` is script code that assigns an entry's `enabled`. `scriptExits` is script code that reads `location.exits`. `timeGates` is a time Condition in a trait gate row or an image Visibility rule. `visibilityRules` needs one location image rule and one entity image rule. `mapBackground` is a Map Background with an image. `newFieldChips` is a placeholder token in a Pronouns field, a Connection leg hint, or a relationship label. Drone's row claims `tools` from the start. A planned feature a world already shows fails with "move it into the row". The `scriptLore` detector matches the inline form only, a script line that sets `dictionaries.<Book>.entries.<Entry>.enabled`; a world ticket writes that form, not an alias (ticket 01 landing note). Ticket 01 landed as 06a8e4c3d.
- **Fingerprints.** Each content and art ticket regenerates the bundled fingerprints and commits them with the world.
- **No shape change.** The expansion changes world content only. It adds no field to the world or save export shape.
- **No migration change.** Each world file stays in the shape `migrateWorld` writes. The current-shape check holds.

## Testing Decisions

- A good test loads a bundled world the way the seeder loads it and checks behavior a player or author sees. It never asserts on authored prose or on an image's pixels.
- **One seam: the shared bundled-world suite.** Ticket 01 extends it:
  - The feature union gains `tools`, `relationships`, `timeGates`, `scriptLore` (a script that writes a dictionary entry's `enabled`), `scriptExits` (a script that reads `location.exits`), `visibilityRules` (a location image rule and an entity image rule), `mapBackground`, and `newFieldChips` (a placeholder token in a Pronouns, Travel Hint or Relationship label field). Each gets a detector.
  - The assignment table is stored as planned rows. A world ticket moves each feature it delivers into its row. The set check for the new features turns on once no planned feature is left unclaimed, so the suite is green before the first world ticket and strict after the last.
  - Test Bench rows stay empty for the seven worlds. Open Chat's row is unchanged.
  - The current-shape check holds for every file.
  - The old-save check reads each world at the pre-refresh and the pre-expansion revisions and plays one turn against the new world. Drift is accepted. No stored copies.
  - Each new check is shown to fail once with a world that lacks the feature or a broken reference.
- **Per-world tests** only for behavior that must hold: a Tool handler's write, a script's effect on its stat or lore entry, a gate, a Visibility rule at a stat value or daypart. Each is shown to bite by breaking the world file once.
- **Probe evidence (Q9)** goes in each content ticket's comments: arms, run counts, structural metrics, and the rubric result, in the refresh's format.
- **Art tickets add no test seam.** The Test Bench image rules run through the shared suite. The contact sheet is the human check.
- Prior art: the shared bundled-world suite, the Veilwood and Emberwatch world tests, the bundled fingerprint test, the refresh tickets' probe tables.

## Out of Scope

- Open Chat.
- World Avatars and ambient sound (Q6). Background music.
- Cloud image providers and any art path outside the app's InvokeAI provider (Q11).
- Re-examining the editor's Downscale presets (Q24): its own effort.
- A Steam build and its lossless shipping path (Q22): no Steam build exists yet.
- Galleries of several images per item beyond Visibility variants (Q17).
- New bundled worlds, or cutting a world.
- Changes to the world or save export shape, or to load-time migrations.
- New Tool script calls or runtime features for a world's sake.
- Local-model probes, unless a ticket shows the cloud results cannot decide.

## Further Notes

- Inventory on 2026-10-26 (image-stripped): Drone 4 locations and 6 entities, Emberwatch 7 and 9, Rampage 6 and 9, Slime 7 and 8, Sugarscape 5 and 9, Valentines 7 and 7, Veilwood 7 and 10. Location art: 0 to 3 per world. Entity art: 0 to 7 per world. Emberwatch has no image and no script. Only Drone has a Tool.
- The narration prompt carries the current location, its sub-locations and reachable neighbors, and the entities in those tiers plus known ones. Lore injects only matched entries. So total world size does not grow the prompt; it grows authoring and review time.
- The eight world files total about 12.5 MB today and ship in the app bundle and the APK. With about 30 images per world, the set will grow several times over. Q13 accepts that; each art ticket reports the number.
- The app's generate control makes one image per run and has no bulk mode. A harness over the same provider module is the expected route for an art ticket's volume.
- There is no world-level style field. The art-direction line lives in this spec and the ticket, and is applied through the session's positive prompt prefix.
- Grill rulings Q1 to Q20 were settled on 2026-10-26 in the spec session.

## Comments

**Art-direction lines (Q16).**

| World | Line | From |
|---|---|---|
| Drone | `painterly fantasy illustration, soft cel shading, clean lineart, sky blue and meadow green palette, warm brass accents, bright natural sunlight, airy atmosphere, hopeful adventurous mood, high detail` | ticket 03, landed 7cb097040 |
| Emberwatch | `painterly fantasy illustration, oil painting texture, muted earth tones, slate gray and heather green palette, warm ember orange accents, dramatic chiaroscuro lighting, low drifting mist, somber heroic mood, high detail` | ticket 04, landed c3b8b09d7 |
| Slime | `cel shaded comic illustration, bold clean lineart, flat muted colors, dark teal and charcoal gray palette, neon lime green glow, glossy highlights, overcast night lighting, light fog, eerie quiet mood, high detail` | ticket 06, landed 87ec1f527 |
| Rampage | `semi-realistic digital painting, cinematic concept art, dramatic high angle, giant scale perspective, hazy daylight, drifting dust and smoke, muted concrete gray and slate blue palette, rust red accents, tense disaster movie mood, high detail` | ticket 05, landed a7d825d60 |

**Landings.** 01 → 06a8e4c3d. 02 → 49c962d11. 03 → 7cb097040 (12 locations, 16 entities; the wheels line did not stop the model giving the drone treads, so ticket 10's tags carry the wheels). 04 → c3b8b09d7 (15 locations, 19 entities, Tool-free: `offer_prayer` spilled 3 of 10 with 0 calls, script in the ticket comments; decision batch 44.5 to 43.5). 06 → 87ec1f527 (12 locations, 17 entities, `mark_overrun` kept on narration at 1 call in 5 with no spills, Wanted Notice as a world script, seven by-design rows; the probe driver now clears a modal live-event poster that had blocked every run). 05 → a7d825d60 (13 locations, 21 entities, Pursuit on `location.exits`, lore-placed canvas; ships no Tool, since `log_landmark` spilled on narration and choices and the stat-pass schema blocks calls; row claims scriptExits and newFieldChips, not tools). 10 → 0ae830bd6 (28 new images, 2 kept; drone.json 1.25 MB → 38.1 MB lossless; neither Visibility rule flipped in a live game), follow-up 0faa4ea00 after the user's review: Blightcrown Peaks and Demon Frontier redone, and both Visibility rules moved to Charge at 100 percent, the Overdrive-ready drone and the Sentinel awake on Mossback Hill (user's call, supersedes the ticket 10 ruling on rule targets). 18 → 07845a4b9 (Drone canvas placed per Q25, seven compass sentences, no structural change). 17 → 9675794cc (Vite plugin, shipped fingerprints from cd6fe508c on; not verified: arm64 macOS bytes and CI's cold cache; Veilwood's seven animated portraits ship unchanged over the new 250 KB entity budget and every production build warns with their names).

**Generation check (2026-10-26, spec session).** InvokeAI 7.0.0-alpha.3 on port 9090, driven through the app's own provider module from Node (`npx vite-node` over a throwaway script that calls `buildImageRequest` and `generateImage`; the `@/` alias resolves). This is the harness route the art tickets use.

| Model | Result | Time |
|---|---|---|
| SDXL Animagine | On-prompt 1216×832 scenery | 25.7 s |
| Z-Image Turbo | On-prompt 1216×832 scenery, at SDXL-style steps and cfg, so slow | 95.0 s |
| Illustrious Nova Anime XL | Solid black | 25.5 s |
| Illustrious Nova Kemono XL 8.0 (Q21) | On-prompt 1216×832 night keep | 27.8 s |

The black image is the fp16 VAE overflow the provider already knows: it sends the `fp32` decode flag only when the model's InvokeAI defaults set `vae_precision: fp32`, and this model's defaults leave it null. The first art ticket's model pick must render through the provider as is, or the user sets that model's `vae_precision` default to fp32 in Invoke's model manager first. Z-Image needs its own steps and guidance in the preset. The Invoke GUI was running during the check with no queue hang.
