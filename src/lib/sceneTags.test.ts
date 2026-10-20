import { describe, it, expect } from 'vitest';
import { composeSceneTags, deriveCountTags, pickSceneCast, splitTags, stripNames, stripPlaces, MAX_SCENE_CHARACTERS } from './sceneTags';
import type { Entity } from '@/types';

const girl = (name: string, extra = '') => ({ name, tags: `1girl, ${extra}`.replace(/,\s*$/, '') });
const ent = (name: string): Entity => ({ id: name, name });

describe('pickSceneCast', () => {
  const cast = [ent('Mira'), ent('Tam'), ent('Vos')];
  const persona = ent('Wren');

  it('leads with the persona when the planner put the player in the picture', () => {
    expect(pickSceneCast({ participants: ['Mira'], entities: cast, persona, playerInFrame: true }).map((e) => e.name))
      .toEqual(['Wren', 'Mira']);
  });

  it('leaves the persona out when the planner kept the player out of it', () => {
    expect(pickSceneCast({ participants: ['Mira', 'Tam'], entities: cast, persona, playerInFrame: false }).map((e) => e.name))
      .toEqual(['Mira', 'Tam']);
  });

  it('reads no planner call as the player being in frame', () => {
    expect(pickSceneCast({ participants: ['Mira'], entities: cast, persona, playerInFrame: undefined }).map((e) => e.name))
      .toEqual(['Wren', 'Mira']);
  });

  it('gives the persona one of the capped slots', () => {
    const picked = pickSceneCast({ participants: ['Mira', 'Tam', 'Vos'], entities: cast, persona, playerInFrame: true });
    expect(picked).toHaveLength(MAX_SCENE_CHARACTERS);
    expect(picked.map((e) => e.name)).toEqual(['Wren', 'Mira']);
  });

  it('is the participants alone when no persona is played', () => {
    expect(pickSceneCast({ participants: ['Tam', 'Nobody'], entities: cast, persona: null, playerInFrame: true }).map((e) => e.name))
      .toEqual(['Tam']);
  });
});

describe('deriveCountTags', () => {
  it('merges two same-kind characters into one plural count', () => {
    expect(deriveCountTags([girl('Mira', 'silver hair'), girl('Sedge', 'red coat')])).toEqual(['2girls']);
  });

  it('keeps mixed kinds as separate singular counts', () => {
    expect(deriveCountTags([girl('Mira'), { name: 'Tam', tags: '1boy, tall' }])).toEqual(['1girl', '1boy']);
  });

  it('counts a character whose tags name no subject count as one other', () => {
    expect(deriveCountTags([{ name: 'The Warden', tags: 'iron mask, tattered cloak' }])).toEqual(['1other']);
  });

  it('reads a stray plural in an authored field as the one character it describes', () => {
    expect(deriveCountTags([{ name: 'Mira', tags: '2girls, silver hair' }])).toEqual(['1girl']);
  });

  it('never emits solo, since the player character is in frame untagged', () => {
    expect(deriveCountTags([girl('Mira', 'solo')])).toEqual(['1girl']);
  });
});

describe('composeSceneTags', () => {
  it('passes authored NovelAI syntax through with cleanTags off', () => {
    expect(composeSceneTags({
      characters: [girl('Mira', '{{silver hair}}, 0.8::freckles ::')],
      locationTags: 'no humans, [[river]]',
      actionTags: 'source#hug, Mira smiling',
      cleanTags: false,
    })).toBe('1girl, {{silver hair}}, 0.8::freckles ::, source#hug, smiling, [[river]]');
  });

  it('strips that syntax by default', () => {
    expect(composeSceneTags({
      characters: [girl('Mira', '{{silver hair}}')],
      locationTags: '[[river]]',
      actionTags: 'source#hug',
    })).toBe('1girl, silver hair, source hug, river');
  });

  it('orders subject, appearance, action, then background', () => {
    expect(composeSceneTags({
      characters: [girl('Mira', 'silver hair')],
      locationTags: 'wooden dock, river',
      actionTags: 'walking, holding lantern',
    })).toBe('1girl, silver hair, walking, holding lantern, wooden dock, river');
  });

  it('drops the location\'s "no humans" when anyone is in frame', () => {
    const out = composeSceneTags({
      characters: [girl('Mira')],
      locationTags: 'no humans, wooden dock',
      actionTags: 'standing',
    });
    expect(out).not.toContain('no humans');
    expect(out).toContain('wooden dock');
  });

  it('keeps "no humans" for an empty scene', () => {
    expect(composeSceneTags({ characters: [], locationTags: 'no humans, wooden dock', actionTags: 'rain' }))
      .toBe('rain, no humans, wooden dock');
  });

  it('strips a count tag the model volunteered rather than trusting it over the cast', () => {
    expect(composeSceneTags({
      characters: [girl('Mira'), girl('Sedge')],
      locationTags: '',
      actionTags: '3girls, arguing',
    })).toBe('2girls, arguing');
  });

  it(`renders a crowd as its first ${MAX_SCENE_CHARACTERS} characters`, () => {
    const out = composeSceneTags({
      characters: [girl('A', 'blue dress'), girl('B', 'green dress'), girl('C', 'red dress')],
      locationTags: '',
      actionTags: 'crowd',
    });
    expect(out).toBe('2girls, blue dress, green dress, crowd');
    expect(out).not.toContain('red dress');
  });

  it('dedupes a tag two sources share, keeping the first position', () => {
    expect(composeSceneTags({
      characters: [girl('Mira', 'rain')],
      locationTags: 'rain, wooden dock',
      actionTags: 'rain',
    })).toBe('1girl, rain, wooden dock');
  });

  it('repairs model output that arrives joined or underscored', () => {
    expect(composeSceneTags({ characters: [], locationTags: '', actionTags: 'holding_hands, walkingSlowly' }))
      .toBe('holding hands, walking slowly');
  });

  it('survives every source being empty', () => {
    expect(composeSceneTags({ characters: [], locationTags: '', actionTags: '' })).toBe('');
  });
});

