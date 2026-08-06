import { describe, it, expect } from 'vitest';
import {
  selectRegenSource,
  collectAppearances,
  findTurnNarration,
  capChronological,
  selectSemanticAppearances,
  buildRegenContext,
  buildRegenUserMessage,
  REGEN_FIRST_LABEL,
  REGEN_SINCE_LABEL,
  REGEN_LABELS,
  REGEN_MAX_PASSAGES,
  REGEN_MAX_CHARS,
  type AppearanceTurn,
} from './discoveredRegen';
import { cleanDiscoveredDescription, DISCOVER_NAME_LABEL } from './runtimeCharacters';
import { vectorKey } from './memoryRelevance';
import type { ChatMessage } from '@/types';

/** Build an assistant turn message with the given fields. */
function turn(fields: { turnId?: string; narration?: string; entities?: string[]; summary?: string }): ChatMessage {
  return { role: 'assistant', content: JSON.stringify({ narration: 'n', choices: [], stat_changes: [], ...fields }) };
}

/** A unit vector in 2D lifted to the length the cosine helper compares — direction is all that matters. */
function vec(x: number, y: number): Float32Array {
  const length = Math.hypot(x, y);
  return new Float32Array([x / length, y / length]);
}

describe('selectRegenSource', () => {
  it('prefers semantic, then diary, then digests, then prose', () => {
    expect(selectRegenSource({ semanticMemory: true, characterDiaries: true, memoryDigests: true })).toBe('semantic');
    expect(selectRegenSource({ semanticMemory: false, characterDiaries: true, memoryDigests: true })).toBe('diary');
    expect(selectRegenSource({ semanticMemory: false, characterDiaries: false, memoryDigests: true })).toBe('digests');
    expect(selectRegenSource({ semanticMemory: false, characterDiaries: false, memoryDigests: false })).toBe('prose');
  });

  it('picks semantic even when only it is on, so the ladder is priority not precedence-of-availability', () => {
    expect(selectRegenSource({ semanticMemory: true, characterDiaries: false, memoryDigests: false })).toBe('semantic');
  });
});

describe('findTurnNarration', () => {
  const history = [turn({ turnId: 't1', narration: 'She stepped from the reeds.' }), turn({ turnId: 't2', narration: 'Later.' })];

  it('returns the narration of the matching turn', () => {
    expect(findTurnNarration(history, 't1')).toBe('She stepped from the reeds.');
  });

  it('returns empty for a rolled-back or absent turn id', () => {
    expect(findTurnNarration(history, 'gone')).toBe('');
    expect(findTurnNarration(history, undefined)).toBe('');
  });
});

describe('collectAppearances', () => {
  const history = [
    turn({ turnId: 't1', narration: 'Intro passage.', entities: ['Grey Mouse'] }),
    turn({ turnId: 't2', narration: 'Second.', entities: ['Sarah'] }),
    turn({ turnId: 't3', narration: 'Third.', entities: ['grey mouse'], summary: 'The mouse fled.' }),
    turn({ turnId: 't4', narration: 'Fourth.', entities: [] }),
  ];

  it('collects only the turns this character took part in, chronological', () => {
    expect(collectAppearances(history, 'Grey Mouse').map((a) => a.turnId)).toEqual(['t1', 't3']);
  });

  it('excludes the introducing turn, which rides the message separately', () => {
    expect(collectAppearances(history, 'Grey Mouse', 't1').map((a) => a.turnId)).toEqual(['t3']);
  });

  it('carries the digest when the turn has one, and leaves it undefined otherwise', () => {
    const [first, third] = collectAppearances(history, 'Grey Mouse');
    expect(first.summary).toBeUndefined();
    expect(third.summary).toBe('The mouse fled.');
  });

  it('matches a name variant, so a coined name and its short form are one character', () => {
    const variant = [turn({ turnId: 'x', narration: 'n', entities: ['Sergeant Aldric'] })];
    expect(collectAppearances(variant, 'Aldric').map((a) => a.turnId)).toEqual(['x']);
  });
});

