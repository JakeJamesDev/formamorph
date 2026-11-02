// Parts adapted from kokoro-js (https://github.com/hexgrad/kokoro, Apache-2.0, copyright hexgrad and contributors):
// src/phonemize.js, the year, time, and money rules.

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", "thousand", "million", "billion", "trillion"];
const ORDINALS: Record<string, string> = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
const MAX_CARDINAL_DIGITS = 15;

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(ONES[Math.floor(n / 100)], "hundred");
  const rest = n % 100;
  if (rest >= 20) parts.push(TENS[Math.floor(rest / 10)], ...(rest % 10 ? [ONES[rest % 10]] : []));
  else if (rest > 0) parts.push(ONES[rest]);
  return parts.join(" ");
}

/** Spells a digit string; a leading zero or a very long number reads digit by digit. */
function cardinal(digits: string): string {
  if (digits.length > MAX_CARDINAL_DIGITS || (digits.length > 1 && digits[0] === "0")) {
    return [...digits].map((d) => ONES[Number(d)]).join(" ");
  }
  let n = Number(digits);
  if (n === 0) return ONES[0];
  const groups: string[] = [];
  for (let scale = 0; n > 0; scale++, n = Math.floor(n / 1000)) {
    const group = n % 1000;
    if (group) groups.unshift(belowThousand(group) + (SCALES[scale] ? ` ${SCALES[scale]}` : ""));
  }
  return groups.join(" ");
}

