import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { RequestAnatomyView } from './RequestAnatomyView';
import { CONTEXT_HINTS, CONTEXT_LABELS, tilePieces, type AnatomyBlock, type AnatomyPiece } from '@/lib/requestAnatomy';

/**
 * The shell both anatomy surfaces render through. What matters here is that a run points at the text it
 * claims, that context never masquerades as the player's own words, that Chips collapses the app's text to
 * the chip behind it while Preview shows every byte, and that a block with no runs still shows its content
 * — a capture from before the sidecar existed must read exactly as it did.
 */

afterEach(cleanup);

/** Build a block from labeled pieces, so a fixture's offsets are derived rather than hand-counted. */
const block = (role: AnatomyBlock['role'], pieces: AnatomyPiece[]): AnatomyBlock => ({ role, ...tilePieces(pieces) });

const BLOCKS: AnatomyBlock[] = [
  block('system', [
    { text: 'You are the narrator.\n\n', source: 'system-template' },
    { text: 'Sample Town sits above the water.', source: 'system-template', chip: '<WORLD DESCRIPTION>' },
  ]),
  block('user', [{ text: 'Recap the story so far.', source: 'recap' }]),
  block('assistant', [
    { text: 'They found a map.', contextLabel: 'condensed' },
    { text: '\n\n', glue: true },
    { text: 'Now you are at The Landing.', source: 'now' },
  ]),
];

const region = (name: string) => screen.getByRole('heading', { name }).closest('section')!;

describe('RequestAnatomyView', () => {
  it('splits the request into its two regions, each saying what it is', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" />);
    expect(screen.getByText('one block, sent first, sets the rules')).toBeInTheDocument();
    expect(screen.getByText('the conversation the AI continues')).toBeInTheDocument();
    // The system prompt is its own region — never a message in the conversation.
    expect(within(region('System Prompt')).getByText(/You are the narrator/)).toBeInTheDocument();
    expect(within(region('Messages')).queryByText(/You are the narrator/)).toBeNull();
  });

  it('names each authored run by the editor that owns it', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" />);
    for (const label of ['System Prompt', 'Recap Message', 'Now Message']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('marks authored text and leaves what a chip injected unmarked', () => {
    const { container } = render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" />);
    const marked = [...container.querySelectorAll('mark')].map((m) => m.textContent);
    expect(marked.some((t) => t?.includes('You are the narrator.'))).toBe(true);
    expect(marked.some((t) => t?.includes('Now you are at The Landing.'))).toBe(true);
    expect(marked.some((t) => t?.includes('Sample Town sits above the water.'))).toBe(false);
  });

  it('renders a block with no runs as plain content (a capture from before the sidecar)', () => {
    const { container } = render(
      <RequestAnatomyView blocks={[{ role: 'user', content: 'unlabeled wall of text', runs: [] }]} mode="resolved" />,
    );
    expect(container.textContent).toContain('unlabeled wall of text');
    expect(container.querySelectorAll('mark')).toHaveLength(0);
  });

  it('still shows text the runs do not cover, so nothing sent can go missing', () => {
    const { container } = render(
      <RequestAnatomyView
        blocks={[{ role: 'system', content: 'covered\n\n/no_think', runs: [{ start: 0, end: 7, source: 'system-template' }] }]}
        mode="resolved"
      />,
    );
    expect(container.textContent).toContain('/no_think');
  });

  it('lets a caller enrich each run slice, so other highlighting composes with the run styling', () => {
    const { container } = render(
      <RequestAnatomyView
        blocks={BLOCKS}
        mode="resolved"
        renderText={(text) => <span data-testid="slice">{text}</span>}
      />,
    );
    const slices = [...container.querySelectorAll('[data-testid="slice"]')].map((s) => s.textContent);
    // A highlighter sees each run's own text and never has to know about runs. An authored run hands over
    // its body and its joins separately, since only the body is inside the mark.
    expect(slices).toContain('You are the narrator.');
    expect(slices).toContain('Recap the story so far.');
    // Nothing is dropped on the way: the slices still spell the blocks out in full.
    expect(slices.join('')).toBe(BLOCKS.map((b) => b.content).join(''));
  });

  it('staggers the player to the right and the AI to the left, the way a chat reads', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" />);
    const messages = within(region('Messages')).getAllByText(/^(user|assistant)$/);
    expect(messages.map((m) => m.textContent)).toEqual(['user', 'assistant']);
    const box = (i: number) => messages[i].parentElement!.className;
    expect(box(0)).toContain('ml-4'); // the player sends
    expect(box(1)).toContain('mr-4'); // the AI answers
  });
});

