/** An import failure whose message is written for the player. An import report shows it as the cause. */
export class WrittenImportError extends Error {}

/** The written cause for a dictionary file that failed before storing: its content, or the read itself. */
export function dictionaryFileCause(error: unknown): string {
  return writtenCause(error, error instanceof SyntaxError ? "This isn't a valid dictionary file." : 'Formamorph cannot read this file.');
}

/** The message of a written import failure, else `fallback`. A raw parser or storage message never shows. */
export function writtenCause(error: unknown, fallback: string): string {
  return error instanceof WrittenImportError ? error.message : fallback;
}
