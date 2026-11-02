# Spec: Release Avatar License

Status: ready-for-agent
Spec session: release-avatar-license — spec

A reading of the licenses, not legal advice.

## Problem Statement

Release builds ship a bundled Avatar named Elaina, by TronSpectra. Its VRM metadata turns off all four expression flags: sexual, violent, political or religious, and antisocial or hate. Formamorph is an adult-capable game heading to a paid Steam release, and we hold no extra rights from the author.

Community Creations has a related gap. The Permissive License gate never reads these flags, so an Avatar with restricted terms can be published.

## Solution

Elaina leaves release builds on every channel. A new model takes its place at the same path on the free channels, so the release swap stays as it is. The model is one you build or one you pick from VRoid Hub, and it must pass the stricter gate.

The Steam build ships no bundled Avatar at all (Q18). Players bring their own, and Steam Workshop can supply them in a later effort.

The Permissive License gate becomes fully permissive: if a file adds any restriction, it can't be published.

## Rulings

| # | Ruling |
|---|---|
| Q1 | Replace Elaina. No permission request to the author. |
| Q2 | The fix covers every release channel. |
| Q3 | Published releases stay up. The next release carries the fix. |
| Q4 | Community Avatars are in scope. This reopens the usage-flag line in the Community Avatar Uploads spec. |
| Q5 | A new model replaces Elaina, not the VRoid default. Widened by Q16. |
| Q6 | Existing players keep their seeded Elaina copy. No migration. |
| Q7 | Publishing needs a fully permissive license. A file with added restrictions isn't allowed. |
| Q8 | Recapture the landing page's Avatar shots with the new model. |
| Q9 | The user builds or picks the model. Agents write the checks and wiring. |
| Q10 | Keep the split. The VRoid sample stays on local dev and the Pages dev build. Releases swap in the new model. |
| Q11 | Credit required, personal-only commercial use, and extra license terms all block a publish. |
| Q12 | No listing sweep. Elaina is the only uploaded Avatar, and the user removes that listing after the new model ships. |
| Q13 | Accept our reading of VRoid Studio Article 13. No contact with pixiv. See Further Notes for the accepted risk. |
| Q14 | The new model matches Elaina: clothed, with the three body keys and working customization. |
| Q15 | The fix blocks every release. No new build on any channel ships Elaina. |
| Q16 | A VRoid Hub model may replace the own-model route if it passes the gate and shows no sign of third-party characters or BOOTH parts. |
| Q17 | The candidate is the maid model, built by script from its Hub file. The user accepted the prototype on 2026-11-02. This moves the key work in Q9 from the user to a script. |
| Q18 | The Steam build ships no bundled VRM, because the paid build carries too much risk otherwise. Free channels keep a bundled model. New evidence: pixiv's sample conditions ban paid redistribution and character creation use. This narrows Q2, Q10, Q15 and Q17: Elaina still leaves every channel, and the candidate serves the free channels only. |
| Q19 | SFW builds (local dev, Pages) ship A as Aki with no body keys. NSFW builds (desktop, web, Android) ship the maid as Sei, the default, with body keys. Steam ships no model and is revisited once a shippable build exists. |
| Q20 | Praline (sample F) ships on NSFW builds as a second bundled library Avatar, with body keys and the hair, eye and stocking changes. |
| Q21 | Sugarscape's Custom Persona uses User's Default, which turns on Avatars there. Players pick Praline from the Player Avatar dropdown. |
| Q22 | Our reading of the sample ban on a character creation service: it targets redistributing models made by a tool like VRoid Studio. Body sliders change local render state, and any model output returns the imported file unchanged, so we hold ourselves clean. pixiv could read it differently. Its guidelines title the section "character creation tools" and allow commissions. |
| Q23 | The user confirmed that all three models read as adults. |
| Q24 | Generated thumbnails get a white background. Sei gets a recaptured embedded thumbnail. |
| Q25 | Existing NSFW players don't receive Sei. Q6 stands. |
| Q26 | Sei and Praline default to hair and eye colors that match each model's source look as closely as the pickers allow. |
| Q27 | Accept VRoid Hub Article 3(2)'s respect clause as a risk for Sei on NSFW builds. See Further Notes. |
| Q28 | VRoid Hub Article 4's ban on analyzing Registered Works doesn't cover edits that the modification flag allows. See Further Notes. |

