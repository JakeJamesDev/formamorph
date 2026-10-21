/** The line of a dropped kind of write, or none when no names are left. */
export const droppedLine = (lead: string, names: readonly string[] | undefined): string[] =>
  (names?.length ? [`${lead} Writes ignored: ${names.join(', ')}.`] : []);

/** The line of the read-only fields a run wrote, or none. Test Code and a user Tool's Try It list them alike (Q44). */
export const readOnlyWritesLines = (paths: readonly string[] | undefined): string[] => droppedLine('Read-only fields.', paths);
