// Advisory copy sweep for the app's instructional text: labels, hints, tooltips, placeholders, settings
// copy, help topics, and changelog leads. It pulls the strings out of whatever files it is given, runs each
// through a pattern table, and prints what looks off, grouped by rule. It never fails a build on its own:
// every pattern has false positives, so a person or an agent reads the snippet beside the rule and decides.
// `--strict` exits 1 when anything is flagged, for a future gate.
//
// The rules it encodes are the Writing Guide's help-line test, which follows Google's Material UX-writing
// pattern, and the Design System's field help order (docs/Writing-Guide.md, docs/Design-System.md). A
// control named in copy takes its on-screen casing, so under each file the report lists the labels it
// found there.
//
// Copy comes in four kinds. A `label` is a control's caption. A `line` is brief help beside a control: a
// description, a tooltip, a placeholder. A `popover` is a ⓘ body, which runs to several paragraphs.
// `prose` is a docs paragraph or a changelog lead. The help-line rules read lines and popovers, the period
// rule reads lines only, and the shared rules read everything but labels.
//
//   node scripts/copySweep.mjs                 files changed on the branch and in the working tree
//   node scripts/copySweep.mjs src/managers    a directory, or one or more files
//   node scripts/copySweep.mjs --all           every source and docs file
//   node scripts/copySweep.mjs --strict ...    exit 1 on any finding

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const HINT_KEYS = ['description', 'tip', 'hint', 'placeholder', 'emptyIndicator', 'sentWhen', 'line'];
/** Names whose string value is a ⓘ popover body. */
const POPOVER_KEYS = ['info', 'body'];
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
  const attr = new RegExp(`\\b(${[...LABEL_KEYS, ...HINT_KEYS, ...POPOVER_KEYS].join('|')})\\s*[=:]\\s*(?:\\{\\s*)?(["'\`])([\\s\\S]*?)\\2`, 'g');
  for (const m of source.matchAll(attr)) {
    const kind = LABEL_KEYS.includes(m[1]) ? 'label' : POPOVER_KEYS.includes(m[1]) ? 'popover' : 'line';
    for (const para of m[3].split(/\n\s*\n/)) if (para.trim()) out.push(item(file, lineOf(source, m.index), kind, para));
  }
  const tag = new RegExp(`<(${[...LABEL_TAGS, ...HINT_TAGS].join('|')})(?:\\s[^>]*)?>([^<{]+)<`, 'g');
  for (const m of source.matchAll(tag)) {
    const kind = LABEL_TAGS.includes(m[1]) ? 'label' : 'line';
    out.push(item(file, lineOf(source, m.index), kind, m[2]));
  }
  // Checkbox captions: a text node directly after a closed control inside a <label>.
  for (const m of source.matchAll(/\/>\s*\n?\s*([A-Z][^<{\n]{2,60})\n/g)) {
    out.push(item(file, lineOf(source, m.index), 'label', m[1]));
  }
  // Popover bodies and other long copy held in a `*_INFO` template literal.
  for (const m of source.matchAll(/const\s+\w+_INFO\s*=\s*`([\s\S]*?)`/g)) {
    // Paragraphs and list items are each one piece of copy; a bullet list is not one long sentence.
    for (const para of m[1].split(/\n\s*\n|\n(?=\s*- )/)) if (para.trim()) out.push(item(file, lineOf(source, m.index), 'popover', para.replace(/^\s*- /, '')));
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
    if (m) out.push(item(file, i + 1, 'prose', m[1]));
  });
  return out;
}

