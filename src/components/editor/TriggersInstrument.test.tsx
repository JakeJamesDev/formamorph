import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildTriggerReport, joinHistory, splitHistory, type TriggerWorld } from '@/lib/testBench/triggers';
import { runRules, selectMatchingFindings, type RuleWorld } from '@/lib/testBench/rules';
import { entryVectorKey } from '@/lib/semanticDictionary';
import type { Dictionary, DictionaryEntry, Entity, WorldOverview } from '@/types';
import { TriggersInstrument, type TriggersInstrumentProps } from './TriggersInstrument';

const entry = (over: Partial<DictionaryEntry> & { id: string }): DictionaryEntry => ({
  name: '', key: [], value: 'lore', ...over,
});
const book = (entries: DictionaryEntry[], over: Partial<Dictionary> = {}): Dictionary =>
  ({ id: 'book1', name: 'Sedge Lore', entries, ...over });
const ent = (id: string, name: string, over: Partial<Entity> = {}): Entity => ({ id, name, ...over }) as Entity;

const world = (over: Partial<TriggerWorld> = {}): TriggerWorld =>
  ({ entities: [], dictionaries: [], placeholders: [], ...over });

// The panel renders whatever the real tracer produced — a row shape the module cannot emit would prove
// nothing about what an author sees.
const renderTriggers = (from: TriggerWorld, text: string, over: Partial<TriggersInstrumentProps> = {}) => {
  const onTextChange = vi.fn();
  const onHistoryChange = vi.fn();
  const onFixRule = vi.fn();
  const history = over.history ?? '';
  render(
    <TriggersInstrument
      text={text}
      onTextChange={onTextChange}
      history={history}
      onHistoryChange={onHistoryChange}
      report={buildTriggerReport(from, text, { history: splitHistory(history) })}
      warnings={[]}
      onFixRule={onFixRule}
      semanticStatus="unavailable"
      semanticOn={false}
      onSemanticChange={vi.fn()}
      {...over}
    />,
  );
  return { onTextChange, onHistoryChange, onFixRule };
};

/** The matching findings the rule engine really raises for a world — never hand-built, so the sentence and
 *  the fix on screen are the ones Issues would show. */
const matchingFor = (over: Partial<RuleWorld>) => selectMatchingFindings(runRules({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: '' } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: [], traits: [], statUpdates: [], dictionaries: [], placeholders: [],
  ...over,
}));

const sedge = world({
  entities: [ent('e1', 'Maren')],
  dictionaries: [book([
    entry({ id: 'd1', name: 'Tides', key: ['tide'] }),
    entry({ id: 'd2', name: 'Storms', key: ['storm'] }),
  ])],
});

