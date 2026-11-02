import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { mergeRatings, pageHtml, planClips, tally } from "./ratingPlan.mjs";

const arms = {
  one: { wyvern: "wˈIvəɹn", kobold: "kˈObOld", Asgard: "ˈæzɡɑɹd" },
  two: { wyvern: "wˈɪvəɹn", kobold: "kˈObOld", Asgard: "ˈɑsɡˌɑɹd" },
};
const words = ["wyvern", "kobold", "Asgard"];

describe("planClips", () => {
  it("renders one clip for a string that two arms share", () => {
    const plan = planClips(arms, ["kobold"], {});
    expect(plan).toEqual([{ word: "kobold", clips: ["kˈObOld"] }]);
  });

  it("carries a rating for an identical string, even a rejected one", () => {
    const plan = planClips(arms, words, { wyvern: { "wˈIvəɹn": true, "wˈɪvəɹn": false }, kobold: { "kˈObOld": true } });
    expect(plan).toEqual([{ word: "Asgard", clips: expect.arrayContaining(["ˈæzɡɑɹd", "ˈɑsɡˌɑɹd"]) }]);
  });

  it("keys a rating to the word, so another word's string is not carried", () => {
    const plan = planClips({ one: { kobold: "wˈIvəɹn" } }, ["kobold"], { wyvern: { "wˈIvəɹn": true } });
    expect(plan[0].clips).toEqual(["wˈIvəɹn"]);
  });

  it("varies the clip order between words, with no arm names in the plan", () => {
    const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`w${i}`, "A"]));
    const other = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`w${i}`, "B"]));
    const plan = planClips({ first: many, second: other }, Object.keys(many), {});
    const firstClips = new Set(plan.map((row: { clips: string[] }) => row.clips[0]));
    expect(firstClips).toEqual(new Set(["A", "B"]));
    expect(JSON.stringify(plan)).not.toMatch(/first|second/);
  });
});

describe("tally", () => {
  it("counts carried verdicts per arm and lists what is unrated", () => {
    const ratings = { wyvern: { "wˈIvəɹn": true, "wˈɪvəɹn": false }, kobold: { "kˈObOld": true } };
    expect(tally(arms, words, ratings)).toEqual({
      one: { acceptable: 2, rejected: 0, unrated: ["Asgard"] },
      two: { acceptable: 1, rejected: 1, unrated: ["Asgard"] },
    });
  });
});

describe("pageHtml", () => {
  const rows = [
    { word: "wyvern", clips: [{ phonemes: "wˈIvəɹn", file: "c0.wav" }, { phonemes: "wˈɪvəɹn", file: "c1.wav" }] },
    { word: "kobold", clips: [{ phonemes: "kˈObOld", file: "c2.wav" }] },
  ];
  const open = () => new JSDOM(pageHtml("Test", rows), { runScripts: "dangerously", url: "http://localhost/" }).window as unknown as Window & {
    collectRatings: () => unknown;
  };
  const answer = (window: Window, name: string, value: string) => {
    const radio = window.document.querySelector<HTMLInputElement>(`input[name=${name}][value=${value}]`)!;
    radio.checked = true;
    radio.onchange!(new window.Event("change"));
  };

  it("leaves unanswered clips out, so a part-done page never reads as rejections", () => {
    const window = open();
    answer(window, "c0", "ok");
    answer(window, "c1", "no");
    expect(window.collectRatings()).toEqual({ wyvern: { "wˈIvəɹn": true, "wˈɪvəɹn": false } });
    expect(window.document.getElementById("count")!.textContent).toBe("2 of 3 clips answered");
  });

  it("saves each answer for a reload", () => {
    const first = new JSDOM(pageHtml("Test", rows), { runScripts: "dangerously", url: "http://localhost/" }).window;
    answer(first as unknown as Window, "c2", "ok");
    const stored = first.localStorage.getItem("ratings-Test")!;
    expect(JSON.parse(stored)).toEqual({ c2: "ok" });
  });

  it("names no arm in the page", () => {
    expect(pageHtml("Test", rows)).not.toMatch(/espeak|arm/i);
  });
});

describe("mergeRatings", () => {
  it("adds new strings, keeps old ones, and lowercases the word", () => {
    const merged = mergeRatings({ asgard: { "ˈæzɡɑɹd": true } }, { Asgard: { "ˈɑsɡˌɑɹd": false } });
    expect(merged).toEqual({ asgard: { "ˈæzɡɑɹd": true, "ˈɑsɡˌɑɹd": false } });
  });
});
