// Help conversation probe: follow-up questions and the AI Language, through the app's own `askHelp`.
//
// Part 1, follow-up retrieval (no model, exact): for each case in `help-followup-cases.json`, is the
// section the follow-up needs among the sections sent, and is the first question's top section (the
// topic)? `alone` searches the follow-up by itself (the single-question behavior); `shipped` searches it
// with the previous question. A topic-change control asks each docs-wording question after another one:
// its own section must still be sent, and first.
//
// Part 2, follow-up answers: per run and case, the first question is asked once, then the follow-up goes
// out in two arms in the same batch:
//   shipped   the earlier exchange in the request, and the follow-up search
//   alone     the control: the follow-up alone, as one question with no history
// Score: the follow-up's keyed control names in the answer, and declined answers.
//
// Part 3, AI Language: the docs-wording questions of `help-cases.json` in three arms in the same batch:
//   English   the control: no directive
//   Spanish, Japanese   the directive
// Score: the answer is in the arm's language (word or script count, bold names left out), and the
// keyed control names stay as the guide writes them.
//
// The probe adds `reasoning_effort: "none"` to the app's request body, as every probe here does.
//
// Usage: npx vite-node testing/baseline/harness/help-conversation-probe.cli.ts --
//          [--endpoint URL] [--model default] [--token T] [--runs 5] [--parallel 4] [--part 1,2,3] [--show]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { askHelp, helpSections, type EarlierExchange } from '@/lib/formaquestion/helpSession';
import { DEFAULT_HELP_SETTINGS } from '@/lib/formaquestion/helpSettings';
import { factShare, mean, pct, probeSnapshot } from './help-probe-shared';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const token = argVal('--token', process.env.PROBE_TOKEN ?? '');
const runs = Number(argVal('--runs', '5'));
const parallel = Number(argVal('--parallel', '4'));
const parts = new Set(argVal('--part', '1,2,3').split(',').map(Number));
const show = args.includes('--show');

interface FollowUpCase { id: string; first: string; followUp: string; section: string; facts: string[] }
interface HelpCase { id: string; wording: 'docs' | 'player'; question: string; section?: string; facts: string[] }

const BASELINE = path.resolve('testing/baseline');
const readCases = <T>(file: string) => (JSON.parse(readFileSync(path.join(BASELINE, file), 'utf8')) as { cases: T[] }).cases;
const followUps = readCases<FollowUpCase>('help-followup-cases.json');
const languageCases = readCases<HelpCase>('help-cases.json').filter((c) => c.wording === 'docs' && c.section);

const index = bundledDocsIndex();

const snapshot = probeSnapshot({ endpoint, model, token });

interface Sample { answer: string; promptChars: number; messages: number; sources: string[] }

/** One question through the app's `askHelp`. The fetch adds the probe's reasoning-off field. */
async function ask(question: string, history: EarlierExchange[], language: string): Promise<Sample> {
  let promptChars = 0;
  let messages = 0;
  const fetchImpl: typeof fetch = (url, init) => {
    const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
    promptChars = body.messages.reduce((sum, message) => sum + message.content.length, 0);
    messages = body.messages.length;
    return fetch(url, { ...init, body: JSON.stringify({ ...body, reasoning_effort: 'none' }) });
  };
  for await (const event of askHelp({ question, history, language, settings: DEFAULT_HELP_SETTINGS, snapshot, index, fetchImpl })) {
    if (event.type === 'done') return { answer: event.text, promptChars, messages, sources: event.sources.map((s) => s.id) };
  }
  throw new Error('no answer');
}

/** Runs the jobs with at most `limit` in flight. */
async function pool<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (next < jobs.length) {
      const at = next++;
      results[at] = await jobs[at]();
    }
  }));
  return results;
}

const DECLINED = /(does not|doesn't|do not|don't|not) (\w+ )?(cover|mention|include|contain|explain|describe|detail|provide|address)|no (information|section|mention)|not covered/i;
const boldNames = (text: string) => [...text.matchAll(/\*\*([^*\n]+)\*\*/g)].map((m) => m[1].trim().replace(/[:.,]$/, ''));
const boldShare = (facts: string[], answer: string) => {
  const bolds = boldNames(answer).map((name) => name.toLowerCase());
  return facts.length ? facts.filter((fact) => bolds.some((name) => name.includes(fact.toLowerCase()))).length / facts.length : 0;
};