describe('TriggersInstrument', () => {
  it('re-evaluates as the author types, with no button to press', async () => {
    const { onTextChange } = renderTriggers(sedge, '');
    expect(screen.queryByRole('button', { name: /run|evaluate|check/i })).toBeNull();
    await userEvent.type(screen.getByRole('textbox', { name: 'Scene text' }), 'a');
    expect(onTextChange).toHaveBeenCalledWith('a');
  });

  it('lists a detected entity with the form that matched and the text it hit', () => {
    renderTriggers(sedge, 'Maren watches the tide.');
    const row = screen.getByText(/Matched “Maren” as “Maren”/).closest('div');
    expect(within(row as HTMLElement).getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('1 detected')).toBeInTheDocument();
  });

  it('shows a fired entry’s keyword, literal text and region', () => {
    renderTriggers(sedge, 'The tides pull out.');
    expect(screen.getByText('Keyword')).toBeInTheDocument();
    expect(screen.getByText('“tide” as “tide” · Scene')).toBeInTheDocument();
  });

  it('states the near-miss reason on a row that did not fire', () => {
    renderTriggers(
      world({ dictionaries: [book([entry({ id: 'd1', name: 'Tides', key: ['tide'], matchWholeWords: true })])] }),
      'The riptides drag the channel.',
    );
    expect(screen.getByText(/appears only inside “riptides”/)).toBeInTheDocument();
  });

  it('greys a muted book with the reason its entries were never scanned', () => {
    renderTriggers(
      world({ dictionaries: [book([entry({ id: 'd1', name: 'Tides', key: ['tide'] })], { enabled: false })] }),
      'The tide pulls out.',
    );
    expect(screen.getByText(/Sedge Lore · off/)).toBeInTheDocument();
    expect(screen.getByText(/book is off, so none of its entries are scanned/)).toBeInTheDocument();
  });

  it('flags an uncompilable pattern on the entry instead of losing the run', () => {
    renderTriggers(
      world({ dictionaries: [book([
        entry({ id: 'd1', name: 'Broken', key: ['tide('], useRegex: true }),
        entry({ id: 'd2', name: 'Tides', key: ['tide'] }),
      ])] }),
      'The tide pulls out.',
    );
    expect(screen.getByText(/is not valid regex/)).toBeInTheDocument();
    // The healthy entry beside it still got its verdict.
    expect(screen.getByText('Keyword')).toBeInTheDocument();
  });

  it('reads empty text as a result: the constant entries and what they do', () => {
    renderTriggers(
      world({ dictionaries: [book([
        entry({ id: 'd1', name: 'House Rules', constant: true }),
        entry({ id: 'd2', name: 'Tides', key: ['tide'] }),
      ])] }),
      '',
    );
    expect(screen.getByText(/1 constant entry injects on every turn/)).toBeInTheDocument();
    expect(screen.getByText('House Rules')).toBeInTheDocument();
    expect(screen.getByText('Always On')).toBeInTheDocument();
  });

  it('reads nothing-fired as a result, with the number of entries checked', () => {
    renderTriggers(sedge, 'A quiet morning.');
    expect(screen.getByText(/Nothing fired\. 2 entries were checked/)).toBeInTheDocument();
    // And the rows are still there to explain themselves.
    expect(screen.getAllByText('No keyword found in the text.')).toHaveLength(2);
  });

  it('says so plainly when a world has no dictionary at all', () => {
    renderTriggers(world(), 'Maren watches the tide.');
    expect(screen.getByText('This world has no dictionary entries.')).toBeInTheDocument();
  });
});

