import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tool } from '@/types';
import { sampleToolSnapshot } from '@/lib/tools/sampleToolSnapshot';
import { ToolEditor } from './ToolEditor';
import type { ToolEditTab } from './toolsView';
import { TRY_IT_COLUMN_MIN_WIDTH } from './useTryItPlacement';

const lookup: Tool = {
  id: 'u-find', name: 'find', description: '', emptyResult: '', offeredTo: ['narration'],
  params: [{ name: 'name', type: 'string', description: '', required: true, options: [] }],
  handler: { kind: 'lookup', source: 'entities', param: 'name', returns: 'full' },
};

describe('the Script reference', () => {
  it('states each global’s access as text, since the list has no badge', async () => {
    const user = userEvent.setup();
    render(
      <ToolEditor
        draft={{ ...lookup, handler: { kind: 'script', code: 'return 1;' } }} onDraftChange={vi.fn()} keptHandlers={{}}
        editTab="handler" onEditTabChange={vi.fn()} userTools={[]}
        editing world={{ snapshot: sampleToolSnapshot, open: false }}
        fullscreen={false} fullscreenButton={null} onCancel={vi.fn()} onSave={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'What a Script Can Read' }));
    const list = within(await screen.findByLabelText('What the script can read'));
    const rowOf = (name: string) => list.getByText(name).nextElementSibling?.textContent;
    expect(rowOf('args')).toMatch(/^\{.*\} The arguments the AI sent, checked against the parameters\. Read-only\.$/);
    expect(rowOf('location')).toMatch(/The location the turn is at, with the fields of a locations entry\. Read-only\.$/);
    // `console` is no field a write could reach, so it names no access.
    expect(rowOf('console')).toMatch(/Output shows in the browser console\.$/);
    expect(rowOf('console')).not.toMatch(/Read-only|Writable/);
  });
});

/** The editor's measured width, and the observer delivery that reports a change to it. */
function stubEditorWidth(initial: number) {
  let width = initial;
  const observers = new Set<StubResizeObserver>();
  class StubResizeObserver {
    constructor(readonly callback: (entries: unknown[]) => void) {}
    observe() { observers.add(this); }
    unobserve() { observers.delete(this); }
    disconnect() { observers.delete(this); }
  }
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    width, height: 600, top: 0, left: 0, right: width, bottom: 600, x: 0, y: 0, toJSON: () => ({}),
  }));
  return {
    resize(next: number) {
      width = next;
      act(() => observers.forEach((o) => o.callback([{ contentRect: { width, height: 600 } }])));
    },
  };
}

const weather: Tool = {
  id: 'u-weather', name: 'get_weather', description: '', emptyResult: '{"matches": []}', offeredTo: ['narration'],
  params: [{ name: 'place', type: 'string', description: '', required: true, options: [] }],
  handler: { kind: 'template', body: 'Sunny in {{arg:place}}.' },
};

/** Holds the draft and the tab as a caller does. */
function EditorHost({ start, home = 'user' }: { start: ToolEditTab; home?: 'user' | 'world' }) {
  const [tab, setTab] = useState<ToolEditTab>(start);
  const [draft, setDraft] = useState(weather);
  return (
    <ToolEditor
      draft={draft} onDraftChange={setDraft} keptHandlers={{}} editTab={tab} onEditTabChange={setTab} userTools={[]} home={home}
      editing world={{ snapshot: sampleToolSnapshot, open: false }}
      fullscreen={false} fullscreenButton={null} onCancel={vi.fn()} onSave={vi.fn()}
    />
  );
}

const tryItRegion = () => screen.queryByRole('region', { name: 'Try It' });
const tryItTab = () => screen.queryByRole('tab', { name: 'Try It' });

