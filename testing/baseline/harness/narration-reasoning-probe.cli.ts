// Narration reasoning probe — what the narration system prompt costs a reasoning model in thought, by arm.
//
//   shipped   the narration system prompt as the app builds it.
//   one-exit  the three "never offer options" statements collapsed into one positive Output contract: the
//             intro's "a separate step presents the player's choices" sentence, the Formatting block's
//             "never a list, menu, or table", and the Output section's named-menu list. The first-beat clause
//             and the opening cue stay word for word.
//
// Both arms are built by buildNarrationPrompt on Sedge Landing; one-exit then cuts the built text, so every
// other byte is shared. Reasoning stays at the app's shipped narration setting (Global → Model Default: no
// effort literal sent). Paired seeds: LM Studio honors `seed`, so the prompt is the only difference.
//
// Per reply: reasoning tokens (usage) and chars · fmt (share of reasoning sentences about format rules) ·
// guards: leak (list, menu, bracket, or a closing question to the player) · narration words · quoted lines.
//
// Usage: npx vite-node testing/baseline/harness/narration-reasoning-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 3] [--only opening] [--arms shipped,one-exit] [--out file.json]
//          [--budget N] [--budget-message TEXT]   (sent as thinking_budget_tokens / reasoning_budget_message)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  defaultNarrationUserPrompt, defaultOocDirectivePrompt, defaultSystemPrompt, OPENING_SCENE_CUE,
} from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'http://127.0.0.1:1234/v1/chat/completions');
const model = argVal('--model', 'g4-meromero-v2-31b-i1');
const token = argVal('--token', process.env.PROBE_TOKEN ?? '');
const runs = Number(argVal('--runs', '3'));
const maxTokens = Number(argVal('--max', '6000'));
const only = argVal('--only', '');
const armNames = argVal('--arms', 'shipped,one-exit').split(',');
const out = argVal('--out', '');
const budget = argVal('--budget', '');
const budgetMessage = argVal('--budget-message', '');
const SEED = 7;

const BASELINE = path.resolve('testing/baseline');
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const enact = JSON.parse(readFileSync(path.join(BASELINE, 'action-enactment-cases.json'), 'utf8')) as Array<{
  id: string; location: string; action: string; prior: string;
}>;

// ── Cases: the opening (where a menu leak actually happens) plus mid-story turns from the enactment set ──
interface Case { id: string; location: string; action: string; prior: string | null }
const MID = ['enact-angry', 'enact-plead', 'ctl-walk', 'ctl-sit', 'imp-fly'];
const cases: Case[] = [
  { id: 'opening', location: 'Sedge Landing', action: '', prior: null },
  ...MID.map((id) => {
    const c = enact.find((entry) => entry.id === id);
    if (!c) throw new Error(`missing enactment case ${id}`);
    return c;
  }),
].filter((c) => !only || only.split(',').includes(c.id));

// ── Arms ──
/** Replaces one exact span, and fails loudly when the built prompt no longer holds it. */
function cut(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`arm text drifted, missing: ${from.slice(0, 60)}`);
  return text.replace(from, to);
}
const ARMS: Record<string, (prompt: string) => string> = {
  shipped: (p) => p,
  'one-exit': (p) => [
    [" Immediately after you, a separate step presents the player's choices, so offering options is never your job.", ''],
    ['- Write immersive, flowing prose - never a list, menu, or table.', '- Write immersive, flowing prose.'],
    [`Output only the story prose - the events themselves, with no labels, no mention of being an AI, and nothing after the scene ends. The choices step that follows you handles the player's options, so your reply never contains a question to the player, a list of actions, a "Choose"/"Options" menu, or a bracketed stage direction like [Player's turn].`,
      'Output only the story prose, ending when the scene ends.'],
  ].reduce((text, [from, to]) => cut(text, from, to), p),
};

const dictionary = (world.dictionaries ?? []).flatMap((book) => book.entries ?? []);
function systemPrompt(c: Case): string {
  const location = world.locations.find((candidate) => candidate.name === c.location);
  if (!location) throw new Error(`${c.id}: no location "${c.location}"`);
  const ctx = chipValues(authoredChipScene(world, {
    location,
    activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
    resolve: (text: string) => text,
  }));
  return buildNarrationPrompt({
    template: defaultSystemPrompt, ctx, action: c.action, history: [], dictionary,
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'auto', maxTokens: 1024, markdownOutput: true,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
}

const USER_RIDER = defaultNarrationUserPrompt.replace('<PLAYER ACTION>', '').trim();
function messagesFor(c: Case, arm: string) {
  const sys = ARMS[arm](systemPrompt(c));
  if (!c.prior) return [{ role: 'system', content: sys }, { role: 'user', content: OPENING_SCENE_CUE }];
  const ooc = /\[[^\]]+\]/.test(c.action) ? `\n\n${defaultOocDirectivePrompt}` : '';
  return [
    { role: 'system', content: sys },
    { role: 'user', content: 'Recap the story so far.' },
    { role: 'assistant', content: c.prior },
    { role: 'user', content: `${c.action}\n\n${USER_RIDER}${ooc}` },
  ];
}

interface Reply {
  content: string; reasoning: string; reasoningTokens: number | null; finish: string | undefined; ms: number;
}
// Narration is unpinned: no temperature, so the model's own config applies, as in the app.
async function call(messages: Array<{ role: string; content: string }>, seed: number): Promise<Reply> {
  const started = Date.now();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      model, messages, max_tokens: maxTokens, seed, stream: false,
      ...(budget ? { thinking_budget_tokens: Number(budget) } : {}),
      ...(budgetMessage ? { reasoning_budget_message: budgetMessage } : {}),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json() as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string; reasoning?: string }; finish_reason?: string }>;
    usage?: { completion_tokens_details?: { reasoning_tokens?: number } };
  };
  const msg = j.choices?.[0]?.message ?? {};
  return {
    content: (msg.content ?? '').trim(),
    reasoning: (msg.reasoning_content ?? msg.reasoning ?? '').trim(),
    reasoningTokens: j.usage?.completion_tokens_details?.reasoning_tokens ?? null,
    finish: j.choices?.[0]?.finish_reason,
    ms: Date.now() - started,
  };
}

