import { describe, expect, it } from 'vitest';
import type { ChatMessage, Entity } from '@/types';
import { mentionCardRows } from '@/components/game/MentionCards';
import type { CharSpan, CorefCluster } from './corefHost';
import { learnSpeakerNames } from './learnedSpeakerNames';
import type { MentionCorrection, MentionCorrectionMap } from './mentionCorrections';
import { mentionEntityAt, readPassageMentions, type MentionSceneContext } from './mentionReading';
import { narrationHash, pruneByNarration, type MentionReadingMap } from './mentionReadings';

// Synthetic passages written for these guards.
const cast = (...members: Partial<Entity>[]): Entity[] => members.map((m) => ({ aliases: [], kind: 'unique', ...m }) as Entity);
const RYN = { id: 'ryn', name: 'Ryn' };
const TOR = { id: 'tor', name: 'Tor' };
const CAST = cast(RYN, TOR);

function at(text: string, piece: string, nth = 1): CharSpan {
  let from = -1;
  for (let i = 0; i < nth; i++) {
    from = text.indexOf(piece, from + 1);
    if (from < 0) throw new Error(`"${piece}" #${nth} not in text`);
  }
  return [from, from + piece.length];
}

interface Turn {
  turnId: string;
  text: string;
  clusters: CorefCluster[];
}

const message = ({ turnId, text }: Turn): ChatMessage => ({ role: 'assistant', content: JSON.stringify({ turnId, narration: text, choices: [] }) });

/** The save after the player played `turns` and made `fixes`, each turn read with what earlier turns taught. */
function play(turns: Turn[], fixes: Record<string, MentionCorrection[]>, entities = CAST, scene: MentionSceneContext = {}) {
  const history: ChatMessage[] = [];
  let readings: MentionReadingMap = {};
  let corrections: MentionCorrectionMap = {};
  for (const turn of turns) {
    const learnedNames = learnSpeakerNames(history, readings, corrections, entities, scene);
    const { reading, clusterEntities } = readPassageMentions(turn.text, turn.clusters, entities, { ...scene, learnedNames });
    history.push(message(turn));
    const textHash = narrationHash(turn.text);
    readings = { ...readings, [turn.turnId]: { model: 'small', version: 1, textHash, reading, clusters: turn.clusters, clusterEntities } };
    if (fixes[turn.turnId]) corrections = { ...corrections, [turn.turnId]: { textHash, corrections: fixes[turn.turnId] } };
  }
  return { history, readings, corrections };
}

const quoteFix = (text: string, quote: string, entityId: string | null): MentionCorrection => {
  const [start, end] = at(text, quote);
  return { kind: 'quote', start, end, entityId };
};

const ALPHA_TEXT = '"Stay back," the massive black-furred Alpha growls. He bares his teeth.';
const alphaTurn = (turnId: string): Turn => ({
  turnId, text: ALPHA_TEXT,
  clusters: [[at(ALPHA_TEXT, 'the massive black-furred Alpha'), at(ALPHA_TEXT, 'He'), at(ALPHA_TEXT, 'his')]],
});
const LATER_TEXT = 'The Alpha circles you. "You smell of the river," the Alpha says.';
const laterTurn = (turnId: string): Turn => ({ turnId, text: LATER_TEXT, clusters: [[at(LATER_TEXT, 'The Alpha'), at(LATER_TEXT, 'the Alpha')]] });

/** The quote speakers and the cluster's entity a later turn gets with what the save teaches. */
function readLater(save: ReturnType<typeof play>, entities = CAST, scene: MentionSceneContext = {}, turn = laterTurn('later')) {
  const learnedNames = learnSpeakerNames(save.history, save.readings, save.corrections, entities, scene);
  const { reading } = readPassageMentions(turn.text, turn.clusters, entities, { ...scene, learnedNames });
  return { learnedNames, reading, entity: mentionEntityAt(reading, ...turn.clusters[0][0]), speakers: reading.quotes.map((q) => q.speaker) };
}

