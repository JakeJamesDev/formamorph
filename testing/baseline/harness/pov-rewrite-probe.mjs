// POV rewrite probe — does the character pass confuse the player's first-person action with its own "I"?
// Feeds the real defaultCharacterPrompt + the buildCharacterUserMessage shape, varying only how the player's
// action is presented. Arms, interleaved per run so each batch carries its own control:
//   raw      — action verbatim, no "I = player character" note
//   label    — action verbatim with the shipped note (stagedPlanning.ts buildCharacterUserMessage)
//   rewrite  — first-person words rewritten to the persona name / "the player character", outside quotes
// Metrics per reply: STOLE (the character claims the player's own act), YOU ("you"/"your" outside quotes),
// SELF3 (own name outside quotes), PARROT (copies the rewrite's unconjugated "<Name> walk"), NAMED (uses the persona name).
//
// --pass diary runs the same arms on the diary pass: its second-person narration, with "you" rewritten
// to the name. The diary STOLE regex is narrow; hand-label actor swaps from the printed replies.
//
// Usage:  node pov-rewrite-probe.mjs [--pass character|diary] [--endpoint URL] [--model default] [--runs 6]
//         [--only flask] [--arms raw,label,rewrite] [--show-rewrites]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "6"));
const PASS = argVal("--pass", "character"); // character | diary
const maxTokens = Number(argVal("--max", PASS === "diary" ? "80" : "256")); // TURN_PASS_CAPS
const only = argVal("--only");
const ARMS = argVal("--arms", "raw,label,rewrite").split(",");
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const { world, location } = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"));