**Candidate source:** [明都セイ, maid version](https://hub.vroid.com/en/characters/3917238075852400462/models/7688062894575397999) by 乙幡皇斗羽, tagged original. The `authors` field stays as it is. The conditions read on 2026-11-02 are saved in `evidence/sei-hub-conditions-2026-11-02.json`.

**Evidence on A:** a fresh AvatarSample_A export matches the tracked default's face and body geometry and every texture except the thumbnail.

## User Stories

1. As the owner, I want release builds to ship a model whose terms allow adult use, so that the paid release doesn't conflict with its bundled Avatar's license.
2. As the owner, I want every channel to change together, so that no store carries the known conflict.
3. As the owner, I want a release blocked until the new model lands, so that Elaina can't ship by accident.
4. As the owner, I want a list of Hub models that pass our rules, so that I can pick by popularity without reading each license.
5. As the owner, I want a candidate file checked before it lands, so that I learn early if its license or keys fall short.
6. As the owner, I want the model's source and license recorded, so that we can show where it came from later.
7. As the owner, I want the Article 13 risk on record, so that the decision and its reasons are easy to find.
8. As a new player, I want the bundled Avatar to have working body sliders, so that I lose nothing from the change.
9. As a world author, I want body stat bindings to keep driving the new model, so that existing worlds still work.
10. As an existing player, I want my library and saves left alone, so that an update doesn't change my Avatar.
11. As a publisher, I want a restricted file refused before the publish modal opens, so that I don't fill in a listing for nothing.
12. As a publisher, I want the refusal to name each failed requirement, so that I know what the file's terms prevent.
13. As a publisher, I want the Model Library to show why a model is Not Shareable, so that I can tell before I try.
14. As a player downloading an Avatar, I want every listing to allow every use, so that I don't have to read its terms before I play.
15. As an API client, I want the server to refuse a restricted file, so that the gate holds without the app.
16. As a player with an old library record, I want its license read again, so that the new checks judge its real terms and not missing fields.
17. As a visitor to formamorph.ai, I want the landing page to show the Avatar the app ships, so that the page is accurate.
18. As a developer, I want a test that reads the shipped model files, so that a restricted file fails the gates.
19. As the owner, I want the Steam build to contain no VRM file, so that the paid product carries no sample or Hub model data.
20. As a Steam player with an empty library, I want a clear empty state, so that I know to add my own Avatar.
21. As a Steam player, I want to add a `.vrm` and use it, so that the 3D view still works for me.
22. As a Steam player without an Avatar, I want to play every world, so that the missing model never blocks a game.

## Implementation Decisions

**The model (human step)**

- The new file replaces the alternate Avatar at its current path. The release swap steps for that file don't change.
- The tracked default becomes the fresh A export named Aki (Q19), at its current path.
- A candidate must meet all of these:
  - Passes the stricter gate from its own metadata.
  - Has `Waist`, `Bust` and `Thickness` keys, or a license that lets us add them. New keys are authored fresh, never copied from Elaina.
  - Works in Character Customization.
  - Shows no sign of a third-party character, BOOTH parts, or a VRoid sample base.
- Modified files keep the original author in their metadata, and their license stays as permissive as the original.
- The Hub filter query and a gate script are the selection tools. The Hub lists no sort control, so a generated gallery does the ranking.
- A provenance record holds the source URL, author, download date, and a copy of the metadata as downloaded.
- The `tools` folder beside this spec holds the build script. It writes the three keys and recolors the textures from the Hub file.
- **Keys:** each is a generated per-vertex offset, built from bone positions and skin weights. All `Body` primitives share one vertex buffer, so clothing moves with the same offsets. `Waist` peaks near 12 cm, `Bust` near 5.6 cm and `Thickness` near 3.6 cm.
- **Waist limit:** the apron and skirt have few vertices, so at the top value the apron looks faceted and stands off the skirt. A cleaner result needs more mesh detail. The user accepted this file.
- **Textures:** the Hub file's hair is flat black and its iris has no green or blue, so multiply tinting can't move them. The script writes a neutral mid-tone hair and an iris with all three channels above zero.
- **Default look (Q26):** color factors in the file restore the source look until a picker is touched, and a touch overwrites them. The picker seed reads texture median times factor, so a picker opens on the color shown when factors are 0 or 1, and factors of 1 change nothing. At mid factors, such as Praline's hair, the swatch opens darker than the render, and picking it still restores the factor. The linear tint fix stays out of this effort, because it changes how saved tints render.
- **Picking the seed:** this isn't always the identity. A touched picker writes the shade factor equal to the base factor, which moves skin shading (Sei's skin changes 30,646 pixels at 700x1000, max 49). One seed also covers Praline's three hair materials, whose medians differ. The untouched render and Revert stay exact, and no file clips its textures to hide this.
- **Praline's stockings:** the stocking picker is the material's existing row in Other Colors. There is no new channel.
- **Provenance:** one record at `provenance.md` beside this spec. Aki's raw export carried the user's name as author, so her record keeps that metadata as exported, notes the author edit, and cites pixiv's sample page as source.

