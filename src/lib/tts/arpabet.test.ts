import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arpabetToKokoro, parseCmudictLine } from "./arpabet";

const dictText = readFileSync(new URL("./g2p/cmudict.dict", import.meta.url), "utf8");
const dict = new Map(dictText.split("\n").flatMap((line) => {
  const entry = parseCmudictLine(line);
  return entry ? [entry] : [];
}));
const say = (word: string) => arpabetToKokoro(dict.get(word)!);

describe("arpabetToKokoro over the pinned CMUdict", () => {
  it("places primary and secondary stress before the vowel", () => {
    expect(say("rain")).toBe("ɹˈAn");
    expect(say("hello")).toBe("həlˈO");
    expect(say("necromancer")).toBe("nˈɛkɹəmˌænsəɹ");
  });

  it("drops the stress digit on unstressed vowels and splits AH and ER by stress", () => {
    expect(say("sofa")).toBe("sˈOfə");
    expect(say("cut")).toBe("kˈʌt");
    expect(say("bird")).toBe("bˈɜɹd");
    expect(say("baker")).toBe("bˈAkəɹ");
  });

  it("flaps a t after a stressed vowel and before a weak vowel", () => {
    expect(say("butter")).toBe("bˈʌɾəɹ");
    expect(say("city")).toBe("sˈɪɾi");
    expect(say("party")).toBe("pˈɑɹɾi");
    expect(say("citadel")).toBe("sˈɪɾədˌɛl");
  });

  it("keeps a t that the flap rule does not cover", () => {
    expect(say("attack")).toBe("ətˈæk");
    expect(say("top")).toBe("tˈɑp");
    expect(say("after")).toBe("ˈæftəɹ");
    expect(say("hat")).toBe("hˈæt");
    expect(say("auto")).toBe("ˈɔtO");
  });

  it("writes each diphthong and affricate as Kokoro's one symbol", () => {
    expect(say("day")).toBe("dˈA");
    expect(say("my")).toBe("mˈI");
    expect(say("go")).toBe("ɡˈO");
    expect(say("how")).toBe("hˈW");
    expect(say("boy")).toBe("bˈY");
    expect(say("church")).toBe("ʧˈɜɹʧ");
    expect(say("judge")).toBe("ʤˈʌʤ");
  });

  it("maps every entry of the pin, and refuses a phone outside the table", () => {
    for (const phones of dict.values()) expect(arpabetToKokoro(phones)).not.toBe("");
    expect(() => arpabetToKokoro("B QQ1 T")).toThrow(/QQ1/);
  });

  it("strips a comment and refuses a blank line when parsing", () => {
    expect(parseCmudictLine("d'artagnan D AH0 R T AE1 NG Y AH0 N # foreign french")).toEqual(["d'artagnan", "D AH0 R T AE1 NG Y AH0 N"]);
    expect(parseCmudictLine("")).toBeNull();
  });

  it("holds the file the pin names", async () => {
    const { default: pins } = await import("../../../testing/g2p/pins.json");
    expect(createHash("sha256").update(dictText).digest("hex")).toBe(pins.cmudict.sha256);
  });
});
