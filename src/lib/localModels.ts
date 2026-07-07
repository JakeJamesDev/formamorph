// Curated GGUF models the desktop build can download and run locally, grouped by the VRAM tier they
// comfortably fit (weights + a working context). All are community roleplay/uncensored models; URLs and
// sizes verified against the Hugging Face API. Licenses are informational hints — vet before shipping.
// The engine (electron/llmEngine.cjs) can load any GGUF; this is just the offered set.

export type VramTier = 'tier4' | 'tier8' | 'tier16' | 'unlimited';

export const VRAM_TIERS: { value: VramTier; label: string; maxMB: number }[] = [
  { value: 'tier4', label: '≤4 GB', maxMB: 4500 },
  { value: 'tier8', label: '≤8 GB', maxMB: 8500 },
  { value: 'tier16', label: '≤16 GB', maxMB: 16500 },
  { value: 'unlimited', label: 'No Limit', maxMB: Infinity },
];

/** Highest tier whose models comfortably fit the given total VRAM (MB); used to auto-select the tab. */
export function tierForVram(totalMB: number): VramTier {
  if (totalMB >= 22000) return 'unlimited';
  if (totalMB >= 14000) return 'tier16';
  if (totalMB >= 7000) return 'tier8';
  return 'tier4';
}

export interface LocalModelInfo {
  /** Stable id used in UI state. */
  id: string;
  name: string;
  /** Parameter count label, e.g. '12B'. */
  params: string;
  /** Quantization label, e.g. 'Q4_K_M'. */
  quant: string;
  /** VRAM tier this model targets. */
  tier: VramTier;
  /** Filename saved into the models folder (also the served model id once loaded). */
  fileName: string;
  /** Direct Hugging Face resolve URL for the GGUF. */
  url: string;
  /** Approximate download size in bytes. */
  sizeBytes: number;
  /** One-line description of the model's character. */
  note: string;
  /** License summary (informational — redistribution matters for the paid release). */
  license: string;
}

const hf = (repo: string, file: string) => `https://huggingface.co/${repo}/resolve/main/${file}`;

