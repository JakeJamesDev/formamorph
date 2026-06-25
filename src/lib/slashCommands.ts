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
