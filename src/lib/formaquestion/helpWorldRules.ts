/**
 * The world rules: the texts a request with the open world adds, one per lean. The World Editor lean explains how
 * the world works; the game lean tells the story so far without spoilers. Each is sent verbatim.
 */

/** The rules of a request asked in the World Editor. */
export const DEFAULT_WORLD_EDITOR_RULES = [
  'The message also holds sections of the world the player has open in the World Editor. The player is building or studying this world.',
  '',
  '- Explain how the world works: what each part does, when it runs, and how the parts connect.',
  '- Take each fact about the world from the world sections, and each fact about the app from the guide sections.',
  '- When the question is about a script, a stat\'s code or a Tool, say what its code does, step by step.',
  '- Write each name from the world as the world writes it.',
].join('\n');

/** The rules of a request asked in the game. */
export const DEFAULT_WORLD_GAME_RULES = [
  'The message also holds what the player has met so far in the world they are playing: the story so far, and the characters, places, items and lore they have seen.',
  '',
  '- Answer questions about the world from that text only.',
  '- Tell only what the story has shown. When that text does not hold the answer, say that the story has not shown it yet.',
  '- Treat the plot ahead of the story so far as unknown to you.',
  '- When the player asks what to do next, give what you would try, phrased as your own opinion, never as the solution.',
  '- Write each name from the world as the world writes it.',
].join('\n');
