// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { SURFACE_LABELS, HUB_LABEL } from '@/lib/promptGroups';

/**
 * Settings → Prompts navigation: what selecting a prompt lands on, what the rail lists under it, and how
 * you get back. The hub is the state with no editor open, so what these assert is which of the two is on
 * screen — the map, or a field.
 */

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download. Neither
// runs in jsdom, and neither is what these tests are about.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const openPrompts = (props: { initialPromptTab?: string; initialPromptSurface?: string } = {}) =>
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="prompts" {...props} />
      </SettingsProvider>
    </ThemeProvider>,
  );

/** The rail's own row for a prompt or an editor — a button, unlike the anatomy's region headings. */
const railRow = (name: string) => screen.getAllByRole('button', { name }).at(-1)!;

/** The hub draws the whole request, so its two region hints are what says it is on screen. */
const onHub = () => screen.queryByText('one block, sent first, sets the rules') !== null;

/** The System editor is the only surface that shows the prompt's one-line description. */
const onSystemEditor = () => screen.queryByText(/Writes the story itself/) !== null;

beforeEach(() => localStorage.clear());

describe('Settings → Prompts landing', () => {
  it('opens on the hub rather than on a wall of template text', () => {
    openPrompts();
    expect(onHub()).toBe(true);
    expect(onSystemEditor()).toBe(false);
  });

  it('lands on the hub when another prompt is selected', () => {
    openPrompts();
    fireEvent.click(railRow('Choices'));
    expect(onHub()).toBe(true);
  });

  it('lists the editors under the open prompt, and no Anatomy among them', () => {
    openPrompts();
    for (const label of Object.values(SURFACE_LABELS)) {
      expect(screen.getAllByRole('button', { name: label }).length).toBeGreaterThan(0);
    }
    expect(screen.queryAllByRole('button', { name: HUB_LABEL })).toHaveLength(0);
  });

  it('opens an editor from its sub-row, and returns to the hub when the prompt is re-selected', () => {
    openPrompts();
    fireEvent.click(railRow(SURFACE_LABELS.system));
    expect(onSystemEditor()).toBe(true);
    expect(onHub()).toBe(false);

    fireEvent.click(railRow('Narration'));
    expect(onHub()).toBe(true);
    expect(onSystemEditor()).toBe(false);
  });
});

describe('Settings → Prompts dev-router landing', () => {
  it('lands on the hub for the anatomy surface', () => {
    openPrompts({ initialPromptTab: 'narration', initialPromptSurface: 'anatomy' });
    expect(onHub()).toBe(true);
  });

  it('lands on the hub for a surface that no longer exists', () => {
    openPrompts({ initialPromptTab: 'narration', initialPromptSurface: 'nonsense' });
    expect(onHub()).toBe(true);
  });

  it('still lands on a named editor', () => {
    openPrompts({ initialPromptTab: 'narration', initialPromptSurface: 'system' });
    expect(onSystemEditor()).toBe(true);
    expect(onHub()).toBe(false);
  });
});

describe('Settings → Prompts jumps', () => {
  /** A highlighted run in the drawn request — a button whose title names the editor it opens. */
  const anatomyRun = (editor: string) =>
    screen.getAllByRole('button').find((b) => b.getAttribute('title') === `Open the ${editor}`)!;

  it('opens the editor a highlighted run belongs to', () => {
    openPrompts();
    // The hub draws the narration request; its system-prompt run is the way into that editor.
    fireEvent.click(anatomyRun(SURFACE_LABELS.system));
    expect(onSystemEditor()).toBe(true);
    expect(onHub()).toBe(false);
  });

  it('lands a stacked narration line on the Messages view, at the field it names', () => {
    openPrompts();
    // Memory Summaries ships on, so the recap exchange is in the drawn request.
    fireEvent.click(anatomyRun('Recap Message'));
    expect(onHub()).toBe(false);
    expect(onSystemEditor()).toBe(false);
    // The Messages view stacks the live conditional lines, each under its own name.
    expect(screen.getByText('Recap Message')).toBeInTheDocument();
    expect(screen.getByText('Now Message')).toBeInTheDocument();
  });
});
