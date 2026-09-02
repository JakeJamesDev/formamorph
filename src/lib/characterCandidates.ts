/**
 * Pure extraction of character names from narration prose, with no AI call.
 *
 * Why this exists: `turnParticipants` is built from `findEntityNames` (already-known entities only)
 * plus director/ad-hoc candidates that ONLY staged planning produces. On pure narration all three
 * are blind to a character the narrator has just invented, so it never becomes a participant, never
 * reaches `selectDueDiscovery`, and never becomes known — discovery required already having been
 * discovered. Measured on a real session: a doctor who speaks on 23 of 50 turns was invisible on
 * every one. Design and measurements: docs-internal/specs/narrator-character-discovery/spec.md.
 *
 * Capitalization-dependent by nature, and fails CLOSED — unusual or non-English capitalization
 * yields no candidates, which is exactly the pre-feature behavior.
 */

import { sameCharacterName } from './entityMatch';

/** Mid-sentence uses (accumulated across turns) before an untitled name counts as a character.
 *  Sentence-initial uses are ignored because every sentence opener is capitalized: measured over
 *  two real sessions, real names appear sentence-initially 45-64% of the time while function words
 *  ("But", "That") sit at 100%. A constant, not a setting — the same reasoning as
 *  RELEVANCE_HALF_LIFE_TURNS: tuning wants measurement, not a player knob. At 2 it scored recall
 *  1.00 on both sessions; raising it delays discovery, lowering it admits passing mentions. */
export const MID_SENTENCE_THRESHOLD = 2;

/** Words that are capitalized because a sentence started, not because they name anyone. */
const STOPWORDS = new Set(`the a an and but or so then that this these those there here if when while as of in on at to for with from by
you your yours i my me mine we our us they them their he she her his hers it its
do does did done be being been am is are was were have has had can could will would shall should may might must let lets
what how why who whom whose which where
oh ah yes no not now just still even also very really please thank thanks good great okay ok sure right well maybe perhaps
first second last next another other some any each every all both few many more most such only own same than too
come go get take give tell say said says look see know think want need feel make made
one two three four five six seven eight nine ten
hey hi hello hiya yo hmm mmm huh ugh um uh whoa wow oops alright aye nope yep yeah nah gosh
sorry congratulations goodbye bye hush shh
later suddenly slowly quickly quietly gently carefully finally eventually meanwhile instead soon
afterward afterwards once together outside inside above below behind beyond beneath nearby briefly
moments minutes hours days weeks months years`.split(/\s+/).filter(Boolean));

/** Kinship words used ALONE are forms of address, not names ("Mom wasn't angry"). Found in a real
 *  session where "Mom" appeared 23 times and was promoted to a character — she was an already-known
 *  entity under her own name. Note the deliberate overlap with TITLES: bare "Sister" is address,
 *  "Sister Agnes" is a character. */
const KINSHIP = new Set(`mom mum mommy mama dad daddy papa pop sis bro grandma grandpa granny nana auntie uncle
mother father sister brother son daughter aunt cousin husband wife`.split(/\s+/).filter(Boolean));

/** A leading title makes the following word a character on sight, with no repetition needed.
 *  NOTE: hand-written, and only `professor`/`dean`/`doctor` are exercised by any corpus we have —
 *  the rest is informed guesswork, and a world with its own register (warden, arch-magus) gets no
 *  help. Author-supplied titles are the real fix; see the spec's follow-ups. */
const TITLES = new Set(['dean', 'professor', 'prof', 'doctor', 'doc', 'dr', 'captain', 'capt',
  'sergeant', 'sgt', 'lieutenant', 'lt', 'lady', 'lord', 'sister', 'brother', 'father', 'mother',
  'madam', 'madame', 'miss', 'mister', 'mr', 'mrs', 'ms', 'nurse', 'officer', 'king', 'queen', 'prince',
  'princess']);

/** Titles that are normally written abbreviated with a period. The period is both a fake
 *  sentence-end and a break in the name run — "Dr. Vance" split into a sentence ending at "Dr."
 *  followed by a new one starting "Vance steps…", which made the name look sentence-initial and
 *  cost it the title. Normalizing the period away before any parsing fixes both at once. */