describe('RequestAnatomyView resolved mode', () => {
  it('shows every byte of a context run, however long, with no excerpt and no ellipsis', () => {
    const long = [block('user', [{
      text: `first line of the recalled scene\n${'x'.repeat(400)}\nlast line nobody used to see`,
      contextLabel: 'recalled',
    }])];
    const { container } = render(<RequestAnatomyView blocks={long} mode="resolved" />);
    expect(container.textContent).toContain('first line of the recalled scene');
    expect(container.textContent).toContain('last line nobody used to see');
    expect(container.textContent).toContain('x'.repeat(400));
    expect(container.textContent).not.toContain('…');
  });

  it('says nothing over the resolved text — no invented tag, only the text itself', () => {
    const blocks = [block('assistant', [{ text: 'the condensed body', contextLabel: 'condensed' }])];
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="resolved" />);
    const body = [...container.querySelectorAll('p')].pop()!;
    expect(body.textContent).toBe('the condensed body');
    // No pseudo-tag over the run, in either spelling: no angle brackets, no label sentence.
    expect(container.textContent).not.toContain('<');
    expect(container.textContent).not.toContain(CONTEXT_LABELS.condensed);
  });

  it('leaves a chip run as its resolved value, not as a chip', () => {
    const { container } = render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" />);
    expect(container.textContent).toContain('Sample Town sits above the water.');
    expect(container.querySelectorAll('[data-chip-token]')).toHaveLength(0);
  });

  it('tells the app text from the player own by dimming it, with the boundaries still visible', () => {
    const { container } = render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" />);
    const dimmed = [...container.querySelectorAll('.text-muted-foreground\\/70')].map((s) => s.textContent);
    expect(dimmed).toContain('Sample Town sits above the water.');
    expect(dimmed.join('')).not.toContain('You are the narrator.');
  });
});

describe('RequestAnatomyView chips mode', () => {
  it('collapses a chip run to the editor own chip, labeled the way the editor labels it', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="chips" />);
    expect(screen.getByText('World')).toBeInTheDocument();
    expect(screen.queryByText(/Sample Town sits above the water/)).toBeNull();
  });

  it('shows a chip variant the way the editor does', () => {
    const blocks = [block('system', [
      { text: 'Health 8/10', source: 'system-template', chip: '<STATS DESCRIPTION|numbers>' },
    ])];
    render(<RequestAnatomyView blocks={blocks} mode="chips" />);
    expect(screen.getByText('Stats (Range)')).toBeInTheDocument();
  });

  it('collapses an assembled run to its own chip, short name out and the sentence in the tooltip', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="chips" />);
    const chip = screen.getByText(CONTEXT_LABELS.condensed);
    expect(chip.getAttribute('title')).toMatch(/condensed by Memory Summaries/);
    expect(screen.queryByText(/They found a map/)).toBeNull();
  });

  it('keeps the two chip species apart, so a chip with no editor behind it is never hunted for', () => {
    const { container } = render(<RequestAnatomyView blocks={BLOCKS} mode="chips" />);
    // A template chip carries its token; an assembled one has none to carry.
    const tokens = [...container.querySelectorAll('[data-chip-token]')].map((c) => c.getAttribute('data-chip-token'));
    expect(tokens).toEqual(['<WORLD DESCRIPTION>']);
    expect(screen.getByText(CONTEXT_LABELS.condensed).closest('[data-chip-token]')).toBeNull();
  });

  it('renders the player own text verbatim, which is the whole point of the view', () => {
    const { container } = render(<RequestAnatomyView blocks={BLOCKS} mode="chips" />);
    expect(container.textContent).toContain('You are the narrator.');
    expect(container.textContent).toContain('Recap the story so far.');
    expect(container.textContent).toContain('Now you are at The Landing.');
  });

  it('keeps the blank lines around a collapsed run, so the request keeps its shape', () => {
    const blocks = [block('user', [
      { text: 'lead', source: 'user-template' },
      { text: '\n\n', glue: true },
      { text: 'the plan', contextLabel: 'turn-plan' },
      { text: '\n\n', glue: true },
    ])];
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="chips" />);
    const body = [...container.querySelectorAll('p')].pop()!;
    // "User Message" is the authored run's own name chip, which leads the text it names.
    expect(body.textContent).toBe(`User Messagelead\n\n${CONTEXT_LABELS['turn-plan']}\n\n`);
  });

  it('leaves an unlabeled capture exactly as it was, with nothing to collapse', () => {
    const { container } = render(
      <RequestAnatomyView blocks={[{ role: 'user', content: 'unlabeled wall of text', runs: [] }]} mode="chips" />,
    );
    expect(container.textContent).toContain('unlabeled wall of text');
  });
});

