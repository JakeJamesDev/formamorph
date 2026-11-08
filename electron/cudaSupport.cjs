// Can this machine run llama-server's CUDA 13.4 build? Pure policy over the facts nvidia-smi reports.
// The one home of the floors: every consumer reads this verdict and never re-derives it.

/** Compute capabilities whose code ships precompiled in the CUDA build. */
const PRECOMPILED = new Set(['8.6', '8.9', '12.0', '12.1']);
/** Driver branch floors: CUDA 13 minor-version compatibility, and the PTX ISA of the build's compiler. */
const DRIVER_FLOOR_PRECOMPILED = 580;
const DRIVER_FLOOR_PTX = 615;
const MIN_CAPABILITY = [7, 5];

/** "8.9" → [8, 9]; null when nvidia-smi gave anything else (e.g. "[N/A]"). */
function parseCapability(text) {
  const m = /^(\d+)\.(\d+)$/.exec(String(text ?? '').trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** "616.92" → 616; null when unreadable. */
function parseDriverBranch(text) {
  const m = /^(\d+)(?:\.\d+)*$/.exec(String(text ?? '').trim());
  return m ? Number(m[1]) : null;
}

function judgeCard(card) {
  const cap = parseCapability(card?.computeCap);
  if (!cap) return { ok: false, reason: 'support-unknown' };
  if (cap[0] < MIN_CAPABILITY[0] || (cap[0] === MIN_CAPABILITY[0] && cap[1] < MIN_CAPABILITY[1])) {
    return { ok: false, reason: 'card-too-old' };
  }
  const branch = parseDriverBranch(card?.driverVersion);
  if (branch == null) return { ok: false, reason: 'support-unknown' };
  const floor = PRECOMPILED.has(`${cap[0]}.${cap[1]}`) ? DRIVER_FLOOR_PRECOMPILED : DRIVER_FLOOR_PTX;
  if (branch < floor) return { ok: false, reason: 'driver-too-old', driverFloor: floor };
  return { ok: true };
}

/**
 * The verdict for a list of NVIDIA cards (`{ name, driverVersion, computeCap }`), or null when the facts
 * could not be read. Every card must pass; the first failing card gives the reason.
 *
 * Returns `{ supported: true }` or `{ supported: false, reason, cardName?, driverFloor? }` with `reason` one of
 * `no-nvidia-card`, `card-too-old`, `driver-too-old`, `support-unknown`.
 */
function evaluateCudaSupport(cards) {
  if (cards == null) return { supported: false, reason: 'support-unknown' };
  if (!Array.isArray(cards) || cards.length === 0) return { supported: false, reason: 'no-nvidia-card' };
  for (const card of cards) {
    const verdict = judgeCard(card);
    if (!verdict.ok) {
      const { ok, ...rest } = verdict;
      return { supported: false, ...rest, cardName: card?.name ?? null };
    }
  }
  return { supported: true };
}

module.exports = { evaluateCudaSupport };
