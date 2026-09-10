// Advisory copy sweep for the app's instructional text: labels, hints, tooltips, placeholders, settings
// copy, help topics, and changelog leads. It pulls the strings out of whatever files it is given, runs each
// through a pattern table, and prints what looks off, grouped by rule. It never fails a build on its own:
// every pattern has false positives, so a person or an agent reads the snippet beside the rule and decides.
// `--strict` exits 1 when anything is flagged, for a future gate.
//
// The rules it encodes are the Writing Guide's help-line test and the Design System's field help order
// (docs/Writing-Guide.md, docs/Design-System.md). The noun half of the help-line test is a register lookup
// a regex cannot do, so under each file the report lists the labels it found there: the agent checks the
// hints' nouns against that list and the guide's term register.
//
//   node scripts/copySweep.mjs                 files changed on the branch and in the working tree
//   node scripts/copySweep.mjs src/managers    a directory, or one or more files
//   node scripts/copySweep.mjs --all           every source and docs file
//   node scripts/copySweep.mjs --strict ...    exit 1 on any finding

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

const ROOT = process.cwd();

// ── Scope ───────────────────────────────────────────────────────────────────────────────────────────

/** Text that is not instructional copy and keeps its own voice: prompts sent to a model, authored
 *  worlds, tests, and generated output. Paths are matched as substrings of the repo-relative path. */
const EXCLUDED = [
  '.test.', '.spec.', '/defaultworlds/', 'GamePrompts.ts', 'promptSamplers', '/testing/', '/dist/',
  '/node_modules/', '/graphify-out/', 'Changelog.md',
];
const CHANGELOG = 'docs/Changelog.md';
const EXTENSIONS = new Set(['.ts', '.tsx', '.md']);

// ── Extraction ───────────────────────────────────────────────────────────────────────────────────────

/** Attribute and property names whose string value is a control's own caption. */
const LABEL_KEYS = ['label', 'stripLabel', 'title', 'aria-label', 'ariaLabel', 'backLabel'];
/** Names whose string value explains a control: one line under a label, a tooltip, a popover body. */
const HINT_KEYS = ['description', 'tip', 'hint', 'placeholder', 'emptyIndicator', 'info', 'sentWhen', 'body', 'line'];
/** JSX elements whose text children are captions or help. */
const LABEL_TAGS = ['Label', 'SectionTitle', 'TabsTrigger', 'DialogTitle', 'CardTitle'];
const HINT_TAGS = ['Hint', 'Meta', 'FieldError', 'DialogDescription', 'p'];

