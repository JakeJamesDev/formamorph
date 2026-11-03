import { arpabetToKokoro, parseCmudictLine } from "./arpabet";
import { toBritish } from "./britishRules";
import { isHomograph, pickHomographs } from "./homographs";
import { cleanText } from "./textCleanup";
import compoundWords from "./g2p/compoundWords.json";
import britishWords from "./g2p/britishWords.json";
import weakForms from "./g2p/weakForms.json";
import wordTable from "./g2p/wordTable.json";

export type Accent = "a" | "b";

export interface TextToPhonemesSources {
  /** The result of `parseDictionary`. */
  dictionary: Map<string, string>;
  /** Answers a lowercase word that no other source has. */
  predict: (word: string) => Promise<string>;
}

const MIN_PART = 3;
const COMMON_PART = 4;
const TOKEN = /(?<![\p{L}-])\p{L}(?:-\p{L})+(?![\p{L}-])(?:'s\b)?|[\p{L}']+|[;:,.!?—…"()]+|\s+/gu;
const PHRASE_END = /^[;:,.!?—…)]/;
const SPELLED_RUN = /^(\p{L}(?:-\p{L})+)('s)?$/u;
const NOT_A_WORD = /^[^\p{L}']/u;
const VOICELESS_END = /[ptkfθ]$/;
const SIBILANT_END = /[szʃʒʧʤ]$/;
/** -ss and -us endings are the word's own, as in moss and Marcus. */
const NO_BARE_S = /(?:ss|us)$/i;
const TENS = /^(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)$/i;
const ONES = /^(?:one|two|three|four|five|six|seven|eight|nine)$/i;
/** After these, "will" is the noun, as in "his will". */
const BEFORE_NOUN_WILL = /^(?:a|an|the|his|her|my|your|our|their|its|own|free|good|ill|last)$/i;

const table = new Map<string, string>(Object.entries(wordTable));
const british = new Map<string, string>(Object.entries(britishWords));
const weak = new Map(Object.entries(weakForms).map(([word, form]) => [word, arpabetToKokoro(form)]));
const commonShort = new Set<string>(compoundWords);

/** Reads the text of `cmudict.dict` into each word's first pronunciation, plus the `word(n)` entries of homographs. */
export function parseDictionary(text: string): Map<string, string> {
  const primary = new Map<string, string>();
  for (const line of text.split("\n")) {
    const entry = parseCmudictLine(line);
    if (!entry) continue;
    const variantOf = /^(.+)\(\d+\)$/.exec(entry[0])?.[1];
    if (!variantOf || isHomograph(variantOf)) primary.set(entry[0], entry[1]);
  }
  return primary;
}

function endingFor(stem: string): string {
  if (SIBILANT_END.test(stem)) return "ɪz";
  return VOICELESS_END.test(stem) ? "s" : "z";
}

/** A British list word, or its regular plural or possessive, as in tomatoes. */
function fromBritishList(lower: string): string | undefined {
  const hit = british.get(lower);
  if (hit !== undefined) return hit;
  const ending = /^(.+?)(?:'s|es|s)$/.exec(lower);
  const stem = ending && (british.get(ending[1]) ?? british.get(`${ending[1]}e`));
  return stem ? stem + endingFor(stem) : undefined;
}

/**
 * Builds the text-to-phoneme call. Each word takes the first source that has it:
 * word table, CMUdict with its homograph picks, compound split, a regular ending on one of those, then the model.
 * British rules apply to every source's result, so word table entries stay American.
 */
export function createTextToPhonemes({ dictionary: primary, predict }: TextToPhonemesSources) {
  const said = new Map<string, string>();
  const predicted = new Map<string, Promise<string>>();

  const fromDictionary = (word: string): string | undefined => {
    const entry = primary.get(word);
    return entry === undefined ? undefined : arpabetToKokoro(entry);
  };

  const isSplitPart = (part: string) => primary.has(part) && (part.length >= COMMON_PART || commonShort.has(part));

  const fromSplit = (word: string): string | undefined => {
    let best: [string, string] | undefined;
    let bestShortest = 0;
    for (let at = MIN_PART; at <= word.length - MIN_PART; at++) {
      const first = word.slice(0, at);
      const second = word.slice(at);
      const shortest = Math.min(first.length, second.length);
      if (shortest > bestShortest && isSplitPart(first) && isSplitPart(second)) {
        best = [first, second];
        bestShortest = shortest;
      }
    }
    if (!best) return undefined;
    return fromDictionary(best[0])! + fromDictionary(best[1])!.replace(/ˈ/g, "ˌ");
  };

  const spell = (letters: string, inAccent?: (letter: string, name: string) => string): string => {
    const names = [...letters.toLowerCase()].map((letter) => {
      const name = letter === "a" ? "ˈA" : fromDictionary(letter) ?? "";
      return inAccent ? inAccent(letter, name) : name;
    });
    return names.map((name, i) => (i < names.length - 1 ? name.replace(/ˈ/g, "ˌ") : name)).join("");
  };

  /** Short capitals, and capitals with no vowel, read as letters when no dictionary has them. */
  const fromCapitals = (word: string, inAccent?: (letter: string, name: string) => string): string | undefined => {
    if (!/^[A-Z]{2,5}$/.test(word)) return undefined;
    return word.length <= 3 || !/[AEIOUY]/.test(word) ? spell(word, inAccent) : undefined;
  };

  /** Letters take the rules one at a time, so an /r/ in R stays out of the next letter's vowel. */
  const britishCapitals = (word: string): string | undefined => {
    const lower = word.toLowerCase();
    const known = table.get(lower) ?? fromDictionary(lower);
    return known === undefined || known === fromCapitals(word) ? fromCapitals(word, toBritish) : undefined;
  };

  const fromListed = (word: string): string | undefined => {
    const lower = word.toLowerCase();
    return table.get(lower) ?? fromDictionary(lower) ?? fromCapitals(word);
  };

  const fromKnown = (word: string): string | undefined => fromListed(word) ?? fromSplit(word.toLowerCase());

  const fromEnding = (word: string, source: (stem: string) => string | undefined): string | undefined => {
    const owned = /^(.+)'s$/i.exec(word)?.[1];
    const stem = owned ?? (/s$/i.test(word) && !NO_BARE_S.test(word) ? word.slice(0, -1) : undefined);
    if (!stem || stem.length < MIN_PART) return undefined;
    const known = source(stem);
    return known === undefined ? undefined : known + endingFor(known);
  };

  const fromModel = (word: string): Promise<string> => {
    const lower = word.toLowerCase();
    let pending = predicted.get(lower);
    if (!pending) {
      pending = predict(lower).catch((error: unknown) => {
        predicted.delete(lower);
        throw error;
      });
      predicted.set(lower, pending);
    }
    return pending;
  };

  const sayWord = async (word: string): Promise<string> => {
    const hit = said.get(word);
    if (hit !== undefined) return hit;
    // An ending on a listed word comes before a split, so barrow's never reads as bar + row's.
    const phonemes = fromListed(word) ?? fromEnding(word, fromListed) ?? fromSplit(word.toLowerCase()) ?? fromEnding(word, fromKnown) ?? await fromModel(word);
    said.set(word, phonemes);
    return phonemes;
  };

  return async function textToPhonemes(text: string, accent: Accent = "a"): Promise<string> {
    const inAccent = (word: string, american: string) => (accent === "b" ? toBritish(word, american) : american);
    const cleaned = cleanText(text);
    const picks = pickHomographs(cleaned);
    const matches = [...cleaned.matchAll(TOKEN)];
    const tokens = matches.map((match) => match[0]);
    let out = "";
    let afterWord = false;
    let insideQuote = false;
    let previous = "";
    for (const [i, token] of tokens.entries()) {
      if (NOT_A_WORD.test(token)) {
        out += /^\s/.test(token) ? " " : token;
        afterWord = false;
        if (!/^\s/.test(token)) previous = "";
        if (token.split('"').length % 2 === 0) insideQuote = !insideQuote;
        continue;
      }
      const word = token.replace(/^'+|'+$/g, "");
      if (!word) continue;
      // A dropped hyphen or symbol between two words still separates them.
      if (afterWord) out += " ";
      afterWord = true;
      const run = SPELLED_RUN.exec(word);
      if (run) {
        const letters = spell(run[1].replace(/-/g, ""), inAccent);
        out += run[2] ? letters + endingFor(letters) : letters;
      } else {
        const next = tokens.slice(i + 1).find((later) => !/^\s/.test(later));
        const strong = next === undefined || PHRASE_END.test(next) || (insideQuote && next.startsWith('"'));
        const shouted = word.length > 1 && word === word.toUpperCase();
        // A capital "Will" is a name or a question, so only lowercase "will" reduces.
        const fullWill = /^will$/i.test(word) && (word !== "will" || BEFORE_NOUN_WILL.test(previous));
        // A weak "you" at the start of a phrase sounds cut off.
        const fullYou = previous === "" && /^you$/i.test(word);
        // "It" and "them" stay light at a phrase end, as in "melt it", unless they stand alone.
        const lightEnd = previous !== "" && /^(?:it|them)$/i.test(word);
        const reduced = (strong && !lightEnd) || shouted || fullWill || fullYou ? undefined : weak.get(word.toLowerCase());
        const listed = accent === "b" && reduced === undefined ? fromBritishList(word.toLowerCase()) ?? britishCapitals(word) : undefined;
        const start = matches[i].index + token.indexOf(word);
        const pick = table.has(word.toLowerCase()) ? undefined : picks.get(start);
        const spoken = listed ?? inAccent(word, reduced ?? (pick && fromDictionary(pick)) ?? await sayWord(word));
        // Ninety-nine runs together, with its stress on the tens.
        if (TENS.test(previous) && ONES.test(word)) out = out.trimEnd() + spoken.replace(/ˈ/g, "ˌ");
        else out += spoken;
      }
      previous = word;
    }
    return out.replace(/ +/g, " ").trim();
  };
}
