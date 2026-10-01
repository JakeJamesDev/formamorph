/**
 * The check that every player-facing surface has a component that reports it. It reads source text, so
 * a report must name its surface with a literal at the place it is made.
 */
import type { SurfaceId } from '@/lib/docs/surfaceMap';

const HELP_WINDOW = 'The help window is over the surface the player needs help with, so it does not report itself.';
const NARRATION_LAYOUT = 'A display setting, not a place the player is in. The game screen and its side tab say where the player is.';

/** Player-facing surfaces that no component reports, each with the reason. */
export const UNREPORTED_SURFACES: Partial<Record<SurfaceId, string>> = {
  formaquestion: HELP_WINDOW,
  'formaquestion.ask': HELP_WINDOW,
  'formaquestion.search': HELP_WINDOW,
  'formaquestion.guide': HELP_WINDOW,
  'gameViewerLayout.pages': NARRATION_LAYOUT,
  'gameViewerLayout.chat': NARRATION_LAYOUT,
  likePrompt: 'A card inside the game screen. A report would put it on top as a dialog and hide the game screen tab while the card shows.',
};

/** A prop or call that names a surface: a quoted literal, or an expression in braces. */
const VALUE = String.raw`(?:"([^"]+)"|\{([^}]*)\})`;
const ID_SITES = [new RegExp(String.raw`\bsurface=${VALUE}`, 'g'), new RegExp(String.raw`<SurfaceLayer\s+id=${VALUE}`, 'g')];
const LEDGER_SITES = [
  new RegExp(String.raw`\bsurfaceTabs=${VALUE}`, 'g'),
  new RegExp(String.raw`<SurfaceTab\s+ledger=${VALUE}`, 'g'),
  /\buseSurfaceTab\(\s*'([^']+)'/g,
];

/** The names at each match: the literal, or every quoted string in the expression. */
function namesAt(source: string, sites: readonly RegExp[]): string[] {
  return sites.flatMap((site) => [...source.matchAll(site)].flatMap(([, literal, expression]) => (
    literal ? [literal] : [...(expression ?? '').matchAll(/'([^']+)'/g)].map((quoted) => quoted[1])
  )));
}

/** The surface ids and tab ledgers that the given source files report. */
export function reportedSurfaces(sources: Record<string, string>): { ids: Set<string>; ledgers: Set<string> } {
  const texts = Object.values(sources);
  return {
    ids: new Set(texts.flatMap((text) => namesAt(text, ID_SITES))),
    ledgers: new Set(texts.flatMap((text) => namesAt(text, LEDGER_SITES))),
  };
}

export interface SurfaceReportInput {
  /** The player-facing surface ids. */
  surfaceIds: readonly string[];
  /** Source text by file path. */
  sources: Record<string, string>;
  /** Surfaces no component reports, with the reason. */
  unreported: Partial<Record<string, string>>;
}

/** One line per surface that no component reports and no reason covers, and per stale reason. */
export function surfaceReportProblems({ surfaceIds, sources, unreported }: SurfaceReportInput): string[] {
  const { ids, ledgers } = reportedSurfaces(sources);
  // A tab is reported through its ledger: the strip passes the active tab at run time.
  const isReported = (id: string) => ids.has(id) || (id.includes('.') && ledgers.has(id.slice(0, id.indexOf('.'))));
  const problems: string[] = [];
  for (const id of surfaceIds) {
    const listed = unreported[id] !== undefined;
    if (!isReported(id) && !listed) problems.push(`${id} is never reported: report it from its component, or list it as unreported with the reason`);
    if (isReported(id) && listed) problems.push(`${id} is listed as unreported, but a component reports it`);
  }
  for (const id of Object.keys(unreported)) {
    if (!surfaceIds.includes(id)) problems.push(`${id} is listed as unreported, but it is not a player-facing surface id`);
  }
  return problems;
}
