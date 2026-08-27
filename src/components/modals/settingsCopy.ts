/**
 * Every user-facing string the Settings modal shows for a setting: the row label, the one-line
 * description beside its control, the optional `ⓘ` body, and the confirmation dialogs its buttons open.
 *
 * It exists so the modal reads as though it were written in one sitting. The rules the copy follows are
 * asserted in `settingsCopy.test.ts` against this table rather than trusted to review, so a new setting
 * cannot arrive without a description, with two sentences, or with a sentence-case label.
 *
 * Out of scope: the setup guides (`LlmSetupGuide`, `ImageSetupGuide`), which are multi-paragraph
 * tutorials rather than settings, and dynamic status lines, which report what just happened rather than
 * describing a control.
 */

/** One setting row's copy. */
export type SettingCopy = {
  label: string;
  /** The line beside the control. One sentence, third person, ≤ 12 words. */
  description: string;
  /** Markdown shown behind the `ⓘ`. Carries cost, tradeoff, or mechanism — never a restatement. */
  info?: string;
  /** Narration-message fields only: when this message is sent, in terms of app features and the turn —
   *  the timing is runtime-conditional, so it can't be inferred from the field being visible. */
  sentWhen?: string;
  /** Renders the badge. The word itself never appears in `description`. */
  experimental?: true;
};

/** A confirmation dialog's copy. The body is a real sentence, so only the title is length-ruled. */
export type ConfirmCopy = { title: string; description: string };

/** One option inside a segmented row. `help` follows the same rules as a row `description`. */
export type SettingOptionCopy<V extends string = string> = {
  value: V;
  label: string;
  /** The line shown beneath the control while this option is picked. One sentence, ≤ 12 words. */
  help: string;
  /** Markdown appended to the row's `ⓘ` while this option is picked, so the cost or mechanism that
   *  doesn't fit `help` is a click away. Authored only where the option has more to say. */
  detail?: string;
  /** Renders the marker on the item itself. The word never appears in `help`. */
  recommended?: true;
};