describe('RequestAnatomyView run labeling', () => {
  it('names a source once per block, however many chips break its template up', () => {
    const blocks = [block('system', [
      { text: 'lead ', source: 'system-template' },
      { text: 'WORLD', source: 'system-template', chip: '<WORLD DESCRIPTION>' },
      { text: ' middle ', source: 'system-template' },
      { text: 'STATS', source: 'system-template', chip: '<STATS DESCRIPTION>' },
      { text: ' tail', source: 'system-template' },
    ])];
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="resolved" />);
    // Counted inside the marks, since the region heading carries the same words.
    const chips = [...container.querySelectorAll('mark > span')].map((s) => s.textContent);
    expect(chips).toEqual(['System Prompt']);
    // Every stretch of the author's own prose is still marked — only the repeated naming goes.
    expect(container.querySelectorAll('mark')).toHaveLength(3);
  });

  it('names each distinct source in a block that mixes two', () => {
    const blocks = [block('user', [
      { text: 'My action: ', source: 'user-template' },
      { text: 'I wait.', contextLabel: 'action' },
      { text: '\n\n', glue: true },
      { text: 'RIDER', source: 'direction' },
    ])];
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="resolved" />);
    expect([...container.querySelectorAll('mark > span')].map((s) => s.textContent))
      .toEqual(['User Message', 'Direction Message']);
  });
});

describe('RequestAnatomyView join handling', () => {
  /** The narration's final user turn: the action, then the template prose after a blank line, then the
   *  rider after another — the shape that put the chip at the end of the wrong line. */
  const finalTurn = [block('user', [
    { text: 'I take the map.', contextLabel: 'action' },
    { text: '\n\n', glue: true },
    { text: 'The player action is the turn first beat.', source: 'user-template' },
    { text: '\n\n', glue: true },
    { text: 'The square-bracketed text is the author directing.', source: 'direction' },
  ])];

  it('keeps the blank lines that join runs outside the mark', () => {
    const { container } = render(<RequestAnatomyView blocks={finalTurn} mode="resolved" />);
    const marked = [...container.querySelectorAll('mark')].map((m) => m.textContent);
    // The chip text leads each mark; what follows it must start and end on a real character.
    for (const text of marked) {
      const body = text.replace(/^(User Message|Direction Message)/, '');
      expect(body).toBe(body.trim());
    }
  });

  it('still renders every character of the block, joins included', () => {
    const { container } = render(<RequestAnatomyView blocks={finalTurn} mode="resolved" />);
    expect(container.textContent).toContain(
      'I take the map.\n\nUser MessageThe player action is the turn first beat.\n\n',
    );
  });

  it('does not spend a source naming on a run that is only whitespace', () => {
    const blocks = [block('user', [
      { text: '\n\n', source: 'user-template' },
      { text: 'real text', source: 'recap' },
      { text: 'more', source: 'user-template' },
    ])];
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="resolved" />);
    expect([...container.querySelectorAll('mark > span')].map((s) => s.textContent))
      .toEqual(['Recap Message', 'User Message']);
  });
});

