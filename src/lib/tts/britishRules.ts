// The coda /r/ step adapts applyRPRules from phonemize (https://github.com/hans00/phonemize), MIT, copyright (c) 2025 Hans.
// Everything else here is our own. No phonemize data is used.
import bathStems from "./g2p/bathStems.json";

const VOWEL = "aæɑɒɔəɛɪʊʌɜeiouAIOQWY";
const BEFORE_VOWEL = `(?=[ˈˌ]?[${VOWEL}])`;
const NOT_BEFORE_VOWEL = `(?![ˈˌ]?[${VOWEL}])`;
const coda = (before: string) => new RegExp(`${before}ɹ${NOT_BEFORE_VOWEL}`, "g");
const CODA_VOWELS: [RegExp, string][] = [
  [coda("ɑ"), "ɑː"],
  [coda("ɔ"), "ɔː"],
  [coda("ɛ"), "ɛː"],
  [coda("[ɪi]"), "ɪə"],
  [coda("[ʊu]"), "ʊə"],
  [coda("I"), "Iə"],
  [coda("W"), "Wə"],
];
const CODA_NURSE = coda("([ˈˌ]?)[əʌɜ]");
const CODA_R = coda("");

const BATH_TAIL = "(?:s|es|d|ed|r|rs|er|ers|est|ing|ings|ly)?$";
const BATH_WHOLE = bathStems.whole.map((stem) => stem.replace(/e$/, "e?")).join("|");
const BATH_START = new RegExp(`^(?:${bathStems.prefix.join("|")})|^(?:${BATH_WHOLE})${BATH_TAIL}`);
/** The last part of a compound, as in hourglass and aircraft, which CMUdict marks with secondary stress. */
const BATH_END = new RegExp(`(?:${BATH_WHOLE})${BATH_TAIL}`);
/** Psychopath and osteopath keep the trap vowel. */
const NOT_BATH_END = /opath/;
/** CMUdict's /ɑ/ in these spellings is the thought vowel, as in fallen. */
const SPELLED_THOUGHT = /all|alk|au|aw/;
/** A short /ɒ/ before /ɹ/ and a vowel, where CMUdict has /ɔ/, as in forest and horror. */
const SHORT_BEFORE_R = /orr|warrant|warrior|forest(?!all)|orange|foreign|moral|coral|origin|florist|authority|majority|minority|priority|quarrel|quarant|historic/;
const SHORT_R = new RegExp(`ɔɹ${BEFORE_VOWEL}`);
/** A CMUdict /ɔ/ that British says short, as in long, off, cloth, and cost, unless spelled as in sauce. */
const CLOTH = /ɔ(?=ŋ|f|θ|s|ɡ)/g;
const NOT_CLOTH = /au|aw/;
/** Want and wander, where CMUdict has /ɔ/ before /n/. */
const SPELLED_WAN = /wan[dt]/;
const SPELLED_YOD = /[tdn](?:ew|eu|ue|u)/;
const YOD = /([tdn])([ˈˌ]?)([uʊ])/;
const SPELLED_NEAR = /e[ae]?r/;
const NEAR_BEFORE_VOWEL = new RegExp(`([ˈˌ])ɪɹ${BEFORE_VOWEL}`);
/** Square before /ɹ/ and a vowel, as in area, various, and wearing. */
const SPELLED_SQUARE = /ar(?:[ie][aeou]|y|ent|ing)|ear/;
/** Trap where CMUdict has /ɛɹ/, as in charity and caramel. */
const SPELLED_TRAP_R = /ar[aeiouy]/;
const R_AFTER_DRESS = new RegExp(`ɛɹ${BEFORE_VOWEL}`);
/** Strut before /ɹ/ and a vowel, as in hurry. Other /ɜɹ/ words keep the nurse vowel, as in furry. */
const SPELLED_STRUT_R = /hurr|worr|^curr|courag|flouri|nouri|burrow|furrow|turret|thorough|borough/;
const WEAK_ENDINGS: [RegExp, RegExp, string][] = [
  [/ed$/, /əd$/, "ɪd"],
  [/es$/, /əz$/, "ɪz"],
  [/is$/, /əs$/, "ɪs"],
  [/ages?$/, /əʤ(ɪz)?$/, "ɪʤ$1"],
  [/[ei]ts?$/, /ət(s?)$/, "ɪt$1"],
  [/[ln]ess$/, /([ln])ɛs$/, "$1əs"],
  [/^un(?!til|less|to)/, /^ən/, "ʌn"],
];
const UNSTRESSED_RY = /(ary|ery|ory|aries|eries|ories)$/;
const SECONDARY_RY = /ˌ[ɛɔ]ɹi(z?)$/;
const NUCLEUS = /[æɑɔəɛɪʊʌɜiuAIOWY]/g;
const SILENT_E = /(?<=[^aeiouy])e$/;
const CODA_NEXT = new RegExp(`^ɹ${NOT_BEFORE_VOWEL}`);

