// Dialogue probe — tests whether the narration model actually lets characters SPEAK, or defers to silence.
// Fires the real narration prompt (defaultSystemPrompt) at scenarios engineered so a spoken reply is the
// obvious outcome: a present, willing, talkative NPC is directly asked/addressed. Silence here is a model
// tic, not a scene-appropriate choice. Reports, per run, whether any NPC line appears and how heavily the
// prose leans on silence motifs; prints the prose to read. Defaults to the FieryLion default endpoint.
//
// Usage:  node dialogue-probe.mjs [--endpoint URL] [--model default] [--runs 4] [--max 380] [--only price]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "4"));
const maxTokens = Number(argVal("--max", "380"));
const only = argVal("--only");
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const { world, playerTrait, location } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

// Dialogue-bait cases: each NPC is framed as present, willing, and mid-conversation, so a spoken answer is
// the natural continuation. `expects` is a human note on what a talkative narrator would say.
const CASES = [
  {
    name: "ask-price",
    entities: [{ name: "Bram", description: "A one-armed ferryman, chatty and fond of a haggle.", type: "Person" }],
    prevNarration: "Bram leans on his pole and grins, clearly in a mood to talk. \"Ferry's still running, if you've the coin for it,\" he says, waiting on you.",
    action: "I ask Bram what the crossing costs tonight.",
    expects: "Bram states a price / haggles aloud.",
  },
  {
    name: "ask-directions",
    entities: [{ name: "Odette", description: "A market woman who calls out to every passer-by; loves to gossip.", type: "Person" }],
    prevNarration: "Odette waves you over from her stall, already talking. \"You look lost, love. Ask me anything, I know this hamlet better than the priest.\"",
    action: "I ask Odette which road leads to the capital.",
    expects: "Odette gives directions aloud, probably with a tangent.",
  },
  {
    name: "reunion",
    entities: [{ name: "Mira", description: "An old friend of the player's, warm and talkative.", type: "Person" }],
    prevNarration: "Mira throws her arms around you, laughing through tears. \"I can't believe it's you! After all this time!\" She pulls back to look at you properly.",
    action: "I ask Mira why she never wrote back.",
    expects: "Mira answers the emotional question aloud.",
  },
  {
    name: "gossip",
    entities: [{ name: "Tomas", description: "A barkeep who polishes mugs and never stops chatting.", type: "Person" }],
    prevNarration: "Tomas slides a mug toward you and leans in, eager. \"You want the news? I've got all of it. Storm, strangers, the lot.\"",
    action: "I ask Tomas what he knows about the strangers who came upriver.",
    expects: "Tomas dishes the gossip aloud.",
  },
  {
    name: "two-party",
    entities: [
      { name: "Bram", description: "A one-armed ferryman, chatty.", type: "Person" },
      { name: "Odette", description: "A gossipy market woman.", type: "Person" },
    ],
    prevNarration: "Bram and Odette are mid-argument about the tides, both talking over each other, when they notice you and turn, expectant.",
    action: "I ask the two of them which crossing is safest after dark.",
    expects: "Both (or at least one) reply aloud, ideally bickering.",
  },
];

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultSystemPrompt");
const MARKDOWN_ON = `## Formatting
- Write immersive, flowing prose - never a list, menu, or table.
- Reach for Markdown emphasis where it genuinely lands: **bold** the single most important noun of the moment and *italicize* a sharp inner thought, sound, or stressed word.`;
const renderEntities = (entities) =>
  entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join("\n");
const renderSys = (c) =>
  SYS
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", MARKDOWN_ON)
    .replaceAll("<WORLD DESCRIPTION>", world)
    .replaceAll("<DICTIONARY|before>", "N/A")
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady")
    .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${playerTrait}`)
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${location}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
    .replaceAll("<ENTITIES|markdown>", renderEntities(c.entities))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
    .replaceAll("<DICTIONARY>", "N/A");

async function call(sys, messages) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, ...messages], max_tokens: maxTokens, stream: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const QUOTE_RE = /("[^"]{3,}"|[“][^”]{3,}[”])/g;
const SILENCE_RE = /\b(silen\w+|quiet\w*|unspoken|wordless|says? nothing|said nothing|without a word|no reply|no answer|hush\w*|mute\w*|stillness|only a look|evaluating\b)\b/gi;
const SPEECH_VERB = /(said|says|grunt\w*|repl\w+|mutter\w*|echo\w*|call\w*|beam\w*|repeat\w*|answer\w*|growl\w*|sigh\w*|murmur\w*|whisper\w*|offer\w*|grins?|chuckl\w*|laugh\w*|snap\w*|bark\w*)/i;
// A quote is the NPC's only when it carries a third-person speech attribution nearby (a name or he/she/they
// + a speaking verb) and isn't the player's line ("you ..."). This is deliberately strict: the model tends
// to quote the PLAYER asking and then NOT answer, so a naive quote count wildly overstates NPC dialogue.
const isNpcQuote = (text, idx, len) => {
  const before = text.slice(Math.max(0, idx - 55), idx);
  const win = before + " " + text.slice(idx + len, idx + len + 55);
  if (/\byou(r)?\b/i.test(before)) return false;
  return /\b(he|she|they|him|her|his|[A-Z][a-z]+)\b/.test(win) && SPEECH_VERB.test(win);
};

const pick = CASES.filter((c) => !only || c.name.includes(only));
console.log(`Dialogue probe · ${endpoint} · "${model}" · ${pick.length} case(s) · ${runs} run(s)/case\n`);
await call(renderSys(pick[0]), [{ role: "user", content: "warm up" }]).catch(() => {});

const totals = { runs: 0, npcSpoke: 0, silenceHits: 0 };
for (const c of pick) {
  let npcSpoke = 0, silence = 0;
  console.log(`\n######## ${c.name} — expects: ${c.expects}`);
  for (let r = 0; r < runs; r++) {
    let out, err = null;
    try {
      out = await call(renderSys(c), [
        { role: "assistant", content: c.prevNarration },
        { role: "user", content: `Player action: ${c.action}` },
      ]);
    } catch (e) { err = String(e.message || e); }
    totals.runs++;
    if (err) { console.log(`  #${r + 1} ERROR: ${err}`); continue; }
    const quotes = [...out.matchAll(QUOTE_RE)];
    const npcQuotes = quotes.filter((m) => isNpcQuote(out, m.index, m[0].length));
    const sil = (out.match(SILENCE_RE) || []).length;
    const hasNpc = npcQuotes.length > 0;
    if (hasNpc) { npcSpoke++; totals.npcSpoke++; }
    silence += sil; totals.silenceHits += sil;
    console.log(`  #${r + 1} ${hasNpc ? "NPC-SPOKE" : "SILENT"} · quotes ${quotes.length} (npc ${npcQuotes.length}) · silence-motif ${sil}`);
    console.log(out.split("\n").filter(Boolean).map((l) => "      " + l).join("\n"));
  }
  console.log(`  -> ${c.name}: NPC spoke ${npcSpoke}/${runs} · silence-motif ${silence} total`);
}
console.log(`\n==== NPC spoke in ${totals.npcSpoke}/${totals.runs} turns · silence-motif ${(totals.silenceHits / totals.runs).toFixed(1)}/turn ====`);
