import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { SAMPLE_PREVIEW_VALUES } from '@/lib/previewValuePool';
import { chipValues } from '@/lib/chipValues/chipValues';
import { sampleChipScene } from '@/lib/chipValues/sampleScene';
import { joinToken } from '@/lib/promptVariables';
import type { TokenValues } from '@/lib/promptValues';
import { renderReporting } from '@/test/surfaceReporter';

const vocabulary = promptVocabulary([]);

function Field({ initial, previewValues = SAMPLE_PREVIEW_VALUES }: { initial: string; previewValues?: TokenValues }) {
  const [value, setValue] = useState(initial);
  return <PromptField value={value} onChange={setValue} vocabulary={vocabulary} previewValues={previewValues} />;
}

const dialog = () => screen.getByRole('dialog', { name: 'Chip Options' });
const pane = () => within(dialog()).getByRole('region', { name: 'What the AI Reads' }).lastElementChild as HTMLElement;
/** Each lit stretch of the pane, adjacent lit runs joined and trimmed. */
function litText(): string[] {
  const spans: string[] = [];
  let open = false;
  for (const node of pane().childNodes) {
    const on = node instanceof HTMLElement && node.hasAttribute('data-lit');
    if (on && open) spans[spans.length - 1] += node.textContent;
    else if (on) spans.push(node.textContent ?? '');
    open = on;
  }
  return spans.map((span) => span.trim()).filter(Boolean);
}
const dimmed = () => [...pane().querySelectorAll('.opacity-40')].map((el) => el.textContent).join('');
const checkbox = (row: string, name: string) =>
  within(within(dialog()).getByRole('group', { name: row })).getByRole('checkbox', { name });
// The pointer leaves a control for the pane's title; the body under a modal dialog takes no pointer.
const leave = (user: ReturnType<typeof userEvent.setup>) => user.hover(within(dialog()).getByText('What the AI Reads'));
const segmented = (name: string) => within(dialog()).getByRole('radiogroup', { name });

async function open(token: string, previewValues?: TokenValues) {
  const user = userEvent.setup();
  renderReporting(<Field initial={token} previewValues={previewValues} />);
  await user.click(document.querySelector<HTMLElement>('[data-chip]')!);
  return user;
}

const PATIENCE_MEANING = 'How long she waits on a stranger before she speaks.';

