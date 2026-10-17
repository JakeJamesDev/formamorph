/** The status line while requests wait on Tool calls: each Tool named once, in call order. Null with none. */
export function toolCallStatus(rounds: readonly (readonly string[])[]): string | null {
  const names = [...new Set(rounds.flat())];
  return names.length ? `Calling ${names.join(', ')}…` : null;
}
