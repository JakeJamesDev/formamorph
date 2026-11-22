/** DEV only: serves the staff side of `CorefContributionService` from an in-memory queue, beside the review stub. */
import CorefContributionService, { type CorefContribution } from '@/services/CorefContributionService';
import type { MentionCorrection } from '@/lib/coref/mentionCorrections';

const STUBBED_KEYS = ['fetchQueue', 'fetchCount', 'fetchCounts', 'rejectNoChange', 'accept', 'reject'] as const satisfies readonly (keyof typeof CorefContributionService)[];
type Stubbed = Pick<typeof CorefContributionService, (typeof STUBBED_KEYS)[number]>;

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

/** A pending contribution over a passage written for the fixture. `fix` names each corrected piece and its entity;
 *  `names` holds the entity names it sent. */
function contribution(id: string, passage: string, clusters: string[][], clusterEntities: (string | null)[], fixes: [string, string | null, MentionCorrection['kind']][], names: Record<string, string>, hours: number): CorefContribution {
  const at = (piece: string): [number, number] => {
    const start = passage.indexOf(piece);
    if (start < 0) throw new Error(`"${piece}" not in the fixture passage`);
    return [start, start + piece.length];
  };
  return {
    id, contributorUsername: 'Lantern Keeper', state: 'pending', createdAt: hoursAgo(hours),
    worldId: 'dev-world', passage, modelId: 'small', modelVersion: 2,
    clusters: clusters.map((pieces) => pieces.map(at)), clusterEntities,
    corrections: fixes.map(([piece, entityId, kind]) => ({ kind, start: at(piece)[0], end: at(piece)[1], entityId })),
    entityNames: names,
  };
}

/** The span of `piece` in `passage`. */
const spanOf = (passage: string, piece: string): { start: number; end: number } => {
  const start = passage.indexOf(piece);
  if (start < 0) throw new Error(`"${piece}" not in the fixture passage`);
  return { start, end: start + piece.length };
};

/** The queue the stub starts from. */
export function devMentionsFixtures(): CorefContribution[] {
  const ferry = 'The ferryman waited at the dock. “No coin, no crossing,” the old man said, and the girl stepped back.';
  const lamp = 'Mira set the lantern down. “Stay close,” she said. “I’ll go first.”';
  const quote = (passage: string, piece: string, speakerId: string | null, rule: string, mention: string | null, firstPerson: string[]) => ({
    ...spanOf(passage, piece), speakerId, rule, mention: mention === null ? null : spanOf(passage, mention), firstPerson: firstPerson.map((p) => spanOf(passage, p)),
  });
  return [
    { ...contribution('dev-mention-1',
      'Mira set the lantern down beside the courier. “You’re late,” she said. He shrugged and handed her the letter.',
      [['Mira', 'she', 'her'], ['the courier', 'He']], ['mira', null],
      [['the courier', 'kessa', 'mention'], ['He', 'kessa', 'mention'], ['her', 'kessa', 'mention']], { mira: 'Mira Vell', kessa: 'Kessa' }, 6),
    changesLabels: true, derivedLabels: [] },
    { ...contribution('dev-mention-2', ferry,
      [['The ferryman', 'the old man'], ['the girl']], ['ferryman', null],
      [['“No coin, no crossing,”', 'ferryman', 'quote'], ['the girl', null, 'mention'], ['the old man', null, 'nonMention']], {}, 2),
    changesLabels: true, derivedLabels: [],
    quotes: [quote(ferry, '“No coin, no crossing,”', null, 'after-verb-subject', 'the old man', [])] },
    { ...contribution('dev-mention-3', lamp,
      [['Mira'], ['she']], ['mira', null],
      [['“Stay close,”', 'kessa', 'quote']], { mira: 'Mira Vell', kessa: 'Kessa' }, 1),
    changesLabels: true,
    derivedLabels: [{ ...spanOf(lamp, 'she'), entityId: 'kessa', wholeCluster: true }],
    quotes: [quote(lamp, '“Stay close,”', 'mira', 'pronoun-subject', 'she', [])] },
    { ...contribution('dev-mention-4', lamp,
      [['Mira', 'she']], ['mira'],
      [['“Stay close,”', 'mira', 'quote']], { mira: 'Mira Vell' }, 0.5),
    changesLabels: false, derivedLabels: [],
    quotes: [quote(lamp, '“Stay close,”', 'mira', 'after-subject-verb', 'she', [])] },
  ];
}

function devMentionsMethods(start: CorefContribution[]): Stubbed {
  let queue = start;
  const decide = async (id: string) => { queue = queue.filter((c) => c.id !== id); };
  return {
    fetchQueue: async () => queue,
    fetchCount: async () => queue.length,
    fetchCounts: async () => ({ pending: queue.length, noChange: queue.filter((c) => c.changesLabels === false).length }),
    rejectNoChange: async () => {
      const before = queue.length;
      queue = queue.filter((c) => c.changesLabels !== false);
      return before - queue.length;
    },
    accept: decide,
    reject: decide,
  };
}

/** Shadows the class methods while `wanted`; deleting the shadows restores them. */
export function syncDevMentionsStub(wanted: boolean): void {
  if (wanted) Object.assign(CorefContributionService, devMentionsMethods(devMentionsFixtures()));
  else for (const key of STUBBED_KEYS) delete (CorefContributionService as Partial<Stubbed>)[key];
}
