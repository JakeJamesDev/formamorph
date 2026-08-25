import { render, screen, cleanup, within } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { RequestAnatomyView } from './RequestAnatomyView';
import { CONTEXT_LABELS, tilePieces, type AnatomyBlock, type AnatomyPiece } from '@/lib/requestAnatomy';

/**
 * The shell both anatomy surfaces render through. What matters here is that a run points at the text it
 * claims, that context never masquerades as the player's own words, and that a block with no runs still
 * shows its content — a capture from before the sidecar existed must read exactly as it did.
 */

afterEach(cleanup);

/** Build a block from labeled pieces, so a fixture's offsets are derived rather than hand-counted. */
const block = (role: AnatomyBlock['role'], pieces: AnatomyPiece[]): AnatomyBlock => ({ role, ...tilePieces(pieces) });

const BLOCKS: AnatomyBlock[] = [
  block('system', [
    { text: 'You are the narrator.\n\n', source: 'system-template' },
    { text: 'Sample Town sits above the water.', contextLabel: 'world-data' },
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
    render(<RequestAnatomyView blocks={BLOCKS} mode="full" />);
    expect(screen.getByText('one block, sent first, sets the rules')).toBeInTheDocument();
    expect(screen.getByText('the conversation the AI continues')).toBeInTheDocument();
    // The system prompt is its own region — never a message in the conversation.
    expect(within(region('System Prompt')).getByText(/You are the narrator/)).toBeInTheDocument();
    expect(within(region('Messages')).queryByText(/You are the narrator/)).toBeNull();
  });

  it('names each authored run by the editor that owns it', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="full" />);
    for (const label of ['System Prompt', 'Recap Message', 'Now Message']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('marks authored text and leaves context unmarked', () => {
    const { container } = render(<RequestAnatomyView blocks={BLOCKS} mode="full" />);
    const marked = [...container.querySelectorAll('mark')].map((m) => m.textContent);
    expect(marked.some((t) => t?.includes('You are the narrator.'))).toBe(true);
    expect(marked.some((t) => t?.includes('Now you are at The Landing.'))).toBe(true);
    expect(marked.some((t) => t?.includes('Sample Town sits above the water.'))).toBe(false);
  });

  it('explains every context run in plain words', () => {
    render(<RequestAnatomyView blocks={BLOCKS} mode="full" />);
    expect(screen.getByText(`<${CONTEXT_LABELS['world-data']}>`)).toBeInTheDocument();
    expect(screen.getByText(`<${CONTEXT_LABELS.condensed}>`)).toBeInTheDocument();
  });

  it('shows a context run in full, and in preview shows only its first line', () => {
    const long = [block('user', [{
      text: 'first line of the recalled scene\nsecond line nobody needs at a glance',
      contextLabel: 'recalled',
    }])];
    const full = render(<RequestAnatomyView blocks={long} mode="full" />);
    expect(full.container.textContent).toContain('second line nobody needs at a glance');
    cleanup();
    const preview = render(<RequestAnatomyView blocks={long} mode="preview" />);
    expect(preview.container.textContent).toContain('first line of the recalled scene');
    expect(preview.container.textContent).not.toContain('second line nobody needs at a glance');
  });

  it('shows authored text in full even in preview mode — it is the point of the view', () => {
    const { container } = render(<RequestAnatomyView blocks={BLOCKS} mode="preview" />);
    expect(container.textContent).toContain('Now you are at The Landing.');
  });

  it('renders a block with no runs as plain content (a capture from before the sidecar)', () => {
    const { container } = render(
      <RequestAnatomyView blocks={[{ role: 'user', content: 'unlabeled wall of text', runs: [] }]} mode="full" />,
    );
    expect(container.textContent).toContain('unlabeled wall of text');
    expect(container.querySelectorAll('mark')).toHaveLength(0);
  });

  it('still shows text the runs do not cover, so nothing sent can go missing', () => {
    const { container } = render(
      <RequestAnatomyView
        blocks={[{ role: 'system', content: 'covered\n\n/no_think', runs: [{ start: 0, end: 7, source: 'system-template' }] }]}
        mode="full"
      />,
    );
    expect(container.textContent).toContain('/no_think');
  });

  it('lets a caller enrich each run slice, so other highlighting composes with the run styling', () => {
    const { container } = render(
      <RequestAnatomyView
        blocks={BLOCKS}
        mode="full"
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
    render(<RequestAnatomyView blocks={BLOCKS} mode="full" />);
    const messages = within(region('Messages')).getAllByText(/^(user|assistant)$/);
    expect(messages.map((m) => m.textContent)).toEqual(['user', 'assistant']);
    const box = (i: number) => messages[i].parentElement!.className;
    expect(box(0)).toContain('ml-4'); // the player sends
    expect(box(1)).toContain('mr-4'); // the AI answers
  });
});

describe('RequestAnatomyView run labeling', () => {
  it('names a source once per block, however many chips break its template up', () => {
    const blocks = [block('system', [
      { text: 'lead ', source: 'system-template' },
      { text: 'WORLD', contextLabel: 'world-data' },
      { text: ' middle ', source: 'system-template' },
      { text: 'STATS', contextLabel: 'world-data' },
      { text: ' tail', source: 'system-template' },
    ])];
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="full" />);
    // Counted inside the marks, since the region heading carries the same words.
    const chips = [...container.querySelectorAll('mark > span')].map((s) => s.textContent);
    expect(chips).toEqual(['System Prompt']);
    // Every stretch is still marked as the author's — only the repeated naming goes.
    expect(container.querySelectorAll('mark')).toHaveLength(3);
  });

  it('names each distinct source in a block that mixes two', () => {
    const blocks = [block('user', [
      { text: 'My action: ', source: 'user-template' },
      { text: 'I wait.', contextLabel: 'action' },
      { text: '\n\n', glue: true },
      { text: 'RIDER', source: 'direction' },
    ])];
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="full" />);
    expect([...container.querySelectorAll('mark > span')].map((s) => s.textContent))
      .toEqual(['User Message', 'Direction Message']);
  });

  it('ends a shortened excerpt with one ellipsis, not two', () => {
    const blocks = [block('assistant', [{
      text: `${'x'.repeat(200)}\nand another line`,
      contextLabel: 'condensed',
    }])];
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="preview" />);
    expect(container.textContent).not.toContain('… …');
    expect(container.textContent).toContain('…');
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
    const { container } = render(<RequestAnatomyView blocks={finalTurn} mode="full" />);
    const marked = [...container.querySelectorAll('mark')].map((m) => m.textContent);
    // The chip text leads each mark; what follows it must start and end on a real character.
    for (const text of marked) {
      const body = text.replace(/^(User Message|Direction Message)/, '');
      expect(body).toBe(body.trim());
    }
  });

  it('still renders every character of the block, joins included', () => {
    const { container } = render(<RequestAnatomyView blocks={finalTurn} mode="full" />);
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
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="full" />);
    expect([...container.querySelectorAll('mark > span')].map((s) => s.textContent))
      .toEqual(['Recap Message', 'User Message']);
  });
});

