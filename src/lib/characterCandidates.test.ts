import { describe, it, expect } from 'vitest';
import {
  extractCharacterCandidates,
  collectCandidateEvidence,
  mergeCandidateEvidence,
  qualifiesAsCharacter,
  MID_SENTENCE_THRESHOLD,
  type CandidateEvidence,
} from './characterCandidates';

/** Accumulate several turns the way the app does, then extract. */
const overTurns = (texts: string[], characters: string[] = [], suppressed: string[] = []) => {
  let acc = new Map<string, CandidateEvidence>();
  for (const t of texts) acc = mergeCandidateEvidence(acc, collectCandidateEvidence(t));
  return extractCharacterCandidates('', { characters, suppressed }, acc);
};

// Fixtures are real sentences from the sessions this was measured on.
const CHEN = 'Doctor Chen works efficiently, her professional focus unwavering.';
const SARAH_1 = 'You squeeze her hand, and Sarah responds with warm reassurance.';
const SARAH_2 = 'The room is quiet until Sarah speaks again, softly.';

describe('extractCharacterCandidates', () => {
  it('promotes a title+name on a single sighting', () => {
    // A title makes it a character on sight — no repetition needed.
    expect(extractCharacterCandidates(CHEN, {})).toEqual(['Doctor Chen']);
  });

  it('needs repeated mid-sentence use for an untitled name', () => {
    expect(extractCharacterCandidates(SARAH_1, {})).toEqual([]);
    expect(overTurns([SARAH_1, SARAH_2])).toEqual(['Sarah']);
  });

  it('ignores sentence-initial uses, which is what separates a name from a sentence opener', () => {
    // "But"/"That" open sentences forever and never qualify; a name used only at sentence start
    // likewise waits until it appears mid-sentence.
    const openers = 'But she said nothing. That was the end of it. But he waited. That settled it.';
    expect(extractCharacterCandidates(openers, {})).toEqual([]);
    expect(overTurns(['Sarah waited.', 'Sarah waited.'])).toEqual([]);
  });

  it('merges a possessive into the bare name instead of inventing a second character', () => {
    expect(overTurns(['You take Sarah’s hand.', 'You meet Sarah’s eyes.'])).toEqual(['Sarah']);
  });

  it('rejects contractions', () => {
    // Mid-sentence on purpose: sentence-initial contractions are already rejected by the position
    // rule, so a sentence-initial fixture would pass even with the contraction rule deleted.
    const text = "She said I'll go. He knew I'll wait. They saw I'm ready. You felt I'm sure.";
    expect(extractCharacterCandidates(text, {})).toEqual([]);
  });

  it('handles an abbreviated title, whose period fakes a sentence end', () => {
    // Verbatim from a live turn. "Dr. Vance" split into a sentence ending at "Dr." and a new one
    // beginning "Vance steps…", so the name read as sentence-initial and lost its title.
    const text = `Dr. Vance steps through a door that wasn't there moments before, her white coat crisp.`;
    expect(extractCharacterCandidates(text, {})).toEqual(['Doctor Vance']);
  });

  it('does not let a contraction swallow the name beside it', () => {
    // Verbatim from a live turn. The run regex matches `I'm Doctor` as one candidate; rejecting the
    // whole run dropped the title and left a bare `Vance` that never qualified.
    const text = `"Good afternoon," she says, pulling out a clipboard. "I'm Doctor Vance. I'll be conducting your evaluation today." Doctor Vance clicks her pen.`;
    expect(extractCharacterCandidates(text, {})).toEqual(['Doctor Vance']);
  });

  it('rejects a bare kinship term but keeps it as a title before a name', () => {
    // "Mom" appeared 23 times in a real session and was promoted; she was an already-known entity.
    const bare = 'You remember when Mom said that. It was Mom who insisted, after all.';
    expect(extractCharacterCandidates(bare, {})).toEqual([]);
    expect(extractCharacterCandidates('You greet Sister Agnes at the door.', {}))
      .toEqual(['Sister Agnes']);
  });

  it('excludes known terms — entities, locations, lore, traits, stats, placeholders, the player', () => {
    const terms = ['Art History', 'Praetoria Academy', 'Porsia', 'Deer Demi-Human', 'Arousal'];
    const text = `You cross Praetoria Academy toward Art History. Porsia adjusts her bag.
      Being a Deer Demi-Human, the walk tires you. Your Arousal settles.
      You cross Praetoria Academy again, and Art History waits. Porsia sighs. Deer Demi-Human legs ache. Arousal fades.`;
    expect(extractCharacterCandidates(text, { terms })).toEqual([]);
  });

  it('treats a fragment of a known name as that name, not a new character', () => {
    // The absorption that takes measured precision from 0.83 to 1.00 on a real session.
    expect(overTurns(['You watch Chen work.', 'You thank Chen quietly.'], ['Doctor Chen'])).toEqual([]);
  });

  it('treats a full name as the known character who shares its surname', () => {
    // Real case: the world knows "Professor Rainsley"; a plaque reads "Dr. Evelyn Rainsley". Word-set
    // matching can't merge those, so without the surname rule she becomes a second entity.
    const text = 'You pass the office of Dr. Evelyn Rainsley, whose brass plaque gleams in the hall light.';
    expect(extractCharacterCandidates(text, {})).toEqual(['Doctor Evelyn Rainsley']);
    expect(extractCharacterCandidates(text, { characters: ['Professor Rainsley'] })).toEqual([]);
  });

  it('rejects a lone short all-caps abbreviation', () => {
    // Verbatim shape from a real run: a class schedule promoted `PM` off "12:00 PM".
    const text = 'Classes run 10:00 AM - 12:00 PM. The hall empties by 12:00 PM sharp, and 9 AM starts again.';
    expect(extractCharacterCandidates(text, {})).toEqual([]);
    // Multi-word runs keep an all-caps first token — the abbreviation rule must not shred them. It is
    // still not a character (no person signal), so assert on the evidence rather than the promotion.
    const branded = 'You film at TNA Films twice. Later you return to TNA Films again.';
    expect(collectCandidateEvidence(branded).has('TNA Films')).toBe(true);
    expect(extractCharacterCandidates(branded, {})).toEqual([]);
  });

  it('ignores markdown headings and stand-alone bold labels', () => {
    // A real turn produced this heading; the title rule read it as a character on sight because a
    // heading has no sentence around it to disagree.
    const text = '**Professor Assignments:**\n## Student Services\nYou glance at the noticeboard and move on.';
    expect(extractCharacterCandidates(text, {})).toEqual([]);
  });

  it('rejects a greeting shouted at the player', () => {
    // Real promotions: "a cheerful voice calls out from behind you: 'Hey'" in two separate sessions.
    // Both uses are mid-sentence on purpose: sentence-initial ones are already rejected by the
    // position rule, so a fixture like `"Hey," she said.` would pass with the stopword deleted.
    const text = `A voice calls out: "Hey, wait up!" She waves and says "Hey" again, grinning.`;
    expect(extractCharacterCandidates(text, {})).toEqual([]);
  });

  it('ignores an unfilled placeholder that leaked into the prose', () => {
    // Real promotion: "Welcome to Praetoria Academy, [Player Name]" made `Player Name` a character.
    const text = 'Welcome to Praetoria Academy, [Player Name]. The hall greets [Player Name] warmly.';
    expect(extractCharacterCandidates(text, {})).toEqual([]);
  });

  it('requires a repeated name to behave like a person', () => {
    // Measured on 16 real sessions: two thirds of repetition-path promotions were agencies, cafés,
    // shows and weekdays. All four fixtures below repeat mid-sentence; only the people qualify.
    const agency = 'Your audition is at Spectrum Talent Agency. The Spectrum Talent Agency lobby is packed.';
    const cafe = 'You meet at Daily Grind on the corner. Daily Grind roasts its own beans.';
    const day = 'The showcase is Saturday evening. You have until Saturday to prepare.';
    for (const t of [agency, cafe, day]) expect(extractCharacterCandidates(t, {})).toEqual([]);
    // Same shape, but the name speaks / is introduced / owns a body part.
    expect(extractCharacterCandidates('You greet Bram, who nods. You thank Bram warmly.', {})).toEqual(['Bram']);
    expect(overTurns(['"I\'m Dakota," she offers.', 'You shake Dakota\'s hand.'])).toEqual(['Dakota']);
  });

  it('accepts third-person naming and Madame as a title', () => {
    // Held-out miss: "This producer - her name is Madame Yuki - she specializes in…" was dropped.
    // `madame` was absent from the titles list and the intro pattern only knew "my name is".
    const text = 'This producer - her name is Madame Yuki - she specializes in fresh talent.';
    expect(extractCharacterCandidates(text, {})).toEqual(['Madame Yuki']);
    const third = 'You meet the cook, whose name is Bela. And Bela waves you over again.';
    expect(extractCharacterCandidates(third, {})).toEqual(['Bela']);
  });

  it('drops a stem left behind by a contraction', () => {
    // Held-out artifact: "Don't overthink it" yielded a bare `Don`, since only `'s` rides inside a
    // token. Both uses are mid-sentence so the position rule cannot mask the guard.
    const text = `She said "Don't overthink it, sweetie." He agreed: "Don't rush this either."`;
    expect(collectCandidateEvidence(text).has('Don')).toBe(false);
  });

  it('ignores a name that only ever appears inside quoted speech', () => {
    // Held-out failures, both titled so both promoted on sight: an absent library patron and a
    // child's stuffed toy. Being talked about is not being in the scene.
    const absent = `"The carrel is reserved," she says, "but Ms Drake hasn't arrived yet today." You wait. "Ms Drake is very punctual," she adds.`;
    expect(extractCharacterCandidates(absent, {})).toEqual([]);
    const toy = `"Mr Rabbit approves of you," she announces solemnly, hugging the worn plush to her chest.`;
    expect(extractCharacterCandidates(toy, {})).toEqual([]);
    // One narrator-voice mention is enough to count as shown.
    const present = `"I'm Ms Winters," she says. The name tag on Ms Winters' blazer catches the light.`;
    expect(extractCharacterCandidates(present, {})).toEqual(['Ms Winters']);
  });

  it('applies the surname rule to people only, never to places or lore', () => {
    // Measured on four real worlds: taking the last word of every exclusion barred anything ending
    // `office` (6 location names), `demi-human` (17 traits), `studio` (8 lore terms), `skill` (4 stats).
    const text = 'You meet Captain Office twice. Later, Captain Office nods to you again.';
    expect(extractCharacterCandidates(text, { terms: ["Professor Rainsley's Office"] }))
      .toEqual(['Captain Office']);
    // The same string as a CHARACTER does block it — that is the rule doing its job.
    expect(extractCharacterCandidates(text, { characters: ['Sergeant Office'] })).toEqual([]);
  });

  it('excludes a suppressed name so a deletion cannot be undone by the next turn', () => {
    const texts = ['"Evening," says Bram Coley.', 'You thank Bram Coley, and he nods.'];
    expect(overTurns(texts)).toEqual(['Bram Coley']);
    expect(overTurns(texts, [], ['Bram Coley'])).toEqual([]);
    // Matched by sameCharacterName, so a fuller form is covered too.
    expect(overTurns(texts, [], ['Bram Coley the Elder'])).toEqual([]);
  });

  it('finds a narrator-invented character across turns, which is the whole point', () => {
    expect(overTurns([SARAH_1, CHEN, SARAH_2], ['Porsia'])).toEqual(['Sarah', 'Doctor Chen']);
  });

  it('yields nothing for prose with no capitalized names (fails closed)', () => {
    expect(extractCharacterCandidates('the room is quiet and nothing moves', {})).toEqual([]);
    expect(extractCharacterCandidates('', {})).toEqual([]);
  });
});

