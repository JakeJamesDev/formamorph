import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

// Renders the real component and reads the DOM: the rule only shows at the end of the whole pipeline.

function rendered(markdown: string): HTMLElement {
  return render(<MarkdownRenderer text={markdown} />).container;
}

describe('indented text in markdown', () => {
  it('renders a four-space-indented outline as a list, not a code block', () => {
    const container = rendered('The player enters the keep.\n\n    - Location: the gate yard.\n    - Time: day.\n');
    expect(container.querySelector('pre')).toBeNull();
    const items = [...container.querySelectorAll('li')].map((li) => li.textContent?.trim());
    expect(items).toEqual(['Location: the gate yard.', 'Time: day.']);
  });

  it('renders an indented paragraph as prose', () => {
    const container = rendered('First line.\n\n    The guards drill in the yard.\n');
    expect(container.querySelector('pre')).toBeNull();
    expect(container.textContent).toContain('The guards drill in the yard.');
  });

  it('still renders fenced code as a code block', () => {
    const container = rendered('```js\nreturn stats.mana;\n```\n');
    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.textContent).toContain('return stats.mana;');
  });
});