describe('capChronological', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ text: `passage ${i}` }));

  it('keeps the newest items up to the count cap, returned chronological', () => {
    const kept = capChronological(items, (i) => i.text);
    expect(kept).toHaveLength(REGEN_MAX_PASSAGES);
    expect(kept[0].text).toBe(`passage ${12 - REGEN_MAX_PASSAGES}`);
    expect(kept[kept.length - 1].text).toBe('passage 11');
  });

  it('stops at the character budget before reaching the count cap', () => {
    const long = Array.from({ length: 6 }, (_, i) => ({ text: `${i}`.padEnd(5000, 'x') }));
    const kept = capChronological(long, (i) => i.text);
    expect(kept).toHaveLength(2); // 5000 + 5000 fits; a third would exceed REGEN_MAX_CHARS
    expect(kept.map((k) => k.text[0])).toEqual(['4', '5']);
  });

  it('keeps one oversized item rather than returning nothing', () => {
    const huge = [{ text: 'x'.repeat(REGEN_MAX_CHARS * 2) }];
    expect(capChronological(huge, (i) => i.text)).toHaveLength(1);
  });

  it('returns empty for no items', () => {
    expect(capChronological([], (i: { text: string }) => i.text)).toEqual([]);
  });
});

describe('selectSemanticAppearances', () => {
  const near: AppearanceTurn = { turnId: 'a', narration: 'n', summary: 'near digest' };
  const far: AppearanceTurn = { turnId: 'b', narration: 'n', summary: 'far digest' };
  const middling: AppearanceTurn = { turnId: 'c', narration: 'n', summary: 'middling digest' };
  const query = vec(1, 0);
  const vectors = new Map([
    [vectorKey('near digest'), vec(1, 0.02)],
    [vectorKey('far digest'), vec(0, 1)],
    [vectorKey('middling digest'), vec(1, 1)],
  ]);

  it('keeps the closest matches and restores chronological order', () => {
    const picked = selectSemanticAppearances([near, far, middling], query, vectors, 2);
    expect(picked?.map((p) => p.turnId)).toEqual(['a', 'c']); // 'far' loses; a-before-c is input order
  });

  it('skips an appearance with no digest or no cached vector', () => {
    const undigested: AppearanceTurn = { turnId: 'd', narration: 'n' };
    const unembedded: AppearanceTurn = { turnId: 'e', narration: 'n', summary: 'never embedded' };
    const picked = selectSemanticAppearances([near, undigested, unembedded], query, vectors, 5);
    expect(picked?.map((p) => p.turnId)).toEqual(['a']);
  });

  it('returns null when nothing is rankable, so the caller can fall to the next source', () => {
    expect(selectSemanticAppearances([{ turnId: 'd', narration: 'n' }], query, vectors)).toBeNull();
    expect(selectSemanticAppearances([], query, vectors)).toBeNull();
  });
});

describe('buildRegenContext', () => {
  const history = [
    turn({ turnId: 't1', narration: 'She stepped from the reeds.', entities: ['Grey Mouse'] }),
    turn({ turnId: 't2', narration: 'She stole the ration tin.', entities: ['Grey Mouse'], summary: 'The mouse stole food.' }),
  ];

  it('pairs the introducing passage with prose appearances when no memory feature is on', () => {
    const ctx = buildRegenContext({ history, name: 'Grey Mouse', sourceTurnId: 't1', source: 'prose' });
    expect(ctx).toEqual({ source: 'prose', firstPassage: 'She stepped from the reeds.', supplemental: ['She stole the ration tin.'] });
  });

  it('uses digests when that is the chosen source', () => {
    const ctx = buildRegenContext({ history, name: 'Grey Mouse', sourceTurnId: 't1', source: 'digests' });
    expect(ctx.source).toBe('digests');
    expect(ctx.supplemental).toEqual(['The mouse stole food.']);
  });

  it('uses the supplied diary entries when that is the chosen source', () => {
    const ctx = buildRegenContext({
      history, name: 'Grey Mouse', sourceTurnId: 't1', source: 'diary',
      diaryEntries: ['I was hungry.', 'They did not see me.'],
    });
    expect(ctx.source).toBe('diary');
    expect(ctx.supplemental).toEqual(['I was hungry.', 'They did not see me.']);
  });

  it('uses exactly one source: the diary tier never also carries digests or prose', () => {
    const ctx = buildRegenContext({
      history, name: 'Grey Mouse', sourceTurnId: 't1', source: 'diary', diaryEntries: ['I was hungry.'],
    });
    expect(ctx.supplemental).toEqual(['I was hungry.']);
    expect(ctx.supplemental.join('\n')).not.toContain('ration tin');
    expect(ctx.supplemental.join('\n')).not.toContain('stole food');
  });

  it('uses the semantic tier when digests are embedded', () => {
    const vectors = new Map([[vectorKey('The mouse stole food.'), vec(1, 0)]]);
    const ctx = buildRegenContext({
      history, name: 'Grey Mouse', sourceTurnId: 't1', source: 'semantic',
      semantic: { queryVec: vec(1, 0), vectorsByKey: vectors },
    });
    expect(ctx.source).toBe('semantic');
    expect(ctx.supplemental).toEqual(['The mouse stole food.']);
  });

  it('steps down one tier at a time when the chosen source is empty', () => {
    // Semantic is on but nothing is embedded yet, and there are no diaries — the next source that has
    // anything is digests, not a drop all the way to raw prose.
    const ctx = buildRegenContext({ history, name: 'Grey Mouse', sourceTurnId: 't1', source: 'semantic', semantic: null });
    expect(ctx.source).toBe('digests');
    expect(ctx.supplemental).toEqual(['The mouse stole food.']);
  });

  it('falls through diary and digests together when both are empty', () => {
    const bare = [
      turn({ turnId: 't1', narration: 'Intro.', entities: ['Grey Mouse'] }),
      turn({ turnId: 't2', narration: 'Undigested later turn.', entities: ['Grey Mouse'] }),
    ];
    const ctx = buildRegenContext({ history: bare, name: 'Grey Mouse', sourceTurnId: 't1', source: 'diary', diaryEntries: [] });
    expect(ctx.source).toBe('prose');
    expect(ctx.supplemental).toEqual(['Undigested later turn.']);
  });

  it('yields an empty supplemental when the character has never appeared since', () => {
    const only = [turn({ turnId: 't1', narration: 'Intro.', entities: ['Grey Mouse'] })];
    const ctx = buildRegenContext({ history: only, name: 'Grey Mouse', sourceTurnId: 't1', source: 'prose' });
    expect(ctx.supplemental).toEqual([]);
    expect(ctx.firstPassage).toBe('Intro.');
  });
});

