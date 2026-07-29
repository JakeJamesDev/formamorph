// Un-baited dialogue probe — the counterpart to dialogue-probe.mjs. Where that one forces a spoken reply
// (NPC mid-conversation, directly asked), this one does NOT: the NPC is present but passive, the prior
// narration carries NO NPC quotes, and the player's action is ambient/indirect (browse, approach, watch,
// keep walking). A talkative narrator still gives the NPC a natural line (a greeting, a challenge, small
// talk); a silence-prone model narrates around them with description and inner thought. THIS is the scene
// type that reproduces the "characters don't speak" complaint. Same metrics as the baited probe.
//
// Usage:  node dialogue-unbaited-probe.mjs [--endpoint URL] [--model default] [--runs 3] [--max 380] [--only tavern]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Unpinned stage: the app sends no temperature here, so the endpoint's own value applies. --temp/--reppen
// let a sweep set it explicitly; omitted, the request is byte-identical to before.
const SAMPLER_EXTRA = {};
{
  const a = process.argv.slice(2);
  const t = a.indexOf("--temp"); if (t >= 0) SAMPLER_EXTRA.temperature = Number(a[t + 1]);
  const r = a.indexOf("--reppen"); if (r >= 0) SAMPLER_EXTRA.repetition_penalty = Number(a[r + 1]);
}


const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const runs = Number(argVal("--runs", "3"));
const maxTokens = Number(argVal("--max", "380"));
const only = argVal("--only");
const bare = args.includes("--bare"); // ablation: send the bare action instead of the real user template
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const { world, playerTrait, location } = JSON.parse(
  await readFile(path.resolve(HARNESS_DIR, "../planning-cases.json"), "utf8"),
);

// Un-baited cases: NPC present but NOT speaking, prevNarration free of NPC quotes, action is ambient/indirect.
// `expects` is what a talkative narrator would do anyway — a natural unprompted line.
const CASES = [
  {
    name: "tavern-arrival",
    framing: "engaged",
    entities: [{ name: "Tomas", description: "The barkeep, wiping down mugs behind the counter.", type: "Person" }],
    prevNarration: "The tavern is low and warm, a few patrons hunched over their cups. Behind the counter, a heavyset barkeep works a rag around the rim of a mug, glancing up as the door swings shut behind you.",
    action: "I cross to the bar and set my pack down on a stool.",
    expects: "A talkative barkeep greets/asks what you'll have, unprompted.",
  },
  {
    name: "gate-guard",
    framing: "engaged",
    entities: [{ name: "Halvard", description: "A gate guard in a mud-spattered tabard, spear butt planted in the dirt.", type: "Person" }],
    prevNarration: "The hamlet's gate is little more than two posts and a swung-back hurdle. A guard leans on his spear beneath it, watching the road, his eyes tracking you as you come up the rise.",
    action: "I walk up to the gate and slow my pace, letting him see my empty hands.",
    expects: "The guard challenges or greets you aloud rather than silently waving you through.",
  },
  {
    name: "dock-worker",
    framing: "withdrawn",
    entities: [{ name: "Sedge", description: "A weathered fisherwoman mending a net, absorbed in the work.", type: "Person" }],
    prevNarration: "Out on the jetty a woman sits on an upturned crate, a great tangle of net across her knees, her needle flashing as she works a tear closed. She has not looked up.",
    action: "I wander out onto the jetty and stand near her, watching her hands work the net.",
    expects: "She acknowledges you with a line — a wary hello, a comment on the work.",
  },
  {
    name: "market-browse",
    framing: "neutral",
    entities: [{ name: "Pell", description: "A fruit-seller arranging his stall, calling prices to no one in particular.", type: "Person" }],
    prevNarration: "The market is thinning as the light goes. At one stall a wiry man stacks bruised apples into a careful pyramid, straightening the topmost fruit with a fussy sort of pride.",
    action: "I stop at the stall and look over what he has left.",
    expects: "The seller pitches you aloud — a price, a patter, a hard-sell on the apples.",
  },
  {
    name: "road-companion",
    framing: "neutral",
    entities: [{ name: "Rook", description: "A traveling companion walking the road beside the player; easy company, prone to filling silences.", type: "Person" }],
    prevNarration: "The road runs on into the dusk, hedgerows black against a bruised sky. Rook walks at your shoulder, kicking a stone ahead of him, the only sound your two sets of boots on the packed dirt.",
    action: "I keep walking, watching the treeline for the first lights of the next village.",
    expects: "Rook breaks the silence with a line — a remark, a question, idle talk.",
  },
  // ── Expectant cases (framing: "expectant"): the NPC is oriented toward the player and socially DUE to
  // speak — mid-transaction, sharing a table, awaiting an instruction — yet the player's action still says
  // nothing to them, so these stay un-baited. They separate "the prompt suppresses unprompted speech" from
  // "the prior narration established a withdrawn NPC and the model is correctly carrying that forward".
  {
    name: "expectant-ferry-boarding",
    framing: "expectant",
    entities: [{ name: "the ferryman", description: "A river ferryman working a rope crossing; paid, and about to cast off.", type: "Person" }],
    prevNarration: "The ferryman pockets your coin without counting it and turns to the mooring rope, working the knot loose with two thick fingers. He glances back over his shoulder at you, then at the flat brown water, waiting on you to settle before he pushes off.",
    action: "I step aboard and stow my pack between my boots.",
    expects: "He says something as he casts off — a warning, a remark on the crossing, small talk.",
  },
  {
    name: "expectant-shared-table",
    framing: "expectant",
    entities: [{ name: "the traveler", description: "Another traveler taking the last free seat at the common table.", type: "Person" }],
    prevNarration: "A woman in road-stained wool sets her bowl down across from you and swings a leg over the bench, the only free seat left in the crowded room. She pulls back her hood, catches your eye across the table, and reaches for the salt.",
    action: "I keep eating, making room for her elbow.",
    expects: "She opens with a line — a greeting, a complaint about the road, a question.",
  },
  {
    name: "expectant-stablehand",
    framing: "expectant",
    entities: [{ name: "the stablehand", description: "A stablehand holding the horse's bridle, waiting on the player's word.", type: "Person" }],
    prevNarration: "The stablehand takes the bridle and holds it, one hand on the mare's cheek strap, looking to you. He does not lead her off yet - he is waiting to be told how long you mean to stay.",
    action: "I run a hand down the mare's foreleg, checking the swelling above the fetlock.",
    expects: "He asks — how long, what feed, whether she's lame — rather than standing mute.",
  },
  // ── Negative controls (guard=true): nobody who can speak. Any quoted line here is over-fire, so an
  // initiative clause that raises the cases above must leave these at zero. Reported as their own axis.
  {
    name: "guard-empty-room",
    guard: true,
    entities: [],
    prevNarration: "The waystation's common room is long abandoned, the hearth cold and drifted with ash. Rain finds its way through the roof in two places, and the only sound is water striking rotten boards.",
    action: "I set my lamp on the table and start going through the cupboards.",
    expects: "Nobody is present — no quoted speech at all.",
  },
  {
    name: "guard-mute-companion",
    guard: true,
    entities: [{ name: "the mare", description: "A packhorse, tired and footsore. An animal; she does not speak.", type: "Animal" }],
    prevNarration: "The mare stands hipshot at the end of her lead, head low, steam rising off her flanks in the cold. She has carried you a long way today and it shows in every line of her.",
    action: "I loosen the girth and rub her down while she cools.",
    expects: "An animal cannot speak — no quoted speech at all.",
  },
];