describe('Try It in a narrow editor', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const narrow = TRY_IT_COLUMN_MIN_WIDTH - 1;

  it.each(['user', 'world'] as const)('moves Try It from its column to a fourth tab on the %s home', (home) => {
    stubEditorWidth(narrow);
    render(<EditorHost start="handler" home={home} />);
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('aria-label'))).toEqual(['Definition', 'Parameters', 'Handler', 'Try It']);
    expect(tryItRegion()).toBeNull();
  });

  it('keeps Try It in its column, with no tab, when the editor is wide', () => {
    stubEditorWidth(TRY_IT_COLUMN_MIN_WIDTH);
    render(<EditorHost start="handler" />);
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('aria-label'))).toEqual(['Definition', 'Parameters', 'Handler']);
    expect(tryItRegion()).toBeInTheDocument();
  });

  it('follows the editor’s own width as it changes, not the window’s', () => {
    const editor = stubEditorWidth(TRY_IT_COLUMN_MIN_WIDTH);
    render(<EditorHost start="handler" />);
    expect(tryItTab()).toBeNull();
    editor.resize(narrow);
    expect(tryItTab()).toBeInTheDocument();
    expect(tryItRegion()).toBeNull();
  });

  it('gives the Try It tab an icon for the strip that hides its labels', () => {
    stubEditorWidth(narrow);
    render(<EditorHost start="handler" />);
    expect(tryItTab()!.querySelector('svg')).not.toBeNull();
  });

  it('shows Try It, and not the form, on the Try It tab', async () => {
    stubEditorWidth(narrow);
    render(<EditorHost start="handler" />);
    await userEvent.setup().click(tryItTab()!);
    expect(tryItRegion()).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Handler Type' })).toBeNull();
  });

  it('keeps the Try It inputs and last result through a switch to Handler and back', async () => {
    const user = userEvent.setup();
    stubEditorWidth(narrow);
    render(<EditorHost start="handler" />);
    await user.click(tryItTab()!);
    await user.type(within(tryItRegion()!).getByRole('textbox', { name: 'place' }), 'Sedge');
    await user.click(within(tryItRegion()!).getByRole('button', { name: 'Run' }));
    expect(await screen.findByTestId('try-it-result')).toHaveTextContent('Sunny in Sedge.');

    await user.click(screen.getByRole('tab', { name: 'Handler' }));
    expect(tryItRegion()).toBeNull();
    await user.click(tryItTab()!);

    expect(within(tryItRegion()!).getByRole('textbox', { name: 'place' })).toHaveValue('Sedge');
    expect(screen.getByTestId('try-it-result')).toHaveTextContent('Sunny in Sedge.');
  });

  it('opens on Try It when the caller asks for it', () => {
    stubEditorWidth(narrow);
    render(<EditorHost start="tryIt" />);
    expect(tryItTab()).toHaveAttribute('aria-selected', 'true');
    expect(tryItRegion()).toBeInTheDocument();
  });

  it('shows a form tab, and asks the caller for it, when a wide editor is told Try It is open', () => {
    stubEditorWidth(TRY_IT_COLUMN_MIN_WIDTH);
    const onEditTabChange = vi.fn();
    render(
      <ToolEditor
        draft={weather} onDraftChange={vi.fn()} keptHandlers={{}} editTab="tryIt" onEditTabChange={onEditTabChange} userTools={[]}
        editing world={{ snapshot: sampleToolSnapshot, open: false }}
        fullscreen={false} fullscreenButton={null} onCancel={vi.fn()} onSave={vi.fn()}
      />,
    );
    // The caller has not answered yet, and no frame may show a strip with no tab selected.
    expect(screen.getByRole('tab', { name: 'Definition' })).toHaveAttribute('aria-selected', 'true');
    expect(onEditTabChange).toHaveBeenCalledWith('definition');
    expect(tryItRegion()).toBeInTheDocument();
  });

  it('gives the open Try It tab a panel for its tab to control', async () => {
    stubEditorWidth(narrow);
    render(<EditorHost start="tryIt" />);
    const panel = screen.getByRole('tabpanel', { name: 'Try It' });
    expect(tryItTab()).toHaveAttribute('aria-controls', panel.id);
    expect(within(panel).getByRole('region', { name: 'Try It' })).toBeInTheDocument();
  });

  it('returns to the last form tab when the editor widens with Try It open', async () => {
    const user = userEvent.setup();
    const editor = stubEditorWidth(narrow);
    render(<EditorHost start="definition" />);
    await user.click(screen.getByRole('tab', { name: 'Parameters' }));
    await user.click(tryItTab()!);

    editor.resize(TRY_IT_COLUMN_MIN_WIDTH);

    expect(tryItTab()).toBeNull();
    expect(screen.getByRole('tab', { name: 'Parameters' })).toHaveAttribute('aria-selected', 'true');
    expect(tryItRegion()).toBeInTheDocument();

    // The caller's tab moved too, so narrowing again does not jump back to Try It.
    editor.resize(narrow);
    expect(screen.getByRole('tab', { name: 'Parameters' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the Try It result across a narrow, wide, narrow resize', async () => {
    const user = userEvent.setup();
    const editor = stubEditorWidth(TRY_IT_COLUMN_MIN_WIDTH);
    render(<EditorHost start="handler" />);
    await user.type(within(tryItRegion()!).getByRole('textbox', { name: 'place' }), 'Sedge');
    await user.click(within(tryItRegion()!).getByRole('button', { name: 'Run' }));
    expect(await screen.findByTestId('try-it-result')).toHaveTextContent('Sunny in Sedge.');

    editor.resize(narrow);
    await user.click(tryItTab()!);

    expect(screen.getByTestId('try-it-result')).toHaveTextContent('Sunny in Sedge.');
  });
});

describe('the Handler tab', () => {
  it('never offers Memories to a user Tool', async () => {
    const user = userEvent.setup();
    render(
      <ToolEditor
        draft={lookup} onDraftChange={vi.fn()} keptHandlers={{}} editTab="handler" onEditTabChange={vi.fn()} userTools={[]}
        editing world={{ snapshot: sampleToolSnapshot, open: false }}
        fullscreen={false} fullscreenButton={null} onCancel={vi.fn()} onSave={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Search' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['Entities', 'Locations', 'Dictionary Entries']);
  });
});
