import { describe, it, expect, beforeEach } from 'vitest';
import type { Finding } from './rules';
import {
  EMPTY_BENCH_STATE,
  findingIdentity,
  partitionFindings,
  readBenchState,
  withDismissed,
  withRestored,
  withSeen,
  withSource,
  writeBenchState,
} from './seenState';

const finding = (over: Partial<Finding> = {}): Finding => ({
  ruleId: 'alias-leading-article',
  severity: 'warning',
  section: 'entities',
  message: 'Alias “the visitor” begins with an article',
  items: [{ id: 'e1', name: 'Maren' }],
  ...over,
});

const isNewOf = (findings: Finding[], state = EMPTY_BENCH_STATE) =>
  partitionFindings(findings, state).live.map((f) => f.isNew);

describe('finding identity', () => {
  it('is the rule plus the items it names', () => {
    expect(findingIdentity(finding())).toBe('alias-leading-article|e1');
  });

  it('holds through a reorder of the items it names', () => {
    const a = finding({ ruleId: 'entity-match-collision', items: [{ id: 'e1', name: 'Maren' }, { id: 'e2', name: 'Tobb' }] });
    const b = finding({ ruleId: 'entity-match-collision', items: [{ id: 'e2', name: 'Tobb' }, { id: 'e1', name: 'Maren' }] });
    expect(findingIdentity(a)).toBe(findingIdentity(b));
  });

  it('separates the same rule firing about different items', () => {
    expect(findingIdentity(finding())).not.toBe(findingIdentity(finding({ items: [{ id: 'e2', name: 'Tobb' }] })));
  });
});

describe('new versus known', () => {
  it('reads a finding nobody has been shown as new', () => {
    expect(isNewOf([finding()])).toEqual([true]);
  });

  it('reads it as known once it has been marked seen', () => {
    const state = withSeen(EMPTY_BENCH_STATE, [finding()]);
    expect(isNewOf([finding()], state)).toEqual([false]);
  });

  it('raises it again when editing the named item changes what the finding says', () => {
    const state = withSeen(EMPTY_BENCH_STATE, [finding()]);
    const afterEdit = finding({ message: 'Alias “the wanderer” begins with an article' });
    expect(isNewOf([afterEdit], state)).toEqual([true]);
  });

  it('raises it again when the item is renamed', () => {
    const state = withSeen(EMPTY_BENCH_STATE, [finding()]);
    const renamed = finding({ items: [{ id: 'e1', name: 'Maren of the Fen' }] });
    expect(isNewOf([renamed], state)).toEqual([true]);
  });

  it('leaves the rest of the list known when one finding changes', () => {
    const other = finding({ items: [{ id: 'e2', name: 'Tobb' }], message: 'Alias “the fishmonger” begins with an article' });
    const state = withSeen(EMPTY_BENCH_STATE, [finding(), other]);
    const edited = finding({ message: 'Alias “the wanderer” begins with an article' });
    expect(isNewOf([edited, other], state)).toEqual([true, false]);
  });

  it('keeps a finding known through a spell where it did not fire', () => {
    // Mid-edit the defect can disappear and come back; marking seen merges rather than replaces, so it does
    // not return as new the moment the author retypes the same mistake.
    const seen = withSeen(EMPTY_BENCH_STATE, [finding()]);
    const afterClean = withSeen(seen, []);
    expect(isNewOf([finding()], afterClean)).toEqual([false]);
  });

  it('does not rewrite the record when everything is already known', () => {
    const state = withSeen(EMPTY_BENCH_STATE, [finding()]);
    expect(withSeen(state, [finding()])).toBe(state);
  });
});

