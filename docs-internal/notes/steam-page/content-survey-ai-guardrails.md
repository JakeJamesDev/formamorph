# Steam Content Survey — Generative AI guardrails answer

Status: draft
Drafted: 2026-10-21

The survey asks what guardrails keep the live-generated AI from producing illegal content. Steam also refuses live-generated Adult Only Sexual Content, so the Steam build is not marked Adult Only and this answer must stay true of that build.

Every sentence below maps to something the build does today, except the bracketed lines, which need the user's confirmation.

Ruling 2026-10-21: Community Creations does not ship in the Steam build. Steam Workshop is the only community-content source there. The age gate, content reports, upload terms, and account sign-in are not part of the Steam build's answer. The Steam build also drops the GitHub and Patreon links, so no outbound links or external payment paths remain for the build review.

▶ Resume here: confirm the bracketed CONFIRM lines. The prompt content rule is decided and still unbuilt.

## Draft answer (paste into the survey)

Formamorph is an interactive text role-playing game. A language model narrates the story in response to the player's typed actions, inside a world the player has chosen or written.

**What is generated, and for whom.** The AI produces narration, dialogue, and short choices during play. Output is generated only in direct response to the player's own input and is shown only to that player, on that player's device. Nothing the AI generates is published, shared, or stored on our servers. The game also produces no images, audio, or video from AI during play unless the player connects their own image service.

**The model.** By default the game sends requests to our hosted AI service, which runs an instruction-tuned open model with its vendor's built-in safety training [CONFIRM: model family and whether the service applies any server-side filtering]. Players may instead point the game at their own compatible AI service or a model running on their own computer. In that case generation happens under that service's terms, and we do not see or control the output.

**Bundled content.** Every world that ships with the game is authored by us, is reviewed before release, and contains no adult content. The AI narrates within the setting, characters, and rules those worlds define.

**Prompt rules.** The narrator prompt instructs the model to stay within the authored world and to narrate only what the player's action and the world's rules support. [REQUIRED BEFORE SUBMISSION: add a fixed, non-editable content rule to the Steam build; ruled 2026-10-21, see below.]

**Community content.** The Steam build does not include our own community service. Player-made worlds reach Steam players only through Steam Workshop, so uploads fall under the Steam Subscriber Agreement and Workshop rules, players report items through Steam, and we moderate and remove Workshop items that break those rules. [CONFIRM: which Workshop moderation controls we enable; check the Workshop docs before submission.]

**Disclosure in game.** [NOT TRUE YET: no first-launch or settings copy says the story is AI-generated. Add it, or cut this paragraph.]

## Gaps the draft exposes

| Gap | Where | What to decide |
|---|---|---|
| No content rule in any prompt today | `src/components/game/GamePrompts.ts` | **Must be added** (ruled 2026-10-21, not started): a fixed rider on the narration and planning prompts in the Steam build, outside the player-editable chips. Needs a probe run before shipping. |
| Workshop moderation controls | Steamworks Workshop config | Decide what we enable: item reporting, developer moderation, mature-content flags. Workshop integration itself is unbuilt. |
| Hosted endpoint moderation unknown | `api.lyonade.net` | Confirm the model and whether the server filters anything. The answer must not overclaim. |
| No in-game AI disclosure copy | main menu / settings | Nothing in the client says the story is AI-generated. Add one line, or drop the paragraph. |
| Player-supplied image services | `src/lib/imageGen/` | The Steam build ships with `VITE_SFW_TAGS=true` (see `STEAM-RELEASE-CHECKLIST.md`). Keep the sentence about images only if that build has no image provider preset. |
