import { describe, expect, it } from 'vitest';
import type { Entity } from '@/types';
import type { CharSpan, CorefCluster } from './corefHost';
import { entitiesInProse, mentionEntityAt, readMentions } from './mentionReading';

// Synthetic passages written for these guards.
const cast = (...members: Partial<Entity>[]): Entity[] =>
  members.map((m) => ({ aliases: [], ...m }) as Entity);

/** The span of the `nth` occurrence of `piece` in `text`. */
function at(text: string, piece: string, nth = 1): CharSpan {
  let from = -1;
  for (let i = 0; i < nth; i++) {
    from = text.indexOf(piece, from + 1);
    if (from < 0) throw new Error(`"${piece}" #${nth} not in text`);
  }
  return [from, from + piece.length];
}

const entityAt = (reading: ReturnType<typeof readMentions>, span: CharSpan) => mentionEntityAt(reading, ...span);

describe('readMentions cluster naming', () => {
  it('names a cluster from a parser hit that ends one of its mentions', () => {
    const text = 'Mira steps inside. She shakes the rain from her coat.';
    const clusters: CorefCluster[] = [[at(text, 'Mira'), at(text, 'She'), at(text, 'her')]];
    const reading = readMentions(text, clusters, cast({ id: 'mira', name: 'Mira' }));
    expect(entityAt(reading, at(text, 'She'))).toBe('mira');
    expect(entityAt(reading, at(text, 'her'))).toBe('mira');
  });

  it('does not name a cluster from a hit inside a mention it does not end', () => {
    const text = "Mira's sister waits by the door. She does not smile.";
    const clusters: CorefCluster[] = [[at(text, "Mira's sister"), at(text, 'She')]];
    const reading = readMentions(text, clusters, cast({ id: 'mira', name: 'Mira' }));
    expect(entityAt(reading, at(text, 'She'))).toBeNull();
    // The hit itself still stands as the parser's evidence for Mira.
    expect(entityAt(reading, at(text, 'Mira'))).toBe('mira');
  });

  it("names a cluster from a head word: an alias or a Stranger Name's word", () => {
    const text = 'The old innkeeper wipes the bar. The smuggler by the fire nods. He lifts his cup.';
    const clusters: CorefCluster[] = [
      [at(text, 'The old innkeeper')],
      [at(text, 'The smuggler by the fire'), at(text, 'He'), at(text, 'his')],
    ];
    const members = cast(
      { id: 'bram', name: 'Bram Holloway', aliases: ['innkeeper'] },
      { id: 'kael', name: 'Kael', strangerName: 'a hooded smuggler' },
    );
    const reading = readMentions(text, clusters, members);
    expect(entityAt(reading, at(text, 'The old innkeeper'))).toBe('bram');
    // A head word names a mention only where it ends it.
    expect(entityAt(reading, at(text, 'He'))).toBeNull();

    const ends = 'A cloaked figure waits. The smuggler nods. He lifts his cup.';
    const named = readMentions(ends, [[at(ends, 'The smuggler'), at(ends, 'He')]], members);
    expect(entityAt(named, at(ends, 'He'))).toBe('kael');
  });

  it('names nobody from a head two cast members share', () => {
    const text = 'The mercenary raises his visor. He looks tired.';
    const clusters: CorefCluster[] = [[at(text, 'The mercenary'), at(text, 'He')]];
    const reading = readMentions(text, clusters, cast(
      { id: 'dagny', name: 'Dagny Rusk', strangerName: 'a scarred mercenary' },
      { id: 'tobin', name: 'Tobin', strangerName: 'a tall mercenary' },
    ));
    expect(entityAt(reading, at(text, 'He'))).toBeNull();
  });

  it('keeps the capital guard on a one-word person name, but not on a generic entity', () => {
    const text = 'She tucks a rose behind her ear. The wolf watches from the trees. It does not move.';
    const clusters: CorefCluster[] = [[at(text, 'a rose')], [at(text, 'The wolf'), at(text, 'It')]];
    const reading = readMentions(text, clusters, cast(
      { id: 'rose', name: 'Rose' },
      { id: 'wolf', name: 'Wolf', kind: 'generic' },
    ));
    expect(entityAt(reading, at(text, 'a rose'))).toBeNull();
    expect(entityAt(reading, at(text, 'It'))).toBe('wolf');
  });

  it(`ties "I'm <name>" to the speaker's "I"`, () => {
    const text = '"I\'m Freya," she says. "I keep the gate."';
    const clusters: CorefCluster[] = [[at(text, 'I'), at(text, 'she'), at(text, 'I', 2)]];
    const reading = readMentions(text, clusters, cast({ id: 'freya', name: 'Freya' }));
    expect(entityAt(reading, at(text, 'she'))).toBe('freya');
  });

  it('drops an everyday-word name that no cluster backs', () => {
    const text = 'Hope fills the hall as the bells ring.';
    const reading = readMentions(text, [], cast({ id: 'hope', name: 'Hope' }));
    expect(entityAt(reading, at(text, 'Hope'))).toBeNull();
    const backed = readMentions('Hope waves. She smiles.', [[[0, 4], [12, 15]]], cast({ id: 'hope', name: 'Hope' }));
    expect(entityAt(backed, [12, 15])).toBe('hope');
  });

  it('never links the player: "you", the narrator\'s "I", or the player name', () => {
    const text = 'You follow Mira inside. I hear Ash call out. "I know," Mira says.';
    const clusters: CorefCluster[] = [[at(text, 'You'), at(text, 'Mira'), at(text, 'I'), at(text, 'Ash'), at(text, 'I', 2)]];
    const reading = readMentions(text, clusters, cast({ id: 'mira', name: 'Mira' }), { playerName: 'Ash' });
    expect(entityAt(reading, at(text, 'You'))).toBeNull();
    expect(entityAt(reading, at(text, 'I'))).toBeNull();
    expect(entityAt(reading, at(text, 'Ash'))).toBeNull();
    expect(entityAt(reading, at(text, 'I', 2))).toBe('mira');
  });

  it("keeps a cast member who shares a word of the player's name", () => {
    const text = 'Ash Vale waits. Ash Rowan leans on the rail.';
    const reading = readMentions(text, [], cast({ id: 'rowan', name: 'Ash Rowan' }), { playerName: 'Ash Vale' });
    expect(entityAt(reading, at(text, 'Ash Rowan'))).toBe('rowan');
    const short = 'Ash Rowan waits. Ash nods.';
    const named = readMentions(short, [[at(short, 'Ash Rowan'), at(short, 'Ash', 2)]],
      cast({ id: 'rowan', name: 'Ash Rowan' }), { playerName: 'Ash Vale' });
    expect(entityAt(named, at(short, 'Ash', 2))).toBe('rowan');
    expect(readMentions('Vale waits.', [[[0, 4]]], cast({ id: 'rowan', name: 'Ash Rowan' }), { playerName: 'Ash Vale' })
      .mentions[0].entityId).toBeNull();
  });
});