export const SETTINGS_COPY = {
  // ── Display · Appearance ────────────────────────────────────────────────────
  theme: {
    label: 'Theme',
    description: 'Sets the app’s light or dark color scheme.',
  },
  themeColor: {
    label: 'Theme Color',
    description: 'Recolors the whole app in light and dark.',
  },
  font: {
    label: 'Font',
    description: 'Sets the typeface for the whole app.',
  },

  // ── Display · Scene ─────────────────────────────────────────────────────────
  backgroundMusic: {
    label: 'Background Music',
    description: 'Plays each location’s music during the scene.',
  },
  locationBackground: {
    label: 'Location Background',
    description: 'Shows the location image behind the game.',
  },
  backgroundFade: {
    label: 'Background Fade',
    description: 'Fades the location image toward the background for readability.',
    info: '0% shows the full image; higher values trade the picture for legibility.',
  },

  // ── Display · Narration ─────────────────────────────────────────────────────
  narrationReveal: {
    label: 'Narration Reveal',
    description: 'Sets how each sentence appears as it streams.',
  },
  aiLanguage: {
    label: 'AI Language',
    description: 'Sets the language or style the AI writes in.',
    info: `The language the AI writes narration and choices in.

Pick a suggestion, type your own, or even a **style** — like *formal English* or *pirate speak*.`,
  },
  paragraphLimit: {
    label: 'Paragraph Limit',
    description: 'Limits how many paragraphs each turn may run to.',
  },
  markdownFormatting: {
    label: 'Markdown Formatting',
    description: 'Allows bold, lists, and tables in narration.',
    info: `Let the AI format narration with **bold/italics**, lists, and tables.

Works best when **Paragraph Limit** isn't set to *Single*.`,
  },

  // ── Display · Accessibility ─────────────────────────────────────────────────
  narrationFont: {
    label: 'Narration Font',
    description: 'Sets a separate typeface for the story text.',
    info: `A separate font for the story text, defaulting to the app font.

Includes faces tuned for **dyslexia**, **low vision**, and reading.`,
  },
  narrationTextSize: {
    label: 'Narration Text Size',
    description: 'Scales the story text without affecting the app.',
  },
  lineSpacing: {
    label: 'Line Spacing',
    description: 'Sets the gap between lines of story text.',
  },

  // ── Display · Inspection ────────────────────────────────────────────────────
  showReasoning: {
    label: 'Show Reasoning',
    description: 'Shows the model’s private reasoning above each turn.',
    info: `Shows a reasoning model's (or the Inline mode's) private scratchpad as a collapsible **"Thinking…"** note above each turn's narration.

Captured and saved either way, so turning it on reveals it on past turns too.`,
  },
  showSilentRequests: {
    label: 'Show Silent Requests',
    description: 'Shows background requests in the status bar and context viewer.',
    info: `Surfaces requests that normally run quietly — **memory summaries**, **character diaries**, and new-character notes — in the status bar and the AI context viewer.

An inspection aid for authoring and debugging; off by default.`,
  },

  // ── Output · Turn Extras ────────────────────────────────────────────────────
  systemPrompts: {
    label: 'System Prompts',
    description: 'Chooses which extra passes run after each turn.',
  },
  moveAutomatically: {
    label: 'Move Automatically',
    description: 'Resolves the move before the scene is written.',
    info: `Resolves the move from your action **before** the scene is written, so it's narrated in the new location.

Skips the "Move to…?" confirmation.`,
  },

  // ── Output · Reasoning ──────────────────────────────────────────────────────
  thinking: {
    label: 'Thinking',
    description: 'Sets how the AI plans a turn before writing it.',
  },
  limitActiveCharacters: {
    label: 'Limit Active Characters',
    description: 'Caps how many characters the director stages per turn.',
    info: `Caps how many characters the director stages each turn.

- Each staged character adds its **own request**
- Off lets the scene use as many as it calls for`,
  },
  nativeReasoning: {
    label: 'Native Reasoning',
    description: 'Sets how hard reasoning models think per request.',
    // The caveat that used to close all eight effort levels, said once for the whole control.
    info: 'Only applies to models with native reasoning. Other models ignore it entirely.',
  },

  // ── Output · Memory ─────────────────────────────────────────────────────────
  memorySummaries: {
    label: 'Memory Summaries',
    description: 'Condenses older turns so long stories stay coherent.',
    info: `Condenses older turns while keeping recent ones **word-for-word**, so long stories stay coherent without bloating each request.

Runs an extra request per turn; edit its prompt under **Prompts → Summaries**.`,
  },
  semanticMemory: {
    label: 'Semantic Memory',
    description: 'Keeps the memories most relevant to your action.',
    experimental: true,
    info: `When memories no longer all fit, keeps the ones most **relevant to your current action** instead of just dropping the oldest.

- Runs a small model **on your device**
- One-time **~23 MB** download when enabled
- Nothing about your story leaves your machine`,
  },
  memoryCap: {
    label: 'Memory Cap',
    description: 'Caps how many memories ride along each turn.',
    info: `Keeps only this many memories in view each turn — the ones most relevant to your action — even when more would fit.

- Smaller, sharper prompts on long stories
- The story opening and newest memories always stay
- Off carries everything that fits`,
  },
  sceneRecall: {
    label: 'Scene Recall',
    description: 'Recalls a full past scene when your action returns to it.',
    experimental: true,
    info: `When your action returns to an old moment — going back to someone you made a promise to — the full original scene is recalled for the AI, word for word, clearly marked as the past.

- At most **two scenes** per turn
- Never near-duplicates of each other or of recent turns
- Uses Semantic Memory's model and memories`,
  },
  timeInMemory: {
    label: 'Time in Memory',
    description: 'Records when each memory happened.',
    experimental: true,
    info: `Each memory carries **when** it happened — *"Day 3, evening — two days ago"* — and the recap states the present moment.

- Without it the AI sees the story as an undated list and guesses at how long ago things were
- Time of day is coarse (*morning*, *evening*), never a clock reading
- Uses the game clock shown in the Log`,
  },
  measuredClock: {
    label: 'Measured Clock',
    description: 'Measures how long each turn actually takes.',
    experimental: true,
    info: `How long each turn takes is measured from what actually happened, instead of the flat **one hour per action** the game charges otherwise.

- A few words spoken cost minutes; a night's rest costs hours; *"three weeks later"* costs three weeks
- Adds one small request per turn, alongside choices and stat updates
- Feeds the Log's clock, stat regeneration, and Time in Memory`,
  },
  semanticLore: {
    label: 'Semantic Lore',
    description: 'Activates dictionary entries by meaning, not just keywords.',
    experimental: true,
    info: `Dictionary entries also activate when your action's **meaning** matches them, even with none of their keywords — "the ruined tower" can wake an *Old Beacon* entry.

- Keyword activation is unchanged; this only **adds** entries
- Uses the same on-device model as Semantic Memory (~23 MB on first enable)`,
  },

  // ── Output · Characters ─────────────────────────────────────────────────────
  describeNewCharacters: {
    label: 'Describe New Characters',
    description: 'Writes a description for each character the story invents.',
    info: `Characters the story invents already appear in the **Characters** panel on their own. Turn this on and each one also gets a written description, so you can open them like any authored character.

Runs one extra request the first time each new character is named. Remove any you don't want from the **Characters** panel during play.`,
  },
  characterDiaries: {
    label: 'Character Diaries',
    description: 'Gives each character a diary that shapes their motivation.',
    info: `Each character present in a turn records a **first-person diary entry** as turns age out, and its recent entries feed back into that character's motivation.

Runs an extra request per participant; edit its prompt under **Prompts → Diary**.`,
  },
  diaryRecall: {
    label: 'Diary Recall',
    description: 'Recalls older diary entries relevant to the moment.',
    experimental: true,
    info: `Instead of only their newest diary entries, characters also recall the older ones most relevant to what you're doing — she remembers the last time you drew a blade.

- Same total entry count, so it costs **nothing extra**
- Uses Semantic Memory's model`,
  },

  // ── Output · Choices ────────────────────────────────────────────────────────
  continueTheStory: {
    label: 'Continue the Story',
    description: 'Adds a choice that nudges the story forward.',
    info: `Adds a **[Continue the Story]** button under the choices. It fills the action box with that text, so you can take a turn without writing anything — the story reads it as a nudge to keep going rather than something your character does.

**Always** keeps the button even with the Choices request switched off.`,
  },

  // ── Output · Performance ────────────────────────────────────────────────────
  concurrentRequests: {
    label: 'Concurrent Requests',
    description: 'Fetches post-narration requests in parallel.',
    info: `Fetches choices, stat updates, and location changes **at the same time** instead of one after another.

- Faster turns on endpoints that handle parallel requests (e.g. LM Studio's **Parallel** setting)
- Turn off if a memory-tight local model slows down under the load`,
  },

  // ── Endpoints · Text ────────────────────────────────────────────────────────
  textPreset: {
    label: 'Preset',
    description: 'Selects which endpoint configuration is active.',
  },
  endpointUrl: {
    label: 'Endpoint URL',
    description: 'Points requests at your model server.',
  },
  apiToken: {
    label: 'API Token',
    description: 'Authenticates you with this endpoint.',
  },
  modelName: {
    label: 'Model Name',
    description: 'Names the model this endpoint should use.',
  },
  contextWindow: {
    label: 'Context Window (tokens)',
    description: 'Sets how much the model keeps in context.',
  },
  maxOutputTokens: {
    label: 'Max Output Tokens',
    description: 'Caps how long each reply may run.',
  },

  // ── Endpoints · Image ───────────────────────────────────────────────────────
  enableImageGeneration: {
    label: 'Enable Image Generation',
    description: 'Shows the “Generate with AI” buttons.',
  },
  sceneImages: {
    label: 'Scene Images',
    description: 'Draws a picture of every turn automatically.',
    info: `Draws a picture of every turn without being asked.

The image renders **after** the turn's text is done and holds your next action until it finishes — one graphics card can't run the artist and the writer at once. Expect each turn to take as long as your image server needs.

You can always draw a single scene by hand from the button above the story instead.`,
  },
  imageProvider: {
    label: 'Provider',
    description: 'Selects which image server Formamorph talks to.',
  },
  imageEndpointUrl: {
    label: 'Endpoint URL',
    description: 'Points image requests at your server.',
  },
  imageApiToken: {
    label: 'API Token',
    description: 'Authenticates you with this image endpoint.',
  },
  imageModel: {
    label: 'Model',
    description: 'Selects which checkpoint draws the image.',
  },
  promptPrefix: {
    label: 'Prompt Prefix',
    description: 'Prepends quality and style tags to every generated prompt.',
  },
  negativePrompt: {
    label: 'Negative Prompt',
    description: 'Lists tags the image should avoid.',
  },
  portraitSize: {
    label: 'Portrait (W × H)',
    description: 'Sets the size of entity portraits.',
  },
  landscapeSize: {
    label: 'Landscape (W × H)',
    description: 'Sets the size of locations and thumbnails.',
  },
  stepsCfg: {
    label: 'Steps / CFG',
    description: 'Sets sampling steps and prompt adherence.',
  },
  imageSampler: {
    label: 'Sampler',
    description: 'Selects the sampling algorithm.',
  },
  faceFix: {
    label: 'Face Fix',
    description: 'Re-renders faces in a second pass.',
  },
  imageWorkflow: {
    label: 'Workflow (API Format)',
    description: 'Replaces the default ComfyUI graph.',
  },
  invokeBoard: {
    label: 'Board',
    description: 'Files generated images under an InvokeAI board.',
    info: 'Uncategorized is InvokeAI\'s own default board.',
  },
  invokeEncoder: {
    label: 'Qwen3 Encoder',
    description: 'Selects the text encoder this base requires.',
  },
  // One row, but the label names the base it belongs to — so both spellings are guarded rather than one
  // of them being a literal at the call site.
  invokeVaeZImage: {
    label: 'Z-Image VAE',
    description: 'Selects the VAE this base requires.',
  },
  invokeVaeAnima: {
    label: 'Anima VAE',
    description: 'Selects the VAE this base requires.',
  },

  // ── Endpoints · Local engine ────────────────────────────────────────────────
  localModel: {
    label: 'Local Model',
    description: 'Chooses which downloaded model the engine runs.',
  },
  localContextSize: {
    label: 'Context Size',
    description: 'Sets how much recent story the model can see.',
    info: `Context is the model's working memory, measured in tokens (word pieces). Everything the model reads each turn must fit in it.

More context uses more **VRAM**. When a model does not fit, lower this first.`,
  },
  localGpuLayers: {
    label: 'GPU Layers',
    description: 'Chooses how much of the model runs on the GPU.',
    info: `A model is a stack of layers. Each layer moved to the GPU runs faster, but takes VRAM.

- **Auto** offloads as many layers as fit
- **Max** offloads the whole model. Use it to split across GPUs. It can run out of VRAM
- **Custom** sets an exact count`,
  },
  localLayers: {
    label: 'Layers',
    description: 'Sets how many layers to offload.',
  },
  localGpu: {
    label: 'GPU',
    description: 'Runs the model on the GPU.',
    info: 'Recommended. Off runs the model on the CPU. That is slower, but works without a capable GPU.',
  },
  localGpuDevice: {
    label: 'GPU Device',
    description: 'Chooses which GPU the engine loads models onto.',
    info: `- **Auto** uses your discrete GPU. With more than one, it uses all of them. With none, it uses the integrated GPU
- **All GPUs** always uses every GPU, so a large model can split across them
- Pick a GPU by name to use only that one

The **Engine device** line above shows the result.`,
  },
  localFlashAttention: {
    label: 'Flash Attention',
    description: 'Saves VRAM and often runs faster.',
    info: `Flash Attention is a faster way for the model to read its context. The result is the same; the work uses less memory.

Turn it off only if an old GPU or backend cannot run it.`,
  },
  localParallelRequests: {
    label: 'Parallel Requests',
    description: 'Sets how many requests the model answers at once.',
    info: `After the narration, a turn sends several follow-up requests: choices, stat changes, the location check. This setting is how many the model answers at the same time instead of one after another.

A higher value speeds up a turn. But the requests split the context between them, and each uses more VRAM.`,
  },
  localAutoLoad: {
    label: 'Auto-Load',
    description: 'Loads a model without waiting to be asked.',
    info: '**On** — the first model in your download folder loads when the engine is in use. A finished download also loads itself.\n\n**Off** — nothing loads until you press **Load**. No VRAM is spent until you ask.',
  },
  localTemperature: {
    label: 'Temperature',
    description: 'Raises randomness; lower values stay focused.',
    info: `Temperature scales how boldly the model picks each word. Low values take the safe pick. High values give rare words a chance.

Around 0.7 fits most story models. Above 1.2 the text can lose coherence.`,
  },
  localMaxTokens: {
    label: 'Max Output Tokens',
    description: 'Caps how long each reply may run.',
    info: 'A reply that hits the cap ends at the last full sentence.',
  },
  localTopP: {
    label: 'Top-p',
    description: 'Trims unlikely words below a probability cutoff.',
    info: `The model picks from the smallest set of words whose chances add up to P.

1 turns it off.`,
  },
  localTopK: {
    label: 'Top-k',
    description: 'Limits sampling to the K most likely tokens.',
    info: `The model picks each word from only the K best candidates. A low value keeps the text focused. A high value allows more variety.

0 turns it off.`,
  },
  localMinP: {
    label: 'Min-p',
    description: 'Drops tokens far below the top token’s probability.',
    info: `The cutoff is a fraction of the best candidate's probability. So it adapts: strict when the model is confident, loose when it is not.

0 turns it off.`,
  },
  localRepetitionPenalty: {
    label: 'Repetition Penalty',
    description: 'Penalizes repeated words; 1 turns it off.',
    info: `The model pays a small cost to reuse words it already wrote, so it reaches for new phrasing.

Small steps matter: 1.05 to 1.15 is typical. High values can break names and punctuation.`,
  },

  // ── Prompts · Options ───────────────────────────────────────────────────────
  verbatimTurns: {
    label: 'Verbatim Turns',
    description: 'Sets how many recent turns stay word-for-word.',
    info: 'Older turns than these are summarized instead of sent in full.',
  },
  customTemperature: {
    label: 'Custom Temperature',
    description: 'Overrides this prompt’s sampling temperature.',
  },
  customRepetitionPenalty: {
    label: 'Custom Repetition Penalty',
    description: 'Overrides this prompt’s repetition penalty.',
  },
  reasoningBudget: {
    label: 'Reasoning Budget',
    description: 'Sets the share of output tokens spent on reasoning.',
    info: '0% means this prompt does no reasoning at all.',
  },
  promptNativeReasoning: {
    label: 'Native Reasoning',
    description: 'Overrides the global reasoning effort for this prompt.',
    info: '**Global** follows Settings → Output → Native Reasoning. Only applies to models with native reasoning.',
  },
  promptEndpoint: {
    label: 'Endpoint',
    description: 'Routes this prompt to a specific endpoint.',
  },

  // ── Prompts · Narration messages ────────────────────────────────────────────
  recapMessage: {
    label: 'Recap Message',
    description: 'Asks for the story so far in one exchange.',
    sentWhen: 'Rides the narration history once Memory Summaries has condensed older turns.',
    info: 'The question the story recap answers. The reply is pre-written from the summaries, so the AI reads the story so far as its own words.',
  },
  nowMessage: {
    label: 'Now Message',
    description: 'Closes the recap with where things stand now.',
    sentWhen: 'Rides the narration history at the end of the recap’s reply.',
    info: 'The recap is all past tense; without this stated present, the AI can restart a live scene as a fresh arrival. Each chip carries its own clause and disappears when it has nothing to say, so any combination still reads as a sentence.',
  },
  recallMessage: {
    label: 'Recall Message',
    description: 'Frames a recalled scene as the past.',
    sentWhen: 'Rides the narration history when Scene Recall brings an old turn back.',
    info: 'Sent right after the recap, with the old turn’s full narration as the reply. The wording must mark the scene as past — an unframed old scene can overrule what the recap says happened since.',
  },
  directionMessage: {
    label: 'Direction Message',
    description: 'Marks bracketed text as your direction, not speech.',
    sentWhen: 'Rides with your action whenever it contains [square brackets].',
    info: 'Tells the AI the bracketed text is you directing the scene as the author, not something your character says.',
  },

  // ── Data · Saves ────────────────────────────────────────────────────────────
  autosave: {
    label: 'Autosave',
    description: 'Saves after every turn to a per-world Autosave slot.',
    info: `- Never touches your manual saves
- Appears in Load with an **"Auto"** tag
- Starts once the opening scene finishes`,
  },
} as const satisfies Record<string, SettingCopy>;