/** The lot or palm vowel for an /ɑ/ spelled by this group; a spelled o or wa is lot, as in sorry and wash. */
const openVowel = (spelled: { text: string; after: string } | undefined, spelling: string): string => {
  const lot = spelled ? /o/.test(spelled.text) || /[wq]u?$/.test(spelled.after) || !/a/.test(spelled.text) : /o|[wq]u?a/.test(spelling) || !/a/.test(spelling);
  if (lot) return "ɒ";
  return SPELLED_THOUGHT.test(spelling) ? "ɔː" : "ɑː";
};

/**
 * Pairs each vowel sound with its spelled vowel, when spelling and sound line up, for the two vowels spelling decides:
 * an unstressed /ə/ spelled i is /ɪ/, as in capital, and /ɑ/ is lot or palm.
 */
function spelledVowels(spelling: string, said: string): string {
  const stem = spelling.replace(SILENT_E, "");
  const groups = [...stem.matchAll(/[aeiouy]+/g)].map((match) => ({ text: match[0], after: stem.slice(0, match.index) }));
  const aligned = groups.length === (said.match(NUCLEUS) ?? []).length;
  let at = -1;
  return said.replace(NUCLEUS, (vowel, offset: number) => {
    at++;
    const spelled = aligned ? groups[at] : undefined;
    if (vowel === "ə" && spelled?.text === "i") return "ɪ";
    if (vowel === "ɑ" && !CODA_NEXT.test(said.slice(offset + 1))) return openVowel(spelled, spelling);
    return vowel;
  });
}

/** Converts the American result of one word to British. */
export function toBritish(word: string, american: string): string {
  const spelling = word.toLowerCase();
  let said = spelledVowels(spelling, american.replace(/ɾ/g, "t"));

  for (const [spelled, sound, weak] of WEAK_ENDINGS) {
    if (spelled.test(spelling)) said = said.replace(sound, weak);
  }
  if (UNSTRESSED_RY.test(spelling)) said = said.replace(SECONDARY_RY, "əɹi$1");
  if (SPELLED_YOD.test(spelling)) said = said.replace(YOD, "$1j$2$3");
  if (SPELLED_NEAR.test(spelling)) said = said.replace(NEAR_BEFORE_VOWEL, "$1ɪəɹ");
  if (SHORT_BEFORE_R.test(spelling)) said = said.replace(SHORT_R, "ɒɹ");
  if (SPELLED_WAN.test(spelling)) said = said.replace(/ɔn/, "ɒn");
  if (SPELLED_SQUARE.test(spelling)) said = said.replace(R_AFTER_DRESS, "ɛːɹ");
  else if (SPELLED_TRAP_R.test(spelling)) said = said.replace(R_AFTER_DRESS, "æɹ");
  if (BATH_START.test(spelling)) said = said.replace(/([ˈˌ])æ/, "$1ɑː");
  else if (BATH_END.test(spelling) && !NOT_BATH_END.test(spelling)) said = said.replace(/ˌæ/, "ˌɑː");
  said = said.replace(/æ/g, "a");

  said = said.replace(CODA_NURSE, (_, stress: string) => (stress ? `${stress}ɜː` : "ə"));
  for (const [from, to] of CODA_VOWELS) said = said.replace(from, to);
  said = said.replace(CODA_R, "").replace(/ɜɹ/g, SPELLED_STRUT_R.test(spelling) ? "ʌɹ" : "ɜːɹ");

  if (!NOT_CLOTH.test(spelling)) said = said.replace(CLOTH, "ɒ");
  return said
    .replace(/ɔ(?!ː)/g, "ɔː")
    .replace(/O/g, "Q")
    .replace(/([ˈˌ])([iu])(?!ː)/g, "$1$2ː");
}