const ABBREVIATED_TITLES = ['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sgt', 'Capt', 'Lt'];
const ABBREV_PERIOD = new RegExp(String.raw`\b(${ABBREVIATED_TITLES.join('|')})\.\s+`, 'g');

/** Abbreviations expanded to the form the story also uses in full, so one character doesn't become
 *  two entities under "Dr. Chen" and "Doctor Chen" — `sameCharacterName` compares word sets and
 *  would not merge those. Mr/Mrs/Ms have no expanded form in practice and stay as written. */
const ABBREV_EXPANSION: Record<string, string> = {
  dr: 'Doctor', prof: 'Professor', sgt: 'Sergeant', capt: 'Captain', lt: 'Lieutenant',
};

/**
 * Person signals. A capitalized name that repeats is not necessarily someone — measured over 16 real
 * sessions, two thirds of the names promoted on repetition alone were agencies, cafés, TV shows,
 * places, days and lore items ("Spectrum Talent Agency", "Daily Grind", "Saturday", "South Mountain").
 * Requiring one of these before the repetition path can fire took precision 0.34 → 1.00 on that
 * corpus while keeping every character who actually appeared on stage.
 *
 * Deliberately narrow, and each exclusion below was measured leaking on the corpus, not guessed:
 * generic motion verbs (looks/takes/turns/steps) let cafés through; "called" names works rather than
 * people ("it's called 'Star Spectrum'"); and "offers" is what an agency does to a client
 * ("Spectrum offers opportunities other agencies won't touch"). Add nothing here without a rescore.
 */
const PERSON_VERBS = String.raw`says?|said|speaks?|spoke|asks?|asked|repl(?:y|ies|ied)|answers?|answered|responds?|responded|whispers?|whispered|murmurs?|murmured|adds?|added|tells?|told|shouts?|shouted|calls? out|explains?|explained|continues?|continued|greets?|greeted|laughs?|laughed|grins?|grinned|smiles?|smiled|nods?|nodded|shrugs?|shrugged|sighs?|sighed|gestures?|gestured|waves?|waved|winks?|winked|leans?|leaned`;
/** Body parts a possessive can attach to — "Sarah's eyes" is a person, "the agency's doors" is not. */
const PERSON_POSSESSIVE = String.raw`eyes?|hands?|voice|face|hair|smile|shoulders?|lips?|gaze|fingers?|arms?|head|expression|cheeks?|brow|chin|throat`;
/** How a character is named into the scene. `called` is absent on purpose (see above). */
const PERSON_INTRO = new RegExp(String.raw`(?:\bI['’]m|\bI am|\bnamed|\b(?:my|her|his|their|its|whose) name (?:is|was)|\bthis is|\breads)\s*$`, 'i');
const VERB_AFTER = new RegExp(String.raw`^\s*(?:\w+ly\s+)?(?:${PERSON_VERBS})\b`, 'i');
const VERB_BEFORE = new RegExp(String.raw`\b(?:${PERSON_VERBS})\s+$`, 'i');
// The matched run already swallows the `'s`, so this tests what follows it.
const POSSESSIVE_AFTER = new RegExp(String.raw`^\s+(?:\w+\s+){0,2}(?:${PERSON_POSSESSIVE})\b`, 'i');

/** Only `'s` may ride inside a name token, so a contraction can never BE one. Matching any
 *  apostrophe suffix made "I'm Doctor" a single candidate, and discarding it as a contraction took
 *  the title with it — "I'm Doctor Vance." left a bare `Vance` with one mid-sentence use, which
 *  never qualified. With `'s` alone, "I" matches, falls to the two-letter floor, and the run
 *  restarts cleanly at "Doctor Vance". "Sarah's" still matches and is stripped to "Sarah". */

/**
 * Everything that must never become a new character. Split by kind because the surname rule is only
 * meaningful for people: taking the last word of a location, trait, stat or lore keyword blocks
 * candidates for no reason — measured against four real worlds, that silently barred anything ending
 * `office` (6 locations), `demi-human` (17 traits), `studio` (8 lore terms) or `skill` (4 stats).
 */