describe('composeSceneTags — segmented', () => {
  it('puts counts, action and place in the base and each character in their own part', () => {
    expect(composeSceneTags({
      characters: [{ name: 'Wren', tags: '1boy, solo, short hair, grey coat' }, girl('Mira', 'silver hair')],
      locationTags: 'wooden dock, river',
      actionTags: 'arguing',
      segmented: true,
    })).toBe('1girl, 1boy, arguing, wooden dock, river | boy, short hair, grey coat | girl, silver hair');
  });

  it('merges same-kind counts in the base and keeps each kind bare in its part', () => {
    expect(composeSceneTags({
      characters: [girl('Mira', 'silver hair'), { name: 'Sedge', tags: '2girls, red coat' }],
      locationTags: '',
      actionTags: 'walking',
      segmented: true,
    })).toBe('2girls, walking | girl, silver hair | girl, red coat');
  });

  it('splits a one-character scene the same way', () => {
    expect(composeSceneTags({
      characters: [girl('Mira', 'solo focus, silver hair')],
      locationTags: 'river',
      actionTags: 'standing',
      segmented: true,
    })).toBe('1girl, standing, river | girl, silver hair');
  });

  it('keeps a tag both characters share in both parts', () => {
    expect(composeSceneTags({
      characters: [girl('Mira', 'long hair, blue eyes'), girl('Sedge', 'long hair, red coat')],
      locationTags: 'long hair',
      actionTags: 'long hair',
      segmented: true,
    })).toBe('2girls, long hair | girl, long hair, blue eyes | girl, long hair, red coat');
  });

  it('dedupes inside one part', () => {
    expect(composeSceneTags({
      characters: [girl('Mira', 'silver hair, Silver_Hair')],
      locationTags: 'rain',
      actionTags: 'rain',
      segmented: true,
    })).toBe('1girl, rain | girl, silver hair');
  });

  it('keeps the separators with Clean Up Tags on', () => {
    expect(composeSceneTags({
      characters: [girl('Mira', '{{silver hair}}')],
      locationTags: '[[river]]',
      actionTags: 'source#hug',
      segmented: true,
      cleanTags: true,
    })).toBe('1girl, source hug, river | girl, silver hair');
  });

  it('keeps NovelAI syntax inside a part with Clean Up Tags off', () => {
    expect(composeSceneTags({
      characters: [girl('Mira', '{{silver hair}}, 0.8::freckles ::')],
      locationTags: '[[river]]',
      actionTags: 'source#hug',
      segmented: true,
      cleanTags: false,
    })).toBe('1girl, source#hug, [[river]] | girl, {{silver hair}}, 0.8::freckles ::');
  });

  it('gives an untagged character a part with only their kind', () => {
    expect(composeSceneTags({
      characters: [{ name: 'Wren', tags: '' }, girl('Mira', 'silver hair')],
      locationTags: '',
      actionTags: 'talking',
      segmented: true,
    })).toBe('1girl, 1other, talking | other | girl, silver hair');
  });

  it('still drops "no humans" and strips names and places from the action', () => {
    expect(composeSceneTags({
      characters: [{ name: 'Dean Wolfram', tags: '1boy, grey coat' }],
      locationTags: 'no humans, wooden dock',
      actionTags: 'dean wolfram walking, sedge landing at dusk',
      places: ['Sedge Landing'],
      segmented: true,
    })).toBe('1boy, walking, at dusk, wooden dock | boy, grey coat');
  });

  it('is the plain line for an empty scene', () => {
    expect(composeSceneTags({ characters: [], locationTags: 'no humans, wooden dock', actionTags: 'rain', segmented: true }))
      .toBe('rain, no humans, wooden dock');
  });
});

