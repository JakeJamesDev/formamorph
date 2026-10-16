import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { sampleChipScene } from '@/lib/chipValues/sampleScene';
import { NONE_PLACEHOLDER } from '@/lib/promptFallbacks';
import { SAMPLE_PREVIEW_VALUES } from '@/lib/previewValuePool';
import { resolveToken } from '@/lib/promptTemplate';
import { joinToken } from '@/lib/promptVariables';
import { layerValues, type TokenValues } from '@/lib/promptValues';
import { renderReporting } from '@/test/surfaceReporter';
import type { Entity, GameLocation, Stat, Trait, WorldOverview } from '@/types';

const vocabulary = promptVocabulary([]);

function Field({ initial, previewValues, chipReads }: { initial: string; previewValues?: TokenValues; chipReads?: TokenValues }) {
  const [value, setValue] = useState(initial);
  return <PromptField value={value} onChange={setValue} vocabulary={vocabulary} previewValues={previewValues} chipReads={chipReads} />;
}

const dialog = () => screen.getByRole('dialog', { name: 'Chip Options' });
const region = () => within(dialog()).getByRole('region', { name: 'What the AI Reads' });
// The rendered value box, which follows the pane's title.
const pane = () => region().lastElementChild as HTMLElement;
/** The placement text on each side of the value, each side's runs joined. */
function placement(): string[] {
  const sides: string[] = [];
  let open = false;
  for (const node of pane().childNodes) {
    const placed = node instanceof HTMLElement && node.hasAttribute('data-placement');
    if (placed && open) sides[sides.length - 1] += node.textContent;
    else if (placed) sides.push(node.textContent ?? '');
    open = placed;
  }
  return sides;
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(document.querySelector<HTMLElement>('[data-chip]')!);
  return dialog();
}

const stat = (id: string, name: string, value: number): Stat => ({
  id, name, type: 'number', description: `What ${name} measures.`, min: 0, max: 100, value, regen: 0,
  descriptors: [{ id: `${id}-0`, threshold: 100, description: 'Held' }],
});
const trait = (id: string, name: string, aiDescription: string): Trait => ({ id, name, aiDescription, isDefault: true, statChanges: [] });

const dock: GameLocation = { id: 'dock', name: 'The Salt Dock', isStarting: true, aiDescription: 'Planks and gulls.' };
const zelda: Entity = {
  id: 'zelda', name: 'Zelda', locations: ['dock'], aiDescription: 'The dockmaster, always counting.',
  traits: [trait('moss-walker', 'Moss Walker', 'Never slips on wet stone.')],
  stats: [stat('calm', 'Calm', 64)],
};
const WORLD: AuthoredWorld = {
  worldOverview: { name: 'Salt Dock', systemPrompt: 'A harbor of rope.' } as WorldOverview,
  stats: [], locations: [dock], entities: [zelda], traits: [],
};

