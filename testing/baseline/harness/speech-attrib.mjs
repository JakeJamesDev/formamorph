// Speaker attribution for narration passages — who said which quoted line, the player or someone else.
// Shared by action-enactment-probe (single-turn) and rider-ablation-probe (long session) so the two can
// be compared directly; a change here moves both.
//
// Two bugs this module exists to not repeat:
//   - a wide lookback credits the NPC's reply to the player when the prose restates the action first
//     ("You tell Bram what you think." ... two sentences later Bram speaks) — attribution is sentence-local.
//   - a narrow speech-verb list silently books the player's own line to the NPC, which BOTH undercounts
//     player speech and scores their words as the NPC parroting them — the verb list is deliberately wide.

export const QUOTE_RE = /("[^"]{2,}"|[“][^”]{2,}[”])/g;

const PC_VERB_STEMS = [
  "say", "ask", "whisper", "murmur", "tell", "reply", "answer", "breathe", "call", "promise", "offer",
  "add", "manage", "repeat", "echo", "press", "insist", "admit", "confess", "mutter", "mumble", "snap",
  "spit", "lie", "shout", "hiss", "growl", "plead", "beg", "counter", "explain", "state", "describe",
  "demand", "urge", "argue", "protest", "confide", "venture", "blurt", "stammer", "swear", "warn",
  "agree", "remark", "note", "observe", "continue", "begin", "finish", "return", "voice", "speak",
  "declare", "announce", "correct", "concede", "object", "reason", "sigh", "laugh", "rasp", "tease",
];
const PC_VERB = `(?:${[...PC_VERB_STEMS, ...PC_VERB_STEMS.map((v) => `${v}s`), "said", "told", "spoke", "began", "swore", "lied"].join("|")})`;
const PC_BEFORE = new RegExp(`\\byou(?:r voice)?\\s+(?:\\w+\\s+){0,3}?${PC_VERB}\\b`, "i");
const PC_AFTER = new RegExp(`^[,—-]?\\s*you\\s+${PC_VERB}\\b`, "i");

const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A sentence that opens as a dialogue tag — "you ask them both", "Mara says quietly", "she breathes".
const TAG_START = new RegExp(`^\\s*(?:you|he|she|they|[A-Z][a-z]+)\\s+(?:\\w+\\s+){0,2}?${PC_VERB}\\b`, "i");

/** Split a passage's quoted lines into the player's and everyone else's. `cast` = names present. */
export function splitQuotes(text, cast = []) {
  const pc = [], npc = [];
  const named = (s) => cast.some((n) => new RegExp(`\\b${rx(n.split(/\s+/)[0])}\\b`).test(s));
  const sentences = text.split(/(?<=[.!?…]["'”’]?)\s+/);
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    QUOTE_RE.lastIndex = 0;
    let m;
    while ((m = QUOTE_RE.exec(s))) {
      const body = m[0].replace(/^["“]|["”]$/g, "");
      const after = s.slice(m.index + m[0].length, m.index + m[0].length + 30);
      const outside = s.slice(0, m.index) + s.slice(m.index + m[0].length);
      // Same sentence decides when it can: a cast name means theirs, a "you ... say" means the player's.
      if (named(outside)) { npc.push(body); continue; }
      if (PC_BEFORE.test(outside) || PC_AFTER.test(after)) { pc.push(body); continue; }
      // A quote ending in ? or ! splits off into its own sentence, leaving the tag ("you ask them both")
      // in the NEXT one — so look forward before falling back, or every question the player asks reads
      // as silence.
      const next = sentences[i + 1] ?? "";
      if (TAG_START.test(next)) {
        if (named(next.split(/\s+/).slice(0, 4).join(" "))) { npc.push(body); continue; }
        if (PC_BEFORE.test(next)) { pc.push(body); continue; }
      }
      const prev = sentences[i - 1] ?? "";
      if (named(prev)) npc.push(body);
      else if (PC_BEFORE.test(prev)) pc.push(body);
      else npc.push(body); // unattributed defaults to the world, never to the player
    }
  }
  return { pc, npc };
}

const STOP = new Set("i a an and the to my me of in on at with for as it is was be you your her his their them that this so into onto but or if then him she he what about".split(" "));
export const content = (s) => [...new Set(s.toLowerCase().match(/[a-z']{3,}/g)?.filter((w) => !STOP.has(w)) ?? [])];

/** How much of the action's own vocabulary comes back inside the NPC's quotes — the parrot failure. */
export function parrotScore(action, npcQuotes) {
  const want = content(action);
  if (!want.length || !npcQuotes.length) return 0;
  const said = new Set(content(npcQuotes.join(" ")));
  return want.filter((w) => said.has(w)).length / want.length;
}
