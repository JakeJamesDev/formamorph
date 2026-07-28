import { describe, it, expect } from 'vitest';
import { composeSceneTags, deriveCountTags, splitTags, stripNames, stripPlaces, MAX_SCENE_CHARACTERS } from './sceneTags';

const girl = (name: string, extra = '') => ({ name, tags: `1girl, ${extra}`.replace(/,\s*$/, '') });

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