/** Prose paragraphs of a docs page. Headings and table rows are skipped; the tables hold labels. */
function extractMarkdown(file, source) {
  const out = [];
  source.split('\n').forEach((line, i) => {
    const text = line.trim();
    if (!text || /^[#|>`\-*]/.test(text) || /^\d+\./.test(text)) return;
    out.push(item(file, i + 1, 'prose', text));
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

/** The period rule for a line beside a control. Twin of `sentenceShapeViolation` in src/test/copyShape.ts,
 *  which the copy tests enforce; keep the two in step. */
export function sentenceShape(text) {
  const line = text.trim();
  // A caption built around an interpolation hides its own ending from the regex.
  if (line.includes('${')) return null;
  const multi = /[.!?]['’”)]?\s/.test(line);
  if (multi && !/[.!?]$/.test(line)) return 'several sentences but no final period';
  if (!multi && /\.$/.test(line)) return 'one sentence with a period';
  return null;
}

/** The period rule with abbreviations set aside, so "e.g. a name" reads as one sentence. */
function periodShape(text) {
  return sentenceShape(text.replace(/\b(e\.g|i\.e|etc|vs)\./gi, '$1'));
}

/** Every rule: which kind it reads (see `reads`), how it matches, and the one-line reason the report prints. */
export const RULES = [
  { name: 'label-case', kind: 'label', why: 'Control labels take AP title case.', test: titleCaseProblem },
  // A unit in parentheses, (%) or (ms), is part of the name, not an aside.
  { name: 'label-parenthetical', kind: 'label', why: 'A label names the field; the aside belongs in a Hint or a HintInfo.', re: /\((?!%\)|[a-z]{1,3}\)).*\)/ },
  // The help-line test's four rules, then its two extra checks.
  { name: 'app-subject', kind: 'help', why: 'Second person or no subject: start with the verb, never "the app", "Formamorph" or "we".', re: /(^|[.!?]\s+)(the app|the game|formamorph|we)\b/i },
  { name: 'on-off-preamble', kind: 'help', why: 'The label is the on state; state the effect once, then the trade-off.', re: /\b(when|while|if|with)\b[^.]{0,40}?\b(is|are) (turned |switched |set to )?(on|off|enabled|disabled|checked|unchecked)\b|^(when|if) (on|off|enabled|disabled|checked|unchecked)\b/i },
  // "that is" and "you have" are left out: both are common as plain verbs ("a value that is one chip").
  { name: 'uncontracted', kind: 'help', why: 'Help lines use contractions.', re: /\b(do not|does not|did not|is not|are not|was not|were not|will not|would not|should not|could not|cannot|can not|has not|have not|you will|you are|it is|there is|they are|they will)\b/i },
  // The copy tests hold brief lines to this and leave popover bodies alone; so does the sweep.
  { name: 'period-shape', kind: 'line', why: 'One sentence takes no period; two or more end with one.', test: periodShape },
  { name: 'exclamation', kind: 'help', why: 'No exclamation marks.', re: /!(\s|$)/ },
  { name: 'definition-cadence', kind: 'help', why: 'Never "A [noun] is [noun]"; write the action, with you as the subject or none.', re: /^(an?|the) [^.]{2,60}? (is|are) (an?|the) /i },
  { name: 'not-but', kind: 'hint', why: 'Say what it does, never "not X but Y".', re: /\bnot (just |only )?[^.]{0,40}\bbut\b/i },
  // A popover's `**Term** — definition` line is its definition-list form, which the guide allows.
  { name: 'em-dash', kind: 'hint', why: 'No asides; write a second sentence.', test: (t) => (/^\*\*[^*]+\*\* — /.test(t) ? null : (/—|--/.test(t) ? '—' : null)) },
  { name: 'ellipsis', kind: 'hint', why: 'Copy does not trail off.', re: /\.\.\.|…/ },
  { name: 'filler', kind: 'hint', why: 'Drop the hedge or the courtesy.', re: /\b(please|just|simply|easy|easily|basically|actually|really|quite|a bit|note that|keep in mind)\b/i },
  // Common words pass ("trash", "badge", "bandwidth"); only figurative language is out.
  { name: 'figurative', kind: 'hint', why: 'Common words, no figurative language: name the operation the image stands for.', re: /\b(fires?|fired|firing|drives?|driven|mutes?|muted|live|lives|rides?|points? [^.]{0,20}\bat\b|stands? in|in play|out of the way|for free|in reach|on the fly|under the hood|kicks? in|lights? up|wakes? up|goes? into)\b/i },
  { name: 'passive', kind: 'hint', why: 'Active voice.', re: /\b(is|are|was|were|be|been|being) \w+(ed|en) by\b/i },
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

/** Whether a rule reads copy of this kind. `any` reads all. `hint` reads everything but labels. `help`
 *  reads lines and popovers. A rule named for one kind reads that kind alone. */
function reads(rule, kind) {
  if (rule.kind === 'any') return true;
  if (rule.kind === 'hint') return kind !== 'label';
  if (rule.kind === 'help') return kind === 'line' || kind === 'popover';
  return rule.kind === kind;
}

/** Every notice one piece of copy draws, as `{ rule, why, detail }`. */
export function checkText(kind, text) {
  const out = [];
  for (const rule of RULES) {
    if (!reads(rule, kind)) continue;
    const detail = rule.test ? rule.test(text) : (rule.re.test(text) ? text.match(rule.re)[0] : null);
    if (detail) out.push({ rule: rule.name, why: rule.why, detail });
  }
  return out;
}

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
      for (const hit of checkText(it.kind, it.text)) findings.push({ ...it, ...hit });
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
    console.log('Labels on each screen (a control named in copy takes this exact casing):');
    for (const [file, labels] of withLabels) console.log(`   ${file}: ${labels.join(' · ')}`);
    console.log('');
  }
  console.log('Advisory: read each snippet against docs/Writing-Guide.md before changing it.');
}

// Run only as a command, so a test can import the rules.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const files = targets(args);
  if (!files.length) { console.log('copy sweep: nothing to read.'); process.exit(0); }
  const result = sweep(files);
  report(result, files);
  process.exit(args.includes('--strict') && result.findings.length ? 1 : 0);
}
