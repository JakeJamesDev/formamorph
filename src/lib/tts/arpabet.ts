import arpabet from "./arpabet.json";

const phones: Record<string, string> = arpabet.phones;
const stressedPhones: Record<string, string> = arpabet.stressedPhones;
const stressMarks: Record<string, string> = arpabet.stressMarks;
const flap = new RegExp(arpabet.flap.pattern, "g");

/** Splits one `cmudict.dict` line into word and pronunciation; a blank line gives null. */
export function parseCmudictLine(line: string): [word: string, pronunciation: string] | null {
  const [word, ...phones] = line.split("#")[0].trim().split(/\s+/);
  return word ? [word, phones.join(" ")] : null;
}

/** Turns one CMUdict pronunciation, such as `B AH1 T ER0`, into Kokoro notation, such as `bˈʌɾəɹ`. */
export function arpabetToKokoro(pronunciation: string): string {
  const out = pronunciation.trim().split(/\s+/).map((token) => {
    const match = /^([A-Z]+)([012])?$/.exec(token);
    const phone = match && phones[match[1]];
    if (!match || !phone) throw new Error(`Unknown CMUdict phone "${token}".`);
    const stress = match[2];
    const stressed = stress && stress !== "0" ? stressedPhones[match[1]] : undefined;
    return (stressMarks[stress] ?? "") + (stressed ?? phone);
  });
  return out.join("").replace(flap, arpabet.flap.replacement);
}
