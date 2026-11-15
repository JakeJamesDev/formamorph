/** DEV only: serves the staff side of `CorefContributionService` from an in-memory queue, beside the review stub. */
import CorefContributionService, { type CorefContribution } from '@/services/CorefContributionService';

const STUBBED_KEYS = ['fetchQueue', 'fetchCount', 'accept', 'reject'] as const satisfies readonly (keyof typeof CorefContributionService)[];
type Stubbed = Pick<typeof CorefContributionService, (typeof STUBBED_KEYS)[number]>;

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

/** A pending contribution over a passage written for the fixture. `fix` names each corrected piece and its entity. */
function contribution(id: string, passage: string, clusters: string[][], clusterEntities: (string | null)[], fixes: [string, string | null, 'mention' | 'quote'][], hours: number): CorefContribution {
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
  };
}

/** The queue the stub starts from. */
export function devMentionsFixtures(): CorefContribution[] {
  return [
    contribution('dev-mention-1',
      'Mira set the lantern down beside the courier. “You’re late,” she said. He shrugged and handed her the letter.',
      [['Mira', 'she', 'her'], ['the courier', 'He']], ['mira', null],
      [['the courier', 'kessa', 'mention'], ['He', 'kessa', 'mention']], 6),
    contribution('dev-mention-2',
      'The ferryman waited at the dock. “No coin, no crossing,” the old man said, and the girl stepped back.',
      [['The ferryman', 'the old man'], ['the girl']], ['ferryman', null],
      [['“No coin, no crossing,”', 'ferryman', 'quote'], ['the girl', null, 'mention']], 2),
  ];
}

function devMentionsMethods(start: CorefContribution[]): Stubbed {
  let queue = start;
  const decide = async (id: string) => { queue = queue.filter((c) => c.id !== id); };
  return {
    fetchQueue: async () => queue,
    fetchCount: async () => queue.length,
    accept: decide,
    reject: decide,
  };
}

/** Shadows the class methods while `wanted`; deleting the shadows restores them. */
export function syncDevMentionsStub(wanted: boolean): void {
  if (wanted) Object.assign(CorefContributionService, devMentionsMethods(devMentionsFixtures()));
  else for (const key of STUBBED_KEYS) delete (CorefContributionService as Partial<Stubbed>)[key];
}