describe('buildRegenUserMessage', () => {
  it('labels the name, the first passage, and the later material', () => {
    const message = buildRegenUserMessage('Grey Mouse', {
      source: 'prose', firstPassage: 'She stepped from the reeds.', supplemental: ['She stole the tin.', 'She ran.'],
    });
    expect(message).toBe(
      `${DISCOVER_NAME_LABEL} Grey Mouse\n\n` +
      `${REGEN_FIRST_LABEL}\nShe stepped from the reeds.\n\n` +
      `${REGEN_SINCE_LABEL}\nShe stole the tin.\n\nShe ran.`,
    );
  });

  it('omits the since section entirely when there is no later material', () => {
    const message = buildRegenUserMessage('Grey Mouse', { source: 'prose', firstPassage: 'Intro.', supplemental: [] });
    expect(message).not.toContain(REGEN_SINCE_LABEL);
    expect(message).toContain(REGEN_FIRST_LABEL);
  });

  it('omits the first-passage section when that turn is gone', () => {
    const message = buildRegenUserMessage('Grey Mouse', { source: 'prose', firstPassage: '', supplemental: ['Later.'] });
    expect(message).not.toContain(REGEN_FIRST_LABEL);
    expect(message).toContain(REGEN_SINCE_LABEL);
  });
});

describe('cleanDiscoveredDescription with the regen labels', () => {
  it('cuts a parroted regen label and everything after it', () => {
    const raw = `A wiry scavenger who trusts nobody.\n\n${REGEN_SINCE_LABEL}\nShe stole the tin and ran.`;
    expect(cleanDiscoveredDescription(raw, 'Grey Mouse', REGEN_LABELS)).toBe('A wiry scavenger who trusts nobody.');
  });

  it('cuts the first-passage label too', () => {
    const raw = `A wiry scavenger.\n${REGEN_FIRST_LABEL}\nShe stepped from the reeds.`;
    expect(cleanDiscoveredDescription(raw, 'Grey Mouse', REGEN_LABELS)).toBe('A wiry scavenger.');
  });

  it('leaves a clean description untouched', () => {
    expect(cleanDiscoveredDescription('A wiry scavenger.', 'Grey Mouse', REGEN_LABELS)).toBe('A wiry scavenger.');
  });

  it('strips a leading bare "Name:" echo', () => {
    expect(cleanDiscoveredDescription('Grey Mouse: A wiry scavenger.', 'Grey Mouse', REGEN_LABELS)).toBe('A wiry scavenger.');
  });
});