/** One extracted string with where it came from and what kind of copy it is. */
function item(file, line, kind, text) {
  return { file, line, kind, text: text.replace(/\s+/g, ' ').trim() };
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/** Strings in a TypeScript or TSX file, by the name they hang off. Regex, not a parser: the shapes it
 *  reads are the handful the codebase uses for copy, and a miss is a quiet miss, not a wrong flag. */
function extractSource(file, source) {
  const out = [];
  const attr = new RegExp(`\\b(${[...LABEL_KEYS, ...HINT_KEYS].join('|')})\\s*[=:]\\s*(?:\\{\\s*)?(["'\`])([\\s\\S]*?)\\2`, 'g');
  for (const m of source.matchAll(attr)) {
    const kind = LABEL_KEYS.includes(m[1]) ? 'label' : 'hint';
    for (const para of m[3].split(/\n\s*\n/)) if (para.trim()) out.push(item(file, lineOf(source, m.index), kind, para));
  }
  const tag = new RegExp(`<(${[...LABEL_TAGS, ...HINT_TAGS].join('|')})(?:\\s[^>]*)?>([^<{]+)<`, 'g');
  for (const m of source.matchAll(tag)) {
    const kind = LABEL_TAGS.includes(m[1]) ? 'label' : 'hint';
    out.push(item(file, lineOf(source, m.index), kind, m[2]));
  }
  // Checkbox captions: a text node directly after a closed control inside a <label>.
  for (const m of source.matchAll(/\/>\s*\n?\s*([A-Z][^<{\n]{2,60})\n/g)) {
    out.push(item(file, lineOf(source, m.index), 'label', m[1]));
  }
  // Popover bodies and other long copy held in a `*_INFO` template literal.
  for (const m of source.matchAll(/const\s+\w+_INFO\s*=\s*`([\s\S]*?)`/g)) {
    // Paragraphs and list items are each one piece of copy; a bullet list is not one long sentence.
    for (const para of m[1].split(/\n\s*\n|\n(?=\s*- )/)) if (para.trim()) out.push(item(file, lineOf(source, m.index), 'hint', para.replace(/^\s*- /, '')));
  }
  return out;
}

/** Bold leads in the unreleased changelog section; they ship verbatim as release notes. */
function extractChangelog(file, source) {
  const out = [];
  const lines = source.split('\n');
  let inProgress = false;
  lines.forEach((line, i) => {
    if (/^## /.test(line)) inProgress = /In Progress/.test(line);
    if (!inProgress) return;
    const m = /^\s{2,}-\s+\*\*(.+?)\*\*/.exec(line);
    if (m) out.push(item(file, i + 1, 'hint', m[1]));
  });
  return out;
}

/** Prose paragraphs of a docs page. Headings and table rows are skipped; the tables hold labels. */
function extractMarkdown(file, source) {
  const out = [];
  source.split('\n').forEach((line, i) => {
    const text = line.trim();
    if (!text || /^[#|>`\-*]/.test(text) || /^\d+\./.test(text)) return;
    out.push(item(file, i + 1, 'hint', text));
  });
  return out;
}

// ── Rules ───────────────────────────────────────────────────────────────────────────────────────────

/** Words a title-cased label leaves lowercase when they are not first or last: AP style. */
const SMALL = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'nor', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'to', 'up', 'via', 'vs']);

function titleCaseProblem(text) {
  // Anything with sentence punctuation is a sentence, not a label; the sentence rules take it. A caption
  // built from a template is read around its interpolation, which the regex cannot see.
  if (/[.!?]$/.test(text) || text.split(' ').length > 8 || text.includes('${')) return null;
  const words = text.split(' ').filter((w) => /^[A-Za-z]/.test(w));
  const bad = words.filter((w, i) => {
    if (i === 0 || i === words.length - 1) return /^[a-z]/.test(w);
    return /^[a-z]/.test(w) && !SMALL.has(w.toLowerCase());
  });
  return bad.length ? `lowercase: ${bad.join(', ')}` : null;
}

/** Every rule: which kind it reads, how it matches, and the one-line reason the report prints. */
const RULES = [
  { name: 'label-case', kind: 'label', why: 'Control labels take AP title case.', test: titleCaseProblem },
  // A unit in parentheses, (%) or (ms), is part of the name, not an aside.
  { name: 'label-parenthetical', kind: 'label', why: 'A label names the field; the aside belongs in a Hint or a HintInfo.', re: /\((?!%\)|[a-z]{1,3}\)).*\)/ },
  // Possessives share the apostrophe, so `'s` is only flagged on the pronouns that contract with it.
  { name: 'contraction', kind: 'hint', why: 'Instructional copy is uncontracted; catalog and narration text keep contractions.', re: /\b(\w+['’](t|re|ll|ve|d|m)|(it|that|there|what|here|let|who|he|she)['’]s)\b/i },
  { name: 'not-but', kind: 'hint', why: 'Say what it does, never "not X but Y".', re: /\bnot (just |only )?[^.]{0,40}\bbut\b/i },
  // A popover's `**Term** — definition` line is its definition-list form, which the guide allows.
  { name: 'em-dash', kind: 'hint', why: 'No asides; write a second sentence.', test: (t) => (/^\*\*[^*]+\*\* — /.test(t) ? null : (/—|--/.test(t) ? '—' : null)) },
  { name: 'ellipsis', kind: 'hint', why: 'Copy does not trail off.', re: /\.\.\.|…/ },
  { name: 'filler', kind: 'hint', why: 'Drop the hedge or the courtesy.', re: /\b(please|just|simply|easily|basically|actually|really|quite|a bit|note that|keep in mind)\b/i },
  { name: 'metaphor-verb', kind: 'hint', why: 'The help-line test: verbs name the literal operation (match, activate, inject, scan, add, remove, show, hide, run, send, set).', re: /\b(fires?|fired|firing|drives?|driven|mutes?|muted|live|lives|stands? in|in play|out of the way|for free|in reach|on the fly|under the hood|kicks? in|lights? up|wakes? up|goes? into)\b/i },
  { name: 'undefined-noun', kind: 'hint', why: 'The help-line test: nouns are on-screen labels or registered terms.', re: /\b(the AI'?s? (mind|head|memory)|the story|the game world|the text|the system|the engine|the thing)\b/i },
  { name: 'passive', kind: 'hint', why: 'Active voice; name the actor.', re: /\b(is|are|was|were|be|been|being) \w+(ed|en) by\b/i },
  { name: 'long-sentence', kind: 'hint', why: 'One topic per sentence, about 20 words.', test: (t) => {
    const long = t.split(/(?<=[.!?])\s+/).filter((s) => s.split(/\s+/).length > 22);
    return long.length ? `${long[0].split(/\s+/).length} words` : null;
  } },
  { name: 'many-sentences', kind: 'hint', why: 'A hint is one or two sentences; more belongs behind a HintInfo.', test: (t) => {
    const n = t.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    return n > 3 ? `${n} sentences` : null;
  } },
  { name: 'term-character', kind: 'any', why: 'The word is entity. "Character" is only the AI pipeline\'s people-in-the-story machinery.', re: /\bcharacters?\b(?! card| pass| diary)/i },
  { name: 'term-phone', kind: 'any', why: 'The small-screen concept is mobile.', re: /\bphones?\b/i },
  { name: 'term-picture', kind: 'any', why: 'The app says image.', re: /\bpictures?\b/i },
  { name: 'second-person-ai', kind: 'hint', why: 'Say what the AI receives, not what it sees or knows.', re: /\bthe AI (sees|knows|thinks|remembers|understands|forgets)\b/i },
];

/** Source-level checks that are about mechanism, not text: raw type roles and sizes outside the module
 *  that owns them. */
const SOURCE_RULES = [
  { name: 'raw-font-size', why: 'Use a text role, never a hard-coded size.', re: /\btext-\[\d*\.?\d+(rem|px|em)\]/g },
  { name: 'raw-hint-role', why: 'Help text renders through Hint or Meta from the typography module.', re: /<(p|span)[^>]*className="[^"]*\btext-(helper|meta)\b[^"]*text-muted-foreground/g },
];

// ── Run ─────────────────────────────────────────────────────────────────────────────────────────────

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!['node_modules', 'dist', '.git', 'graphify-out'].includes(name)) walk(p, acc); }
    else acc.push(p);
  }
  return acc;
}

