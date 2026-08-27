// Which GPU the bundled engine is allowed to use. Pure policy: given the devices the backend enumerated,
// the GPUs nvidia-smi reports, and the user's setting, decide the single device index to pin to.
//
// Why pin at all: with several Vulkan adapters visible, llama.cpp aggregates their memory into one budget,
// so a discrete card beside an integrated GPU sizes every load against a figure belonging to neither — the
// reported machine saw 47.8 GB total and 0 GB free while nvidia-smi showed 14.7 GB free on the card alone.
// One visible adapter means the figure is that adapter's own.
//
// Nothing else decides: llmEngine.cjs applies whatever index this returns, and null means "leave llama.cpp's
// own default alone", which is what a machine that can't be told apart gets.

/** The setting value meaning "let the policy choose". Anything else is a device name to pin to. */
const ENGINE_DEVICE_AUTO = 'auto';
/** The setting value meaning "no pin at all": every visible device stays in play (multi-GPU splitting). */
const ENGINE_DEVICE_ALL = 'all';

/**
 * Names that only ever belong to an integrated GPU. Matched against the normalized name, so `(R)`/`(TM)`
 * and spacing differences between the two sources never reach these.
 */
const INTEGRATED_PATTERNS = [
  // Intel's integrated lines are named for the chip generation, never for a card model.
  /\bintel\b.*\b(uhd|hd|iris)\b/,
  // Intel Arc without a card model (A770, B580) is the integrated part of a recent mobile chip.
  /\bintel\b.*\barc\b(?!.*\b[ab]\d{3}\b)/,
  // An AMD APU's graphics: "Radeon(TM) Graphics", "Radeon(TM) Vega 8 Graphics" — never an RX card.
  /\bradeon\b(?!.*\brx\b).*\bgraphics\b/,
];

/** Reduce a device name to what the two sources agree on: lowercase words, no vendor punctuation. */
function normalize(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\((r|tm)\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Do a Vulkan device name and an nvidia-smi GPU name refer to the same card? Containment either way covers
 *  the qualifiers only one source carries (nvidia-smi's "Laptop GPU" suffix, Vulkan's vendor prefix). */
function namesMatch(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

const isIntegrated = (name) => {
  const norm = normalize(name);
  return INTEGRATED_PATTERNS.some((re) => re.test(norm));
};

/** The automatic pick: an index, or null when no device can be singled out with confidence. */
function autoPick(deviceNames, nvidiaGpus) {
  // One adapter is no aggregate — there is nothing for a pin to fix, so don't change what llama.cpp does.
  if (deviceNames.length < 2) return null;
  // The problem being fixed is an integrated GPU polluting the memory budget of the one real card. So
  // count the *real* cards — an nvidia-smi match, or any name the integrated patterns don't claim — and
  // pin only when exactly one stands beside identifiable integrated ones. Two or more real cards is a
  // configuration llama.cpp handles by design (Max layers splits a model across them); pinning one would
  // silently halve that machine's VRAM, which is worse than the bug.
  const real = [];
  deviceNames.forEach((name, index) => {
    const matchesNvidia = nvidiaGpus.some((gpu) => namesMatch(name, gpu && gpu.name));
    if (matchesNvidia || !isIntegrated(name)) real.push(index);
  });
  return real.length === 1 ? real[0] : null;
}

/**
 * Resolve the device pin for one engine start.
 *
 * `deviceNames` is the backend's enumeration in index order, `nvidiaGpus` the nvidia-smi rows (empty when
 * nvidia-smi is missing), `setting` either the auto sentinel or a device name the user chose.
 *
 * Returns the index to restrict the backend to (null = leave it unfiltered) and where the pick came from:
 * `auto`, `manual`, or `fallback-auto` when a chosen device no longer exists.
 */
function selectEngineDevice({ deviceNames, nvidiaGpus, setting } = {}) {
  const names = Array.isArray(deviceNames) ? deviceNames : [];
  const gpus = Array.isArray(nvidiaGpus) ? nvidiaGpus : [];
  const wanted = typeof setting === 'string' ? setting : ENGINE_DEVICE_AUTO;

  // Explicitly unfiltered: the escape hatch for a machine Auto pins (a dGPU+iGPU rig whose owner wants
  // llama.cpp splitting across both anyway).
  if (wanted === ENGINE_DEVICE_ALL) return { index: null, origin: null };

  if (wanted !== ENGINE_DEVICE_AUTO) {
    // Resolved by name against the current enumeration, so a driver change that reorders the indices
    // doesn't silently move the pin to a different card. Matched exactly, not normalized: the setting was
    // written from this same enumeration, and the picker compares it the same way — a looser match here
    // would pin a device the row was calling missing. A name that really did change spelling falls back to
    // Auto, which is the answer for a device that no longer exists either way.
    const chosen = names.indexOf(wanted);
    if (chosen !== -1) return { index: chosen, origin: 'manual' };
    return { index: autoPick(names, gpus), origin: 'fallback-auto' };
  }

  const index = autoPick(names, gpus);
  return { index, origin: index == null ? null : 'auto' };
}

module.exports = { selectEngineDevice, ENGINE_DEVICE_AUTO, ENGINE_DEVICE_ALL };
