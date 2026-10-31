/** The entities the player added from entity blocks since the last help question, which the next question names. */
let added: string[] = [];

/** Records one Add. */
export function noteEntityAdded(name: string): void {
  added = [...added, name];
}

/** Puts back the names of a question that never reached the AI, ahead of any added since. */
export function restoreEntityAdds(names: readonly string[]): void {
  added = [...names, ...added];
}

/** The names added since the last call, oldest first. Taking them clears the list. */
export function takeEntityAdds(): string[] {
  const names = added;
  added = [];
  return names;
}
