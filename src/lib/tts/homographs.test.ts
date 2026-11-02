import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { arpabetToKokoro, parseCmudictLine } from "./arpabet";
import { toBritish } from "./britishRules";
import homographs from "./g2p/homographs.json";
import { createTextToPhonemes, parseDictionary } from "./textToPhonemes";

const dictionaryText = readFileSync(new URL("./g2p/cmudict.dict", import.meta.url), "utf8");
const cmudict = new Map(dictionaryText.split("\n").flatMap((line) => {
  const entry = parseCmudictLine(line);
  return entry ? [entry] : [];
}));
const say = createTextToPhonemes({ dictionary: parseDictionary(dictionaryText), predict: vi.fn(async (word: string) => `<${word}>`) });

/** The CMUdict entry for a word's numbered variant, in Kokoro notation. */
const variant = (word: string, n: number) => arpabetToKokoro(cmudict.get(n === 1 ? word : `${word}(${n})`)!);
const words = (phonemes: string) => phonemes.split(/[\s;:,.!?—…"()]+/);

// [word, first sentence, its CMUdict variant, contrasting sentence, its CMUdict variant]
const CONTRASTS: [string, string, number, string, number][] = [
  ["abuse", "The abuse went on for years.", 1, "They abuse the old horses.", 2],
  ["alternate", "We took an alternate road.", 1, "They alternate between the two roads.", 2],
  ["appropriate", "It was an appropriate gift.", 1, "They appropriate the land for the crown.", 2],
  ["associate", "He met an associate at the inn.", 1, "They associate him with the guild.", 2],
  ["attribute", "Courage is a fine attribute.", 1, "They attribute the fire to a dragon.", 2],
  ["bow", "He drew his bow.", 2, "They bow to the queen.", 1],
  ["bows", "The archers carried their bows.", 2, "He bows to the queen.", 1],
  ["close", "The cave is close.", 1, "Please close the door.", 2],
  ["conduct", "His conduct was poor.", 1, "They conduct the ritual at dawn.", 2],
  ["content", "The content of the letter was short.", 1, "She felt content.", 2],
  ["contents", "The contents of the box spilled.", 1, "He contents himself with bread.", 2],
  ["contract", "She signed the contract.", 1, "The muscles contract in the cold.", 2],
  ["convict", "The convict ran for the hills.", 1, "They will convict him at dawn.", 2],
  ["deliberate", "It was a deliberate insult.", 1, "The elders deliberate until dark.", 2],
  ["desert", "The desert stretched for miles.", 1, "Do not desert your post.", 2],
  ["digest", "The scholar wrote a digest of the law.", 2, "Snakes digest their prey slowly.", 1],
  ["dove", "The white dove sang.", 1, "She dove into the lake.", 2],
  ["estimate", "His estimate was too low.", 1, "They estimate the cost in gold.", 2],
  ["excuse", "That is a poor excuse.", 1, "Please excuse the mess.", 2],
  ["excuses", "He made many excuses.", 1, "She excuses herself from the table.", 2],
  ["graduate", "The graduate left the academy.", 1, "They graduate from the academy in spring.", 2],
  ["intimate", "They shared an intimate dinner.", 1, "They intimate that the king is ill.", 2],
  ["lead", "The pipe was made of lead.", 1, "She will lead the army.", 2],
  ["learned", "A learned man spoke.", 2, "He learned the spell.", 1],
  ["live", "They saw a live dragon.", 1, "I live in the north.", 2],
  ["lives", "Many lives were lost.", 2, "She lives alone.", 1],
  ["moderate", "He showed moderate skill.", 1, "They moderate the debate.", 2],
  ["object", "The object glowed.", 1, "I object to this.", 2],
  ["objects", "The objects glowed.", 1, "She objects to the plan.", 2],
  ["perfect", "It was a perfect night.", 2, "They perfect the recipe.", 1],
  ["permit", "She showed the guard her permit.", 2, "They permit no visitors.", 1],
  ["polish", "Polish the sword.", 1, "The Polish knight bowed.", 2],
  ["present", "She gave him a present.", 1, "They present the gift.", 2],
  ["presents", "The presents sat by the fire.", 1, "He presents the gift.", 2],
  ["produce", "The produce rotted at the market.", 2, "The farms produce grain.", 1],
  ["project", "The project took years.", 1, "They project their voices.", 2],
  ["read", "I will read the letter tonight.", 2, "She read the letter last night.", 1],
  ["rebel", "The rebel fled.", 1, "They rebel against the crown.", 2],
  ["record", "Keep a record of it.", 2, "They record every word.", 1],
  ["records", "The records burned.", 2, "He records every word.", 1],
  ["refuse", "The refuse piled up.", 2, "I refuse to go.", 1],
  ["separate", "They slept in separate rooms.", 3, "The guards separate the prisoners.", 1],
  ["sow", "The sow slept in the mud.", 1, "They sow the fields in spring.", 2],
  ["subject", "The subject of the letter was war.", 2, "They subject him to questions.", 1],
  ["tear", "A single tear fell.", 2, "Do not tear the page.", 1],
  ["tears", "Her tears fell.", 2, "He tears the page.", 1],
  ["use", "What is the use of it?", 1, "We use the old road.", 2],
  ["uses", "The herb has many uses.", 1, "He uses the old road.", 3],
  ["wind", "The wind howled all night.", 2, "You must wind the clock.", 1],
  ["winds", "The winds howled all night.", 1, "He winds the clock.", 2],
  ["wound", "The wound bled through the cloth.", 2, "He wound the rope around the post.", 1],
];

describe("homographs", () => {
  it.each(CONTRASTS)("%s follows its sentence", async (word, first, firstVariant, second, secondVariant) => {
    const a = variant(word, firstVariant);
    const b = variant(word, secondVariant);
    expect(a).not.toBe(b);
    expect(words(await say(first))).toContain(a);
    expect(words(await say(second))).toContain(b);
  });

  it("covers every word in the table", () => {
    expect(CONTRASTS.map(([word]) => word).sort()).toEqual(Object.keys(homographs).sort());
  });

  it("lists only CMUdict variants", () => {
    for (const [word, senses] of Object.entries(homographs)) {
      for (const n of Object.values(senses)) expect(cmudict.has(n === 1 ? word : `${word}(${n})`), `${word} ${n}`).toBe(true);
    }
  });

  it("picks each occurrence by its own sentence, in one text", async () => {
    const out = words(await say("She read the letter. Now I will read it again."));
    expect(out.filter((said) => said === variant("read", 1))).toHaveLength(1);
    expect(out.filter((said) => said === variant("read", 2))).toHaveLength(1);
  });

  it("picks a word inside quotes and apostrophes", async () => {
    expect(words(await say(`"I will read it," she said.`))).toContain(variant("read", 2));
    expect(words(await say("The 'wind' howled."))).toContain(variant("wind", 2));
  });

  it("reads a bare verb as past when a past verb shares the sentence", async () => {
    expect(words(await say("They read the letter and said nothing."))).toContain(variant("read", 1));
  });

  it("reads a verb after a modal, a negative, or to as present", async () => {
    expect(words(await say("He could read."))).toContain(variant("read", 2));
    expect(words(await say("He did not read it."))).toContain(variant("read", 2));
    expect(words(await say("He likes to read."))).toContain(variant("read", 2));
    expect(words(await say("To wound him was a crime."))).toContain(variant("wound", 2));
  });

  it("tells a metal from a place in line by the determiner", async () => {
    expect(words(await say("Lead is heavy."))).toContain(variant("lead", 1));
    expect(words(await say("He took the lead."))).toContain(variant("lead", 2));
    expect(words(await say("He kept his lead."))).toContain(variant("lead", 2));
  });

  it("reads a bare verb after a singular noun as past", async () => {
    expect(words(await say("The boy read the book."))).toContain(variant("read", 1));
  });

  it("looks past an adverb to the subject", async () => {
    expect(words(await say("He slowly read the note."))).toContain(variant("read", 1));
  });

  it("keeps the past form the tagger marks after a helper verb", async () => {
    expect(words(await say("He has read every book here."))).toContain(variant("read", 1));
  });

  it("looks past a negative to the modal, with a past verb in the sentence", async () => {
    expect(words(await say("He could not read the letter he found."))).toContain(variant("read", 2));
  });

  it("reads a verb in a question as present, whatever helper starts it", async () => {
    for (const question of ["Did she read it?", "Will she read it?", "Can he read?", "Does he read it?"]) {
      expect(words(await say(question)), question).toContain(variant("read", 2));
    }
    expect(words(await say("Did he wound the rope?"))).toContain(variant("wound", 2));
  });

  it("reads a verb after object her as a verb, and a noun after possessive her as a noun", async () => {
    expect(words(await say("Let her wind the clock."))).toContain(variant("wind", 1));
    expect(words(await say("I saw her tear the page."))).toContain(variant("tear", 1));
    expect(words(await say("We made her record it."))).toContain(variant("record", 1));
    expect(words(await say("She raised her bow."))).toContain(variant("bow", 2));
  });

  it("gives a British voice the pick, with British rules on top", async () => {
    expect(words(await say("Please close the door.", "b"))).toContain(toBritish("close", variant("close", 2)));
    expect(words(await say("The cave is close.", "b"))).toContain(toBritish("close", variant("close", 1)));
    expect(toBritish("close", variant("close", 2))).not.toBe(toBritish("close", variant("close", 1)));
  });

  it("gives content its verb form", async () => {
    expect(words(await say("He must content himself."))).toContain(variant("content", 2));
  });

  it("keeps an adjective after a determiner when a noun follows", async () => {
    expect(words(await say("It was a close call."))).toContain(variant("close", 1));
  });

  it("a word with no table row keeps its first CMUdict entry", async () => {
    expect(cmudict.has("either(2)")).toBe(true);
    expect(await say("either")).toBe(variant("either", 1));
  });

  it("does not offer variants of other words as lookups", () => {
    const dictionary = parseDictionary(dictionaryText);
    expect(dictionary.has("read(2)")).toBe(true);
    expect(dictionary.has("either(2)")).toBe(false);
  });
});
