import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PromptField from './PromptField';
import { RequestAnatomyView } from '@/components/game/RequestAnatomyView';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { renderPromptTemplate, renderPromptTemplateRuns } from '@/lib/promptTemplate';

// One template through every surface that draws prompt chips: the request, the editor's Preview tab, and
// Request Anatomy's Resolved and Chips views. Only the Edit tab draws headers, affixes, and `↵` hints.
const vocab = promptVocabulary([]);
const TEMPLATE = 'Intro\n<PERSONA|markdown|pre="Meet "|post="."|header="player"><LOCATION|markdown|header="place">'
  + '<NOTES|format=markdown|header="notes">\n<TRAITS DESCRIPTION>\nEnd';
const FILLED = { '<PERSONA|markdown>': 'Mira', '<LOCATION|markdown>': 'Dock\n', '<NOTES>': 'hi', '<TRAITS DESCRIPTION>': 'Brave' };
const EMPTY = { '<PERSONA|markdown>': 'Mira', '<LOCATION|markdown>': '', '<NOTES>': 'N/A', '<TRAITS DESCRIPTION>': 'Brave' };

/** Drawn text: `<br>` as a line break, a chip pill as «label», an empty-value marker as ⌀. */
function drawn(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  const el = node as HTMLElement;
  if (el.tagName === 'BR') return el.hasAttribute('data-lexical-managed-linebreak') ? '' : '\n';
  if (el.getAttribute('role') === 'img') return '⌀';
  if (el.tagName === 'BUTTON' && /^Remove /.test(el.getAttribute('aria-label') ?? '')) return '';
  const inner = [...el.childNodes].map(drawn).join('');
  return el.hasAttribute('data-chip') ? `«${inner}»` : inner;
}

const block = (values: Record<string, string>) =>
  ({ role: 'system' as const, ...renderPromptTemplateRuns(TEMPLATE, values, { source: 'system-template' }) });

function anatomy(values: Record<string, string>, mode: 'chips' | 'resolved') {
  const view = render(<RequestAnatomyView blocks={[block(values)]} mode={mode} />);
  const body = view.container.querySelector('p')!;
  const out = { text: drawn(body), hints: body.querySelectorAll('[data-affix-newline]').length };
  view.unmount();
  return out;
}

describe('prompt chip surfaces agree', () => {
  it.each([['filled', FILLED], ['empty', EMPTY]])('shows the request bytes wherever values render (%s)', async (_, values) => {
    const request = renderPromptTemplate(TEMPLATE, values);
    const field = render(<PromptField value={TEMPLATE} onChange={() => {}} vocabulary={vocab} previewValues={values} />);
    await waitFor(() => expect(field.container.querySelector('[data-lexical-editor] [data-chip]')).toBeTruthy());
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Preview' }));
    // Preview adds only a marker where a chip resolved empty.
    expect(drawn(await screen.findByTestId('prompt-preview')).replaceAll('⌀', '')).toBe(request);
    field.unmount();
    expect(anatomy(values, 'resolved').text).toBe(`System Prompt${request}`);
  });

  it('spaces Chips view pills the same whatever the values, with no header or affix hints', () => {
    const filled = anatomy(FILLED, 'chips');
    expect(filled.text).toBe('System PromptIntro\n\n«Persona (Markdown)»\n\n«Location (Markdown)»\n\n«Notes»\n\n«Traits»\nEnd');
    expect(anatomy(EMPTY, 'chips').text).toBe(filled.text);
    expect(filled.hints).toBe(0);
  });
});
