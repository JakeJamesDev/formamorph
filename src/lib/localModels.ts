// Curated GGUF models the desktop build can download and run locally, grouped by the VRAM tier they
// comfortably fit (weights + a working context). All are community roleplay finetunes; URLs, sizes,
// release dates, and download snapshots verified against the Hugging Face API. Licenses are informational
// hints — vet before shipping. The engine (electron/llmEngine.cjs) can load any GGUF; this is just the
// offered set.

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
  /** Release month as `YYYY-MM` (HF createdAt) — a currency signal; static, since creation is immutable. */
  released: string;
  /** All-time download count snapshot (HF), the fallback shown until live counts load. See DOWNLOADS_AS_OF. */
  downloads: number;
  /** True for native-reasoning models (default `<think>`) — surfaced as a badge so users pair them with
   *  the per-prompt reasoning-budget control. The engine handles both kinds identically; this is a UI hint. */
  reasoning?: boolean;
}

const hf = (repo: string, file: string) => `https://huggingface.co/${repo}/resolve/main/${file}`;

/** Month the `downloads` snapshots below were captured, for the "as of" label when live counts are offline. */
export const DOWNLOADS_AS_OF = '2026-07';

// Verified against the HF API (filenames, sizes, release dates, all-time downloads) July 2026. All entries
// are genuine roleplay finetunes — the two flagged `reasoning: true` are RP finetunes on reasoning bases
// (Qwen3 / Qwen3.6-A3B); the local engine handles the thought segment (per-prompt budget → node-llama-cpp
// `budgets.thoughtTokens`, with `<think>` reconstruction). Refresh this list periodically; the RP scene moves fast.
export const LOCAL_MODELS: LocalModelInfo[] = [
  // ≤4 GB — 2-4B
  {
    id: 'qwen3-4b-rpg-roleplay', name: 'Qwen3-4B RPG Roleplay v2', params: '4B', quant: 'Q4_K_M', tier: 'tier4',
    fileName: 'Qwen3-4B-RPG-Roleplay-V2-Q4_K_M.gguf',
    url: hf('Chun121/Qwen3-4B-RPG-Roleplay-V2', 'unsloth.Q4_K_M.gguf'),
    sizeBytes: 2_500_000_000, note: 'Tiny reasoning RP model — experimental at this size; may loop.', license: 'MIT',
    released: '2025-07', downloads: 120_108, reasoning: true,
  },
  {
    id: 'gemmasutra-small-4b', name: 'Gemmasutra Small 4B', params: '4B', quant: 'Q4_K_M', tier: 'tier4',
    fileName: 'Gemmasutra-Small-4B-v1a-Q4_K_M.gguf',
    url: hf('TheDrummer/Gemmasutra-Small-4B-v1-GGUF', 'Gemmasutra-Small-4B-v1a-Q4_K_M.gguf'),
    sizeBytes: 2_460_000_000, note: 'TheDrummer’s Gemma-based RP — small but capable.', license: 'Gemma Terms',
    released: '2025-03', downloads: 111_174,
  },
  {
    id: 'impish-llama-4b', name: 'Impish LLAMA 4B', params: '4B', quant: 'Q4_K_M', tier: 'tier4',
    fileName: 'Impish_LLAMA_V2-Q4_K_M.gguf',
    url: hf('SicariusSicariiStuff/Impish_LLAMA_4B_GGUF', 'Impish_LLAMA_V2-Q4_K_M.gguf'),
    sizeBytes: 2_780_000_000, note: 'Sicarius’s compact roleplay model.', license: 'Llama 3.2',
    released: '2025-07', downloads: 20_245,
  },
  {
    id: 'gemmasutra-mini-2b', name: 'Gemmasutra Mini 2B', params: '2B', quant: 'Q4_K_M', tier: 'tier4',
    fileName: 'Gemmasutra-Mini-2B-v1-Q4_K_M.gguf',
    url: hf('TheDrummer/Gemmasutra-Mini-2B-v1-GGUF', 'Gemmasutra-Mini-2B-v1-Q4_K_M.gguf'),
    sizeBytes: 1_710_000_000, note: 'Tiny RP model for minimal VRAM.', license: 'Gemma Terms',
    released: '2024-08', downloads: 1_244_993,
  },

  // ≤8 GB — 8B
  {
    id: 'wingless-imp-8b', name: 'Wingless Imp 8B', params: '8B', quant: 'Q4_K_M', tier: 'tier8',
    fileName: 'Wingless_Imp_8B.Q4_K_M.gguf',
    url: hf('mradermacher/Wingless_Imp_8B-GGUF', 'Wingless_Imp_8B.Q4_K_M.gguf'),
    sizeBytes: 4_920_000_000, note: 'Uncensored 8B with strong prose.', license: 'Llama 3.1',
    released: '2025-02', downloads: 3_446,
  },
  {
    id: 'anubis-mini-8b', name: 'Anubis Mini 8B', params: '8B', quant: 'Q4_K_M', tier: 'tier8',
    fileName: 'Anubis-Mini-8B-v1h-Q4_K_M.gguf',
    url: hf('TheDrummer/Anubis-Mini-8B-v1-GGUF', 'Anubis-Mini-8B-v1h-Q4_K_M.gguf'),
    sizeBytes: 4_920_000_000, note: 'TheDrummer’s compact RP 8B (Llama 3.3).', license: 'Llama 3.3',
    released: '2026-01', downloads: 12_035,
  },
  {
    id: 'stheno-8b-v34', name: 'Stheno v3.4 8B', params: '8B', quant: 'Q4_K_M', tier: 'tier8',
    fileName: 'Llama-3.1-8B-Stheno-v3.4-Q4_K_M.gguf',
    url: hf('bartowski/Llama-3.1-8B-Stheno-v3.4-GGUF', 'Llama-3.1-8B-Stheno-v3.4-Q4_K_M.gguf'),
    sizeBytes: 4_920_000_000, note: 'Sao10K’s classic 8B RP finetune — the 8B roleplay standard.', license: 'CC-BY-NC 4.0',
    released: '2024-09', downloads: 41_900,
  },
  {
    id: 'lunaris-8b-v1', name: 'Lunaris v1 8B', params: '8B', quant: 'Q4_K_M', tier: 'tier8',
    fileName: 'L3-8B-Lunaris-v1-Q4_K_M.gguf',
    url: hf('bartowski/L3-8B-Lunaris-v1-GGUF', 'L3-8B-Lunaris-v1-Q4_K_M.gguf'),
    sizeBytes: 4_920_000_000, note: 'Sao10K’s well-rounded RP/creativity 8B blend.', license: 'Llama 3',
    released: '2024-06', downloads: 153_645,
  },

  // ≤16 GB — 12-24B
  {
    id: 'cydonia-24b-v43', name: 'Cydonia 24B v4.3', params: '24B', quant: 'Q4_K_M', tier: 'tier16',
    fileName: 'Cydonia-24B-v4zg-Q4_K_M.gguf',
    url: hf('TheDrummer/Cydonia-24B-v4.3-GGUF', 'Cydonia-24B-v4zg-Q4_K_M.gguf'),
    sizeBytes: 14_330_000_000, note: 'TheDrummer’s flagship RP 24B; optional [THINK] prefill.', license: 'Apache 2.0',
    released: '2025-11', downloads: 116_605,
  },
  {
    id: 'paintedfantasy-24b', name: 'Painted Fantasy 24B v4.1', params: '24B', quant: 'Q4_K_M', tier: 'tier16',
    fileName: 'MS3.2-PaintedFantasy-v4.1-24B-Q4_K_M.gguf',
    url: hf('zerofata/MS3.2-PaintedFantasy-v4.1-24B-GGUF', 'MS3.2-PaintedFantasy-v4.1-24B-Q4_K_M.gguf'),
    sizeBytes: 14_330_000_000, note: 'zerofata’s vivid, scene-driven RP 24B.', license: 'Apache 2.0',
    released: '2026-02', downloads: 8_578,
  },
  {
    id: 'rocinante-x-12b', name: 'Rocinante-X 12B', params: '12B', quant: 'Q4_K_M', tier: 'tier16',
    fileName: 'Rocinante-X-12B-v1b-Q4_K_M.gguf',
    url: hf('TheDrummer/Rocinante-X-12B-v1-GGUF', 'Rocinante-X-12B-v1b-Q4_K_M.gguf'),
    sizeBytes: 7_480_000_000, note: 'Newer Rocinante — reliable, well-rounded 12B.', license: 'Apache 2.0',
    released: '2026-01', downloads: 44_913,
  },
  {
    id: 'impish-bloodmoon-12b', name: 'Impish Bloodmoon 12B', params: '12B', quant: 'Q4_K_M', tier: 'tier16',
    fileName: 'Impish_Bloodmoon-Q4_K_M.gguf',
    url: hf('SicariusSicariiStuff/Impish_Bloodmoon_12B_GGUF', 'Impish_Bloodmoon-Q4_K_M.gguf'),
    sizeBytes: 7_480_000_000, note: 'Sicarius’s current 12B RP model.', license: 'Apache 2.0',
    released: '2025-12', downloads: 32_488,
  },

  // No Limit — 31B / 35B MoE / 70B
  {
    id: 'qwen36-35b-a3b-anko', name: 'Qwen3.6 35B-A3B Anko', params: '35B-A3B', quant: 'Q4_K_M', tier: 'unlimited',
    fileName: 'allura-org_Qwen3.6-35B-A3B-Anko-Q4_K_M.gguf',
    url: hf('bartowski/allura-org_Qwen3.6-35B-A3B-Anko-GGUF', 'allura-org_Qwen3.6-35B-A3B-Anko-Q4_K_M.gguf'),
    sizeBytes: 21_390_000_000, note: 'Allura’s RP finetune of Qwen3.6 — reasoning MoE, smart and characterful.', license: 'Apache 2.0',
    released: '2026-04', downloads: 26_028, reasoning: true,
  },
  {
    id: 'skyfall-31b', name: 'Skyfall 31B v4.2', params: '31B', quant: 'Q4_K_M', tier: 'unlimited',
    fileName: 'Skyfall-31B-v4y-Q4_K_M.gguf',
    url: hf('TheDrummer/Skyfall-31B-v4.2-GGUF', 'Skyfall-31B-v4y-Q4_K_M.gguf'),
    sizeBytes: 18_980_000_000, note: 'Upscaled 31B for richer, longer writing.', license: 'Apache 2.0',
    released: '2026-02', downloads: 34_448,
  },
  {
    id: 'euryale-70b', name: 'Euryale 70B v2.3', params: '70B', quant: 'Q4_K_M', tier: 'unlimited',
    fileName: 'L3.3-70B-Euryale-v2.3-Q4_K_M.gguf',
    url: hf('bartowski/L3.3-70B-Euryale-v2.3-GGUF', 'L3.3-70B-Euryale-v2.3-Q4_K_M.gguf'),
    sizeBytes: 42_520_000_000, note: 'Elite 70B roleplay; heavy VRAM (needs partial offload on 24 GB).', license: 'Llama 3.3',
    released: '2024-12', downloads: 38_367,
  },
];

/** The HF repo id for a model, parsed from its resolve URL — the key for live download-count lookups. */
export function repoOf(m: LocalModelInfo): string {
  return m.url.replace('https://huggingface.co/', '').split('/resolve/')[0];
}

/** `'2026-04'` → `'Apr 2026'`. Returns the input unchanged if it isn't a `YYYY-MM` string. */
export function formatReleased(ym: string): string {
  const [y, mo] = ym.split('-').map(Number);
  if (!y || !mo || mo < 1 || mo > 12) return ym;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[mo - 1]} ${y}`;
}

/** Compact download count: 1_244_993 → '1.2M', 41_900 → '41.9K', 900 → '900'. */
export function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Human-readable size, GB-aware (the shared imageOptim.formatBytes tops out at MB). */
export function formatModelSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}
