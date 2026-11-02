import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { arpabetToKokoro, parseCmudictLine } from "./arpabet";
import compoundWords from "./g2p/compoundWords.json";
import vocab from "./g2p/vocab.json";
import weakForms from "./g2p/weakForms.json";
import wordTable from "./g2p/wordTable.json";
import { createTextToPhonemes, parseDictionary } from "./textToPhonemes";

// The symbols in onnx-community/Kokoro-82M-v1.0-ONNX tokenizer.json.
const KOKORO_SYMBOLS = new Set(`$;:,.!?—…"()“” ̃ʣʥʦʨᵝꭧAIOQSTWYᵊabcdefhijklmnopqrstuvwxyzɑɐɒæβɔɕçɖðʤəɚɛɜɟɡɥɨɪʝɯɰŋɳɲɴøɸθœɹɾɻʁɽʂʃʈʧʊʋʌɣɤχʎʒʔˈˌːʰʲ↓→↗↘ᵻ`);

const dictionaryText = readFileSync(new URL("./g2p/cmudict.dict", import.meta.url), "utf8");
const dictionary = parseDictionary(dictionaryText);
const dict = new Map(dictionaryText.split("\n").flatMap((line) => {
  const entry = parseCmudictLine(line);
  return entry ? [entry] : [];
}));
const cmu = (word: string) => arpabetToKokoro(dict.get(word)!);

function setup() {
  const predict = vi.fn(async (word: string) => `<${word}>`);
  return { say: createTextToPhonemes({ dictionary, predict }), predict };
}

describe("lookup order", () => {
  it("a word table entry beats CMUdict", async () => {
    expect(dict.has("chimera")).toBe(true);
    expect(cmu("chimera")).not.toBe(wordTable.chimera);
    expect(await setup().say("chimera")).toBe(wordTable.chimera);
  });

  it("a word table entry beats a split and the model", async () => {
    const { say, predict } = setup();
    expect(await say("Tiefling")).toBe(wordTable.tiefling);
    expect(await say("wyvern")).toBe(wordTable.wyvern);
    expect(predict).not.toHaveBeenCalled();
  });

  it("CMUdict beats a split", async () => {
    expect(dict.has("blackbird")).toBe(true);
    expect(await setup().say("blackbird")).toBe(cmu("blackbird"));
    expect(cmu("blackbird")).not.toBe(cmu("black") + cmu("bird").replace("ˈ", "ˌ"));
  });

  it("a split beats the model", async () => {
    const { say, predict } = setup();
    expect(await say("Silvermere")).toBe(`${cmu("silver")}${cmu("mere").replace("ˈ", "ˌ")}`);
    expect(predict).not.toHaveBeenCalled();
  });

  it("a word no source has goes to the model, lowercase and once", async () => {
    const { say, predict } = setup();
    expect(await say("Kaelith Kaelith")).toBe("<kaelith> <kaelith>");
    expect(predict).toHaveBeenCalledTimes(1);
    expect(predict).toHaveBeenCalledWith("kaelith");
  });

  it("asks the model again after a failed call", async () => {
    const { say, predict } = setup();
    predict.mockRejectedValueOnce(new Error("no model"));
    await expect(say("Kaelith")).rejects.toThrow("no model");
    expect(await say("Kaelith")).toBe("<kaelith>");
    expect(predict).toHaveBeenCalledTimes(2);
  });

  it("uses the first CMUdict variant for a word with several", async () => {
    expect(await setup().say("read")).toBe(cmu("read"));
  });
});

describe("compound split", () => {
  it("splits Emberwatch with secondary stress on the second part", async () => {
    expect(await setup().say("Emberwatch")).toBe("ˈɛmbəɹwˌɑʧ");
  });

  it.each(["Archon", "Haldren", "Tiamat", "Nyxara"])("keeps %s whole", async (word) => {
    const { say, predict } = setup();
    expect(await say(word)).toBe(`<${word.toLowerCase()}>`);
    expect(predict).toHaveBeenCalledTimes(1);
  });

  it("takes a 3-letter part only from the reviewed list", async () => {
    expect(await setup().say("Oakspire")).toBe(`${cmu("oak")}${cmu("spire").replace("ˈ", "ˌ")}`);
    expect(await setup().say("Honspire")).toBe("<honspire>");
    expect(dict.has("hon")).toBe(true);
  });

  it("lists only CMUdict words of 3 letters", () => {
    for (const word of compoundWords) {
      expect(word).toHaveLength(3);
      expect(dict.has(word)).toBe(true);
    }
  });
});

