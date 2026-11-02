import nlp from "compromise/two";
import homographs from "./g2p/homographs.json";

type Sense = "noun" | "mass" | "proper" | "verb" | "past" | "adj";

interface Term {
  text: string;
  tags: string[];
  offset: { start: number };
}

const table: Record<string, Partial<Record<Sense, number>>> = homographs;
const ANY_HOMOGRAPH = new RegExp(`\\b(?:${Object.keys(table).join("|")})\\b`, "i");
const THIRD_PERSON = new Set(["he", "she", "it"]);
const HELPERS = new Set(["to", "do", "does", "did"]);
/** "It" and "you" also take the object place, so only these mark the next word as a verb. */
const SUBJECTS = new Set(["i", "he", "she", "we", "they"]);
/** The sense to use when a word's row lacks the one its sentence calls for. */
const FALLBACK: Partial<Record<Sense, Sense>> = { mass: "noun", proper: "noun", past: "verb", adj: "noun", noun: "adj" };

export function isHomograph(word: string): boolean {
  return Object.hasOwn(table, word);
}

const has = (term: Term | undefined, tag: string) => term?.tags.includes(tag) ?? false;

/** Whether one of `openers` comes before the word, past any adjectives. */
function followsOpener(terms: Term[], at: number, openers: string[]): boolean {
  for (let i = at - 1; i >= 0; i--) {
    if (openers.some((tag) => has(terms[i], tag))) return true;
    if (!has(terms[i], "Adjective") && !has(terms[i], "Adverb")) return false;
  }
  return false;
}

function isHelper(term: Term | undefined): boolean {
  return has(term, "Modal") || has(term, "Auxiliary") || HELPERS.has(term?.text.toLowerCase() ?? "");
}

/** The tagger reads a bare verb as present; a singular subject or a past verb nearby rules that out. */
function isPast(terms: Term[], at: number): boolean {
  if (has(terms[at], "PastTense") || has(terms[at], "Participle")) return true;
  let before = at - 1;
  while (has(terms[before], "Negative") || has(terms[before], "Adverb")) before--;
  const prev = terms[before];
  // The helper can sit before the subject, as in "Did she read it?".
  if (!prev || isHelper(prev) || isHelper(terms[before - 1])) return false;
  if (THIRD_PERSON.has(prev.text.toLowerCase()) || (has(prev, "Singular") && !has(prev, "Pronoun"))) return true;
  return terms.some((term, i) => i !== at && has(term, "PastTense"));
}

function senseOf(terms: Term[], at: number): Sense | undefined {
  const term = terms[at];
  const beforeNoun = has(terms[at + 1], "Noun") || has(terms[at + 1], "Adjective");
  // "Her" is also an object, as in "Let her wind the clock", so only a true determiner overrules a verb tag.
  if (followsOpener(terms, at, ["Determiner"]) && (has(term, "Verb") || (has(term, "Adjective") && !beforeNoun))) return "noun";
  if (SUBJECTS.has(terms[at - 1]?.text.toLowerCase())) return isPast(terms, at) ? "past" : "verb";
  if (has(term, "ProperNoun")) return "proper";
  if (has(term, "Noun")) return followsOpener(terms, at, ["Determiner", "Possessive"]) ? "noun" : "mass";
  if (has(term, "Verb")) return isPast(terms, at) ? "past" : "verb";
  return has(term, "Adjective") || has(term, "Adverb") ? "adj" : undefined;
}

function variantFor(word: string, sense: Sense | undefined): string | undefined {
  if (!sense) return undefined;
  const entry = table[word];
  const fallback = FALLBACK[sense];
  const variant = entry[sense] ?? (fallback && entry[fallback]);
  if (variant === undefined) return undefined;
  return variant === 1 ? word : `${word}(${variant})`;
}

/** Maps the start offset of each homograph in `text` to the CMUdict entry its sentence calls for. */
export function pickHomographs(text: string): Map<number, string> {
  const picks = new Map<number, string>();
  if (!ANY_HOMOGRAPH.test(text)) return picks;
  const sentences: { terms: Term[] }[] = nlp(text).json({ offset: true, terms: { offset: true, tags: true } });
  for (const { terms } of sentences) {
    for (const [at, term] of terms.entries()) {
      const word = term.text.toLowerCase();
      if (!isHomograph(word)) continue;
      const variant = variantFor(word, senseOf(terms, at));
      if (variant) picks.set(term.offset.start, variant);
    }
  }
  return picks;
}
