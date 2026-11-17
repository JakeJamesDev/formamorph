import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';

afterEach(cleanup);

describe('the reveal word spans', () => {
  it('hold the words alone, with the spaces between them as plain text', () => {
    const { container } = render(<MarkdownRenderer text="Hello  brave world" animate animation="reveal" />);
    const words = [...container.querySelectorAll('[data-sd-animate]')].map((span) => span.textContent);
    expect(words).toEqual(['Hello', 'brave', 'world']);
    expect(container.querySelector('p')?.textContent).toBe('Hello  brave world');
  });
});