describe('ContextRun line layout', () => {
  it('puts the explanation on its own line with the text directly beneath, in both modes', () => {
    const blocks = [block('assistant', [{ text: 'the condensed body', contextLabel: 'condensed' }])];
    for (const mode of ['full', 'preview'] as const) {
      const { container } = render(<RequestAnatomyView blocks={blocks} mode={mode} />);
      // The message body is the last <p>; the first is the empty-system-prompt notice.
      const body = [...container.querySelectorAll('p')].pop()!;
      expect(body.textContent).toContain(`<${CONTEXT_LABELS.condensed}>\nthe condensed body`);
      cleanup();
    }
  });

  it('breaks the line first when the run begins mid-line', () => {
    const blocks = [block('user', [
      { text: 'Player: ', source: 'user-template' },
      { text: 'I wade out.', contextLabel: 'action' },
    ])];
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="full" />);
    const body = [...container.querySelectorAll('p')].pop()!;
    expect(body.textContent).toContain(`Player: \n<${CONTEXT_LABELS.action}>\nI wade out.`);
  });

  it('does not add a break when the run already starts a line', () => {
    const blocks = [block('system', [
      { text: 'lead\n', source: 'system-template' },
      { text: 'VALUE', contextLabel: 'world-data' },
    ])];
    const { container } = render(<RequestAnatomyView blocks={blocks} mode="full" />);
    expect(container.querySelector('p')!.textContent).toContain(
      `lead\n<${CONTEXT_LABELS['world-data']}>\nVALUE`,
    );
  });
});