// ---- The rewrite under test: first-person words → the player's name, outside quoted speech. ----
export function rewriteFirstPerson(text, name) {
  const who = name || "the player character";
  const grp = `${who}'s group`;
  const MAP = {
    "i'm": `${who} is`, "i'll": `${who} will`, "i've": `${who} has`, "i'd": `${who} would`,
    i: who, me: who, my: `${who}'s`, mine: `${who}'s`, myself: "themself",
    we: grp, us: grp, our: `${grp}'s`, ours: `${grp}'s`, ourselves: "themselves",
  };
  const WORD = /\b(i['’](?:m|ll|ve|d)|i|me|my|mine|myself|we|us|our|ours|ourselves)\b/gi;
  const swap = (seg) => seg.replace(WORD, (m, _w, at, whole) => {
    const out = MAP[m.toLowerCase().replace("’", "'")];
    const start = !whole.slice(0, at).trim() || /[.!?*]\s*$/.test(whole.slice(0, at));
    return start ? out[0].toUpperCase() + out.slice(1) : out;
  });
  // Split on balanced double quotes; odd segments are speech and stay as written.
  const parts = text.split(/(["“][^"”]*["”])/);
  return parts.map((p, i) => (i % 2 ? p : swap(p))).join("");
}

// ---- Cases: the player acts on the character the pass plays. Standard prose, first-person, mixed forms. ----
const CASES = [
  {
    name: "flask", persona: { name: "Mara", desc: "A traveling cartographer, quick-witted and road-worn." },
    npc: { name: "Elena", desc: "A wary sellsword who trusts no one she has not seen fight." },
    recap: "You find the sellsword alone by the fire at the edge of camp, sharpening a blade she does not look up from.",
    scene: "Night at the caravan camp; Elena sits by the fire, Mara approaches.",
    action: `I walk up to her and smile, then hold out my flask. "I figured you could use a drink," I say, keeping my eyes on hers. I'm not sure she trusts me yet.`,
    stole: /\bI (walk up to (her|him)|hold out my flask|offer (her|him) my flask)\b|keeping my eyes on hers|trusts me yet/i,
  },
  {
    name: "bar", persona: { name: "Mara", desc: "A traveling cartographer, quick-witted and road-worn." },
    npc: { name: "Dace", desc: "A quiet card player who keeps his hat low and his winnings close." },
    recap: "The inn's common room is loud; a game of cards runs at the corner table, and one stranger keeps winning.",
    scene: "The bar of the Sedge Landing inn; Dace sits alone between hands.",
    action: `*I lean against the bar and order two drinks* "One for me, one for whoever wins the next hand." *I slide the second glass toward the stranger and wait for him to look up.*`,
    stole: /\bI (lean against the bar|order two drinks|slide the (second )?glass)|wait for (him|her) to look up/i,
  },
  {
    name: "hiding", persona: { name: "Mara", desc: "A traveling cartographer, quick-witted and road-worn." },
    npc: { name: "Tomas", desc: "A young ferryhand who fled the landing with Mara when the raiders came." },
    recap: "You and Tomas ran from the landing when the raiders came, and the shouting behind you has faded but not stopped.",
    scene: "A ditch behind an abandoned cart on the east road; Tomas crouches beside Mara.",
    action: `I've been running for an hour and my legs are giving out. I drop to my knees behind the cart and tie the bandage around my arm myself. If they find us here, I'd rather fight than run again. We wait.`,
    stole: /\bI (drop to my knees|tie the bandage around my arm)|my legs are giving out|I'd rather fight than run again/i,
  },
  {
    name: "return", persona: { name: "Mara", desc: "A traveling cartographer, quick-witted and road-worn." },
    npc: { name: "Lysa", desc: "The innkeeper's daughter, warm and stubborn, who waited a long year for Mara to come back." },
    recap: "You step off the ferry after a year away, and Lysa is the first face you see on the jetty.",
    scene: "The jetty at dusk; Lysa stands frozen with a basket of nets.",
    action: `I take her hand and pull her close. I tell her I missed her every single day I was gone, and I kiss her forehead.`,
    stole: /\bI (take her hand|pull her close|kiss her forehead|missed her)|every (single )?day I was gone/i,
  },
  {
    name: "smithy", persona: null,
    npc: { name: "Harl", desc: "A gruff blacksmith who hates haggling and loves honest work." },
    recap: "You push into the smithy out of the rain, the heat of the forge hitting you like a wall.",
    scene: "Harl's smithy; Harl works the bellows behind the counter.",
    action: `I set my broken axe on his counter and ask what it'll cost to fix. I can't pay much, so I offer to sweep his shop for a week.`,
    stole: /\bI (set my (broken )?axe|ask what it'll cost|offer to sweep|can't pay much)/i,
  },
];

// Diary mode: the turn's second-person narration per case, and what a diary stealing the player's act says.
const DIARY = {
  flask: {
    narration: `You cross the firelight with an easy smile and hold out your flask. Elena does not take it at once. Her whetstone stops mid-stroke, and her gray eyes travel from your face to your hands and back. "I figured you could use a drink," you say. "Strangers who bring gifts usually want something," she answers, but after a long moment she takes the flask and drinks, never looking away from you.`,
    stole: /\bI (cross(ed)? the firelight|h[oe]ld out my flask|figured you could use)|\bmy flask\b/i,
  },
  bar: {
    narration: `You lean on the bar and order two drinks, then slide the second glass down to the quiet card player in the corner. "One for me, one for whoever wins the next hand." Dace lifts his hat brim an inch and studies you, then the glass. "Then it's mine," he says, and turns over a winning hand without looking at it.`,
    stole: /\bI (lean(ed)? on the bar|order(ed)? two drinks|slid(e)? the second glass)/i,
  },
  hiding: {
    narration: `Your legs finally give out behind the overturned cart, and you drop to your knees in the mud. You tie the bandage around your arm yourself, teeth clenched, while Tomas crouches beside you and watches the road. "If they find us here," you whisper, "I'd rather fight than run again." Tomas swallows and nods. Neither of you moves.`,
    stole: /\bI (dr[oa]p(ped)? to my knees|tied? the bandage around my arm)|my legs (finally )?(give|gave) out/i,
  },
  return: {
    narration: `You take Lysa's hand on the jetty and pull her close. "I missed you every single day I was gone," you tell her, and you kiss her forehead. The basket of nets slips from her arm. For a moment she only holds on, her face pressed to your coat, and then she laughs, wet and shaky. "A whole year," she says. "You could have written."`,
    stole: /every (single )?day I was gone|\bI (t(oo|a)ke? (her|Lysa's) hand|pull(ed)? her close|kiss(ed)? her forehead)/i,
  },
  smithy: {
    narration: `You set your broken axe on Harl's counter and ask what it will cost to fix. Harl wipes his hands, turns the axe over, and grunts at the split haft. "More than you've got, by the look of you." You admit you can't pay much and offer to sweep his shop for a week instead. He snorts, but he does not say no.`,
    stole: /\bI (set my (broken )?axe|ask(ed)? what it (will|would)|offer(ed)? to sweep)|\bmy (broken )?axe\b|I (can't|couldn't) pay/i,
  },
};

// The diary's rewrite: second-person words → the player's name, outside quoted speech.
export function rewriteSecondPerson(text, name) {
  const who = name || "the player character";
  const MAP = {
    "you're": `${who} is`, "you'll": `${who} will`, "you've": `${who} has`, "you'd": `${who} would`,
    you: who, your: `${who}'s`, yours: `${who}'s`, yourself: "themself", yourselves: "themselves",
  };
  const WORD = /\b(you['’](?:re|ll|ve|d)|you|your|yours|yourself|yourselves)\b/gi;
  const swap = (seg) => seg.replace(WORD, (m, _w, at, whole) => {
    const out = MAP[m.toLowerCase().replace("’", "'")];
    const start = !whole.slice(0, at).trim() || /[.!?*]\s*$/.test(whole.slice(0, at));
    return start ? out[0].toUpperCase() + out.slice(1) : out;
  });
  return text.split(/(["“][^"”]*["”])/).map((p, i) => (i % 2 ? p : swap(p))).join("");
}

// ---- Real prompt text, chips rendered the way the app's header form renders them. ----
const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from)).replaceAll("\\\n", "").trimEnd();
};
const SYS = grab("defaultCharacterPrompt");
const block = (header, body) => `\n\n## ${header}\n${body}`;
const renderSys = (c) =>
  SYS
    .replaceAll("<CHARACTER NAME>", c.npc.name)
    .replace(/<WORLD DESCRIPTION\|[^>]*>/, block("Game World", world))
    .replace(/<TRAITS DESCRIPTION\|[^>]*>/, "")
    .replace(/<PERSONA\|[^>]*>/, c.persona ? block("Player Character", `- **${c.persona.name}** - ${c.persona.desc}`) : "")
    .replace(/<LOCATION\|summary[^>]*>/, block("Current Location", `- **name:** ${location}`))
    .replace(/<LOCATION\|sublocations[^>]*>/, "")
    .replace(/<LOCATION\|reachable[^>]*>/, "");

// Mirrors buildCharacterUserMessage; only the action line changes per arm.
const actionLine = (c, arm) => {
  if (arm === "raw") return `The player's latest action: ${c.action}`;
  if (arm === "label") return `The player's latest action (their own words — any "I" / "me" / "my" here is the player character, not me): ${c.action}`;
  return `The player's latest action: ${rewriteFirstPerson(c.action, c.persona?.name)}`;
};
const renderUser = (c, arm) =>
  `You are ${c.npc.name}.\nMy background (who I am in general, not this exact moment): ${c.npc.desc}` +
  `\n\nWhat just happened (here "you" / "your" means the player character, not me):\n${c.recap}` +
  `\n\nScene right now: ${c.scene}\n\n${actionLine(c, arm)}` +
  `\n\nAs ${c.npc.name}, from where I stand in this scene, state in the first person what I want and what I do now.`;

// Mirrors buildDiaryUserMessage; only the account header and narration change per arm.
const DIARY_SYS = grab("defaultDiaryPrompt").replaceAll("<LANGUAGE>", "");
const renderDiarySys = (c) =>
  DIARY_SYS.replace(/<PERSONA\|[^>]*>/, c.persona ? ` The player character is ${c.persona.name}.` : "");
const renderDiaryUser = (c, arm) => {
  const d = DIARY[c.name], n = c.npc.name;
  const head = `You are ${n}.\nWho you are: ${c.npc.desc}`;
  const tail = `\n\nAs ${n}, write my own diary entry now - one or two sentences, first person ("I" = ${n}).`;
  if (arm === "raw") return `${head}\n\nAccount of what just happened:\n${d.narration}${tail}`;
  if (arm === "label") return `${head}\n\nAccount of what just happened (in it, "you" means the player character, not you - you appear as ${n}):\n${d.narration}${tail}`;
  return `${head}\n\nAccount of what just happened:\n${rewriteSecondPerson(d.narration, c.persona?.name)}${tail}`;
};
const sysFor = (c) => (PASS === "diary" ? renderDiarySys(c) : renderSys(c));
const userFor = (c, arm) => (PASS === "diary" ? renderDiaryUser(c, arm) : renderUser(c, arm));

const seedBase = argVal("--seed"); // run r uses seedBase + r, the same seed for every arm
async function call(sys, user, r = 0) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const seed = seedBase === null ? {} : { seed: Number(seedBase) + r };
  const res = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: maxTokens, reasoning_effort: "none", stream: false, ...seed }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const unquoted = (s) => s.replace(/["“][^"”]*["”]/g, " ");
const PARROT_VERBS = "walk|smile|hold|lean|order|slide|drop|tie|take|pull|tell|kiss|set|ask|offer|wait|cross|admit|are";
const score = (c, out) => {
  const bare = unquoted(out);
  const who = c.persona?.name ? c.persona.name : "the player character";
  return {
    stole: (PASS === "diary" ? DIARY[c.name].stole : c.stole).test(out),
    nothing: /nothing notable/i.test(out),
    you: /\b(you|your)\b/i.test(bare),
    self3: new RegExp(`\\b${c.npc.name}\\b`).test(bare),
    parrot: new RegExp(`\\b${who}('s group)? (${PARROT_VERBS})\\b`, "i").test(bare),
    named: !!c.persona && new RegExp(`\\b${c.persona.name}\\b`).test(out),
  };
};

if (args.includes("--show-rewrites")) {
  for (const c of CASES) {
    const [src, out] = PASS === "diary"
      ? [DIARY[c.name].narration, rewriteSecondPerson(DIARY[c.name].narration, c.persona?.name)]
      : [c.action, rewriteFirstPerson(c.action, c.persona?.name)];
    console.log(`${c.name}:\n  ${src}\n→ ${out}\n`);
  }
  process.exit(0);
}

const pick = CASES.filter((c) => !only || c.name.includes(only));
console.log(`POV rewrite probe · ${PASS} pass · ${endpoint} · "${model}" · ${pick.length} case(s) · ${runs} run(s) · arms ${ARMS.join("/")}\n`);
await call(sysFor(pick[0]), "warm up").catch(() => {});

const T = Object.fromEntries(ARMS.map((a) => [a, { n: 0, err: 0, stole: 0, you: 0, self3: 0, parrot: 0, named: 0, nothing: 0 }]));
const perCase = {};
for (const c of pick) {
  console.log(`######## ${c.name}`);
  for (let r = 0; r < runs; r++) {
    for (const arm of ARMS) {
      let out;
      try { out = await call(sysFor(c), userFor(c, arm), r); } catch (e) { T[arm].err++; console.log(`  #${r + 1} ${arm} ERROR ${e.message}`); continue; }
      const s = score(c, out);
      T[arm].n++;
      for (const k of ["stole", "you", "self3", "parrot", "named", "nothing"]) if (s[k]) T[arm][k]++;
      const key = `${c.name}/${arm}`; perCase[key] = (perCase[key] || 0) + (s.stole ? 1 : 0);
      const flags = Object.entries(s).filter(([, v]) => v).map(([k]) => k.toUpperCase()).join(",");
      console.log(`  #${r + 1} ${arm.padEnd(7)} ${flags.padEnd(18)} ${out.replace(/\s+/g, " ")}`);
    }
  }
}
console.log(`\n==== STOLE per case ====`);
for (const c of pick) console.log(`  ${c.name.padEnd(8)} ${ARMS.map((a) => `${a} ${perCase[`${c.name}/${a}`] || 0}/${runs}`).join(" · ")}`);
console.log(`\n==== totals ====`);
for (const a of ARMS) {
  const t = T[a];
  console.log(`  ${a.padEnd(7)} n=${t.n} err=${t.err} · STOLE ${t.stole} · YOU ${t.you} · SELF3 ${t.self3} · PARROT ${t.parrot} · NAMED ${t.named} (of persona cases) · NOTHING ${t.nothing}`);
}