describe('dismissal', () => {
  it('takes a finding out of the live list', () => {
    const state = withDismissed(EMPTY_BENCH_STATE, [finding()]);
    const { live, dismissed } = partitionFindings([finding()], state);
    expect(live).toEqual([]);
    expect(dismissed.map((f) => f.identity)).toEqual(['alias-leading-article|e1']);
  });

  it('stays put when the item is renamed — it is a judgment about the item, not the wording', () => {
    const state = withDismissed(EMPTY_BENCH_STATE, [finding()]);
    const renamed = finding({ items: [{ id: 'e1', name: 'Maren of the Fen' }] });
    expect(partitionFindings([renamed], state).live).toEqual([]);
  });

  it('mutes only the finding it was aimed at', () => {
    const other = finding({ items: [{ id: 'e2', name: 'Tobb' }] });
    const state = withDismissed(EMPTY_BENCH_STATE, [finding()]);
    expect(partitionFindings([finding(), other], state).live.map((f) => f.identity))
      .toEqual(['alias-leading-article|e2']);
  });

  it('restores what it muted', () => {
    const state = withRestored(withDismissed(EMPTY_BENCH_STATE, [finding()]), [finding()]);
    expect(partitionFindings([finding()], state).live).toHaveLength(1);
  });
});

describe('source updates', () => {
  it('clears the seen-set when the downloaded source changed', () => {
    const seen = withSource(withSeen(EMPTY_BENCH_STATE, [finding()]), 'T1');
    const afterUpdate = withSource(seen, 'T2');
    expect(isNewOf([finding()], afterUpdate)).toEqual([true]);
  });

  it('keeps it when the same source is re-downloaded unchanged', () => {
    const seen = withSeen(withSource(EMPTY_BENCH_STATE, 'T1'), [finding()]);
    expect(withSource(seen, 'T1')).toBe(seen);
    expect(isNewOf([finding()], withSource(seen, 'T1'))).toEqual([false]);
  });

  it('leaves an author’s own dismissals alone across an update', () => {
    const state = withDismissed(withSource(EMPTY_BENCH_STATE, 'T1'), [finding()]);
    expect(partitionFindings([finding()], withSource(state, 'T2')).live).toEqual([]);
  });

  it('never clears a locally authored world, which has no source at all', () => {
    const seen = withSeen(EMPTY_BENCH_STATE, [finding()]);
    expect(withSource(seen, undefined)).toBe(seen);
  });

  it('holds the marks while the version is still unknown', () => {
    // The world's metadata arrives after the editor mounts. Reading that gap as "the source changed" would
    // wipe a downloaded world's marks every time it was opened.
    const seen = withSource(withSeen(EMPTY_BENCH_STATE, [finding()]), 'T1');
    expect(withSource(seen, undefined)).toBe(seen);
    expect(isNewOf([finding()], withSource(seen, undefined))).toEqual([false]);
  });

  it('records a version it is learning for the first time without clearing', () => {
    // The marks were made against the content already in hand, so first sight of its version proves nothing.
    const seen = withSeen(EMPTY_BENCH_STATE, [finding()]);
    expect(withSource(seen, 'T1').source).toBe('T1');
    expect(isNewOf([finding()], withSource(seen, 'T1'))).toEqual([false]);
  });
});

describe('the stored record', () => {
  beforeEach(() => localStorage.clear());

  it('survives a reload', () => {
    writeBenchState('w1', withSeen(EMPTY_BENCH_STATE, [finding()]));
    expect(isNewOf([finding()], readBenchState('w1'))).toEqual([false]);
  });

  it('keeps each world’s marks to itself', () => {
    writeBenchState('w1', withSeen(EMPTY_BENCH_STATE, [finding()]));
    expect(isNewOf([finding()], readBenchState('w2'))).toEqual([true]);
  });

  it('leaves the other worlds alone when one is written', () => {
    writeBenchState('w1', withDismissed(EMPTY_BENCH_STATE, [finding()]));
    writeBenchState('w2', withSeen(EMPTY_BENCH_STATE, [finding()]));
    expect(readBenchState('w1').dismissed).toEqual(['alias-leading-article|e1']);
  });

  it('reads a corrupt record as no marks rather than throwing', () => {
    localStorage.setItem('FORMAMORPH_benchFindingState', '{"w1":{"seen":"nonsense","dismissed":7}}');
    expect(readBenchState('w1')).toEqual(EMPTY_BENCH_STATE);
    localStorage.setItem('FORMAMORPH_benchFindingState', 'not json at all');
    expect(readBenchState('w1')).toEqual(EMPTY_BENCH_STATE);
  });
});