describe('learned speaker names', () => {
  it('names a later descriptor-only cluster, and its quotes, after a speaker fix', () => {
    const before = readLater(play([alphaTurn('t1')], {}));
    expect(before.speakers).toEqual([null]);

    const save = play([alphaTurn('t1')], { t1: [quoteFix(ALPHA_TEXT, '"Stay back,"', 'ryn')] });
    const later = readLater(save);
    expect([...later.learnedNames]).toEqual([['alpha', 'ryn']]);
    expect(later.entity).toBe('ryn');
    expect(later.speakers).toEqual(['ryn']);
  });

  it('learns a capitalized name outside the cast whole', () => {
    const text = '"Move," Captain Garrick snaps.';
    const save = play([{ turnId: 't1', text, clusters: [[at(text, 'Captain Garrick')]] }], { t1: [quoteFix(text, '"Move,"', 'tor')] });
    const later = 'Captain Garrick waits. "Well?" Captain Garrick asks.';
    const turn = { turnId: 'later', text: later, clusters: [[at(later, 'Captain Garrick'), at(later, 'Captain Garrick', 2)]] };
    const result = readLater(save, CAST, {}, turn);
    expect([...result.learnedNames]).toEqual([['captain garrick', 'tor']]);
    expect(result.speakers).toEqual(['tor']);
  });

  it('keeps the entity a cluster vote named when a learned name disagrees', () => {
    const save = play([alphaTurn('t1')], { t1: [quoteFix(ALPHA_TEXT, '"Stay back,"', 'ryn')] });
    const voted = cast(RYN, { ...TOR, aliases: ['Alpha'] });
    const later = readLater(save, voted);
    expect(later.learnedNames.get('alpha')).toBe('ryn');
    expect(later.entity).toBe('tor');
    expect(later.speakers).toEqual(['tor']);
  });

  it('names nothing with a head word fixed to two different entities', () => {
    const save = play([alphaTurn('t1'), alphaTurn('t2')], {
      t1: [quoteFix(ALPHA_TEXT, '"Stay back,"', 'ryn')],
      t2: [quoteFix(ALPHA_TEXT, '"Stay back,"', 'tor')],
    });
    const later = readLater(save);
    expect(later.learnedNames.size).toBe(0);
    expect(later.speakers).toEqual([null]);
  });

  it('names nothing when a cluster holds head words learned for two entities', () => {
    const text = '"Down," the Alpha says.';
    const learnedNames = new Map([['alpha', 'ryn'], ['wolf', 'tor']]);
    const clusters: CorefCluster[] = [[at(text, 'the Alpha')]];
    expect(readPassageMentions(text, clusters, CAST, { learnedNames }).reading.quotes[0].speaker).toBe('ryn');
    const both = 'The wolf turns. "Down," the Alpha says.';
    const reading = readPassageMentions(both, [[at(both, 'The wolf'), at(both, 'the Alpha')]], CAST, { learnedNames }).reading;
    expect(reading.quotes[0].speaker).toBeNull();
  });

  it('drops a learned name a later fix on its own cluster disagrees with', () => {
    const save = play([alphaTurn('t1'), laterTurn('t2')], {
      t1: [quoteFix(ALPHA_TEXT, '"Stay back,"', 'ryn')],
      t2: [quoteFix(LATER_TEXT, '"You smell of the river,"', 'tor')],
    });
    expect(save.readings.t2.reading.quotes[0].speaker).toBe('ryn');
    expect(save.readings.t2.clusterEntities).toEqual([null]);
    expect(readLater(save).learnedNames.size).toBe(0);
  });

  it('teaches a fix that names the player, and never renames a cluster the player rule claimed', () => {
    const scene = { player: { id: 'ash', names: ['Ash'] } };
    const save = play([alphaTurn('t1')], { t1: [quoteFix(ALPHA_TEXT, '"Stay back,"', 'ash')] }, CAST, scene);
    expect(readLater(save, CAST, scene).speakers).toEqual(['ash']);

    const yours = '"Back off," you say.';
    const learnedNames = new Map([['you', 'ryn']]);
    const { reading, clusterEntities } = readPassageMentions(yours, [[at(yours, 'you')]], CAST, { ...scene, learnedNames });
    expect(clusterEntities).toEqual(['ash']);
    expect(reading.quotes[0].speaker).toBe('ash');
  });

  it('forgets what an undone turn taught', () => {
    const save = play([alphaTurn('t1'), laterTurn('t2')], { t1: [quoteFix(ALPHA_TEXT, '"Stay back,"', 'ryn')] });
    expect(readLater(save).speakers).toEqual(['ryn']);
    // The undo drops t1 from the history; the save's maps prune the way GameViewer prunes them.
    const history = save.history.slice(1);
    const undone = { history, readings: pruneByNarration(save.readings, history), corrections: pruneByNarration(save.corrections, history) };
    const later = readLater(undone);
    expect(later.learnedNames.size).toBe(0);
    expect(later.speakers).toEqual([null]);
  });

  it('carries an unmet stranger by id, so its quotes and card show the stranger label', () => {
    const stranger = { id: 'ryn', name: 'Ryndal Ashmane', strangerName: 'the black wolf', strangerDescription: 'A scarred wolf.' };
    const entities = cast(stranger, TOR);
    const save = play([alphaTurn('t1')], { t1: [quoteFix(ALPHA_TEXT, '"Stay back,"', 'ryn')] }, entities);
    const later = readLater(save, entities);
    expect(later.speakers).toEqual(['ryn']);
    expect(JSON.stringify(later.reading)).not.toContain('Ryndal');
    const presence = new Map([['ryn', { entity: entities[0], known: false, label: 'The Black Wolf' }]]);
    expect(mentionCardRows({ entities: [] }, presence).get(later.speakers[0]!)?.name).toBe('The Black Wolf');
  });

  it('learns nothing from a pronoun or a player word', () => {
    const pronoun = '"Go," she says.';
    const scene = { player: { id: 'ash', names: ['Ash', 'the courier'] } };
    // A mixed cluster (Q67): the player's "you" merged into someone else's pronoun, so the vote leaves it unnamed.
    const mixed = 'The woman waits. "Fine," you say, and she nods.';
    const save = play([
      { turnId: 't1', text: pronoun, clusters: [[at(pronoun, 'she')]] },
      { turnId: 't2', text: mixed, clusters: [[at(mixed, 'you'), at(mixed, 'she')]] },
    ], { t1: [quoteFix(pronoun, '"Go,"', 'ryn')], t2: [quoteFix(mixed, '"Fine,"', 'tor')] }, CAST, scene);
    expect(save.readings.t2.reading.quotes[0].mention).toEqual({ start: at(mixed, 'you')[0], end: at(mixed, 'you')[1] });
    expect(save.readings.t2.clusterEntities).toEqual([null]);
    expect(readLater(save, CAST, scene).learnedNames.size).toBe(0);
  });

  it('learns nothing from a Not Listed fix, a quote no speech tag or beat names, or a cluster the vote named', () => {
    const untagged = 'The Alpha paces. "Stay back."';
    const named = '"Halt," old Ryn says.';
    const save = play([
      alphaTurn('t1'),
      { turnId: 't2', text: untagged, clusters: [[at(untagged, 'The Alpha')]] },
      { turnId: 't3', text: named, clusters: [[at(named, 'old Ryn')]] },
    ], {
      t1: [quoteFix(ALPHA_TEXT, '"Stay back,"', null)],
      t2: [quoteFix(untagged, '"Stay back."', 'ryn')],
      t3: [quoteFix(named, '"Halt,"', 'tor')],
    });
    expect(save.readings.t3.clusterEntities).toEqual(['ryn']);
    expect(save.readings.t2.reading.quotes[0].rule).toBe('nearest-subject');
    expect(readLater(save).learnedNames.size).toBe(0);
  });
});