describe('RequestAnatomyView jumps', () => {
  const runButton = (source: string) => screen.getByRole('button', { name: new RegExp(source) });

  it('leaves every run inert without a request type to resolve against', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" onJump={() => {}} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('leaves every run inert without a handler, however the request is typed', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" type="narration" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('opens the editor a captured run belongs to, resolved from the request own type', () => {
    const jumps: unknown[] = [];
    render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" type="narration" onJump={(t) => jumps.push(t)} />);
    fireEvent.click(runButton('You are the narrator'));
    fireEvent.click(runButton('Recap the story so far'));
    fireEvent.click(runButton('Now you are at The Landing'));
    expect(jumps).toEqual([
      { tab: 'narration', surface: 'system' },
      { tab: 'narration', surface: 'messages', field: 'recap' },
      { tab: 'narration', surface: 'messages', field: 'now' },
    ]);
  });

  it('keeps an authored run clickable in chips mode too', () => {
    const jumps: unknown[] = [];
    render(<RequestAnatomyView blocks={BLOCKS} mode="chips" type="narration" onJump={(t) => jumps.push(t)} />);
    fireEvent.click(runButton('You are the narrator'));
    expect(jumps).toEqual([{ tab: 'narration', surface: 'system' }]);
  });

  it('never makes the text the app assembled clickable in resolved mode', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" type="narration" onJump={() => {}} />);
    // Every button on screen belongs to an authored run; the world data and the condensed band are not.
    for (const text of ['Sample Town sits above the water.', 'They found a map.']) {
      expect(screen.getByText(text, { exact: false }).closest('button')).toBeNull();
    }
  });

  it('leaves an unlabeled capture with nothing to click, as it had before the sidecar existed', () => {
    render(
      <RequestAnatomyView
        blocks={[{ role: 'user', content: 'unlabeled wall of text', runs: [] }]}
        mode="resolved"
        type="narration"
        onJump={() => {}}
      />,
    );
    expect(screen.getByText('unlabeled wall of text')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('resolves nothing to click on a call with no editor behind it', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="resolved" type="discoverEntity" onJump={() => {}} />);
    // The two stacked narration lines still belong to the Narration prompt; the system template does not.
    expect(screen.queryByRole('button', { name: /You are the narrator/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Recap the story so far/ })).toBeInTheDocument();
  });
});

describe('RequestAnatomyView chip jumps', () => {
  it('sends a template chip to its own placement in the editor that holds it', () => {
    const jumps: unknown[] = [];
    render(<RequestAnatomyView blocks={BLOCKS} mode="chips" type="narration" onJump={(t) => jumps.push(t)} />);
    fireEvent.click(screen.getByRole('button', { name: 'World' }));
    expect(jumps).toEqual([{ tab: 'narration', surface: 'system', chip: '<WORLD DESCRIPTION>' }]);
  });

  it('says where a chip goes before it is clicked', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="chips" type="narration" onJump={() => {}} />);
    expect(screen.getByRole('button', { name: 'World' }).getAttribute('title'))
      .toBe('Show this chip in the System Prompt');
  });

  it('is reachable and activatable from the keyboard', () => {
    const jumps: unknown[] = [];
    render(<RequestAnatomyView blocks={BLOCKS} mode="chips" type="narration" onJump={(t) => jumps.push(t)} />);
    const chip = screen.getByRole('button', { name: 'World' });
    chip.focus();
    expect(document.activeElement).toBe(chip);
    fireEvent.click(chip); // what Enter and Space dispatch on a real <button>
    expect(jumps).toHaveLength(1);
  });

  it('sends an assembled chip to the anatomy of the prompt that wrote its content', () => {
    const jumps: unknown[] = [];
    const blocks = [block('user', [{ text: 'the plan', contextLabel: 'turn-plan' }])];
    render(<RequestAnatomyView blocks={blocks} mode="chips" type="narration" onJump={(t) => jumps.push(t)} />);
    const chip = screen.getByRole('button', { name: CONTEXT_LABELS['turn-plan'] });
    expect(chip.getAttribute('title')).toContain('open the Planning prompt');
    fireEvent.click(chip);
    // No surface: the destination is that prompt's hub, not one of its editors.
    expect(jumps).toEqual([{ tab: 'thinking' }]);
  });

  it('leaves an assembled chip nobody wrote inert', () => {
    const blocks = [block('user', [
      { text: 'I take the map.', contextLabel: 'action' },
      { text: '\n\n', glue: true },
      { text: 'plan on', contextLabel: 'mode-directive' },
    ])];
    render(<RequestAnatomyView blocks={blocks} mode="chips" type="narration" onJump={() => {}} />);
    for (const label of ['action', 'mode-directive'] as const) {
      expect(screen.getByText(CONTEXT_LABELS[label]).closest('button')).toBeNull();
    }
  });

  it('leaves every chip inert without a handler, and promises no destination either', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="chips" type="narration" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('World').closest('[title]')).toBeNull();
    // The assembled chip keeps its own explanation — that is what it is, not where it goes.
    expect(screen.getByText(CONTEXT_LABELS.condensed).getAttribute('title'))
      .toBe(CONTEXT_HINTS.condensed);
  });
});