/** Buttons inside the modal, kept here so their casing is guarded alongside the row labels. */
export const SETTINGS_BUTTONS = {
  resetSizeSpacing: 'Reset Size & Spacing',
  restoreDefaultWorlds: 'Restore Default Worlds',
  clearCachedImages: 'Clear Cached Images',
  resetTutorials: 'Reset Tutorials',
  resetAiEndpoint: 'Reset AI Endpoint',
  troubleConnecting: 'Trouble Connecting?',
  howToSetUp: 'How to Set Up',
  howToGetThis: 'How to Get This',
  resetToDefaults: 'Reset to Defaults',
  manageModels: 'Manage Models…',
  saveReloadModel: 'Save & Reload Model',
  retryWithSettings: 'Retry With These Settings',
} as const;

/** Every confirmation the modal raises. Bodies are sentences and carry their own punctuation. */
export const SETTINGS_CONFIRMS = {
  resetSizeSpacing: {
    title: 'Reset Size & Spacing',
    description: 'Reset the narration text size and line spacing to their defaults?',
  },
  restoreDefaultWorlds: {
    title: 'Restore Default Worlds',
    description: "Bring back the bundled worlds you've deleted (City Rampage, Valentines Survival, Reincarnated Drone)? Worlds you still have are left untouched, and nothing you made or imported is affected.",
  },
  clearCachedImages: {
    title: 'Clear Cached Images',
    description: "Delete the downloaded copies of images that worlds link to rather than store? They'll be downloaded again next time you're online. Nothing in your worlds or saves is affected.",
  },
  resetTutorials: {
    title: 'Reset Tutorials',
    description: "Show the one-time tutorial popovers again? They explain a screen's controls the first time you meet them. Nothing in your worlds or saves is affected.",
  },
  resetAiEndpoint: {
    title: 'Reset AI Endpoint',
    description: 'Are you sure you want to reset the endpoint URL, model name, API token, and limits to their default values?',
  },
  resetWorkflow: {
    title: 'Reset Workflow',
    description: 'Reset the ComfyUI workflow to the default graph? Your custom workflow will be lost.',
  },
  resetTagPrompt: {
    title: 'Reset Tag Prompt',
    description: 'Reset the image tag prompt to its default? Your edits will be lost.',
  },
} as const satisfies Record<string, ConfirmCopy>;

