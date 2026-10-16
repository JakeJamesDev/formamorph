import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TokenChip } from './TokenChip';
import PromptField from './PromptField';
import {
  promptVocabulary, worldPromptVocabulary, placeholderVocabulary, plainVocabulary,
} from '@/lib/chipVocabulary';
import { toolTemplateVocabulary } from '@/lib/tools/toolTemplateVocabulary';
import { ALL_PROMPT_VARIABLES } from '@/lib/promptVariables';

const vocab = promptVocabulary(ALL_PROMPT_VARIABLES);
const glyph = (container: HTMLElement) => container.querySelector('[data-chip-filter]');

describe('the Only With glyph on a placed chip', () => {
  it.each([
    ['<ENTITIES|withstats>', 'Only With Stats'],
    ['<ENTITIES|withtraits>', 'Only With Traits'],
    ['<ENTITIES|inscene.withtraits.withstats.markdown>', 'Only With Stats or Traits'],
    ['<PERSONA|withstats>', 'Only With Stats'],
    ['<PERSONA|summary.withtraits.withstats>', 'Only With Stats or Traits'],
  ])('shows on %s and names the picks "%s"', (token, picks) => {
    const { container } = render(<TokenChip token={token} vocab={vocab} />);
    expect(glyph(container)).not.toBeNull();
    expect(screen.getByRole('img', { name: picks })).toBe(glyph(container));
  });

  it.each([
    '<ENTITIES>', '<ENTITIES|inscene.notraits.nostats>', '<PERSONA>', '<PERSONA|nostats.norange>',
    '<STATS DESCRIPTION>', '<LOCATION|summary>', '<WORLD DESCRIPTION>',
  ])('stays off %s', (token) => {
    const { container } = render(<TokenChip token={token} vocab={vocab} />);
    expect(glyph(container)).toBeNull();
  });

  it('leaves the label text and the accessible name as they were', () => {
    const plain = render(<TokenChip token="<ENTITIES|inscene.markdown>" vocab={vocab} />);
    const filtered = render(<TokenChip token="<ENTITIES|inscene.withstats.markdown>" vocab={vocab} />);
    expect(filtered.container.textContent).toBe(plain.container.textContent);
    expect(filtered.container.textContent).toBe('Entities (In Scene, Markdown)');
  });

  it('shows with the removal control present, and keeps the remove name', () => {
    render(<TokenChip token="<ENTITIES|withtraits>" vocab={vocab} onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: 'Remove Entities' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Only With Traits' })).toBeInTheDocument();
  });

  it('shows through the world prompt and Tool template vocabularies', () => {
    const world = worldPromptVocabulary(vocab, placeholderVocabulary([], {}));
    const tool = toolTemplateVocabulary([]);
    for (const family of [world, tool]) {
      const { container } = render(<TokenChip token="<ENTITIES|withstats>" vocab={family} />);
      expect(glyph(container)).not.toBeNull();
    }
  });

  it('shows on the chip the prompt editor places', async () => {
    const { container } = render(<PromptField value="<ENTITIES|withstats.withtraits>" onChange={() => {}} vocabulary={vocab} />);
    await waitFor(() => expect(container.querySelector('[data-chip-token] [data-chip-filter]')).not.toBeNull());
    expect(screen.getByRole('img', { name: 'Only With Stats or Traits' })).toBeInTheDocument();
  });

  it('is absent from a vocabulary with no filter', () => {
    const { container } = render(<TokenChip token="<ENTITIES|withstats>" vocab={plainVocabulary()} />);
    expect(glyph(container)).toBeNull();
  });
});