**Bundled Avatars by build (Q19–Q21)**

- A build flag, not a failed fetch, decides whether Praline exists. A 404 on an SFW build would retry on every launch.
- The flag is `FORMAMORPH_AVATARS`, set to `nsfw` only by the three release steps that copy her file. Unset means SFW, so a local Android or desktop build holds Aki alone. A build check fails when the flag and the output disagree.
- With no device default, User's Default resolves to the seeded default record when the library holds it, else to the bundled file. An existing player keeps seeing their copy (Q6), and the picker and the played Avatar agree.
- Old Sugarscape saves with no chosen Avatar resolve to the player's default, because the world stays authoritative for saves. They get no save handling.
- Seeding becomes a list of bundled entries, each with a fixed library id and its own one-shot flag. Seeded copies stay the player's, so a deleted Praline stays gone.
- Existing players on NSFW builds receive Praline through her own flag. They keep their current default copy (Q6), so they don't receive Sei.
- Praline's file lives beside the alternate file in `build-assets`, and the release swap copies it in. This adds about 20 MB to each NSFW build.
- The default-Avatar hash check and the fingerprint list include Praline, so her unedited file can't be published.
- Sugarscape's Custom Persona gains `vrmPick: { kind: 'default' }`. No other bundled world picks an Avatar today. The world file is the same on every build.
- Sei, Aki and Praline carry those names in their `name` field, which sets the library label.
- Praline needs body keys built and checked on her 14 `Body` primitives, including her stocking layer and fox tail. Her build script joins the `tools` folder.

**Thumbnails (Q24)**

- The generated thumbnail renders on an opaque white background. Thumbnails already stored keep their old look.
- Embedded thumbnails for the bundled models are rendered with the same framing and background.

**Steam build (Q18)**

- No Steam build class exists yet. This effort adds `none` to `FORMAMORPH_AVATARS`, and the Steam effort sets it.
- The build must leave out every `.vrm`, including the tracked default that `public/` copies into a dist.
- With no bundled file, these change: the viewer's default model URL, library seeding, the bundled hash check, and the rule that the library keeps at least one Avatar.
- With no device default, User's Default resolves to no model even when the library holds an added Avatar. It never guesses a record. In a game the entity view then hides, and Character Creation's picker opens on the first library Avatar, so no blank canvas needs explaining. A locked world pick missing from the library gets a hint in the preview.
- The Avatar surfaces get an empty state that leads to adding a `.vrm`. Games run without a model.
- Saves and worlds that name the default Avatar id resolve to no model, with no error. That includes Sugarscape's User's Default pick.
- Store art and trailers may still show a model. pixiv's terms allow images and videos of models in games. Recheck this if a sample appears in them.

**Tint code**

- The skin picker starts from the Face average, while the Body average is darker, so the same tint renders Body brighter than Face. The Body average drops because of dark texture areas. Tinting uses the median of opaque pixels instead of the mean.
- Tint math runs in sRGB while rendering is linear, so dark textures come out darker than the picker. A linear fix would allow a darker default hair. This is optional and not ruled.