describe('TriggersInstrument highlights', () => {
  it('marks the matched words in the pasted text', () => {
    renderTriggers(sedge, 'Maren watches the tide.');
    expect(screen.getByRole('button', { name: 'Maren' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tide' })).toBeInTheDocument();
  });

  it('opens the row a highlight belongs to', async () => {
    renderTriggers(sedge, 'Maren watches the tide.');
    await userEvent.click(screen.getByRole('button', { name: 'tide' }));
    // The Tides row is the one the span points at, so it is the one singled out.
    const row = screen.getByText('Tides').closest('div[class*="rounded-md"]');
    expect(row?.className).toMatch(/ring-1/);
    expect(within(row as HTMLElement).getByText('“tide” as “tide” · Scene')).toBeInTheDocument();
  });

  it('reaches both rows from words an entity and an entry share', async () => {
    renderTriggers(
      world({ entities: [ent('e1', 'Maren')], dictionaries: [book([entry({ id: 'd1', name: 'The Visitor', key: ['Maren'] })])] }),
      'Maren crosses the yard.',
    );
    const span = screen.getByRole('button', { name: 'Maren' });
    const ringed = () => document.querySelectorAll('div[class*="ring-1"]');
    await userEvent.click(span);
    expect(within(ringed()[0] as HTMLElement).getByText(/Matched “Maren”/)).toBeInTheDocument();
    // A second click hands the same words to the other claimant rather than sticking on the first.
    await userEvent.click(span);
    expect(ringed()).toHaveLength(1);
    expect(within(ringed()[0] as HTMLElement).getByText('The Visitor')).toBeInTheDocument();
  });
});

describe('TriggersInstrument rendered context', () => {
  const lore = world({
    dictionaries: [book([entry({ id: 'd1', name: 'Tides', key: ['tide'], value: 'The tide runs twice a day.' })])],
  });

  it('states the token estimate with its ~ prefix without being opened', () => {
    renderTriggers(lore, 'The tide pulls out.');
    expect(screen.getByRole('button', { name: /Rendered Context/ }).textContent).toMatch(/~\d+ tokens/);
  });

  it('shows the injected block verbatim once opened, with what is in it', async () => {
    renderTriggers(lore, 'The tide pulls out.');
    await userEvent.click(screen.getByRole('button', { name: /Rendered Context/ }));
    expect(screen.getByText('Tides: The tide runs twice a day.')).toBeInTheDocument();
    expect(screen.getByText(/Foreground Lore · 1 entry · ~\d+ tokens/)).toBeInTheDocument();
  });

  it('says plainly that nothing would be injected when nothing fired', async () => {
    renderTriggers(lore, 'A quiet morning.');
    expect(screen.getByRole('button', { name: /Rendered Context/ }).textContent).toMatch(/~0 tokens/);
    await userEvent.click(screen.getByRole('button', { name: /Rendered Context/ }));
    expect(screen.getByText('Nothing fired, so no entry’s text is injected.')).toBeInTheDocument();
  });
});

describe('TriggersInstrument history', () => {
  const deep = world({
    dictionaries: [book([entry({ id: 'd1', name: 'Tides', key: ['tide'], scanDepth: 3 })])],
  });

  it('takes earlier messages and reports how many are being traced', async () => {
    const { onHistoryChange } = renderTriggers(deep, 'A quiet morning.', {
      history: joinHistory(['One turn.', 'Two turns.']),
    });
    expect(screen.getByRole('button', { name: /History/ }).textContent).toContain('2 messages');
    await userEvent.click(screen.getByRole('button', { name: /History/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'History messages' }), '!');
    expect(onHistoryChange).toHaveBeenCalled();
  });

  it('labels a history hit with how far back it was and the depth window that let it count', () => {
    renderTriggers(deep, 'A quiet morning.', { history: joinHistory(['The tide pulled out.', 'She walked the pier.']) });
    expect(screen.getByText(
      '“tide” as “tide” · History, 2 messages back · inside its scan depth of 3 messages',
    )).toBeInTheDocument();
  });

  it('names each further message a hit came from, once, whatever matched in it', () => {
    renderTriggers(
      world({ dictionaries: [book([entry({ id: 'd1', name: 'Tides', key: ['tide', 'ebb'] })])] }),
      'The tide pulls out.',
      { history: joinHistory(['The ebb tide ran hard.', 'She walked the pier.']) },
    );
    // Two keywords in the one older message is still one place the hit came from.
    const also = screen.getAllByText(/^Also/);
    expect(also).toHaveLength(1);
    expect(also[0].textContent).toContain('History, 2 messages back');
  });

  it('explains a hit the depth window dropped, with its distance', () => {
    renderTriggers(
      world({ dictionaries: [book([entry({ id: 'd1', name: 'Tides', key: ['tide'], scanDepth: 1 })])] }),
      'A quiet morning.',
      { history: joinHistory(['The tide pulled out.', 'She walked the pier.']) },
    );
    expect(screen.getByText(/matched 2 messages back, further back than its scan depth of 1 message/))
      .toBeInTheDocument();
  });
});

describe('TriggersInstrument paste last turn', () => {
  it('is absent, not disabled, when the world has no save to read', () => {
    renderTriggers(sedge, '');
    expect(screen.queryByRole('button', { name: /Paste Last Turn/ })).toBeNull();
  });

  it('hands the paste back to the editor, which owns both boxes', async () => {
    const onPasteLastTurn = vi.fn();
    renderTriggers(sedge, '', { onPasteLastTurn });
    await userEvent.click(screen.getByRole('button', { name: /Paste Last Turn/ }));
    expect(onPasteLastTurn).toHaveBeenCalled();
  });
});

describe('TriggersInstrument inline warnings', () => {
  const articled: Entity[] = [{ id: 'e1', name: 'Maren', aliases: ['the visitor'], locations: ['harbor'] }];

  it('states a matching warning beside the row it is about, in the engine’s own words', () => {
    const warnings = matchingFor({ entities: articled });
    renderTriggers(world({ entities: articled }), 'Maren watches the tide.', { warnings });
    const row = screen.getByText(/Matched “Maren”/).closest('div[class*="rounded-md"]');
    expect(within(row as HTMLElement).getByText(warnings[0].message)).toBeInTheDocument();
  });

  it('offers the rule’s own repair, and hands it back by rule id', async () => {
    const warnings = matchingFor({ entities: articled });
    const { onFixRule } = renderTriggers(world({ entities: articled }), 'Maren watches the tide.', { warnings });
    await userEvent.click(screen.getByRole('button', { name: 'Fix' }));
    expect(onFixRule).toHaveBeenCalledWith('alias-leading-article');
  });

  it('offers no Fix where the repair is a judgment call', () => {
    // Which of two colliding entities should be renamed is the author's call, so the row states it and stops.
    const colliding: Entity[] = [
      { id: 'e1', name: 'Maren', locations: ['harbor'] },
      { id: 'e2', name: 'Maren Vosk', aliases: ['Maren'], locations: ['harbor'] },
    ];
    const warnings = matchingFor({ entities: colliding });
    renderTriggers(world({ entities: colliding }), 'Maren crosses the yard.', { warnings });
    expect(screen.getAllByText(/matches Maren and Maren Vosk/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Fix' })).toBeNull();
  });

  it('still shows a warning whose item earned no row — the articled alias is why it earned none', () => {
    // The rule's whole point: "the visitor" misses "The visitor", so the entity is undetected. Attaching the
    // warning only to a row it failed to earn would hide the explanation for the failure.
    const warnings = matchingFor({ entities: articled });
    renderTriggers(world({ entities: articled }), 'The visitor crosses the yard.', { warnings });
    expect(screen.queryByText(/Matched/)).toBeNull();
    const loose = screen.getByText('Nothing below can show these').closest('div');
    expect(within(loose as HTMLElement).getByText(warnings[0].message)).toBeInTheDocument();
    expect(within(loose as HTMLElement).getByRole('button', { name: 'Fix' })).toBeInTheDocument();
  });

  it('keeps a warning off the loose list once its row is on screen', () => {
    const warnings = matchingFor({ entities: articled });
    renderTriggers(world({ entities: articled }), 'Maren watches the tide.', { warnings });
    expect(screen.queryByText('Nothing below can show these')).toBeNull();
  });

  it('warns about an entry that can never fire, on the entry’s own row', () => {
    const dictionaries = [book([entry({ id: 'd1', name: 'Orphan' })])];
    const warnings = matchingFor({ dictionaries });
    renderTriggers(world({ dictionaries }), 'Maren watches the tide.', { warnings });
    const row = screen.getByText('Orphan').closest('div[class*="rounded-md"]');
    expect(within(row as HTMLElement).getByText(warnings[0].message)).toBeInTheDocument();
  });
});

describe('TriggersInstrument — the semantic toggle', () => {
  /** Unit vectors in the plane: their dot product is the cosine, which is what the worker's normalized
   *  vectors make the real scorer compute. */
  const at = (radians: number) => new Float32Array([Math.cos(radians), Math.sin(radians)]);
  const scoring = (score: number) => at(Math.acos(score));
  const beacon = entry({ id: 'd1', name: 'Old Beacon', key: ['beacon'], value: 'The beacon has not burned.' });
  const tides = entry({ id: 'd2', name: 'Tides', key: ['tide'], value: 'The tide runs twice a day.' });
  const lore = world({ dictionaries: [book([beacon, tides])] });
  const scene = 'The ruined tower on the hill.';

  /** The panel with a real semantic run behind it — the scores on screen come from the tracer, never from
   *  a hand-built row. */
  const renderScored = (scores: Array<[DictionaryEntry, number]>, over: Partial<TriggersInstrumentProps> = {}) =>
    renderTriggers(lore, scene, {
      report: buildTriggerReport(lore, scene, {
        semantic: {
          queryVec: at(0),
          vectors: new Map(scores.map(([e, score]) => [entryVectorKey(e), scoring(score)])),
          threshold: 0.4,
        },
      }),
      semanticStatus: 'ready',
      semanticOn: true,
      ...over,
    });

  it('is off with nothing semantic on screen until the author asks for it', () => {
    renderTriggers(lore, scene);
    expect(screen.getByRole('checkbox', { name: 'Semantic' })).not.toBeChecked();
    expect(screen.queryByText(/threshold/)).toBeNull();
  });

  it('cannot be turned on without an index, and says why', () => {
    renderTriggers(lore, scene, { semanticStatus: 'unavailable' });
    expect(screen.getByRole('checkbox', { name: 'Semantic' })).toBeDisabled();
    expect(screen.getByText(/play this world once with Semantic Lore on/)).toBeInTheDocument();
  });

  it('is enabled once the world has an index', async () => {
    const onSemanticChange = vi.fn();
    renderTriggers(lore, scene, { semanticStatus: 'off', onSemanticChange });
    const toggle = screen.getByRole('checkbox', { name: 'Semantic' });
    expect(toggle).toBeEnabled();
    await userEvent.click(toggle);
    expect(onSemanticChange).toHaveBeenCalledWith(true);
  });

  it('states a score against the threshold rather than a bare fired-or-not', () => {
    renderScored([[beacon, 0.6], [tides, 0.1]]);
    expect(screen.getByText('0.60 vs the 0.40 threshold — close enough to fire on meaning.')).toBeInTheDocument();
    expect(screen.getByText('0.10 vs the 0.40 threshold — too far to fire on meaning.')).toBeInTheDocument();
  });

  it('marks a semantic-only firing as one, so no keyword can be credited for it', () => {
    renderScored([[beacon, 0.6], [tides, 0.1]]);
    const row = screen.getByText('Old Beacon').closest('div[class*="rounded-md"]') as HTMLElement;
    expect(within(row).getByText('Semantic')).toBeInTheDocument();
    expect(within(row).getByText('Fired on meaning alone — no keyword matched.')).toBeInTheDocument();
  });

  it('leaves a keyword firing labeled as one even when its meaning also scores', () => {
    const keyworded = 'The tide pulls out past the tower.';
    renderTriggers(lore, keyworded, {
      report: buildTriggerReport(lore, keyworded, {
        semantic: {
          queryVec: at(0),
          vectors: new Map([[entryVectorKey(tides), scoring(0.9)]]),
          threshold: 0.4,
        },
      }),
      semanticStatus: 'ready',
      semanticOn: true,
    });
    const row = screen.getByText('Tides').closest('div[class*="rounded-md"]') as HTMLElement;
    expect(within(row).getByText('Keyword')).toBeInTheDocument();
    expect(within(row).getByText(/“tide” as “tide”/)).toBeInTheDocument();
  });

  it('keeps the keyword diagnosis on a row that only meaning could fire', () => {
    // The rows an author is here to fix: it fired, but their matching rule is why it took meaning to do it.
    const blocked = entry({ id: 'd3', name: 'Riptides', key: ['tide'], matchWholeWords: true, value: 'The rip runs hard.' });
    const near = world({ dictionaries: [book([blocked])] });
    const text = 'The riptides drag the channel.';
    renderTriggers(near, text, {
      report: buildTriggerReport(near, text, {
        semantic: { queryVec: at(0), vectors: new Map([[entryVectorKey(blocked), scoring(0.7)]]), threshold: 0.4 },
      }),
      semanticStatus: 'ready',
      semanticOn: true,
    });
    const row = screen.getByText('Riptides').closest('div[class*="rounded-md"]') as HTMLElement;
    expect(within(row).getByText('Fired on meaning alone — no keyword matched.')).toBeInTheDocument();
    expect(within(row).getByText(/appears only inside “riptides”/)).toBeInTheDocument();
  });

  it('reports how much of the dictionary the run could score', () => {
    renderScored([[beacon, 0.6]]);
    expect(screen.getByText('1 of 2 scored against 0.40')).toBeInTheDocument();
    expect(screen.getByText('Not embedded yet, so it cannot fire on meaning.')).toBeInTheDocument();
  });
});