// --source <file>: read the prompts from a snapshot (e.g. `git show <rev>:...GamePrompts.ts` dumped to the
// scratchpad) instead of the working tree — baseline arms without touching checked-out files.
const source = await readFile(argVal("--source") ?? path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from));
};
const SYS = grab("defaultSystemPrompt");
const MARKDOWN_ON = grab("MARKDOWN_ON");   // read the real markdown guidance so formatting changes are tested
// The app's thinking-off narration turn is the user TEMPLATE rendered, not the bare action — it carries the
// voice clause, the strongest dialogue lever measured (~3x participation). A probe sending the bare action
// measures a strictly weaker config than production and reads near-zero. `--bare` restores it for ablation.
const USER_TMPL = grab("defaultNarrationUserPrompt");
const renderUser = (action) => (bare ? action : USER_TMPL.replaceAll("<PLAYER ACTION>", action));
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
    // reasoning_effort:"none" suppresses thinking on Ollama's /v1 for Gemma-4 models (meromero) — else it
    // spends the whole budget reasoning and returns empty content. Harmless/ignored on non-thinking models.
    body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, ...messages], max_tokens: maxTokens, reasoning_effort: "none", stream: false, ...SAMPLER_EXTRA }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const QUOTE_RE = /("[^"]{3,}"|[“][^”]{3,}[”])/g;