describe('stripNames', () => {
  it('deletes a full name that is the whole tag', () => {
    expect(stripNames('dean wolfram', ['Dean Wolfram'])).toBe('');
  });

  it('keeps what the tag said around the name', () => {
    expect(stripNames('dean wolfram walking', ['Dean Wolfram'])).toBe('walking');
    expect(stripNames('behind dean wolfram', ['Dean Wolfram'])).toBe('behind');
  });

  it('matches regardless of case and handles regex-special characters in a name', () => {
    expect(stripNames('DEAN WOLFRAM smiling', ['dean wolfram'])).toBe('smiling');
    expect(stripNames('a. j. crane leaning', ['A. J. Crane'])).toBe('leaning');
  });

  it('removes a one-word name where it leads the tag, which is where a subject lands', () => {
    expect(stripNames('mira reaching out', ['Mira'])).toBe('reaching out');
    expect(stripNames('rain', ['Rain'])).toBe('');
    // A world with a character called Rain still keeps its weather tag.
    expect(stripNames('heavy rain', ['Rain'])).toBe('heavy rain');
  });

  it('does not eat a longer word that merely starts with a name', () => {
    expect(stripNames('miranda pose', ['Mira'])).toBe('miranda pose');
  });

  it('leaves an ordinary tag alone', () => {
    expect(stripNames('holding hands', ['Dean Wolfram', 'Mira'])).toBe('holding hands');
  });
});

describe('composeSceneTags — names', () => {
  it('takes the cast out of the tags the model wrote', () => {
    const out = composeSceneTags({
      characters: [{ name: 'Dean Wolfram', tags: '1boy, grey coat' }, girl('Mira', 'silver hair')],
      locationTags: 'wooden dock',
      actionTags: 'dean wolfram, mira reaching out, arguing',
    });
    expect(out).toBe('1girl, 1boy, grey coat, silver hair, reaching out, arguing, wooden dock');
  });

  it('strips an alias the same way as the name', () => {
    const out = composeSceneTags({
      characters: [{ name: 'Emmeline Fisk', aliases: ['The Matron'], tags: '1girl' }],
      locationTags: '',
      actionTags: 'the matron pouring tea',
    });
    expect(out).toBe('1girl, pouring tea');
  });

  it('leaves an authored tag that happens to contain a name, since the author meant it', () => {
    const out = composeSceneTags({
      characters: [{ name: 'Mira', tags: '1girl, mira signature locket' }],
      locationTags: '',
      actionTags: 'standing',
    });
    expect(out).toContain('mira signature locket');
  });
});

describe('stripPlaces', () => {
  const KNOWN = new Set(['kitchen', 'classroom', 'forest']);

  it('removes a full place name, keeping what the tag said around it', () => {
    expect(stripPlaces('sedge landing dock', ['Sedge Landing'], KNOWN)).toBe('dock');
    expect(stripPlaces('sedge landing', ['Sedge Landing'], KNOWN)).toBe('');
  });

  it('matches only the whole name, never its words', () => {
    // "Classroom A" is worth removing; neither of its words is.
    expect(stripPlaces('classroom a', ['Classroom A'], KNOWN)).toBe('');
    expect(stripPlaces('classroom', ['Classroom A'], KNOWN)).toBe('classroom');
    expect(stripPlaces('a girl', ['Classroom A'], KNOWN)).toBe('a girl');
  });

  it('leaves a place name that is itself a real tag', () => {
    expect(stripPlaces('kitchen', ['Kitchen'], KNOWN)).toBe('kitchen');
    expect(stripPlaces('forest path', ['Forest'], KNOWN)).toBe('forest path');
  });

  it('strips every name when no vocabulary is available', () => {
    expect(stripPlaces('kitchen', ['Kitchen'])).toBe('');
  });

  it('is case-insensitive and safe with punctuation in a name', () => {
    expect(stripPlaces('THE EELHOUSE interior', ['the eelhouse'], KNOWN)).toBe('interior');
    expect(stripPlaces("mother's rest lantern", ["Mother's Rest"], KNOWN)).toBe('lantern');
  });

  it('leaves an ordinary tag alone', () => {
    expect(stripPlaces('wooden dock', ['Sedge Landing'], KNOWN)).toBe('wooden dock');
  });
});

describe('composeSceneTags — places', () => {
  const KNOWN = new Set(['kitchen', 'wooden dock']);

  it('takes place names out of the tags the model wrote', () => {
    const out = composeSceneTags({
      characters: [girl('Mira')],
      locationTags: 'wooden dock',
      actionTags: 'walking, sedge landing at dusk',
      places: ['Sedge Landing', 'The Eelhouse'],
      knownTags: KNOWN,
    });
    expect(out).toBe('1girl, walking, at dusk, wooden dock');
  });

  it('never touches the authored layers, whatever they contain', () => {
    const out = composeSceneTags({
      characters: [{ name: 'Mira', tags: '1girl, sedge landing crest' }],
      locationTags: 'sedge landing, wooden dock',
      actionTags: 'standing',
      places: ['Sedge Landing'],
      knownTags: KNOWN,
    });
    expect(out).toContain('sedge landing crest');
    expect(out).toContain('sedge landing,');
  });

  it('keeps a place name the vocabulary knows', () => {
    const out = composeSceneTags({
      characters: [],
      locationTags: '',
      actionTags: 'kitchen, steam',
      places: ['Kitchen'],
      knownTags: KNOWN,
    });
    expect(out).toBe('kitchen, steam');
  });
});

describe('splitTags', () => {
  it('trims and drops empties', () => {
    expect(splitTags(' a ,, b,')).toEqual(['a', 'b']);
  });
});