export type SettingCopyKey = keyof typeof SETTINGS_COPY;

/**
 * The options of the segmented rows. These rows show the picked option's `help` in place of the row
 * description, which moves to the label's `ⓘ` — two lines in the same column read as one confused block.
 */
export const SETTINGS_OPTIONS = {
  theme: [
    { value: 'light', label: 'Light', help: 'Always uses the light color scheme.' },
    { value: 'dark', label: 'Dark', help: 'Always uses the dark color scheme.' },
    { value: 'system', label: 'System', recommended: true, help: 'Follows your operating system’s light or dark setting.' },
  ],
  paragraphLimit: [
    {
      value: 'none', label: 'None',
      help: 'The model writes until it finishes or hits the token cap.',
      detail: 'No limit is sent. The model writes until it finishes or reaches **Max Output Tokens**, which can cut a reply off mid-sentence.',
    },
    { value: 'single', label: 'Single', help: 'One paragraph per turn, stopping at the first line break.' },
    {
      value: 'auto', label: 'Auto', recommended: true,
      help: 'Scales the paragraph count to your Max Output Tokens.',
      detail: 'The paragraph count is scaled to your **Max Output Tokens**, so a reply fits the budget and ends cleanly instead of being cut off.',
    },
  ],
  thinking: [
    {
      value: 'off', label: 'Native',
      help: 'Nothing is added; reasoning models think as they normally would.',
      detail: 'Nothing is added to the prompt. A reasoning model thinks the way it normally would; every other model answers immediately. One request per turn.',
    },
    {
      value: 'inline', label: 'Inline',
      help: 'The model reasons privately before narrating, in the same request.',
      detail: 'The model reasons privately, then narrates, in the same request — one fewer round-trip than Planning.\n\nThe reasoning is saved either way; turn on **Show Reasoning** to read it.',
    },
    {
      value: 'precall', label: 'Planning', recommended: true,
      help: 'A separate request plans the narration before it is written.',
      detail: 'A separate request plans the turn before the narration is written. The most reliable option for small models, which lose the thread when asked to plan and write at once.\n\nCosts one extra request per turn.',
    },
    {
      value: 'staged', label: 'Staged',
      help: 'Highest quality, slowest.',
      detail: 'Three kinds of pass run before the narration: a director picks who is in the scene, each staged character plans its own motivation, and a storyboarder turns that into a plan.\n\n- Several extra requests per turn, so it is the slowest option\n- The best at holding a cast together\n- **Limit Active Characters** caps how many character passes run',
    },
  ],
} as const satisfies Record<string, readonly SettingOptionCopy[]>;

/**
 * Help for the native-reasoning levels, keyed by value rather than listed as options: which levels appear
 * is decided per endpoint by `reasoningTabs`, which owns their short tab labels. Held to the same rules as
 * an option's `help`. The caveat that any of this needs a reasoning model is a property of the control, so
 * it lives once in the row's `ⓘ` rather than closing all eight of these.
 */
export const REASONING_EFFORT_HELP = {
  auto: 'No hint sent — the endpoint decides.',
  none: 'Disables native reasoning.',
  minimal: 'Minimal effort.',
  low: 'Low effort.',
  medium: 'Medium effort.',
  high: 'High effort.',
  xhigh: 'Extra-high effort.',
  max: 'Maximum effort.',
} as const satisfies Record<string, string>;
