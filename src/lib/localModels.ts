// Curated GGUF models the desktop build can download and run locally, grouped by the VRAM tier they
// comfortably fit (weights + a working context). URLs, sizes, release dates, and download snapshots verified
// against the Hugging Face API. Licenses are informational hints — vet before shipping. The engine
// (electron/llmEngine.cjs) can load any GGUF; this is just the offered set.
//
// Eligibility: entries are judged per-model on measured quality, not on carrying a roleplay-finetune label.
// General decensored models are eligible — a controlled probe (same base, RP finetune vs decensored-only)
// found no willingness or prose advantage from RP-tuning; tier and per-model quality dominated. Screen a
// candidate before adding it: `npm run screen -- --model <label>` (testing/baseline/GATE-PROBE.md).
// Every entry below happens to be an RP finetune — that's history, not a requirement.

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

// Verified against the HF API (filenames, sizes, release dates, all-time downloads) July 2026. Entries here
// all happen to be roleplay finetunes — that's history, not an entry requirement (see the eligibility note at
// the top of this file). The one flagged `reasoning: true` is an RP finetune on a reasoning base
// (Qwen3.6-A3B); the local engine handles the thought segment (per-prompt budget → node-llama-cpp
// `budgets.thoughtTokens`, with `<think>` reconstruction). That handling is not a guarantee at small sizes —
// the 4B reasoning entry was cut for returning empty narrations, so screen any reasoning candidate before
// adding it. Refresh this list periodically; the scene moves fast.
export const LOCAL_MODELS: LocalModelInfo[] = [
  // ≤4 GB — 2-4B
  // Thin by design, not by neglect: the 2026-07-17 screen (3 seeds each, gate world, built-in engine) cut
  // Qwen3-4B RPG Roleplay v2, Gemmasutra Small 4B, and Gemmasutra Mini 2B — all three missed the location
  // router's 90% gate (60/77/67%), and the Qwen3 one returned an empty narration on ~2 in 9 runs, which
  // stalls the turn loop outright. Impish is the only ≤4GB entry that cleared the gate, and only just (93%).
  // Backfilling this tier needs candidates that survive `npm run screen` — see testing/baseline/GATE-PROBE.md.
  {
    id: 'impish-llama-4b', name: 'Impish LLAMA 4B', params: '4B', quant: 'Q4_K_M', tier: 'tier4',
    fileName: 'Impish_LLAMA_V2-Q4_K_M.gguf',
    url: hf('SicariusSicariiStuff/Impish_LLAMA_4B_GGUF', 'Impish_LLAMA_V2-Q4_K_M.gguf'),
    sizeBytes: 2_780_000_000, note: 'Sicarius’s compact roleplay model.', license: 'Llama 3.2',
    released: '2025-07', downloads: 20_245,
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
    id: 'g4-meromero-31b', name: 'G4 MeroMero 31B', params: '31B', quant: 'Q4_K_M', tier: 'unlimited',
    fileName: 'G4-MeroMero-31B-Q4_K_M.gguf',
    url: hf('zerofata/G4-MeroMero-31B-gguf', 'G4-MeroMero-31B-Q4_K_M.gguf'),
    sizeBytes: 18_690_000_000, note: 'Gemma-4 31B RP finetune — top screen scorer; the one model that keeps stats quiet on idle turns.', license: 'Apache 2.0',
    released: '2026-05', downloads: 6_492,
  },
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
  // Pick the unit from the *rounded* value: 999_960 would otherwise land in the K branch and render
  // '1000.0K' instead of '1.0M'.
  if (n >= 999_950) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Human-readable size, GB-aware (the shared imageOptim.formatBytes tops out at MB). */
export function formatModelSize(bytes: number): string {
  // Every boundary picks its unit from the *rounded* value, as formatDownloads does: 999_960_000 would
  // otherwise render '1000 MB' instead of '1.0 GB', and 999_500 '1000 KB' instead of '1 MB'.
  if (bytes >= 999_500_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 999_500) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}
