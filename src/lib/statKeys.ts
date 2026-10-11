/** The key beside a stat's key that holds the change to its maximum. */
export const maxKeyOf = (key: string): string => `${key} max`;

/** Unique keys for one owner's stats, in order. A stat takes its plain name and that name's max key, or the
 *  first numbered name whose pair is free, so a stat named "Vigor max" never lands on Vigor's max key. */
export function statKeys(plainNames: readonly string[]): string[] {
  const taken = new Set<string>();
  return plainNames.map((plain) => {
    const base = plain || 'Stat';
    let key = base;
    for (let n = 2; taken.has(key) || taken.has(maxKeyOf(key)); n++) key = `${base} (${n})`;
    taken.add(key).add(maxKeyOf(key));
    return key;
  });
}
