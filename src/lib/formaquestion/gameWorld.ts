/**
 * The world Formaquestion reads in game: the Player View as a World Index, the story so far, and the dictionary
 * entries that fire on that context (Q9, Q12). Nothing here reads past the Player View or saves anything.
 */
import type { DictionaryEntry } from '@/types';
import { explainActivation, type ScanSource } from '@/lib/dictionaryUtils';
import { applySemanticLore, selectSemanticLore } from '@/lib/semanticDictionary';
import type { PlayerView } from './playerView';
import type { StorySoFar } from './storySoFar';
import type { WorldSource } from './helpWorldSource';
import { worldIndexOfPages, type WorldIndex, type WorldPage } from './worldIndex';

/** The game's world for one question, as the open-world registration hands it over. */
export interface GameWorldInput {
  view: PlayerView;
  story: StorySoFar;
  /** The entries the narration reads, with the scripts' lore toggles applied. */
  lore: readonly DictionaryEntry[];
  /** Entry vectors by `entryVectorKey` while Semantic Lore is on; null while it is off. */
  loreVectors: Map<string, Float32Array> | null;
  /** Resolves placeholder chips the way the player sees them. */
  resolve: (text: string) => string;
}

/** Builds the markdown of one row from its lines; blank lines drop out. */
const lines = (...parts: (string | false | undefined)[]): string => parts.filter((part): part is string => !!part && part.trim() !== '').join('\n\n');

const source = (worldKind: WorldSource['worldKind'], id: string, name: string): WorldSource => ({ kind: 'world', worldKind, id, name });

/** One page per Player View row, in player text. */
export function playerViewPages(view: PlayerView): WorldPage[] {
  const trail = (ownerId: string | undefined): string[] => {
    const owner = ownerId ? view.entities.find((row) => row.id === ownerId)?.name : undefined;
    return owner ? [owner] : [];
  };
  return [
    ...view.entities.map((row) => ({
      source: source('entity', row.id, row.name), trail: [],
      markdown: lines(`# ${row.name}`, row.player && 'The player', row.seenAliases?.length ? `Also seen as: ${row.seenAliases.join(', ')}` : undefined, row.description),
    })),
    ...view.locations.map((row) => ({
      source: source('location', row.id, row.name), trail: [],
      markdown: lines(`# ${row.name}`, row.current && 'Where the player is now', row.description),
    })),
    ...view.items.map((row) => ({
      source: source('item', row.id, row.name), trail: [],
      markdown: lines(`# ${row.name}`, row.description),
    })),
    ...view.stats.map((row) => ({
      source: source('stat', row.id, row.name), trail: trail(row.ownerId),
      markdown: lines(`# ${row.name}`, `Value: ${row.value} (from ${row.min} to ${row.max})`, row.band),
    })),
    ...view.traits.map((row) => ({
      source: source('trait', row.id, row.name), trail: trail(row.ownerId),
      markdown: lines(`# ${row.name}`, 'A trait the player has', row.description),
    })),
  ];
}

/** A fired entry as its world source. */
export const loreSource = (entry: DictionaryEntry): WorldSource => source('dictionary', entry.id, entry.name || entry.key[0] || 'Entry');

/** The page of one fired entry: its name and its text as the narration reads it. */
const lorePage = (entry: DictionaryEntry, resolve: GameWorldInput['resolve']): WorldPage => {
  const named = loreSource(entry);
  return { source: named, trail: [], markdown: lines(`# ${named.name}`, resolve(entry.value)) };
};

/**
 * The entries that fire on the question's context, with the narration's activation: keywords over the question,
 * the Player View text and the memories, and over the recent turns as history; then meaning against the question.
 */
export function firedLore(game: GameWorldInput, question: string, questionVector: Float32Array | null): DictionaryEntry[] {
  const lore = [...game.lore];
  const viewText = playerViewPages(game.view).map((page) => page.markdown).join('\n\n');
  const scene: ScanSource[] = [
    { region: 'question', text: question },
    { region: 'playerView', text: viewText },
    { region: 'memories', text: game.story.memories },
  ];
  const history = game.story.turns.flatMap((turn, i): ScanSource[] => [
    { region: `story:${i}:action`, text: turn.action },
    { region: `story:${i}:narration`, text: turn.narration },
  ]);
  const report = explainActivation(lore, scene, { history });
  if (questionVector && game.loreVectors) {
    applySemanticLore(report, selectSemanticLore(lore, questionVector, game.loreVectors));
  }
  return lore.filter((entry) => entry.enabled !== false && report.byId.get(entry.id)?.activated);
}

/** The game's World Index: the Player View rows and the fired entries, each its own item. */
export function gameWorldIndex(game: GameWorldInput, fired: readonly DictionaryEntry[]): WorldIndex {
  return worldIndexOfPages([...fired.map((entry) => lorePage(entry, game.resolve)), ...playerViewPages(game.view)]);
}