describe('evidence helpers', () => {
  it('counts mid-sentence separately from total', () => {
    const ev = collectCandidateEvidence('Sarah waited. You saw Sarah there.');
    expect(ev.get('Sarah')).toMatchObject({ total: 2, mid: 1 });
  });

  it('accumulates across turns so repetition can span narrations', () => {
    const acc = mergeCandidateEvidence(
      collectCandidateEvidence('You saw Sarah there.'),
      collectCandidateEvidence('You greet Sarah again.'),
    );
    expect(acc.get('Sarah')?.mid).toBe(MID_SENTENCE_THRESHOLD);
    expect(qualifiesAsCharacter(acc.get('Sarah')!)).toBe(true);
  });

  it('qualifies a titled name regardless of position count', () => {
    expect(qualifiesAsCharacter({ name: 'Doctor Chen', mid: 0, total: 1, titled: true, person: false, inProse: true, bodied: false })).toBe(true);
    expect(qualifiesAsCharacter({ name: 'Sarah', mid: 1, total: 9, titled: false, person: true, inProse: true, bodied: false })).toBe(false);
  });
});

describe('a name that owns a body qualifies without repetition', () => {
  // The reported miss: a character whose name opens every sentence it appears in. `mid` ignores
  // sentence-initial uses by design, so she scored 0 and was never discovered.
  const lyria = `Lyria's hand is warm and firm as it closes around yours. "You're very welcome!"

Lyria glances back at you with a playful smile.`;

  it('qualifies her from the possessive alone', () => {
    expect(extractCharacterCandidates(lyria, {})).toEqual(['Lyria']);
    const e = collectCandidateEvidence(lyria).get('Lyria')!;
    expect(e.bodied).toBe(true);
    expect(e.mid).toBe(0); // still zero — the mid-sentence rule is untouched
  });

  it('accepts the body words wherever they sit after the name', () => {
    for (const s of ["Sable's eyes narrow.", "Pell's voice drops low.", "Mira's gaze flicks up.", "Odette's thin face tightens."]) {
      expect(extractCharacterCandidates(s, {})).toHaveLength(1);
    }
  });

  it('does not fire on a possessive that owns something inanimate', () => {
    expect(extractCharacterCandidates("Timbermaw's border runs east from here.", {})).toEqual([]);
    expect(extractCharacterCandidates("The Moonpetal Inn's roof sags under the snow.", {})).toEqual([]);
    expect(extractCharacterCandidates("Teldorill's markets open at dawn.", {})).toEqual([]);
  });

  it('still requires the name to appear in prose, not only inside quoted speech', () => {
    expect(extractCharacterCandidates('"I saw Lyria\'s face," she says.', {})).toEqual([]);
  });

  it('leaves an already-known name alone', () => {
    expect(extractCharacterCandidates("Lyria's hand is warm.", { characters: ['Lyria'] })).toEqual([]);
  });
});