describe("regular endings", () => {
  it.each([
    ["wyverns", `${wordTable.wyvern}z`],
    ["Asgard's", `${wordTable.asgard}z`],
    ["kobolds'", `${wordTable.kobold}z`],
    ["Emberwatch's", "ˈɛmbəɹwˌɑʧɪz"],
    ["Stalefronts", "stˈAlfɹˌʌnts"],
  ])("%s takes its stem's phonemes and the voiced ending", async (word, phonemes) => {
    const { say, predict } = setup();
    expect(await say(word)).toBe(phonemes);
    expect(predict).not.toHaveBeenCalled();
  });

  it("voices the ending by the stem's last sound", async () => {
    const { say } = setup();
    expect(await say("Oakmap's")).toMatch(/ps$/);
    expect(await say("Oakmoss's")).toMatch(/ɪz$/);
    expect(await say("Oakbird's")).toMatch(/dz$/);
  });

  it("does not strip a word's own -ss or -us", async () => {
    const { say, predict } = setup();
    expect(dict.has("abbas") && dict.has("badu")).toBe(true);
    expect(await say("Abbass")).toBe("<abbass>");
    expect(await say("Badus")).toBe("<badus>");
    expect(predict).toHaveBeenCalledTimes(2);
  });

  it("strips a capital S too", async () => {
    const { say, predict } = setup();
    expect(await say("WYVERNS")).toBe(`${wordTable.wyvern}z`);
    expect(predict).not.toHaveBeenCalled();
  });

  it("gives the model a word whose stem no source has", async () => {
    expect(await setup().say("Kaeliths")).toBe("<kaeliths>");
  });
});

describe("function words", () => {
  it("keeps shouted words strong and the pronoun I weak", async () => {
    const { say } = setup();
    expect(await say("IT WAS TO BE")).toBe(`${cmu("it")} ${cmu("was")} ${cmu("to")} ${cmu("be")}`);
    expect(await say("I went")).toBe(`I ${cmu("went")}`);
  });

  it("stays strong before a closing quote and weak before an opening one", async () => {
    const { say } = setup();
    expect(await say('"it was for" and left')).toBe(`"ɪt wəz ${cmu("for")}" ənd ${cmu("left")}`);
    expect(await say('went to "the top"')).toBe(`${cmu("went")} tə "ðə ${cmu("top")}"`);
  });

  it("no word is both a function word and a table word, so the table always wins", () => {
    expect(Object.keys(weakForms).filter((word) => word in wordTable)).toEqual([]);
  });

  it("takes weak forms inside a phrase", async () => {
    expect(await setup().say("went to the top of it")).toBe(`${cmu("went")} tə ðə ${cmu("top")} əv ${cmu("it")}`);
  });

  it("stays strong at a phrase end and alone", async () => {
    const { say } = setup();
    expect(await say("to")).toBe(cmu("to"));
    expect(await say("what is it for?")).toBe(`${cmu("what")} ɪz ɪt ${cmu("for")}?`);
    expect(await say("It was for, as you said, him.")).toBe(`ɪt wəz ${cmu("for")}, æz ju ${cmu("said")}, ${cmu("him")}.`);
  });

  it("holds a CMUdict variant or the primary entry with no stress", () => {
    const stressless = (phones: string) => phones.replace(/[12]/g, "0");
    const variants = new Map<string, string[]>();
    for (const [word, phones] of dict) {
      const base = word.replace(/\(\d+\)$/, "");
      variants.set(base, [...(variants.get(base) ?? []), phones]);
    }
    for (const [word, form] of Object.entries(weakForms)) {
      const known = variants.get(word)!;
      expect(known.includes(form) || stressless(known[0]) === form, word).toBe(true);
    }
  });
});