export interface CandidateExclusions {
  /** People: authored + already-discovered entity names. Matched by name equality, word-set subset,
   *  AND shared surname — one character met under a fuller name is still that character. */
  characters?: string[];
  /** Everything else — locations, dictionary names/keywords, traits, stats, placeholder values, the
   *  player's own name. Matched by equality and word-set subset only; never by surname. */
  terms?: string[];
  /** Names the player deleted. Treated like characters, so a deletion also covers fuller forms. */
  suppressed?: string[];
}

/** One name's evidence within the scanned text. */
export interface CandidateEvidence {
  name: string;
  /** Occurrences that were NOT sentence-initial — the signal that survives capitalization noise. */
  mid: number;
  total: number;
  /** A leading title was present, which qualifies the name regardless of `mid`. */
  titled: boolean;
  /** Somewhere in the scanned text this name behaved like a person — spoke, gestured, was introduced,
   *  or owned a body part. Required before the repetition path may promote it. */
  person: boolean;
  /** The narrator named them outside quoted speech, so they were shown rather than merely discussed.
   *  Required on every path, the title one included. */
  inProse: boolean;
  /** This name owned a body or expression ("Lyria's hand is warm"), which qualifies it regardless of
   *  `mid` — see `qualifiesAsCharacter`. */
  bodied: boolean;
}

/** Markdown headings and stand-alone bold labels are page furniture, not narration. A real turn
 *  produced `**Professor Assignments:**` as a heading, which the title rule read as a character on
 *  sight — the heading had no sentence around it to disagree. Dropped before anything is counted. */
const NON_PROSE_LINE = /^\s*(?:#{1,6}\s|[*_]{2}[^*_]+[*_]{2}\s*:?\s*$)/;

/** Unfilled prompt placeholders that reached the page. A real turn wrote
 *  "Welcome to Praetoria Academy, [Player Name]" and `Player Name` was promoted to a character.
 *  Whatever sits inside brackets is template plumbing, never someone in the scene. */
const PLACEHOLDER_SPAN = /\[[^\]\n]{0,80}\]|<[^>\n]{0,80}>/g;

/** Split prose into sentences. Trailing quotes/emphasis ride with the sentence that ends, so the
 *  next sentence's first word is correctly seen as sentence-initial. */
