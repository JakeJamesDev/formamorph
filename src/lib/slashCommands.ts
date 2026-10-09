import { REVEAL_TEST_PROFILES } from './revealTestScripts';

export interface SlashCommand {
  /** First token after the `/`, lowercased. */
  command: string;
  /** Remaining whitespace-separated tokens. */
  args: string[];
}

/**
 * Parse a player-input slash command. Returns `null` when `input` isn't a slash command, otherwise
 * the lowercased command name and its arguments. The seam the in-game command system grows on.
 */
export function parseSlashCommand(input: string): SlashCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return { command: parts[0].toLowerCase(), args: parts.slice(1) };
}

/** One level of the command tree: each key is a word, and its value holds the words that can follow it. */
export interface SlashCommandTree { [word: string]: SlashCommandTree }

const leaves = (words: string[]): SlashCommandTree => Object.fromEntries(words.map((w) => [w, {}]));
const PROFILES = Object.keys(REVEAL_TEST_PROFILES);

/** Every command the action box runs, for completion. Commands list alphabetically, arguments in order. */
export const SLASH_COMMANDS: SlashCommandTree = {
  choices: { test: leaves(PROFILES) },
  markdown: { test: leaves(['render', ...PROFILES]) },
};

/** The word under the caret, from `start` to `end`, and the words that complete it. */
export interface SlashCompletion {
  start: number;
  end: number;
  items: string[];
}

/** What can complete the word at `caret` in a slash command, or null outside one. */
export function slashCompletion(value: string, caret: number, tree: SlashCommandTree = SLASH_COMMANDS): SlashCompletion | null {
  if (!value.startsWith('/')) return null;
  const before = value.slice(1, caret);
  if (/\n/.test(before)) return null;
  const words = before.split(' ');
  const typed = words.pop() ?? '';
  let node = tree;
  for (const word of words.filter(Boolean)) {
    const next = node[word.toLowerCase()];
    if (!next) return null;
    node = next;
  }
  const start = caret - typed.length;
  const end = start + (/^\S*/.exec(value.slice(start))?.[0].length ?? 0);
  const prefix = typed.toLowerCase();
  const items = Object.keys(node).filter((word) => word.startsWith(prefix));
  // A word typed in full needs no list, so Enter still sends.
  if (items.length === 1 && items[0] === value.slice(start, end).toLowerCase()) return { start, end, items: [] };
  return { start, end, items };
}

/** `value` with the completed word in place, and the caret after it. A word with arguments gets a space. */
export function applySlashCompletion(
  value: string, completion: SlashCompletion, word: string, tree: SlashCommandTree = SLASH_COMMANDS,
): { value: string; caret: number } {
  const path = value.slice(1, completion.start).split(' ').filter(Boolean).map((w) => w.toLowerCase());
  const node = path.reduce<SlashCommandTree>((at, w) => at[w] ?? {}, tree);
  const hasArgs = Object.keys(node[word] ?? {}).length > 0;
  const rest = value.slice(completion.end);
  const space = hasArgs && !rest.startsWith(' ') ? ' ' : '';
  const head = value.slice(0, completion.start) + word + space;
  return { value: head + rest, caret: head.length + (hasArgs && !space ? 1 : 0) };
}