// Verified against the HF API (filenames, sizes, download popularity) July 2026. Newest-generation
// architectures (Gemma-4) should load on node-llama-cpp 3.19 (a late-June-2026 llama.cpp) but confirm at
// runtime. Reasoning models (default `<think>`) are deliberately kept out — see the note below the tier-4
// block. Refresh this list periodically; the RP scene moves fast.
export const LOCAL_MODELS: LocalModelInfo[] = [
  // ≤4 GB — 2-4B
  {
    id: 'gemmasutra-small-4b', name: 'Gemmasutra Small 4B', params: '4B', quant: 'Q4_K_M', tier: 'tier4',
    fileName: 'Gemmasutra-Small-4B-v1a-Q4_K_M.gguf',
    url: hf('TheDrummer/Gemmasutra-Small-4B-v1-GGUF', 'Gemmasutra-Small-4B-v1a-Q4_K_M.gguf'),
    sizeBytes: 2_460_000_000, note: 'TheDrummer’s Gemma-based RP — small but capable.', license: 'Gemma Terms',
  },
  {
    id: 'impish-llama-4b', name: 'Impish LLAMA 4B', params: '4B', quant: 'Q4_K_M', tier: 'tier4',
    fileName: 'Impish_LLAMA_V2-Q4_K_M.gguf',
    url: hf('SicariusSicariiStuff/Impish_LLAMA_4B_GGUF', 'Impish_LLAMA_V2-Q4_K_M.gguf'),
    sizeBytes: 2_780_000_000, note: 'Sicarius’s compact roleplay model.', license: 'Llama 3.2',
  },
  {
    id: 'gemmasutra-mini-2b', name: 'Gemmasutra Mini 2B', params: '2B', quant: 'Q4_K_M', tier: 'tier4',
    fileName: 'Gemmasutra-Mini-2B-v1-Q4_K_M.gguf',
    url: hf('TheDrummer/Gemmasutra-Mini-2B-v1-GGUF', 'Gemmasutra-Mini-2B-v1-Q4_K_M.gguf'),
    sizeBytes: 1_710_000_000, note: 'Tiny RP model for minimal VRAM.', license: 'Gemma Terms',
  },

  // ≤8 GB — 8-9B
  // NOTE: reasoning models (Qwen3.x-style default `<think>`) are intentionally excluded — Formamorph has
  // no reasoning-block UI yet, so they misbehave here (they're fine in clients like SillyTavern that
  // collapse the thinking). See memory `reasoning-model-support`. Only add non-reasoning models below.
  {
    id: 'gemma4-e4b-uncensored', name: 'Gemma-4 E4B Uncensored', params: 'E4B', quant: 'Q4_K_M', tier: 'tier8',
    fileName: 'Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf',
    url: hf('HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive', 'Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf'),
    sizeBytes: 5_340_000_000, note: 'Current Gemma-4 uncensored small model (newest-gen arch).', license: 'Gemma Terms',
  },
  {
    id: 'wingless-imp-8b', name: 'Wingless Imp 8B', params: '8B', quant: 'Q4_K_M', tier: 'tier8',
    fileName: 'Wingless_Imp_8B.Q4_K_M.gguf',
    url: hf('mradermacher/Wingless_Imp_8B-GGUF', 'Wingless_Imp_8B.Q4_K_M.gguf'),
    sizeBytes: 4_920_000_000, note: 'Uncensored 8B with strong prose.', license: 'Llama 3.1',
  },
  {
    id: 'anubis-mini-8b', name: 'Anubis Mini 8B', params: '8B', quant: 'Q4_K_M', tier: 'tier8',
    fileName: 'Anubis-Mini-8B-v1h-Q4_K_M.gguf',
    url: hf('TheDrummer/Anubis-Mini-8B-v1-GGUF', 'Anubis-Mini-8B-v1h-Q4_K_M.gguf'),
    sizeBytes: 4_920_000_000, note: 'TheDrummer’s compact RP 8B (Llama 3.3).', license: 'Llama 3.3',
  },

  // ≤16 GB — 12-24B
  {
    id: 'cydonia-24b-v43', name: 'Cydonia 24B v4.3', params: '24B', quant: 'Q4_K_M', tier: 'tier16',
    fileName: 'Cydonia-24B-v4zg-Q4_K_M.gguf',
    url: hf('TheDrummer/Cydonia-24B-v4.3-GGUF', 'Cydonia-24B-v4zg-Q4_K_M.gguf'),
    sizeBytes: 14_330_000_000, note: 'TheDrummer’s current flagship RP 24B.', license: 'Apache 2.0',
  },
  {
    id: 'paintedfantasy-24b', name: 'Painted Fantasy 24B v4.1', params: '24B', quant: 'Q4_K_M', tier: 'tier16',
    fileName: 'MS3.2-PaintedFantasy-v4.1-24B-Q4_K_M.gguf',
    url: hf('zerofata/MS3.2-PaintedFantasy-v4.1-24B-GGUF', 'MS3.2-PaintedFantasy-v4.1-24B-Q4_K_M.gguf'),
    sizeBytes: 14_330_000_000, note: 'zerofata’s vivid, scene-driven RP 24B.', license: 'Apache 2.0',
  },
  {
    id: 'rocinante-x-12b', name: 'Rocinante-X 12B', params: '12B', quant: 'Q4_K_M', tier: 'tier16',
    fileName: 'Rocinante-X-12B-v1b-Q4_K_M.gguf',
    url: hf('TheDrummer/Rocinante-X-12B-v1-GGUF', 'Rocinante-X-12B-v1b-Q4_K_M.gguf'),
    sizeBytes: 7_480_000_000, note: 'Newer Rocinante — reliable, well-rounded 12B.', license: 'Apache 2.0',
  },
  {
    id: 'impish-bloodmoon-12b', name: 'Impish Bloodmoon 12B', params: '12B', quant: 'Q4_K_M', tier: 'tier16',
    fileName: 'Impish_Bloodmoon-Q4_K_M.gguf',
    url: hf('SicariusSicariiStuff/Impish_Bloodmoon_12B_GGUF', 'Impish_Bloodmoon-Q4_K_M.gguf'),
    sizeBytes: 7_480_000_000, note: 'Sicarius’s current 12B RP model.', license: 'Apache 2.0',
  },

  // No Limit — 26B MoE / 31B / 72B / 70B  (Qwen3.x reasoning MoEs excluded — see the note above.)
  {
    id: 'dark-scarlett-26b', name: 'Dark Scarlett 26B-A4B', params: '26B-A4B', quant: 'Q4_K_M', tier: 'unlimited',
    fileName: 'Dark-Scarlett-v0.3-26B-A4B-Q4_K_M.gguf',
    url: hf('ReadyArt/Dark-Scarlett-v0.3-26B-A4B-GGUF', 'Dark-Scarlett-v0.3-26B-A4B-Q4_K_M.gguf'),
    sizeBytes: 16_800_000_000, note: 'Popular current RP MoE — fast (Gemma-4, newest-gen arch).', license: 'Gemma Terms',
  },
  {
    id: 'skyfall-31b', name: 'Skyfall 31B v4.2', params: '31B', quant: 'Q4_K_M', tier: 'unlimited',
    fileName: 'Skyfall-31B-v4y-Q4_K_M.gguf',
    url: hf('TheDrummer/Skyfall-31B-v4.2-GGUF', 'Skyfall-31B-v4y-Q4_K_M.gguf'),
    sizeBytes: 18_980_000_000, note: 'Upscaled 31B for richer, longer writing.', license: 'Apache 2.0',
  },
  {
    id: 'magnum-v4-72b', name: 'Magnum v4 72B', params: '72B', quant: 'Q4_K_M', tier: 'unlimited',
    fileName: 'magnum-v4-72b-Q4_K_M.gguf',
    url: hf('bartowski/magnum-v4-72b-GGUF', 'magnum-v4-72b-Q4_K_M.gguf'),
    sizeBytes: 47_420_000_000, note: 'Anthracite’s acclaimed Magnum RP series (Qwen2.5 72B); heavy VRAM.', license: 'Qwen License',
  },
  {
    id: 'euryale-70b', name: 'Euryale 70B v2.3', params: '70B', quant: 'Q4_K_M', tier: 'unlimited',
    fileName: 'L3.3-70B-Euryale-v2.3-Q4_K_M.gguf',
    url: hf('bartowski/L3.3-70B-Euryale-v2.3-GGUF', 'L3.3-70B-Euryale-v2.3-Q4_K_M.gguf'),
    sizeBytes: 42_520_000_000, note: 'Elite 70B roleplay; heavy VRAM (needs partial offload on 24 GB).', license: 'Llama 3.3',
  },
];

/** Human-readable size, GB-aware (the shared imageOptim.formatBytes tops out at MB). */
export function formatModelSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}