function splitSentences(text: string): string[] {
  const prose = (text || '')
    .replace(PLACEHOLDER_SPAN, ' ')
    .split('\n')
    .filter((line) => !NON_PROSE_LINE.test(line))
    .join('\n');
  return prose.replace(ABBREV_PERIOD, '$1 ').split(/(?<=[.!?])["'*_)\]”’]*\s+|\n+/);
}

/** Quoted speech removed, leaving what the narrator said in their own voice. */
function stripQuotes(text: string): string {
  return (text || '').replace(/[“"][^”"]{0,400}[”"]/g, ' ');
}

/**
 * Every capitalized run in `text` with its sentence-position evidence, before exclusions.
 *
 * Runs twice: once over everything, then once over narration with quoted speech stripped, to learn
 * which names the narrator actually says. A name that only ever appears inside someone's dialogue is
 * being talked about, not shown — measured across 36 sessions, that split cleanly separated present
 * characters from an absent library patron ("Ms Drake hasn't arrived yet today") and a child's
 * stuffed toy ("'Mr Rabbit approves of you,' she announces").
 */
export function collectCandidateEvidence(text: string): Map<string, CandidateEvidence> {
  const out = scanRuns(text || '');
  const inProse = scanRuns(stripQuotes(text || ''));
  for (const [name, record] of out) record.inProse = inProse.has(name);
  return out;
}

function scanRuns(text: string): Map<string, CandidateEvidence> {
  const out = new Map<string, CandidateEvidence>();
  for (const raw of splitSentences(text)) {
    const sentence = raw.trim();
    if (!sentence) continue;
    // Hyphens stay inside a token: "Demi-Human" and "Anne-Marie" are one name, and splitting them
    // leaks a bare "Human" that no exclusion list would think to name.
    // Up to three capitalized tokens, so "Doctor Evelyn Rainsley" survives whole rather than being
    // truncated to a two-word name that matches nobody.
    const runs = /\b[A-Z][A-Za-z]*(?:-[A-Za-z]+)*(?:['’]s)?(?:(?:\s+(?:of|de|van|von)\s+|\s+)[A-Z][A-Za-z]*(?:-[A-Za-z]+)*(?:['’]s)?){0,2}/g;
    let match: RegExpExecArray | null;
    while ((match = runs.exec(sentence))) {
      let tokens = match[0].trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) continue;
      // A sentence-opening conjunction glues onto the name after it — "And Alice said…", "But Alice
      // is faster" match as one run, and rejecting the run for its stopword head threw the name away
      // with it. Measured at 1.33% of all runs across 36 sessions, so it silently cost real mentions
      // against a threshold of two. Shed leading stopwords and keep the remainder, tracking the
      // offset so position and neighbour checks stay honest. (Adverbs mostly take a comma —
      // "Later, Bela waves" — which already breaks the run; conjunctions do not.)
      let lead = 0;
      while (tokens.length > 1 && STOPWORDS.has(tokens[0].toLowerCase().replace(/['’]s$/i, ''))) {
        lead += tokens[0].length + 1;
        tokens = tokens.slice(1);
      }
      const words = tokens.map((t) => t.replace(/['’]s$/i, '')).filter(Boolean);
      // Expand a leading abbreviation so "Dr Chen" and "Doctor Chen" are one character, not two.
      const expanded = ABBREV_EXPANSION[words[0]?.toLowerCase() ?? ''];
      if (expanded) words[0] = expanded;
      if (words.length === 0) continue;
      if (words.some((w) => w.length < 2)) continue;
      // A lone short all-caps token is an abbreviation, not a person — "12:00 PM" promoted `PM` on a
      // real run. Multi-word runs are exempt so a branded name ("TNA Films") still reads as one.
      if (words.length === 1 && /^[A-Z]{2,3}$/.test(words[0])) continue;
      const lower = words.map((w) => w.toLowerCase());
      if (STOPWORDS.has(lower[0])) continue;
      if (lower.every((w) => STOPWORDS.has(w))) continue;
      // A kinship word alone is address; with a name after it, it acts as a title.
      if (words.length === 1 && KINSHIP.has(lower[0])) continue;
      const name = words.join(' ');
      const start = match.index + lead;
      const before = sentence.slice(0, start);
      const after = sentence.slice(match.index + match[0].length);
      // A stem left behind by a contraction is not a name: only `'s` may ride inside a token, so
      // "Don't overthink it" leaves a bare `Don` with an apostrophe still attached after it.
      if (/^['’][A-Za-z]/.test(after)) continue;
      const sentenceInitial = /^[\s"'“”*_([]*$/.test(before);
      // Did this occurrence behave like a person? Checked against the immediate neighbours only —
      // a wide window matches "The air … speaks of deep wilderness" and calls every article a person.
      // An anatomical possessive is the strongest single signal there is: PERSON_POSSESSIVE is a tight
      // body/expression list, so only a person owns one. Tracked separately from `person` because it
      // carries on its own, where the other signals need repetition.
      const bodied = /['’]s$/.test(match[0]) && POSSESSIVE_AFTER.test(after);
      const person =
        VERB_AFTER.test(after) || VERB_BEFORE.test(before) || PERSON_INTRO.test(before) || bodied;
      const record = out.get(name) ?? {
        name,
        mid: 0,
        total: 0,
        titled: words.length > 1 && TITLES.has(lower[0]),
        person: false,
        inProse: false,
        bodied: false,
      };
      record.total += 1;
      if (!sentenceInitial) record.mid += 1;
      record.person = record.person || person;
      record.bodied = record.bodied || bodied;
      out.set(name, record);
    }
  }
  return out;
}

/** Merge one turn's evidence into a running tally, so a name can qualify on repetition across turns
 *  rather than needing to prove itself within a single narration. */
export function mergeCandidateEvidence(
  into: Map<string, CandidateEvidence>,
  from: Map<string, CandidateEvidence>,
): Map<string, CandidateEvidence> {
  for (const [name, add] of from) {
    const record = into.get(name);
    if (record) {
      record.mid += add.mid;
      record.total += add.total;
      record.titled = record.titled || add.titled;
      record.person = record.person || add.person;
      record.inProse = record.inProse || add.inProse;
      record.bodied = record.bodied || add.bodied;
    } else {
      into.set(name, { ...add });
    }
  }
  return into;
}

/**
 * Whether accumulated evidence is enough to treat `name` as a character.
 *
 * A title carries on its own — "Doctor Chen" is a person whether or not she has spoken yet, and page
 * furniture that used to abuse this path ("Professor Assignments") is dropped earlier as non-prose.
 * So does owning a body ("Lyria's hand is warm"): PERSON_POSSESSIVE lists only body and expression
 * words, so nothing but a person satisfies it, and requiring repetition on top of it stranded
 * characters whose name happened to open every sentence it appeared in — the mid-sentence tally
 * ignores sentence-initial uses by design, so a name written only as "Lyria's hand…" / "Lyria
 * glances…" never scored. Measured across 47 real sessions this promotes two names, both genuine
 * characters, and demotes none.
 *
 * Repetition alone is still not enough: a name that merely recurs is as likely to be an agency, a
 * café or a weekday, so it must also have behaved like a person somewhere.
 */
export function qualifiesAsCharacter(evidence: CandidateEvidence): boolean {
  if (!evidence.inProse) return false;
  return evidence.titled || evidence.bodied || (evidence.mid >= MID_SENTENCE_THRESHOLD && evidence.person);
}

/**
 * Character names in `text` that no known term already accounts for. Matching against exclusions
 * uses `sameCharacterName`, so a variant ("Chen" of "Doctor Chen") is treated as the known name
 * rather than a second character — the same rule `selectDueDiscovery` already applies.
 *
 * `priorEvidence` carries earlier turns' tallies so repetition accumulates; omit it to judge one
 * passage alone.
 */
export function extractCharacterCandidates(
  text: string,
  exclusions: CandidateExclusions,
  priorEvidence?: Map<string, CandidateEvidence>,
): string[] {
  const evidence = mergeCandidateEvidence(
    priorEvidence ? mergeCandidateEvidence(new Map(), priorEvidence) : new Map(),
    collectCandidateEvidence(text),
  );
  const people = [...(exclusions.characters ?? []), ...(exclusions.suppressed ?? [])].filter(Boolean);
  const blocked = [...people, ...(exclusions.terms ?? [])].filter(Boolean);
  // Surname collision, PEOPLE ONLY: `sameCharacterName` compares word SETS as a subset, so a
  // character met under a fuller name ("Doctor Evelyn Rainsley") never merges with the form the world
  // already knows ("Professor Rainsley") — different title, extra given name, no subset either way —
  // and becomes a second entity for the same person. Observed on a real session. Matching the final
  // word catches it.
  //
  // Scoped to characters because the last word of a non-person blocks candidates for nothing:
  // measured over four real worlds it would have barred anything ending `office` (6 locations),
  // `demi-human` (17 traits), `studio` (8 lore terms) or `skill` (4 stats).
  //
  // The remaining cost is deliberate: two distinct characters sharing a surname collapse into one, so
  // a new relative of an authored family is not discovered. A missed discovery is quiet; a duplicate
  // cast member is not.
  const lastWord = (n: string) => n.trim().toLowerCase().split(/\s+/).pop() ?? '';
  const blockedSurnames = new Set(people.map(lastWord).filter((w) => w.length > 1));
  const out: string[] = [];
  for (const record of evidence.values()) {
    if (!qualifiesAsCharacter(record)) continue;
    if (blocked.some((term) => sameCharacterName(record.name, term))) continue;
    if (blockedSurnames.has(lastWord(record.name))) continue;
    out.push(record.name);
  }
  return out;
}
