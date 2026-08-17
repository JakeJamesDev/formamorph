/**
 * What the Bench remembers about a world's findings between sessions: which ones the author has already been
 * shown, and which ones they muted. Bench-local like every other piece of Bench state — one localStorage
 * record keyed by world id, never a byte of it in the world itself.
 *
 * A finding's identity is its rule plus the items it names, so the same problem about the same items stays
 * the same finding across recomputes. The seen record also holds what the finding *said*: editing a named
 * item changes its wording, which raises it as new again, so a stale mark can never hide a fresh defect.
 */
import type { Finding } from './rules';

const STORAGE_KEY = 'FORMAMORPH_benchFindingState';

export interface BenchWorldState {
  /** The source version the seen-set was recorded against. A downloaded world updating clears the set. */
  source?: string;
  /** Identity → the finding's wording when it was last marked seen. */
  seen: Record<string, string>;
  /** The identities the author muted. */
  dismissed: string[];
}

/** A finding placed against the seen record: what it is, and whether the author has been shown it. */
export interface MarkedFinding extends Finding {
  identity: string;
  isNew: boolean;
}

export const EMPTY_BENCH_STATE: BenchWorldState = { seen: {}, dismissed: [] };

/** Order-insensitive so reordering a world's lists can't make an old finding read as a new one. */
export const findingIdentity = (finding: Finding): string =>
  [finding.ruleId, ...finding.items.map((item) => item.id).sort()].join('|');

// FNV-1a, so the record stores a few characters per finding rather than every message in full.
const hash = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
};

/** What the finding currently says — its message and the names it uses. This is what an edit changes. */
const wording = (finding: Finding): string =>
  hash(JSON.stringify([finding.message, ...finding.items.map((item) => item.name)]));

const mark = (finding: Finding, state: BenchWorldState): MarkedFinding => {
  const identity = findingIdentity(finding);
  return { ...finding, identity, isNew: state.seen[identity] !== wording(finding) };
};

/** The findings the Issues list shows, and the ones the author muted, each marked new-or-known. */
export function partitionFindings(findings: Finding[], state: BenchWorldState): {
  live: MarkedFinding[];
  dismissed: MarkedFinding[];
} {
  const muted = new Set(state.dismissed);
  const live: MarkedFinding[] = [];
  const dismissed: MarkedFinding[] = [];
  for (const finding of findings) {
    const marked = mark(finding, state);
    (muted.has(marked.identity) ? dismissed : live).push(marked);
  }
  return { live, dismissed };
}

/**
 * `state` with every one of `findings` recorded as shown, or `state` itself when they all already were.
 * Merges rather than replaces: a finding that disappears mid-edit and comes back is still known.
 */
export function withSeen(state: BenchWorldState, findings: Finding[]): BenchWorldState {
  const seen = { ...state.seen };
  let changed = false;
  for (const finding of findings) {
    const identity = findingIdentity(finding);
    const said = wording(finding);
    if (seen[identity] === said) continue;
    seen[identity] = said;
    changed = true;
  }
  return changed ? { ...state, seen } : state;
}

/** `state` with `findings` muted. Dismissals key on identity alone, so a rename doesn't un-mute them. */
export function withDismissed(state: BenchWorldState, findings: Finding[]): BenchWorldState {
  const dismissed = new Set(state.dismissed);
  const before = dismissed.size;
  for (const finding of findings) dismissed.add(findingIdentity(finding));
  return dismissed.size === before ? state : { ...state, dismissed: [...dismissed] };
}

/** `state` with `findings` audible again. */
export function withRestored(state: BenchWorldState, findings: Finding[]): BenchWorldState {
  const lifted = new Set(findings.map(findingIdentity));
  const dismissed = state.dismissed.filter((identity) => !lifted.has(identity));
  return dismissed.length === state.dismissed.length ? state : { ...state, dismissed };
}

/**
 * `state` carrying `source` as the version its marks belong to. A *different* known version means the
 * world's content changed underneath the marks, so the seen-set goes — an update's own defects have to read
 * as new. Dismissals are the author's own judgment and survive.
 *
 * An unknown version leaves the record untouched: the world's metadata arrives asynchronously, and reading
 * "no source" as "the source changed" would wipe a downloaded world's marks every time the editor opened
 * ahead of it. Learning a version for the first time only records it — the marks were made against the
 * content that is already there.
 */
export function withSource(state: BenchWorldState, source: string | undefined): BenchWorldState {
  if (source === undefined || state.source === source) return state;
  return state.source === undefined ? { ...state, source } : { ...state, source, seen: {} };
}

const readAll = (): Record<string, BenchWorldState> => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, BenchWorldState>)
      : {};
  } catch {
    return {};
  }
};

/** The stored state for one world, sanitized — a hand-edited or half-written record reads as no marks. */
export function readBenchState(worldId: string): BenchWorldState {
  const stored: unknown = readAll()[worldId];
  if (!stored || typeof stored !== 'object') return EMPTY_BENCH_STATE;
  const { source, seen, dismissed } = stored as Partial<BenchWorldState>;
  return {
    ...(typeof source === 'string' ? { source } : {}),
    seen: seen && typeof seen === 'object' && !Array.isArray(seen) ? seen : {},
    dismissed: Array.isArray(dismissed) ? dismissed.filter((id): id is string => typeof id === 'string') : [],
  };
}

export function writeBenchState(worldId: string, state: BenchWorldState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [worldId]: state }));
  } catch {
    // A full or blocked localStorage costs findings reading as new next session, nothing else.
  }
}