describe('Chip Options: What the AI Reads', () => {
  it('shows the Settings sample scene when the field reads the sample values', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" previewValues={SAMPLE_PREVIEW_VALUES} />);
    await open(user);
    expect(pane().textContent).toBe(resolveToken('<ENTITIES>', SAMPLE_PREVIEW_VALUES));
    expect(pane()).toHaveTextContent('Wren');
    expect(pane()).toHaveTextContent('Patience');
  });

  it("shows the edited world's own entities, traits and stats", async () => {
    const user = userEvent.setup();
    const authored = chipValues(authoredChipScene(WORLD));
    renderReporting(<Field initial="<ENTITIES>" previewValues={layerValues(SAMPLE_PREVIEW_VALUES, authored)} />);
    await open(user);
    expect(pane()).toHaveTextContent('Zelda');
    expect(pane()).toHaveTextContent('Moss Walker');
    expect(pane()).toHaveTextContent('Calm');
    expect(pane()).not.toHaveTextContent('Wren');
  });

  it("matches the field's Preview tab for the same token, over a live scene layered on the sample", async () => {
    const user = userEvent.setup();
    const live = chipValues(authoredChipScene(WORLD));
    const values = layerValues(SAMPLE_PREVIEW_VALUES, live);
    const token = joinToken({ base: '<ENTITIES>', variantId: 'summary' });
    renderReporting(<Field initial={token} previewValues={values} />);
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    const previewed = screen.getByTestId('prompt-preview').textContent;
    await user.click(screen.getByRole('tab', { name: 'Edit' }));
    await open(user);
    expect(previewed).toContain('Zelda');
    expect(pane().textContent).toBe(previewed);
  });

  it('renders only what the field supplies, with no cast of its own', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" previewValues={{ '<ENTITIES>': 'Only this.' }} />);
    await open(user);
    expect(pane().textContent).toBe('Only this.');
  });

  it('shows an empty pane where the field has no values to read', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" />);
    await open(user);
    expect(pane().textContent).toBe('');
  });

  it('reads a chip value from `chipReads` in a field with no Preview tab', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<NOTES>" chipReads={{ '<NOTES>': 'the ferryman' }} />);
    expect(screen.queryByRole('tab', { name: 'Preview' })).toBeNull();
    await open(user);
    expect(pane().textContent).toBe('the ferryman');
  });

  it.each([
    ['Simple', undefined, '\nSALT DOCK:\nAt ', '.\n'],
    ['Markdown', 'markdown', '\n## Salt Dock\nAt ', '.\n'],
    ['XML', 'xml', '\n<salt_dock>\nAt ', '.\n</salt_dock>\n'],
  ] as const)('wraps the value in the %s Header, Prepend and Append, dimmed', async (_name, headerFormat, before, after) => {
    const user = userEvent.setup();
    const token = joinToken({ base: '<LOCATION>', header: 'Salt Dock', headerFormat, pre: 'At ', post: '.' });
    renderReporting(<Field initial={token} previewValues={{ '<LOCATION>': 'The Landing' }} />);
    await open(user);
    expect(placement()).toEqual([before, after]);
    expect(pane().textContent).toBe(`${before}The Landing${after}`);
    for (const el of pane().querySelectorAll('[data-placement]')) expect(el).toHaveClass('text-muted-foreground');
  });

  it("leaves the chip's own value undimmed", async () => {
    const user = userEvent.setup();
    const token = joinToken({ base: '<LOCATION>', pre: 'At ' });
    renderReporting(<Field initial={token} previewValues={{ '<LOCATION>': 'The Landing' }} />);
    await open(user);
    const value = [...pane().childNodes].find((node) => node.textContent === 'The Landing');
    expect(value?.nodeType).toBe(Node.TEXT_NODE);
  });

  it('shows the placeholder for an empty bare chip and nothing under a placement', async () => {
    const user = userEvent.setup();
    const values = { '<NOTES>': NONE_PLACEHOLDER };
    const bare = renderReporting(<Field initial="<NOTES>" previewValues={values} />);
    await open(user);
    expect(pane().textContent).toBe(NONE_PLACEHOLDER);
    await user.keyboard('{Escape}');
    bare.unmount();

    renderReporting(<Field initial={joinToken({ base: '<NOTES>', header: 'Notes' })} previewValues={values} />);
    await open(user);
    expect(pane().textContent).toBe('');
  });

  it('updates on every control change without closing the dialog', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" previewValues={SAMPLE_PREVIEW_VALUES} />);
    await open(user);
    expect(pane()).toHaveTextContent('lamp-keeper');
    await user.click(within(dialog()).getByRole('radio', { name: 'Name' }));
    expect(dialog()).toBeInTheDocument();
    expect(pane()).toHaveTextContent('Wren');
    expect(pane()).not.toHaveTextContent('lamp-keeper');
    await user.type(within(dialog()).getByLabelText('Header'), 'Cast');
    expect(placement()[0]).toContain('CAST:');
    await user.click(within(dialog()).getByRole('radio', { name: 'XML' }));
    expect(placement()[0]).toContain('<cast>');
    expect(dialog()).toBeInTheDocument();
  });

  it('shows the Persona chip a filter removes as what an unset persona renders', async () => {
    const user = userEvent.setup();
    // The sample's Traveler, with nothing owned: no stats for the filter to keep.
    const values = chipValues({ ...sampleChipScene(), ownedStats: {}, ownedTraits: {}, playedStats: [] });
    const token = joinToken({ base: '<PERSONA>', variantId: 'withstats', header: 'You' });
    // The persona exists: without the filter the same scene renders it.
    expect(resolveToken(joinToken({ base: '<PERSONA>', header: 'You' }), values)).not.toBe('');
    renderReporting(<Field initial={token} previewValues={values} />);
    await open(user);
    expect(pane().textContent).toBe('');
  });
});
