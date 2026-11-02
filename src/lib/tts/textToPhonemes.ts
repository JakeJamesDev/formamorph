import { arpabetToKokoro, parseCmudictLine } from "./arpabet";
import { cleanText } from "./textCleanup";
import compoundWords from "./g2p/compoundWords.json";
import weakForms from "./g2p/weakForms.json";
import wordTable from "./g2p/wordTable.json";

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

const table = new Map<string, string>(Object.entries(wordTable));
const weak = new Map(Object.entries(weakForms).map(([word, form]) => [word, arpabetToKokoro(form)]));
const commonShort = new Set<string>(compoundWords);

/** Reads the text of `cmudict.dict` into each word's first pronunciation. */
export function parseDictionary(text: string): Map<string, string> {
  const primary = new Map<string, string>();
  for (const line of text.split("\n")) {
    const entry = parseCmudictLine(line);
    if (entry && !entry[0].endsWith(")")) primary.set(entry[0], entry[1]);
  }
  return primary;
}

function endingFor(stem: string): string {
  if (SIBILANT_END.test(stem)) return "ɪz";
  return VOICELESS_END.test(stem) ? "s" : "z";
}

/**
 * Builds the American text-to-phoneme call. Each word takes the first source that has it:
 * word table, CMUdict, compound split, a regular ending on one of those, then the model.
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

  const spell = (letters: string): string => {
    const names = [...letters.toLowerCase()].map((letter) => (letter === "a" ? "ˈA" : fromDictionary(letter) ?? ""));
    return names.map((name, i) => (i < names.length - 1 ? name.replace(/ˈ/g, "ˌ") : name)).join("");
  };

  /** Short capitals, and capitals with no vowel, read as letters when no dictionary has them. */
  const fromCapitals = (word: string): string | undefined => {
    if (!/^[A-Z]{2,5}$/.test(word)) return undefined;
    return word.length <= 3 || !/[AEIOUY]/.test(word) ? spell(word) : undefined;
  };

  const fromKnown = (word: string): string | undefined => {
    const lower = word.toLowerCase();
    return table.get(lower) ?? fromDictionary(lower) ?? fromCapitals(word) ?? fromSplit(lower);
  };

  const fromEnding = (word: string): string | undefined => {
    const owned = /^(.+)'s$/i.exec(word)?.[1];
    const stem = owned ?? (/s$/i.test(word) && !NO_BARE_S.test(word) ? word.slice(0, -1) : undefined);
    if (!stem || stem.length < MIN_PART) return undefined;
    const known = fromKnown(stem);
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
    const phonemes = fromKnown(word) ?? fromEnding(word) ?? await fromModel(word);
    said.set(word, phonemes);
    return phonemes;
  };

  return async function textToPhonemes(text: string): Promise<string> {
    const tokens = cleanText(text).match(TOKEN) ?? [];
    let out = "";
    let afterWord = false;
    let insideQuote = false;
    for (const [i, token] of tokens.entries()) {
      if (NOT_A_WORD.test(token)) {
        out += /^\s/.test(token) ? " " : token;
        afterWord = false;
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
        const letters = spell(run[1].replace(/-/g, ""));
        out += run[2] ? letters + endingFor(letters) : letters;
      } else {
        const next = tokens.slice(i + 1).find((later) => !/^\s/.test(later));
        const strong = next === undefined || PHRASE_END.test(next) || (insideQuote && next.startsWith('"'));
        const shouted = word.length > 1 && word === word.toUpperCase();
        const reduced = strong || shouted ? undefined : weak.get(word.toLowerCase());
        out += reduced ?? await sayWord(word);
      }
    }
    return out.replace(/ +/g, " ").trim();
  };
}
