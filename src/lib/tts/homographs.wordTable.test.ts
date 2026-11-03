import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { createTextToPhonemes, parseDictionary } from "./textToPhonemes";

// No shipped entry is a homograph, so this one stands in for a bad clip.
vi.mock("./g2p/wordTable.json", () => ({ default: { read: "ɹˈid" } }));

it("a word table entry beats a homograph pick", async () => {
  const dictionary = parseDictionary(readFileSync(new URL("./g2p/cmudict.dict", import.meta.url), "utf8"));
  const say = createTextToPhonemes({ dictionary, predict: async (word) => word });
  expect(await say("She read it.")).toContain("ɹˈid");
});