const out: Record<string, unknown> = { endpoint, model, runs };

// Part 1: retrieval, exact.
if (parts.has(1)) {
  console.log('\nPART 1 · follow-up retrieval (no model)');
  const rows = followUps.map((c) => {
    const history = [{ question: c.first, answer: 'An answer.' }];
    const alone = helpSections(index, c.followUp).map((s) => s.id);
    const shipped = helpSections(index, c.followUp, { history }).map((s) => s.id);
    const topic = helpSections(index, c.first)[0]?.id;
    return {
      id: c.id, alone: alone.includes(c.section), shipped: shipped.includes(c.section),
      aloneTopic: alone.includes(topic), shippedTopic: shipped.includes(topic), aloneIds: alone, shippedIds: shipped,
    };
  });
  const yes = (hit: boolean) => (hit ? 'yes' : ' NO');
  for (const r of rows) console.log(`${r.id.padEnd(16)} section: alone ${yes(r.alone)} shipped ${yes(r.shipped)}   topic: alone ${yes(r.aloneTopic)} shipped ${yes(r.shippedTopic)}`);
  const count = (pick: (r: (typeof rows)[number]) => boolean) => `${rows.filter(pick).length}/${rows.length}`;
  console.log(`follow-up section sent: alone ${count((r) => r.alone)}, shipped ${count((r) => r.shipped)}`);
  console.log(`topic section sent: alone ${count((r) => r.aloneTopic)}, shipped ${count((r) => r.shippedTopic)}`);
  const changes = languageCases.map((next, i) => ({ before: languageCases[(i + 3) % languageCases.length], next }));
  const changed = changes.map(({ before, next }) => helpSections(index, next.question, { history: [{ question: before.question, answer: 'An answer.' }] }).map((s) => s.id));
  const sent = changed.filter((ids, i) => ids.includes(changes[i].next.section!)).length;
  const first = changed.filter((ids, i) => ids[0] === changes[i].next.section).length;
  console.log(`topic change: own section sent ${sent}/${changes.length}, first ${first}/${changes.length}`);
  out.retrieval = { followUps: rows, topicChanges: changes.map((c, i) => ({ before: c.before.id, next: c.next.id, ids: changed[i] })) };
}

// Part 2: follow-up answers.
if (parts.has(2)) {
  type Arm = 'shipped' | 'alone';
  interface Row { id: string; arm: Arm; run: number; sample?: Sample; error?: string }
  const jobs: (() => Promise<Row[]>)[] = [];
  for (let run = 1; run <= runs; run++) {
    for (const c of followUps) {
      jobs.push(async () => {
        let first: Sample;
        try {
          first = await ask(c.first, [], 'English');
        } catch (error) {
          return (['shipped', 'alone'] as Arm[]).map((arm) => ({ id: c.id, arm, run, error: String(error) }));
        }
        const history = [{ question: c.first, answer: first.answer }];
        return Promise.all((['shipped', 'alone'] as Arm[]).map(async (arm) => {
          try {
            return { id: c.id, arm, run, sample: await ask(c.followUp, arm === 'shipped' ? history : [], 'English') };
          } catch (error) {
            return { id: c.id, arm, run, error: String(error) };
          }
        }));
      });
    }
  }
  console.log(`\nPART 2 · follow-up answers · ${endpoint} · ${model} · ${followUps.length} cases × 2 arms × ${runs} runs`);
  const started = Date.now();
  const rows = (await pool(jobs, parallel)).flat();
  console.log(`${rows.length} follow-ups in ${((Date.now() - started) / 1000).toFixed(0)}s, ${rows.filter((r) => r.error).length} failed`);
  const facts = (id: string) => followUps.find((c) => c.id === id)!.facts;
  const line = (label: string, keep: (r: Row) => boolean) => {
    const scored = rows.filter((r) => r.sample && keep(r));
    const n = scored.length;
    const answers = scored.map((r) => r.sample!);
    console.log([
      label.padEnd(28), `n=${n}`.padEnd(5),
      `facts ${pct(mean(scored.map((r) => factShare(facts(r.id), r.sample!.answer))) * n, n)}`,
      `complete ${pct(scored.filter((r) => factShare(facts(r.id), r.sample!.answer) === 1).length, n)}`,
      `declined ${pct(answers.filter((s) => DECLINED.test(s.answer)).length, n)}`,
      `chars in ${Math.round(mean(answers.map((s) => s.promptChars)))}`,
    ].join('  '));
  };
  for (const c of followUps) for (const arm of ['shipped', 'alone'] as Arm[]) line(`${c.id} · ${arm}`, (r) => r.id === c.id && r.arm === arm);
  console.log('');
  for (const arm of ['shipped', 'alone'] as Arm[]) line(`ALL · ${arm}`, (r) => r.arm === arm);
  if (show) for (const r of rows.filter((row) => row.run === 1)) console.log(`\n--- ${r.id} · ${r.arm} ---\n${r.error ?? r.sample?.answer}`);
  out.followUps = rows;
}

