// Help retrieval probe — does the Docs Index find the right section for a question?
//
// No model runs, so every number is exact and needs no control. Each question set runs on two indexes in
// the same run: `before`, the index code and docs at `--before REF`, and `now`, the working tree's.
//
// Question sets:
//   guide    one question per "How to…" heading, in the heading's own words ("How do I <rest>?")
//   player   the `cases` of help-baseline-cases.json: player-worded questions, two or more per docs page,
//            written from the section headings only, never the section text
//   probe    help-cases.json, the answer probe's covered questions, by their `wording`
//
// Checks, per question:
//   sent     the right section is among the sections retrieval mode puts in the prompt (`helpSections`)
//   top1     the right section is the first search hit
//   top3     the right section is among the first three hits
//
// Usage: npx vite-node testing/baseline/harness/help-retrieval-probe.cli.ts -- [--before 9a010b82] [--show]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { bundledDocsIndex, BUNDLED_DOCS } from '@/lib/docs/bundledDocsIndex';
import type { DocsIndex } from '@/lib/docs/docsIndex';
import { createDocsLinkResolver } from '@/lib/docs/docsReader';
import { docTargetId } from '@/lib/docs/docsLinks';
import { docHeadings, isHowToHeading, plainText } from '@/lib/docs/headingAnchors';
import { helpSections } from '@/lib/formaquestion/helpSession';
import { refDocsIndex } from './refDocsIndex';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const beforeRef = argVal('--before', '');
const show = args.includes('--show');

interface Question { set: string; id: string; question: string; section: string }

const BASELINE = path.resolve('testing/baseline');
const readCases = <T>(file: string) => (JSON.parse(readFileSync(path.join(BASELINE, file), 'utf8')) as { cases: T[] }).cases;

const now = bundledDocsIndex();
const resolve = createDocsLinkResolver(now);
const guide: Question[] = Object.entries(BUNDLED_DOCS).flatMap(([page, markdown]) =>
  docHeadings(markdown).flatMap((heading) => {
    const text = plainText(heading.text);
    const section = resolve(page, `#${heading.anchor}`);
    if (!isHowToHeading(text) || !section) return [];
    return [{ set: 'guide', id: docTargetId({ page, anchor: heading.anchor }), question: `How do I ${text.slice('How to '.length)}?`, section }];
  }));
const player: Question[] = readCases<{ id: string; question: string; section: string }>('help-baseline-cases.json')
  .map((c) => ({ set: 'player', ...c }));
const probe: Question[] = readCases<{ id: string; wording: string; question: string; section?: string }>('help-cases.json')
  .flatMap((c) => (c.section ? [{ set: `probe-${c.wording}`, id: c.id, question: c.question, section: c.section }] : []));
const questions = [...guide, ...player, ...probe];

const baseId = (id: string) => id.replace(/-part-\d+$/, '');

function check(index: DocsIndex, q: Question) {
  const hits = index.search(q.question, 3).map((s) => baseId(s.id));
  return {
    sent: helpSections(index, q.question).some((s) => baseId(s.id) === q.section),
    top1: hits[0] === q.section,
    top3: hits.includes(q.section),
    first: hits[0] ?? '(none)',
  };
}

const arms: { name: string; index: DocsIndex }[] = [];
if (beforeRef) {
  const { sha, index } = await refDocsIndex(beforeRef);
  arms.push({ name: `before ${sha}`, index });
}
arms.push({ name: 'now', index: now });

const results = arms.map((arm) => ({ arm, checks: questions.map((q) => check(arm.index, q)) }));
const pct = (n: number, d: number) => `${n}/${d} (${Math.round((100 * n) / Math.max(d, 1))}%)`.padEnd(14);

console.log(`help-retrieval-probe · ${questions.length} questions · ${new Set(player.map((q) => q.section.split('#')[0])).size} pages in the player set\n`);
const sets = [...new Set(questions.map((q) => q.set))];
console.log(`${'set'.padEnd(14)}${'index'.padEnd(18)}${'sent'.padEnd(14)}${'top1'.padEnd(14)}top3`);
for (const set of sets) {
  for (const { arm, checks } of results) {
    const rows = checks.filter((_, i) => questions[i].set === set);
    const count = (key: 'sent' | 'top1' | 'top3') => rows.filter((r) => r[key]).length;
    console.log(`${set.padEnd(14)}${arm.name.padEnd(18)}${pct(count('sent'), rows.length)}${pct(count('top1'), rows.length)}${pct(count('top3'), rows.length)}`);
  }
}

if (show) {
  console.log('\nquestions whose sent result differs between indexes, or that miss on the last one:');
  questions.forEach((q, i) => {
    const marks = results.map(({ checks }) => (checks[i].sent ? '✓' : '✗'));
    const last = results[results.length - 1].checks[i];
    if (last.sent && marks.every((m) => m === marks[0])) return;
    console.log(`${marks.join(' ')}  [${q.set}] ${q.question}\n      want ${q.section} · first ${last.first}`);
  });
}