function ordinal(digits: string): string {
  const words = cardinal(digits).split(" ");
  const last = words.pop()!;
  const said = ORDINALS[last] ?? (last.endsWith("y") ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return [...words, said].join(" ");
}

function pluralNumber(digits: string): string {
  const words = cardinal(digits);
  if (words.endsWith("y")) return `${words.slice(0, -1)}ies`;
  return words.endsWith("x") ? `${words}es` : `${words}s`;
}

function year(digits: string, suffix: string): string {
  const value = Number(digits);
  if (value < 1100 || value % 1000 < 10) return digits + suffix;
  const left = digits.slice(0, 2);
  const right = Number(digits.slice(2));
  if (value % 1000 >= 100) {
    if (right === 0) return `${left} hundred${suffix}`;
    if (right < 10) return `${left} oh ${right}${suffix}`;
  }
  return `${left} ${right}${suffix}`;
}

function clock(hours: string, minutes: string): string {
  const m = Number(minutes);
  if (m === 0) return `${hours} o'clock`;
  return m < 10 ? `${hours} oh ${m}` : `${hours} ${m}`;
}

const MONEY: Record<string, { bill: string; coin: string; coins: string }> = {
  $: { bill: "dollar", coin: "cent", coins: "cents" },
  "£": { bill: "pound", coin: "penny", coins: "pence" },
  "€": { bill: "euro", coin: "cent", coins: "cents" },
};

function money(symbol: string, whole: string, fraction: string | undefined, scale: string | undefined): string {
  const { bill, coin, coins } = MONEY[symbol];
  if (scale || (fraction && fraction.length > 2)) return `${whole}${fraction ? `.${fraction}` : ""}${scale ?? ""} ${bill}s`;
  const bills = `${whole} ${bill}${whole === "1" ? "" : "s"}`;
  const count = Number((fraction ?? "").padEnd(2, "0"));
  if (count === 0) return bills;
  const change = `${count} ${count === 1 ? coin : coins}`;
  return Number(whole) === 0 ? change : `${bills} and ${change}`;
}

/** Dotted letters become one hyphen-joined run, which the word step reads letter by letter. */
function spelledLetters(match: string, end: string): string {
  return match.replace(/\./g, "").toUpperCase().split("").join("-") + end;
}

const TITLES: [RegExp, string][] = [
  [/\bM[Rr]\.(?=\s+[A-Z])/g, "Mister"],
  [/\bM[Rr][Ss]\.(?=\s+[A-Z])/g, "Missus"],
  [/\bM[Ss]\.(?=\s+[A-Z])/g, "Miss"],
  [/\bD[Rr]\.(?=\s+[A-Z])/g, "Doctor"],
  [/\bProf\.(?=\s+[A-Z])/g, "Professor"],
  [/\bCapt\.(?=\s+[A-Z])/g, "Captain"],
  [/\bSgt\.(?=\s+[A-Z])/g, "Sergeant"],
  [/\bLt\.(?=\s+[A-Z])/g, "Lieutenant"],
  [/\bCol\.(?=\s+[A-Z])/g, "Colonel"],
  [/\bGen\.(?=\s+[A-Z])/g, "General"],
  [/\bRev\.(?=\s+[A-Z])/g, "Reverend"],
  [/(?<=\b[A-Z][a-z]+ )St\./g, "Street"],
  [/\bSt\.(?=\s+[A-Z])/g, "Saint"],
  [/\bSt\./g, "Street"],
  [/\bMt\.(?=\s+[A-Z])/g, "Mount"],
  [/\bJr\./g, "Junior"],
  [/\bSr\./g, "Senior"],
  [/\bvs\./gi, "versus"],
  [/\be\.g\.,?/gi, "for example"],
  [/\bi\.e\.,?/gi, "that is"],
  [/\b[Ee]tc\.(?=\s+[A-Z]|\s*$)/g, "et cetera."],
  [/\betc\b\.?/gi, "et cetera"],
];

/** Turns text into words and punctuation only, so every digit, symbol, and abbreviation reaches the speaker as a word. */
export function cleanText(input: string): string {
  let text = input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[«»“”]/g, '"')
    .replace(/、|，/g, ", ")
    .replace(/。/g, ". ")
    .replace(/！/g, "! ")
    .replace(/：/g, ": ")
    .replace(/；/g, "; ")
    .replace(/？/g, "? ")
    .replace(/\s+/g, " ");

  for (const [pattern, spoken] of TITLES) text = text.replace(pattern, spoken);
  // All-capital text is shouting, so its US is the word.
  if (/\p{Ll}/u.test(text)) text = text.replace(/\bUS\b/g, "U-S");

  text = text
    .replace(/(?<![\w.])[A-Za-z](?:\.[A-Za-z])+(?![A-Za-z])(\.?)/g, (match: string, dot: string, at: number, whole: string) => spelledLetters(match, dot && !whole.slice(at + match.length).trim() ? "." : ""))
    .replace(/\bAI\b/g, "A-I")
    .replace(/(?<=\d\s?)([AP])M\b/g, "$1-M")
    .replace(/&/g, " and ")
    .replace(/(?<![$£€\d.,])\b(\d{4})(s?)\b(?![,.]\d)/g, (_, digits: string, suffix: string) => year(digits, suffix))
    .replace(/(?<!:)\b([01]?\d|2[0-3]):([0-5]\d)\b(?!:)/g, (_, h: string, m: string) => clock(h, m))
    .replace(/(?<=\d),(?=\d{3}\b)/g, "")
    .replace(/([$£€])(\d+)(?:\.(\d+))?( hundred| thousand| (?:[bm]|tr)illion)?\b/gi, (_, symbol: string, whole: string, fraction: string | undefined, scale: string | undefined) => money(symbol, whole, fraction, scale))
    .replace(/(\d)\s?%/g, "$1 percent")
    .replace(/(\d*)\.(\d+)/g, (_, a: string, b: string) => `${a} point ${b.split("").join(" ")}`)
    .replace(/(?<=\d)-(?=\d)/g, " to ")
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/gi, (_, digits: string) => ordinal(digits))
    .replace(/\b(\d+)'?s\b/g, (_, digits: string) => pluralNumber(digits))
    .replace(/(?<=\d)(?=[A-Za-z])|(?<=[A-Za-z])(?=\d)/g, " ")
    .replace(/\d+/g, cardinal);

  return text.replace(/ +/g, " ").trim();
}
