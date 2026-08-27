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
    description: 'Sets the app’s color palette for both themes.',
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
  },

  // ── Display · Narration ─────────────────────────────────────────────────────
  narrationReveal: {
    label: 'Narration Reveal',
    description: 'Sets how each sentence appears as it streams.',
  },
  aiLanguage: {
    label: 'AI Language',
    description: 'Sets the language or style the AI writes in.',
    info: `Applies to the narration and the choices.

Pick a suggestion or type your own. A **style** works too, like *formal English* or *pirate speak*.`,
  },
  paragraphLimit: {
    label: 'Paragraph Limit',
    description: 'Caps how many paragraphs the model writes each turn.',
  },
  markdownFormatting: {
    label: 'Markdown Formatting',
    description: 'Allows bold, lists, and tables in narration.',
  },

  // ── Display · Accessibility ─────────────────────────────────────────────────
  narrationFont: {
    label: 'Narration Font',
    description: 'Sets a separate typeface for the story text.',
    info: 'Includes typefaces tuned for **dyslexia** and **low vision**.',
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
    info: `Some models think privately before they write. Thinking modes add the same step. This setting shows that text as a collapsible **"Thinking…"** note above the narration.

The text is saved either way. Turn this on later, and past turns show theirs too.`,
  },
  showSilentRequests: {
    label: 'Show Silent Requests',
    description: 'Shows background requests in the status bar and context viewer.',
    info: `The silent requests are **memory summaries**, **character diaries**, and notes on new characters.

An aid for world authoring and debugging.`,
  },

  // ── Output · Turn Extras ────────────────────────────────────────────────────
  systemPrompts: {
    label: 'System Prompts',
    description: 'Chooses which follow-up requests run after each turn.',
    info: 'Each item is its own request after the narration. Turn one off and that feature stops: choice buttons, stat changes, or detected moves. Its editor under **Prompts** hides too.',
  },
  moveAutomatically: {
    label: 'Move Automatically',
    description: 'Resolves the move before the scene is written.',
    info: 'Your action\'s move applies first, so the scene is narrated in the new location. The "Move to…?" confirmation is skipped.',
  },

  // ── Output · Reasoning ──────────────────────────────────────────────────────
  thinking: {
    label: 'Thinking',
    description: 'Sets how the AI plans a turn before writing it.',
  },
  limitActiveCharacters: {
    label: 'Limit Active Characters',
    description: 'Caps how many characters the director stages per turn.',
    info: `- Each staged character adds its **own request**
- Off lets the scene stage as many as it needs`,
  },
  nativeReasoning: {
    label: 'Native Reasoning',
    description: 'Sets how hard reasoning models think per request.',
    // The caveat that used to close all eight effort levels, said once for the whole control.
    info: 'Some models think privately before they answer. This sets how much effort they spend. Models without native reasoning ignore it.',
  },

  // ── Output · Memory ─────────────────────────────────────────────────────────
  memorySummaries: {
    label: 'Memory Summaries',
    description: 'Condenses older turns so long stories stay coherent.',
    info: `Recent turns stay word for word; older ones shrink to a summary the AI still reads.

Runs one extra request per turn. Edit its prompt under **Prompts → Summaries**.`,
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
    description: 'Caps how many memories the AI sees each turn.',
    info: `Only the most relevant memories stay, even when more would fit.

- Smaller, sharper prompts on long stories
- The story opening and the newest memories always stay
- Off keeps everything that fits`,
  },
  sceneRecall: {
    label: 'Scene Recall',
    description: 'Recalls a full past scene when your action returns to it.',
    experimental: true,
    info: `Go back to someone you made a promise to, and the AI rereads the original scene word for word, marked as the past.

- At most **two scenes** per turn
- Never near-duplicates of each other or of recent turns
- Uses Semantic Memory's model and memories`,
  },
  timeInMemory: {
    label: 'Time in Memory',
    description: 'Records when each memory happened.',
    experimental: true,
    info: `Each memory carries a stamp like *"Day 3, evening — two days ago"*, and the recap states the present moment.

- Without it, the AI sees an undated list and guesses how long ago things were
- Time of day stays coarse (*morning*, *evening*), never a clock reading
- Uses the game clock shown in the Log`,
  },
  measuredClock: {
    label: 'Measured Clock',
    description: 'Measures how much story time each turn takes.',
    experimental: true,
    info: `Without it, every action costs a flat **one hour**. With it, the turn's events set the cost.

- A few spoken words cost minutes; a night's rest costs hours; *"three weeks later"* costs three weeks
- Adds one small request per turn, next to choices and stat updates
- Feeds the Log's clock, stat regeneration, and Time in Memory`,
  },
  semanticLore: {
    label: 'Semantic Lore',
    description: 'Activates dictionary entries by meaning, not just keywords.',
    experimental: true,
    info: `Write *"the ruined tower"* and an *Old Beacon* entry can wake with none of its keywords present.

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
    info: `As turns age out, each character present writes a **first-person diary entry**. A character's recent entries feed its motivation.

Runs one extra request per participant. Edit its prompt under **Prompts → Diary**.`,
  },
  diaryRecall: {
    label: 'Diary Recall',
    description: 'Recalls older diary entries relevant to the moment.',
    experimental: true,
    info: `Characters recall the older entries most relevant to the moment, not only their newest ones. She remembers the last time you drew a blade.

- Same total entry count, so it costs **nothing extra**
- Uses Semantic Memory's model`,
  },

  // ── Output · Choices ────────────────────────────────────────────────────────
  continueTheStory: {
    label: 'Continue the Story',
    description: 'Adds a choice that nudges the story forward.',
    info: `A **[Continue the Story]** button sits under the choices. Press it and the turn runs with that text as your action. The story reads it as a nudge to keep going, not as something your character does.

**Always** keeps the button even when the Choices request is off.`,
  },

  // ── Output · Performance ────────────────────────────────────────────────────
  concurrentRequests: {
    label: 'Concurrent Requests',
    description: 'Runs each turn’s follow-up requests at the same time.',
    info: `Choices, stat updates, and the location change go out together instead of one after another.

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
    description: 'Generates an image of every turn automatically.',
    info: `The image renders after the turn's text is done. Your next action waits for it, because one GPU cannot run the image model and the text model at the same time. Each turn then takes as long as your image server needs.

You can still generate a single scene manually from the button above the story.`,
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
      detail: 'No limit is sent. A reply that hits **Max Output Tokens** stops at the last full sentence, so a long turn can stop without a real ending.',
    },
    { value: 'single', label: 'Single', help: 'One paragraph per turn, stopping at the first line break.' },
    {
      value: 'auto', label: 'Auto', recommended: true,
      help: 'Scales the paragraph count to your Max Output Tokens.',
      detail: 'The paragraph count is scaled to your **Max Output Tokens**, so the model plans an ending that fits the budget.',
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