**Permissive License gate**

- The gate stays one pure module in each repo, with the same requirement identifiers on both sides.
- New requirements:
  - `allowExcessivelySexualUsage` must be true.
  - `allowExcessivelyViolentUsage` must be true.
  - `allowPoliticalOrReligiousUsage` must be true.
  - `allowAntisocialOrHateUsage` must be true.
  - `creditNotation` must be `unnecessary`.
  - `licenseUrl` must be exactly `https://vrm.dev/licenses/1.0/`.
  - `otherLicenseUrl` must be absent or empty. Exporters omit it, and all six real files checked on 2026-11-02 do.
- The existing `commercialUsage` requirement tightens to `corporation`. `personalProfit` now fails.
- A missing field fails its requirement, as it does today. `otherLicenseUrl` is the one exception.
- The new identifiers are the VRM field names, appended in this order: `allowExcessivelySexualUsage`, `allowExcessivelyViolentUsage`, `allowPoliticalOrReligiousUsage`, `allowAntisocialOrHateUsage`, `creditNotation`, `licenseUrl`, `otherLicenseUrl`.
- Identifiers stay append-only. The existing five keep their names.
- The server reads the new fields in its VRM meta reader and runs the same checks on create and on file update.
- The server's error body and the client's copy gain the new identifiers. Both client copy tables need an entry for each.

**Client license data**

- The normalized VRM license type gains the four flags, `creditNotation` and `otherLicenseUrl`, under those VRM field names. The server's listing `license` content uses the same names.
- The library's stale-license check moves to a field that only new records carry, so old records are read again. Today it keys on `avatarPermission`.

**Fingerprints and records**

- The bundled fingerprint test fails when a shipped model's hash is missing, so the client list regenerates in the same landing as each model file. The server copy follows. Elaina's hash stays in the list through file history.
- `STEAM-RELEASE-CHECKLIST.md` and the third-party notices clear a file that no longer exists and omit the release model. Both name the real files. The notices work belongs with the Credits effort, so this effort hands it the new model's details.

**Landing order**

1. The new model files with their client fingerprints, built by script (Q17).
2. Server gate. The server's bundled-avatar test reads the client's alternate file, and Elaina fails the stricter gate, so this waits for step 1.
3. Client gate, license data and copy. The bundled-avatar test reads the alternate file, and Elaina fails the stricter gate, so this waits for step 2.
4. Server fingerprints, records, and the landing page recapture.
5. The Steam switch and empty state. This doesn't depend on the model file.

**Unchanged by ruling**

- The morph alias layer stays, so worlds bound to older key names keep working.
- The one-shot seed stays. New installs get the new model. Existing players keep their copy and don't receive the new model in their library.

**Export-shape reminder**

- Adding license fields touches the stored model record and the Avatar listing's `license` content. Tickets must repeat this reminder in their responses.

## Testing Decisions

- A good test calls the gate or the real file reader and asserts the verdict. It never restates the gate's logic.
- **Gate, both repos:** every requirement passing, each one failing alone and named, and each missing field failing. Prior art: the existing gate tests and the server's model-kind tests.
- **Client and server agreement:** both reject the same files with the same identifiers. Prior art: the shared bundled-fingerprint vector.
- **Shipped files:** the bundled-avatar test keeps both rows and now holds them to the stricter gate. It must stay as it is, never narrowed, so Elaina going red until the new file lands is expected. Land the client gate after the file.
- **Stale license:** an old record is read again, and a current one isn't.
- **Refusal copy:** each new identifier produces its own words, and a file with no VRM 1.0 metadata keeps the single sentence about format.
- **Guards bite:** prove the shipped-file test by running it against the current Elaina file before the swap.
- **Steam artifact:** a build test asserts the Steam output holds no `.vrm`. Prove it bites by leaving one in. Prior art: the bundle boundary test.
- **Empty library:** the viewer, library and a game run with no Avatar and no error.
- **Seeding:** each entry seeds once, a deleted one stays gone, an existing library gains Praline and keeps its default, and an SFW build never fetches her.
- **Build contents:** an SFW build holds no Praline file, and an NSFW build holds both.
- **Sugarscape:** starting it offers the library picker, and Praline resolves as the played Avatar.
- **By hand:** load the new file in Character Customization and confirm the sliders and colors with `verify-ui`.

