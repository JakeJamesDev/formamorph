import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PLAYER_QUOTE_COLOR, slotColor } from '@/lib/coref/speakerPalette';

// The model store and its host are absent: any use of them fails the test (Q65).
vi.mock('@/lib/coref/characterMentionsApp', () => {
  throw new Error('The preview must not load the model store');
});
vi.mock('@/lib/coref/characterMentions', () => {
  throw new Error('The preview must not load the model store');
});
vi.mock('@/lib/coref/corefClient', () => {
  throw new Error('The preview must not load the coref host');
});
vi.mock('@/lib/coref/corefHost', () => {
  throw new Error('The preview must not load the coref host');
});

import { MentionsPreview } from './MentionsPreview';

afterEach(cleanup);

describe('the Character Mentions offer preview', () => {
  it('renders every quote in its speaker’s color, the player’s in their Quote Color, with the model store absent', () => {
    const { container } = render(<MentionsPreview />);
    const quotes = [...container.querySelectorAll<HTMLElement>('.dialogue-quote')]
      .map((q) => [q.textContent, q.style.getPropertyValue('--quote-speaker')]);
    expect(quotes.map(([, color]) => color)).not.toContain('');
    const byQuote = new Map<string, string>();
    for (const [text, color] of quotes) byQuote.set(color!, (byQuote.get(color!) ?? '') + text);
    expect([...byQuote.entries()]).toEqual([
      [slotColor(0), '"First round\'s free,"'],
      [slotColor(1), '"Since when does Brann give anything away?"'],
      [slotColor(2), '"Since the storm took his roof,"'],
      [PLAYER_QUOTE_COLOR, '"Then pour mine,"'],
    ]);
  });

  it('links each cast member and the player, and opens their card', () => {
    const { container } = render(<MentionsPreview />);
    const mentions = [...container.querySelectorAll<HTMLElement>('[data-mention]')].map((el) => el.textContent);
    expect(mentions).toEqual(['Brann', 'he', 'Ilse', 'you', 'Brann', 'his', 'old Pell', 'you']);
    fireEvent.click(container.querySelector<HTMLElement>('[data-mention="preview-pell"]')!);
    expect(screen.getByTestId('mention-card').textContent).toContain('Pell');
    expect(screen.queryByText('Wrong character?')).toBeNull();
  });
});
