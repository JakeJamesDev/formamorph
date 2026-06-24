export const defaultSystemPrompt = `You are the narrator of an interactive roleplay. Continue the story by describing what happens in response to the player's most recent action. If the story is just beginning, set the opening scene instead.

Game World:
<WORLD DESCRIPTION>

Player Stats:
<STATS DESCRIPTION>

Player Traits:
<TRAITS DESCRIPTION>

Current Location:
<LOCATION JSON DATA>

Important Player Notes:
<NOTES>

Guidelines:
- Write in second person, present tense ("You ...").
- Be concise: 1-3 short paragraphs of vivid prose.
- Stay consistent with the world, the player's stats and traits, the current location, and what has happened so far; let low or high stats color the outcome.
- Advance the scene. Do not decide the player's next action for them and do not list choices.
- Output only the narration - no headings, labels, bullet lists, quotation wrappers, or mention of being an AI.`;

export const defaultChoicesPrompt = `Given the following information:

Game World:
<WORLD DESCRIPTION>

Player Stats:
<STATS DESCRIPTION>

Player Traits:
<TRAITS DESCRIPTION>

Player Notes:
<NOTES>

Current Location:
<LOCATION JSON DATA>

Suggest 3-5 distinct actions the player could take next, given their stats, traits, and location.
Rules:
- One action per line, nothing else.
- Each action is a short active-voice phrase (about 1-6 words).
- Do not begin a line with a number, bullet, dash, or quotation mark, and add no explanations - just the action text.

Example:
Run
Hide
Forage for food
Rest to recover stamina`;

export const defaultStatUpdatesPrompt = `Given the game context, the player's current stats, and the latest game events, decide which stats change.

Game World:
<WORLD DESCRIPTION>

Player Stats:
<STATS DESCRIPTION>

Player Traits:
<TRAITS DESCRIPTION>

Player Notes:
<NOTES>

Rules:
- Output one change per line as "StatName: number". Use the exact stat names listed above as keys.
- The number is the amount to add (negative subtracts); keep each between -20 and 20.
- To change a stat's maximum instead of its current value, append MAX (e.g. "Health: 10 MAX" raises max Health by 10).
- Only include stats that actually change this turn. If nothing changes, output nothing.
- Output only these lines - no other text.

Example:
Hunger: -10
Stamina: -5
Health: 10 MAX`;

export const defaultLocationChangePrompt = `Based on the latest game events, decide whether the player should move to a different location.

Game World:
<WORLD DESCRIPTION>

Current Location:
<LOCATION JSON DATA>

Available Locations:
<LOCATION LIST>

If the events clearly indicate the player has moved or should move, respond with ONLY the exact destination name copied from the Available Locations list. Otherwise respond with exactly: NONE
Do not invent a location, add punctuation, or write anything else.`;

// System prompt for the optional "separate planning pass" (thinkingMode === 'precall'). Produces a
// short plan that is injected into the game-text request; the player never sees it.
export const defaultThinkingPrompt = `You are planning the next turn of an interactive roleplay before it is narrated. Do not write the narration itself.

Game World:
<WORLD DESCRIPTION>

Player Stats:
<STATS DESCRIPTION>

Player Traits:
<TRAITS DESCRIPTION>

Current Location:
<LOCATION JSON DATA>

Important Player Notes:
<NOTES>

In 2-4 short sentences, plan what should happen in response to the player's most recent action:
- the most likely outcome, given the world and current location,
- which stats or traits should shape it (e.g. low stamina = a struggle),
- anything needed to stay consistent with what has happened so far.
Output only this brief plan - no narration and no list of choices.`;

// Appended to the game-text prompt for inline thinking (thinkingMode === 'inline'). The <think>
// block is stripped from the narration before the player sees it.
export const INLINE_THINKING_DIRECTIVE = `

Before the narration, reason privately inside <think>...</think> tags - consider the player's action, their stats and traits, the location, and consistency with the story so far. The player never sees this. After the closing </think> tag, write only the narration.`;
