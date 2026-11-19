import { describe, expect, it } from 'vitest';
import type { Entity } from '@/types';
import type { CharSpan, CorefCluster } from './corefHost';
import { entitiesInProse, mentionEntityAt, quoteSpeakingClusters, readMentions, readPassageMentions } from './mentionReading';
import { holdPoint } from './streamingQuotes';

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

describe('the entity each cluster sends with a contribution (Q35)', () => {
  it("names the persona's cluster when no cast member won it, and keeps a cast member's vote (Q67)", () => {
    const text = 'You wave at Mira. She grins, and you laugh.';
    const clusters: CorefCluster[] = [[at(text, 'You'), at(text, 'you')], [at(text, 'Mira'), at(text, 'She')]];
    const persona = { player: { id: 'ash', names: ['Ash'] } };
    expect(readPassageMentions(text, clusters, cast({ id: 'mira', name: 'Mira' }), persona).clusterEntities).toEqual(['ash', 'mira']);
    expect(readPassageMentions(text, clusters, cast({ id: 'mira', name: 'Mira' })).clusterEntities).toEqual([null, 'mira']);
  });

  it("leaves a mixed cluster unnamed: the player's words merged into someone else's pronouns (Q67)", () => {
    const text = 'The woman turns. You meet her eyes, and she smiles at you.';
    const clusters: CorefCluster[] = [[at(text, 'The woman'), at(text, 'You'), at(text, 'her'), at(text, 'she'), at(text, 'you')]];
    const { reading, clusterEntities } = readPassageMentions(text, clusters, cast({ id: 'mira', name: 'Mira' }),
      { player: { id: 'ash', names: ['Ash'] } });
    expect(clusterEntities).toEqual([null]);
    expect(entityAt(reading, at(text, 'You'))).toBe('ash');
    expect(entityAt(reading, at(text, 'her'))).toBeNull();
  });

  it('names one entity or null per cluster, in cluster order, matching the reading', () => {
    const text = 'Mira met a stranger. She nodded at him.';
    const clusters: CorefCluster[] = [[at(text, 'a stranger'), at(text, 'him')], [at(text, 'Mira'), at(text, 'She')]];
    const { reading, clusterEntities } = readPassageMentions(text, clusters, cast({ id: 'mira', name: 'Mira' }));
    expect(clusterEntities).toEqual([null, 'mira']);
    expect(entityAt(reading, at(text, 'She'))).toBe('mira');
    expect(reading).toEqual(readMentions(text, clusters, cast({ id: 'mira', name: 'Mira' })));
  });
});

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

  it('links the persona: "you", the narrator\'s "I", and its name, even inside a cast member\'s cluster (Q61)', () => {
    const text = 'You follow Mira inside. I hear Ash call out. "I know," Mira says.';
    const clusters: CorefCluster[] = [[at(text, 'You'), at(text, 'Mira'), at(text, 'I'), at(text, 'Ash'), at(text, 'I', 2)]];
    const reading = readMentions(text, clusters, cast({ id: 'mira', name: 'Mira' }), { player: { id: 'ash', names: ['Ash'] } });
    expect(entityAt(reading, at(text, 'You'))).toBe('ash');
    expect(entityAt(reading, at(text, 'I'))).toBe('ash');
    expect(entityAt(reading, at(text, 'Ash'))).toBe('ash');
    expect(entityAt(reading, at(text, 'I', 2))).toBe('mira');
  });

  it('links the player to nobody without a persona', () => {
    const text = 'You follow Mira inside. I hear her call out.';
    const reading = readMentions(text, [[at(text, 'You'), at(text, 'I')]], cast({ id: 'mira', name: 'Mira' }));
    expect(entityAt(reading, at(text, 'You'))).toBeNull();
    expect(entityAt(reading, at(text, 'I'))).toBeNull();
  });

  it("links the persona's aliases and a bare mention of its name (Q67)", () => {
    const text = 'Kessa bows to the Matron. Corvina smiles back.';
    const reading = readMentions(text, [[at(text, 'the Matron')]], cast({ id: 'kessa', name: 'Kessa' }),
      { player: { id: 'corvina', names: ['Corvina', 'Matron'] } });
    expect(entityAt(reading, at(text, 'the Matron'))).toBe('corvina');
    expect(entityAt(reading, at(text, 'Corvina'))).toBe('corvina');
    expect(entityAt(reading, at(text, 'Kessa'))).toBe('kessa');
    // An alias the host merged into a cast member's cluster is still the persona.
    const merged = readMentions(text, [[at(text, 'Kessa'), at(text, 'the Matron')]], cast({ id: 'kessa', name: 'Kessa' }),
      { player: { id: 'corvina', names: ['Corvina', 'Matron'] } });
    expect(entityAt(merged, at(text, 'the Matron'))).toBe('corvina');
  });

  it("keeps a cast member who shares a word of the player's name", () => {
    const text = 'Ash Vale waits. Ash Rowan leans on the rail.';
    const vale = { player: { id: 'vale', names: ['Ash Vale'] } };
    const reading = readMentions(text, [], cast({ id: 'rowan', name: 'Ash Rowan' }), vale);
    expect(entityAt(reading, at(text, 'Ash Rowan'))).toBe('rowan');
    const short = 'Ash Rowan waits. Ash nods.';
    const named = readMentions(short, [[at(short, 'Ash Rowan'), at(short, 'Ash', 2)]],
      cast({ id: 'rowan', name: 'Ash Rowan' }), vale);
    expect(entityAt(named, at(short, 'Ash', 2))).toBe('rowan');
    expect(readMentions('Vale waits.', [[[0, 4]]], cast({ id: 'rowan', name: 'Ash Rowan' }), vale)
      .mentions[0].entityId).toBe('vale');
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

  it('takes the mention opening an action beat after the quote over an earlier subject', () => {
    const speakers = (text: string) => readMentions(text, [], two).quotes.map((q) => q.speaker);
    expect(speakers('Brannock turns away. "Wait." Odile grabs his sleeve.')).toEqual(['odile']);
    expect(speakers('Brannock turns away. "Wait," Odile grins.')).toEqual(['odile']);
    expect(speakers('Brannock turns away.\n\n"Wait. Please." Odile reaches out.')).toEqual(['odile']);
    expect(speakers('Brannock turns away. "Wait" — Odile catches his arm.')).toEqual(['odile']);
    // A beat that does not open on a mention leaves the earlier subject.
    expect(speakers('Odile calls it "the Pit," and Brannock stares.')).toEqual(['odile']);
  });

  it('keeps a speech-verb lead-in over the beat after the quote', () => {
    const text = 'Odile whispers, "Run." Brannock nods.';
    expect(readMentions(text, [], two).quotes.map((q) => q.speaker)).toEqual(['odile']);
  });

  it('resolves a beat pronoun through its cluster, and a player beat to the persona', () => {
    // An unnamed beat subject is someone, just not the earlier subject.
    const text = 'Brannock turns away. "Wait," she grins.';
    expect(readMentions(text, [[at(text, 'she')]], two).quotes.map((q) => q.speaker)).toEqual([null]);
    const odile = 'Odile looks up. Brannock turns away. "Wait," she grins.';
    expect(readMentions(odile, [[at(odile, 'Odile'), at(odile, 'she')]], two).quotes.map((q) => q.speaker)).toEqual(['odile']);
    const mine = 'Odile turns away. "Stop." You catch her wrist.';
    expect(readMentions(mine, [], two, { player: { id: 'ash', names: ['Ash'] } }).quotes.map((q) => q.speaker)).toEqual(['ash']);
  });

  it('reads the beat speaker on the passage cut at the streaming hold point', () => {
    const text = 'Brannock turns away. "Wait." Odile grabs his sleeve. Brannock stops.';
    const end = text.indexOf(' Odile');
    const cut = holdPoint(text, end, false)!;
    expect(text.slice(0, cut)).toBe('Brannock turns away. "Wait." Odile grabs his sleeve.');
    expect(readMentions(text.slice(0, cut), [], two).quotes.map((q) => q.speaker)).toEqual(['odile']);
  });

  it('leaves beats out of the speech-verb clusters', () => {
    const text = 'Brannock turns away. "Wait." Odile grabs his sleeve.';
    expect(quoteSpeakingClusters(text, [[at(text, 'Odile')]])).toEqual(new Set());
  });

  it('resolves a pronoun speaker through its cluster', () => {
    const text = 'Brannock turns. "I\'m waiting for the tide," he says.';
    const reading = readMentions(text, [[at(text, 'Brannock'), at(text, 'he')]], two);
    expect(reading.quotes.map((q) => q.speaker)).toEqual(['brannock']);
  });

  it("gives the persona's quotes the persona, and no speaker without one", () => {
    const text = 'Odile looks up. "Who sent you?" you ask.\n\nYou lean in and whisper, "Tell me."\n\n"Not here," I say.';
    // The host clusters the player's "you" mentions.
    const clusters: CorefCluster[] = [[at(text, 'you', 2), at(text, 'You', 1), at(text, 'I', 1)]];
    const persona = { player: { id: 'ash', names: ['Ash'] } };
    expect(readMentions(text, clusters, two, persona).quotes.map((q) => q.speaker)).toEqual(['ash', 'ash', 'ash']);
    expect(readMentions(text, clusters, two).quotes.map((q) => q.speaker)).toEqual([null, null, null]);
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