function changedFiles() {
  const run = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const set = new Set([...run('git diff --name-only main...HEAD'), ...run('git diff --name-only'), ...run('git diff --name-only --cached')]);
  return [...set].map((f) => join(ROOT, f));
}

function targets(args) {
  const paths = args.filter((a) => !a.startsWith('--'));
  let files;
  if (args.includes('--all')) files = walk(join(ROOT, 'src'), walk(join(ROOT, 'docs'), []));
  else if (paths.length) files = paths.flatMap((p) => (statSync(p).isDirectory() ? walk(p, []) : [p]));
  else files = changedFiles();
  return files
    .map((f) => relative(ROOT, f).split(sep).join('/'))
    .filter((f) => EXTENSIONS.has(extname(f)) && (f === CHANGELOG || !EXCLUDED.some((x) => `/${f}`.includes(x))))
    .filter((f) => { try { return statSync(join(ROOT, f)).isFile(); } catch { return false; } });
}

function sweep(files) {
  const findings = [];
  const labelsByFile = new Map();
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    const items = file === CHANGELOG ? extractChangelog(file, source)
      : file.endsWith('.md') ? extractMarkdown(file, source)
        : extractSource(file, source);
    labelsByFile.set(file, [...new Set(items.filter((i) => i.kind === 'label').map((i) => i.text))]);
    for (const it of items) {
      for (const rule of RULES) {
        if (rule.kind !== 'any' && rule.kind !== it.kind) continue;
        const detail = rule.test ? rule.test(it.text) : (rule.re.test(it.text) ? it.text.match(rule.re)[0] : null);
        if (detail) findings.push({ ...it, rule: rule.name, why: rule.why, detail });
      }
    }
    if (!file.endsWith('.md')) {
      for (const rule of SOURCE_RULES) {
        for (const m of source.matchAll(rule.re)) {
          findings.push({ file, line: lineOf(source, m.index), kind: 'source', text: m[0], rule: rule.name, why: rule.why, detail: m[0] });
        }
      }
    }
  }
  return { findings, labelsByFile };
}

function report({ findings, labelsByFile }, files) {
  const byRule = new Map();
  for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);
  const clip = (s, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  console.log(`copy sweep: ${files.length} file${files.length === 1 ? '' : 's'}, ${findings.length} notice${findings.length === 1 ? '' : 's'}\n`);
  for (const [rule, list] of [...byRule.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`── ${rule} (${list.length}) — ${list[0].why}`);
    for (const f of list) console.log(`   ${f.file}:${f.line}  [${f.detail}]  ${clip(f.text)}`);
    console.log('');
  }
  const withLabels = [...labelsByFile.entries()].filter(([, l]) => l.length);
  if (withLabels.length) {
    console.log('Labels on each screen, for the noun check (a hint\'s nouns are these or registered terms):');
    for (const [file, labels] of withLabels) console.log(`   ${file}: ${labels.join(' · ')}`);
    console.log('');
  }
  console.log('Advisory: read each snippet against docs/Writing-Guide.md before changing it.');
}

const args = process.argv.slice(2);
const files = targets(args);
if (!files.length) { console.log('copy sweep: nothing to read.'); process.exit(0); }
const result = sweep(files);
report(result, files);
process.exit(args.includes('--strict') && result.findings.length ? 1 : 0);