describe("text cleanup", () => {
  const spoken = async (text: string, words: string) => {
    const { say } = setup();
    expect(await say(text)).toBe(await say(words));
  };

  it.each([
    ["He has 42 swords", "He has forty two swords"],
    ["0", "zero"],
    ["1,250 gold", "one thousand two hundred fifty gold"],
    ["3.5 miles", "three point five miles"],
    ["the 2nd gate", "the second gate"],
    ["the 21st gate", "the twenty first gate"],
    ["the 40th gate", "the fortieth gate"],
    ["in 1999", "in nineteen ninety nine"],
    ["in 1905", "in nineteen oh five"],
    ["in 1900", "in nineteen hundred"],
    ["in 2005", "in two thousand five"],
    ["the 1980s", "the nineteen eighties"],
    ["the 80s", "the eighties"],
    ["at 3:05", "at three oh five"],
    ["at 3:00", "at three o'clock"],
    ["$5", "five dollars"],
    ["$1", "one dollar"],
    ["$4.50", "four dollars and fifty cents"],
    ["£2.01", "two pounds and one penny"],
    ["$3 million", "three million dollars"],
    ["50%", "fifty percent"],
    ["007", "zero zero seven"],
    ["3-2", "three to two"],
    ["3D", "three D"],
  ])("speaks the number in %s", spoken);

  it.each([
    ["Mr. Jones", "Mister Jones"],
    ["Mrs. Jones", "Missus Jones"],
    ["Ms. Jones", "Miss Jones"],
    ["Dr. Jones", "Doctor Jones"],
    ["St. Paul", "Saint Paul"],
    ["Capt. Vane", "Captain Vane"],
    ["bread, etc.", "bread, et cetera."],
    ["this vs. that", "this versus that"],
    ["salt & pepper", "salt and pepper"],
  ])("speaks the abbreviation in %s", spoken);

  it.each([
    ["the U.S.A. ship", "the U-S-A ship"],
    ["at 5 p.m. sharp", "at five P-M sharp"],
    ["at 5 PM sharp", "at five P-M sharp"],
    ["at 5AM sharp", "at five A-M sharp"],
    ["the NPC", "the N-P-C"],
    ["our AI", "our A-I"],
    ["the US army", "the U-S army"],
  ])("speaks the initialism in %s", spoken);

  it("adds a regular ending to letters", async () => {
    const { say } = setup();
    expect(await say("three NPCs")).toBe(`${cmu("three")} ˌɛnpˌisˈiz`);
    expect(await say("our AI's plan")).toBe(`${cmu("our")} ˌAˈIz ${cmu("plan")}`);
    expect(await say("the U.S.A.'s ship")).toBe(`ðə jˌuˌɛsˈAz ${cmu("ship")}`);
  });

  it("keeps US as a word in shouted text", async () => {
    expect(await setup().say("HELP US NOW")).toBe(`${cmu("help")} ${cmu("us")} ${cmu("now")}`);
  });

  it.each([
    ["$5.00", "five dollars"],
    ["$0.50", "fifty cents"],
    ["$4.505", "four point five zero five dollars"],
    ["1,2,3", "one,two,three"],
    ["at 13:05", "at thirteen oh five"],
    ["bread, etc. and salt", "bread, et cetera and salt"],
    ["Baker St. The end", "Baker Street The end"],
    ["down the St.", "down the Street"],
  ])("speaks the edge case in %s", spoken);

  it("spells dotted text only when every part is one letter", async () => {
    const { say } = setup();
    expect(await say("I.Then")).toBe(`${cmu("i")}.${cmu("then")}`);
    expect(await say("www.a.com")).toContain(`.${cmu("a")}.`);
  });

  it("reads letters with the last one stressed", async () => {
    expect(await setup().say("U.S.A.")).toBe("jˌuˌɛsˈA.");
  });

  it("keeps a sentence's last period after dotted letters", async () => {
    expect(await setup().say("at 5 p.m.")).toMatch(/ˈɛm\.$/);
  });

  it("keeps punctuation and drops symbols", async () => {
    const { say } = setup();
    expect(await say("Yes, (top)! “Hello”—no… [a] *bold*")).toBe(`${cmu("yes")}, (${cmu("top")})! "${cmu("hello")}"—${cmu("no")}… ə ${cmu("bold")}`);
  });

  it("separates words across a dropped hyphen or slash", async () => {
    const { say } = setup();
    expect(await say("top-down and/or")).toBe(`${cmu("top")} ${cmu("down")} ${cmu("and")} ${cmu("or")}`);
  });

  it("removes accents and normalizes curly apostrophes", async () => {
    const { say } = setup();
    expect(await say("Éowyn")).toBe("<eowyn>");
    expect(await say("don’t")).toBe(cmu("don't"));
  });

  it("gives no output for text with no speech", async () => {
    expect(await setup().say("***")).toBe("");
  });
});

describe("Kokoro notation", () => {
  it.each(Object.entries(wordTable))("%s uses only symbols Kokoro accepts", (_, phonemes) => {
    expect([...phonemes].filter((symbol) => !KOKORO_SYMBOLS.has(symbol))).toEqual([]);
  });

  it("the model and weak forms use only symbols Kokoro accepts", () => {
    expect(vocab.phonemes.filter((symbol) => !KOKORO_SYMBOLS.has(symbol))).toEqual([]);
    for (const form of Object.values(weakForms)) {
      expect([...arpabetToKokoro(form)].filter((symbol) => !KOKORO_SYMBOLS.has(symbol))).toEqual([]);
    }
  });

  it("the list rejects a symbol Kokoro has no token for", () => {
    expect(KOKORO_SYMBOLS.has("r")).toBe(true);
    expect(KOKORO_SYMBOLS.has("g")).toBe(false);
    expect(KOKORO_SYMBOLS.has("«")).toBe(false);
  });
});