// ── Scoring ──
const QUOTE = /"[^"\n]{2,}"|“[^”\n]{2,}”/g;
// A reasoning sentence about format: the rules the arms differ on, plus the rest of the formatting contract.
const FORMAT = /\b(options?|menus?|lists?|bullet\w*|choices?|choose|questions? to the player|bracket\w*|stage direction|labels?|AI|markdown|bold\w*|italic\w*|format\w*|second[- ]person|present tense|paragraphs?|constraints?|rules?|guidelines?|output only)\b/i;
const sentences = (t: string) => t.split(/(?<=[.!?:])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const fmtShare = (t: string) => {
  const s = sentences(t);
  return s.length ? s.filter((x) => FORMAT.test(x)).length / s.length : 0;
};
function leakOf(text: string): string {
  if (/^\s*(?:[-*•]|\d+[.)])\s/m.test(text)) return 'list';
  if (/\b(what do you do|what will you do|choose|options?:)/i.test(text)) return 'menu';
  if (/\[[^\]]*\]/.test(text)) return 'bracket';
  return /\?\s*$/.test(sentences(text.replace(QUOTE, 'Q')).at(-1) ?? '') ? 'question' : '';
}
// Drafted narration inside the reasoning: lines of second-person prose or quoted speech, not notes or bullets.
const draftShare = (t: string) => {
  const draft = t.split('\n').filter((l) => !/^\s*(?:[-*•]|\d+[.)])/.test(l) && /"[^"]{2,}"|“[^”]{2,}”|^\s*You\b/.test(l));
  return t.length ? draft.join('\n').length / t.length : 0;
};
const words = (t: string) => (t.match(/\S+/g) ?? []).length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

// Fail before the first request when a cut no longer matches.
for (const c of cases) for (const arm of armNames) messagesFor(c, arm);
const dump = argVal('--dump-messages', '');
if (dump) {
  writeFileSync(dump, JSON.stringify(messagesFor(cases[0], armNames[0]), null, 2));
  process.exit(0);
}

// ── Run: arms alternate inside each case and seed, so drift hits both alike ──
console.log(`NARRATION REASONING · "${model}" · ${cases.length} case(s) × ${runs} run(s) × ${armNames.join('/')}\n`);
console.log('case          arm        rTok  rChars  fmt%  dft%  words  quotes  leak      s');
const rows: Array<Reply & { case: string; arm: string; run: number; fmt: number; draft: number; words: number; quotes: number; leak: string }> = [];
for (const c of cases) {
  for (let r = 0; r < runs; r++) {
    for (const arm of armNames) {
      const reply = await call(messagesFor(c, arm), SEED + r);
      const row = {
        ...reply, case: c.id, arm, run: r, fmt: fmtShare(reply.reasoning), draft: draftShare(reply.reasoning),
        words: words(reply.content), quotes: (reply.content.match(QUOTE) ?? []).length, leak: leakOf(reply.content),
      };
      rows.push(row);
      if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
      console.log(`${c.id.padEnd(13)} ${arm.padEnd(9)} ${String(row.reasoningTokens ?? '-').padStart(5)} ${String(row.reasoning.length).padStart(7)} ${(row.fmt * 100).toFixed(0).padStart(5)} ${(row.draft * 100).toFixed(0).padStart(5)} ${String(row.words).padStart(6)} ${String(row.quotes).padStart(7)}  ${(row.leak || '-').padEnd(8)} ${(row.ms / 1000).toFixed(0).padStart(4)}${row.finish === 'length' ? '  TRUNCATED' : ''}`);
    }
  }
}

console.log('\narm        n  rTok med  rChars med  fmt% mean  dft% mean  words med  quotes mean  leaks  empty');
for (const arm of armNames) {
  const a = rows.filter((x) => x.arm === arm);
  const tok = a.map((x) => x.reasoningTokens).filter((x): x is number => x !== null);
  console.log(`${arm.padEnd(9)} ${String(a.length).padStart(2)}  ${String(tok.length ? median(tok) : '-').padStart(8)}  ${String(median(a.map((x) => x.reasoning.length))).padStart(10)}  ${(mean(a.map((x) => x.fmt)) * 100).toFixed(1).padStart(9)}  ${(mean(a.map((x) => x.draft)) * 100).toFixed(1).padStart(9)}  ${String(median(a.map((x) => x.words))).padStart(9)}  ${mean(a.map((x) => x.quotes)).toFixed(1).padStart(11)}  ${String(a.filter((x) => x.leak).length).padStart(5)}  ${String(a.filter((x) => !x.content).length).padStart(5)}`);
}