describe('Chip Options: hover highlighting', () => {
  it('lights only the Range text inside the stat line and dims the lines without it', async () => {
    const user = await open('<ENTITIES>');
    await user.hover(checkbox('Stat Detail', 'Range'));
    expect(litText()).toEqual(['70/100']);
    // The stat line's other text stays at full strength; every other line dims.
    expect(dimmed()).not.toContain('Patience');
    expect(dimmed()).toContain('a gull');
    expect(dimmed()).toContain('Night Watch');
    await leave(user);
    expect(litText()).toEqual([]);
    expect(dimmed()).toBe('');
  });

  it.each([
    ['Descriptor', ['(Measured)']],
    ['Description', [PATIENCE_MEANING]],
  ])('lights only the %s text', async (name, expected) => {
    const user = await open('<ENTITIES>');
    await user.hover(checkbox('Stat Detail', name));
    expect(litText()).toEqual(expected);
  });

  it.each([
    ['Simple', undefined, 'description: The lamp-keeper', 'traits:', 'stats:', '70/100'],
    ['Markdown', 'markdown', '- **description:** The lamp-keeper', '- **traits:**', '- **stats:**', '70/100'],
    ['XML', 'xml', '<description>The lamp-keeper', '<traits>', '<stats>', '<value>70/100</value>'],
  ] as const)('lights what each control produces in %s', async (_name, format, content, traits, stats, range) => {
    const user = await open(joinToken({ base: '<ENTITIES>', variantId: format }));
    const lights = async (control: HTMLElement) => {
      await user.hover(control);
      const shown = litText();
      await leave(user);
      return shown;
    };
    expect((await lights(segmented('Content')))[0].startsWith(content)).toBe(true);
    expect((await lights(checkbox('Include', 'Traits')))[0].startsWith(traits)).toBe(true);
    expect((await lights(checkbox('Include', 'Stats')))[0].startsWith(stats)).toBe(true);
    expect(await lights(checkbox('Stat Detail', 'Range'))).toEqual([range]);
    // Only Wren owns stats and traits, so Only With lights her block and leaves the gull out.
    for (const kind of ['Stats', 'Traits']) {
      const [block, ...rest] = await lights(checkbox('Only With', kind));
      expect(rest).toEqual([]);
      expect(block).toContain('Wren');
      expect(block).toContain('Patience');
      expect(block).not.toContain('a gull');
    }
  });

  it.each([
    ['Simple', undefined, 'description: Salt-stained', '55/100'],
    ['Markdown', 'markdown', '- **description:** Salt-stained', '55/100'],
    ['XML', 'xml', '<description>Salt-stained', '<value>55/100</value>'],
  ] as const)("lights what each Persona control produces in %s", async (_name, format, content, range) => {
    const user = await open(joinToken({ base: '<PERSONA>', variantId: format }));
    const lights = async (control: HTMLElement) => {
      await user.hover(control);
      const shown = litText();
      await leave(user);
      return shown;
    };
    expect((await lights(segmented('Content')))[0].startsWith(content)).toBe(true);
    expect((await lights(checkbox('Include', 'Traits')))[0]).toContain('False Map');
    expect((await lights(checkbox('Include', 'Stats')))[0]).toContain('Nerve');
    expect(await lights(checkbox('Stat Detail', 'Range'))).toEqual([range]);
    expect((await lights(checkbox('Only With', 'Stats')))[0]).toContain('Traveler');
  });

  it('dims the XML lines around a piece, its own line lit', async () => {
    const user = await open('<ENTITIES|xml>');
    await user.hover(checkbox('Stat Detail', 'Range'));
    expect(litText()).toEqual(['<value>70/100</value>']);
    expect(dimmed()).toContain('<name>Patience</name>');
    expect(dimmed()).toContain('<status>Measured</status>');
  });

  it('lights the same on keyboard focus as on hover', async () => {
    const user = await open('<ENTITIES>');
    act(() => checkbox('Stat Detail', 'Descriptor').focus());
    expect(litText()).toEqual(['(Measured)']);
    await user.tab();
    expect(document.activeElement).toBe(checkbox('Stat Detail', 'Description'));
    expect(litText()).toEqual([PATIENCE_MEANING]);
  });

  it('lights nothing and dims nothing for Scope and Format', async () => {
    const user = await open('<ENTITIES>');
    await user.hover(within(dialog()).getByRole('combobox', { name: 'Scope' }));
    expect(litText()).toEqual([]);
    expect(dimmed()).toBe('');
    await user.hover(segmented('Format'));
    expect(litText()).toEqual([]);
    expect(dimmed()).toBe('');
  });

  it('dims nothing while the hovered control has no text in this scene', async () => {
    // Nobody in the scene owns a trait, so Include Traits produces no line to light.
    const user = await open('<ENTITIES>', chipValues({ ...sampleChipScene(), ownedTraits: {} }));
    expect(pane().textContent).not.toContain('traits');
    await user.hover(checkbox('Include', 'Traits'));
    expect(litText()).toEqual([]);
    expect(dimmed()).toBe('');
    // An empty Header has no text to light either.
    await user.hover(within(dialog()).getByLabelText('Header'));
    expect(litText()).toEqual([]);
    expect(dimmed()).toBe('');
  });

  it('lights the Header, Prepend and Append text each on its own', async () => {
    const token = joinToken({ base: '<LOCATION>', header: 'Salt Dock', pre: 'At ', post: '.' });
    const user = await open(token, { '<LOCATION>': 'The Landing' });
    await user.hover(within(dialog()).getByLabelText('Header'));
    expect(litText()).toEqual(['SALT DOCK:']);
    expect(dimmed()).toContain('The Landing');
    await user.hover(within(dialog()).getByLabelText('Prepend'));
    expect(litText()).toEqual(['At']);
    await user.hover(within(dialog()).getByLabelText('Append'));
    expect(litText()).toEqual(['.']);
  });

  it("lights nothing from the Location chip's own axes", async () => {
    const user = await open('<LOCATION>');
    await user.hover(segmented('Content'));
    expect(litText()).toEqual([]);
    expect(dimmed()).toBe('');
  });

  it("lights the Stats chip's pieces in its lines", async () => {
    const user = await open(joinToken({ base: '<STATS DESCRIPTION>', variantId: 'numbers.descriptions.meaning' }));
    await user.hover(checkbox('Stat Detail', 'Range'));
    expect(litText()).toHaveLength(3);
  });
});