// Part 3: the AI Language.
if (parts.has(3)) {
  const LANGUAGES = ['English', 'Spanish', 'Japanese'] as const;
  type Language = (typeof LANGUAGES)[number];
  const SPANISH = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'que', 'y', 'en', 'para', 'una', 'un', 'con', 'por', 'se', 'su', 'es', 'luego', 'pestaña', 'botón', 'selecciona', 'abre']);
  const ENGLISH = new Set(['the', 'and', 'to', 'of', 'in', 'for', 'a', 'an', 'with', 'then', 'select', 'open', 'your', 'is', 'on']);
  /** The answer without its bold control names, which stay in the guide's language. */
  const prose = (answer: string) => answer.replace(/\*\*[^*\n]+\*\*/g, ' ');
  const inLanguage = (language: Language, answer: string): boolean => {
    const text = prose(answer);
    if (language === 'Japanese') {
      const letters = text.match(/[\p{L}]/gu)?.length ?? 0;
      const japanese = text.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu)?.length ?? 0;
      return letters > 0 && japanese / letters > 0.5;
    }
    const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
    const es = words.filter((w) => SPANISH.has(w)).length;
    const en = words.filter((w) => ENGLISH.has(w)).length;
    return language === 'Spanish' ? es > en : en > es;
  };
  interface Row { id: string; language: Language; run: number; sample?: Sample; error?: string }
  const jobs: (() => Promise<Row>)[] = [];
  for (let run = 1; run <= runs; run++) {
    for (const c of languageCases) {
      for (const language of LANGUAGES) {
        jobs.push(async () => {
          try {
            return { id: c.id, language, run, sample: await ask(c.question, [], language) };
          } catch (error) {
            return { id: c.id, language, run, error: String(error) };
          }
        });
      }
    }
  }
  console.log(`\nPART 3 · AI Language · ${languageCases.length} questions × ${LANGUAGES.length} arms × ${runs} runs`);
  const started = Date.now();
  const rows = await pool(jobs, parallel);
  console.log(`${rows.length} requests in ${((Date.now() - started) / 1000).toFixed(0)}s, ${rows.filter((r) => r.error).length} failed`);
  const facts = (id: string) => languageCases.find((c) => c.id === id)!.facts;
  for (const language of LANGUAGES) {
    const scored = rows.filter((r) => r.sample && r.language === language);
    const n = scored.length;
    console.log([
      language.padEnd(9), `n=${n}`.padEnd(5),
      `in language ${pct(scored.filter((r) => inLanguage(language, r.sample!.answer)).length, n)}`,
      `names kept ${pct(mean(scored.map((r) => factShare(facts(r.id), r.sample!.answer))) * n, n)}`,
      `all names ${pct(scored.filter((r) => factShare(facts(r.id), r.sample!.answer) === 1).length, n)}`,
      `in bold ${pct(mean(scored.map((r) => boldShare(facts(r.id), r.sample!.answer))) * n, n)}`,
      `steps ${pct(scored.filter((r) => /^\s*1[.)]\s/m.test(r.sample!.answer)).length, n)}`,
    ].join('  '));
  }
  if (show) for (const r of rows.filter((row) => row.run === 1)) console.log(`\n--- ${r.id} · ${r.language} ---\n${r.error ?? r.sample?.answer}`);
  out.language = rows;
}

const outDir = path.join(BASELINE, 'runs');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `help-conversation-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`\nraw answers: ${path.relative(process.cwd(), outFile)}`);