const SILENCE_RE = /\b(silen\w+|quiet\w*|unspoken|wordless|says? nothing|said nothing|without a word|no reply|no answer|hush\w*|mute\w*|stillness|only a look|evaluating\b)\b/gi;
const SPEECH_VERB = /(said|says|grunt\w*|repl\w+|mutter\w*|echo\w*|call\w*|beam\w*|repeat\w*|answer\w*|growl\w*|sigh\w*|murmur\w*|whisper\w*|offer\w*|grins?|chuckl\w*|laugh\w*|snap\w*|bark\w*|greet\w*|ask\w*)/i;
const isNpcQuote = (text, idx, len) => {
  const before = text.slice(Math.max(0, idx - 55), idx);
  const win = before + " " + text.slice(idx + len, idx + len + 55);
  if (/\byou(r)?\b/i.test(before)) return false;
  return /\b(he|she|they|him|her|his|[A-Z][a-z]+)\b/.test(win) && SPEECH_VERB.test(win);
};
const BOLD_RE = /\*\*[^*]+\*\*/g;   // #2: bold-noun reflex — count **...** spans per response
// #1: PC re-description tic — how often the narrator re-stamps the player's fixed features in one turn
const PC_TIC_RE = /(silver hair|silver of your hair|silver in your hair|ink[- ]stain\w*|ink beneath|ink-stained|mapmaker|map[- ]?case|map[- ]?tubes?|cartographer)/gi;

const pick = CASES.filter((c) => !only || c.name.includes(only));
console.log(`Un-baited dialogue probe · ${endpoint} · "${model}" · ${pick.length} case(s) · ${runs} run(s)/case\n`);
await call(renderSys(pick[0]), [{ role: "user", content: "warm up" }]).catch(() => {});

const totals = { runs: 0, npcSpoke: 0, silenceHits: 0, bold: 0, pcTic: 0, guardRuns: 0, guardQuotes: 0 };
// Per-framing tally: does the prior narration's framing of the NPC (withdrawn / neutral / engaged /
// expectant) explain the silence? Withdrawn scenes staying quiet is arguably correct continuity;
// expectant scenes staying quiet is not.
const byFraming = {};
for (const c of pick) {
  let npcSpoke = 0, silence = 0;
  console.log(`\n######## ${c.name} — expects: ${c.expects}`);
  for (let r = 0; r < runs; r++) {
    let out, err = null;
    try {
      out = await call(renderSys(c), [
        { role: "assistant", content: c.prevNarration },
        // No "Player action:" wrapper (dropped 2026-07-21); the user turn is the rendered narration template.
        { role: "user", content: renderUser(c.action) },
      ]);
    } catch (e) { err = String(e.message || e); }
    if (!c.guard) totals.runs++;
    if (err) { console.log(`  #${r + 1} ERROR: ${err}`); continue; }
    const quotes = [...out.matchAll(QUOTE_RE)];
    const npcQuotes = quotes.filter((m) => isNpcQuote(out, m.index, m[0].length));
    const sil = (out.match(SILENCE_RE) || []).length;
    const hasNpc = npcQuotes.length > 0;
    // Guard cases score the opposite way: ANY quoted speech is over-fire (nobody there can talk).
    if (c.guard) { totals.guardRuns++; totals.guardQuotes += quotes.length; }
    else {
      const f = (byFraming[c.framing] ??= { runs: 0, spoke: 0 });
      f.runs++;
      if (hasNpc) { f.spoke++; npcSpoke++; totals.npcSpoke++; }
    }
    const bold = (out.match(BOLD_RE) || []).length;
    const pcTic = (out.match(PC_TIC_RE) || []).length;
    silence += sil; totals.silenceHits += sil; totals.bold += bold; totals.pcTic += pcTic;
    const verdict = c.guard ? (quotes.length ? "OVER-FIRE" : "clean") : (hasNpc ? "NPC-SPOKE" : "SILENT");
    console.log(`  #${r + 1} ${verdict} · quotes ${quotes.length} (npc ${npcQuotes.length}) · silence-motif ${sil} · bold ${bold} · pc-tic ${pcTic}`);
    console.log(out.split("\n").filter(Boolean).map((l) => "      " + l).join("\n"));
  }
  if (!c.guard) console.log(`  -> ${c.name}: NPC spoke ${npcSpoke}/${runs} · silence-motif ${silence} total`);
}
console.log(`\n==== NPC spoke in ${totals.npcSpoke}/${totals.runs} turns · silence-motif ${(totals.silenceHits / totals.runs).toFixed(1)}/turn · bold ${(totals.bold / totals.runs).toFixed(1)}/turn · pc-tic ${(totals.pcTic / totals.runs).toFixed(1)}/turn ====`);
const framingLine = ["expectant", "engaged", "neutral", "withdrawn"]
  .filter((f) => byFraming[f])
  .map((f) => `${f} ${byFraming[f].spoke}/${byFraming[f].runs}`)
  .join(" · ");
console.log(`==== by prior-narration framing: ${framingLine} ====`);
console.log(`==== over-fire guard (no-speaker scenes): ${totals.guardQuotes} quote(s) in ${totals.guardRuns} runs — want 0 ====`);