describe('readMentions quote speakers', () => {
  const two = cast({ id: 'odile', name: 'Odile' }, { id: 'brannock', name: 'Brannock' });

  it('takes the mention at a speech verb after the quote, either order', () => {
    const text = '"You\'re late," Odile says. "The tide waits," says Brannock.';
    const reading = readMentions(text, [], two);
    expect(reading.quotes.map((q) => q.speaker)).toEqual(['odile', 'brannock']);
  });

  it('takes the mention at a speech verb before the quote', () => {
    const text = 'Brannock leans in and whispers, "Not here."';
    expect(readMentions(text, [], two).quotes.map((q) => q.speaker)).toEqual(['brannock']);
    // The speaker at the verb, not the sentence's first subject.
    const mid = 'Odile nods while Brannock whispers, "Not here."';
    expect(readMentions(mid, [], two).quotes.map((q) => q.speaker)).toEqual(['brannock']);
  });

  it('falls back to the nearest preceding subject mention in the paragraph', () => {
    const text = 'Odile sets down her pliers. "Green glass, then."\n\n"Ask someone else."';
    const reading = readMentions(text, [], two);
    expect(reading.quotes.map((q) => q.speaker)).toEqual(['odile', null]);
  });

  it('resolves a pronoun speaker through its cluster', () => {
    const text = 'Brannock turns. "I\'m waiting for the tide," he says.';
    const reading = readMentions(text, [[at(text, 'Brannock'), at(text, 'he')]], two);
    expect(reading.quotes.map((q) => q.speaker)).toEqual(['brannock']);
  });

  it('gives the player\'s quotes no speaker', () => {
    const text = 'Odile looks up. "Who sent you?" you ask.';
    expect(readMentions(text, [], two).quotes.map((q) => q.speaker)).toEqual([null]);
  });
});

describe('entitiesInProse', () => {
  it('counts a named mention in the prose and skips one only inside a quote', () => {
    const text = 'She waits. "Brannock is late," she says.';
    const reading = readMentions(text, [[at(text, 'She'), at(text, 'she')]], cast(
      { id: 'odile', name: 'Odile', aliases: [] },
      { id: 'brannock', name: 'Brannock' },
    ));
    expect(entitiesInProse(text, reading)).toEqual([]);
    const named = readMentions(`Odile nods. ${text}`, [[[0, 5], [12, 15], [31 + 12, 34 + 12]]], cast(
      { id: 'odile', name: 'Odile' }, { id: 'brannock', name: 'Brannock' },
    ));
    expect(entitiesInProse(`Odile nods. ${text}`, named)).toEqual(['odile']);
  });
});