## Out of Scope

- Asking TronSpectra or pixiv for permission.
- Pulling or rebuilding published releases.
- Migrating seeded library copies.
- A listing sweep. The user removes the one Elaina listing by hand.
- Restricting what players import for their own local play, or warning them about a model's flags.
- Steam Workshop rules. Steam has no Community Creations, and Workshop is a separate effort. It is also how Steam players could get Avatars later.
- Building the Steam build itself. This effort only adds its avatar switch.
- Removing body sliders from the bundled model.
- Other licensing findings from the Credits sweep.

## Further Notes

**VRM Public License 1.0**

- The prohibited-expression condition covers images generated in Model Use and Avatar Use. It doesn't cover redistribution of the file, which is why Q3 and Q6 are acceptable readings.
- Elaina allows corporate commercial use, redistribution, and redistribution of modified copies.
- A modified copy must keep terms at least as restrictive, so editing Elaina can't lift its flags.

**Accepted risk (Q13, Q22)**

- VRoid Studio Article 13 excludes applications with functions that let 3D models be created by deforming meshes or combining meshes or textures. Such an app needs a separate pixiv license. Article 7 and the guidelines say the same, and output is banned beside creation.
- The Japanese text prevails. Writing no file doesn't clear us.
- An independent read leaned about 60% that setup-screen body sliders are in scope, with low to moderate confidence. Color tints probably fall out. Stat-driven changes lean out.
- For our reading: the banned function creates a 3D model, and we only change render state. Every VRM app deforms meshes at runtime, so the clause must be narrower than that.
- No record of a pixiv ruling, license or forced change was found. No clear paid app with VRoid-based sliders was found either, which means "others do it" has no support. Neither shows that none exist.
- The risk applies to any model with VRoid preset content, which includes most Hub models.
- New evidence reopens this ruling. A pixiv statement or a complaint would count.

**VRoid Hub terms (Q27, Q28)**

- Article 3(2): the Conditions of Use at download time apply, and later changes don't reach a copy already downloaded. The source file's size matches the listing's 15,069,648 bytes. The saved read is from the download date, 2026-11-02.
- Respect clause: uses must respect the character's personality and individuality and maintain and enhance her image. It has no exception for sexual use.
- For our reading: Sei's flags allow sexual use, the listing has no description, and the terms say a registrant can't object that a use is "not to my liking".
- Article 4 bans reverse engineering or otherwise analyzing Registered Works. For our reading: a modification the flags allow needs the file opened.
- Article 3(1): a registrant answers for disputes when registered content conflicts with outside conditions. That doesn't stop a third party from raising a dispute with us.
- The Japanese text prevails. New evidence reopens these rulings. A creator or pixiv complaint would count.

**pixiv sample conditions**

- Allowed: for-profit use, and editing texture and parameters to make an original character, even for sale.
- Prohibited: redistributing the VRM or its data for a fee, using sample data in a character creation service, and distributing it with CC0 terms.
- Removing bundled models from the Steam build also likely takes Article 13 out of play there, because the app holds no VRoid data. This is an inference.

**UNVERIFIED**

- How the keys behave in the app. The user tested the file in the app. No agent has driven the sliders there.
- Whether Hub flags are accurate. They are the uploader's claim.
- Elaina's provenance, and whether it contains preset or sample content. pixiv's sample terms ban selling a sample's data and using it in character creation.
- Whether signed-in Hub searches show more models. The 187 passing models came from a signed-out read on 2026-11-02.
- Whether "Elaina" copies a third-party character.

**Sources**

- [VRM Public License 1.0](https://vrm.dev/en/licenses/1.0/)
- [VRoid Studio Guidelines](https://vroid.com/en/studio/guidelines)
- [pixiv terms, VRoid Studio section](https://policies.pixiv.net/en.html#vroidstudio)
- [pixiv terms, VRoid Hub section](https://policies.pixiv.net/en.html#vroidhub)
- [VRoid sample model conditions](https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z)
