// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { CodeCard } from '@/lib/codeCards';
import { cardAnnouncement, renderCodeCard } from './codeCardView';

describe('cardAnnouncement', () => {
  it('reads the signature, the badge and the description as sentences', () => {
    const card = {
      from: 0, to: 5, signature: { kind: 'property', path: 'Stat.value', type: 'number' }, access: 'afterRun', description: 'The current value.',
    } as const;
    expect(cardAnnouncement(card)).toBe('property Stat.value: number. Writable After This Run. The current value');
  });

  it('reads World Details after the description', () => {
    const card = {
      from: 0, to: 5, signature: { kind: 'stat', path: 'stats.Fatigue', type: 'Stat' }, description: 'Tired.',
      rows: [{ label: 'Range', value: '0 – 100' }, { label: 'Owner', value: 'World' }],
    } as const;
    expect(cardAnnouncement({ ...card, rows: [...card.rows] })).toBe('stat stats.Fatigue: Stat. Tired. Range: 0 – 100. Owner: World');
  });

  it('skips the badge and the description a card lacks', () => {
    expect(cardAnnouncement({ from: 0, to: 5, signature: { kind: 'stat', path: 'stats.Fatigue', type: 'Stat' } }))
      .toBe('stat stats.Fatigue: Stat');
  });
});

describe('renderCodeCard', () => {
  it('writes a method as a call, with no badge', () => {
    const card = renderCodeCard({
      from: 0, to: 4, signature: { kind: 'method', path: 'Placeholder.roll', type: '() => string' }, description: 'Draw one value.',
    });
    expect(card.querySelector('section')?.textContent).toBe('(method) Placeholder.roll(): string');
    expect(card.textContent).toContain('Draw one value.');
  });

  it.each([
    ['writable', 'Writable'],
    ['afterRun', 'Writable After This Run'],
    ['readOnly', 'Read-Only'],
  ] as const)('badges %s access as %s', (access, label) => {
    const card = renderCodeCard({ from: 0, to: 5, signature: { kind: 'property', path: 'Stat.value', type: 'number' }, access });
    expect(card.querySelector('section')?.textContent).toBe(`(property) Stat.value: number${label}`);
  });

  it('clamps the description to 3 lines', () => {
    const card = renderCodeCard({ from: 0, to: 4, signature: { kind: 'stat', path: 'stats.Fatigue', type: 'Stat' }, description: 'Long.' });
    const description = card.querySelectorAll('section')[1];
    expect(description.querySelector('.line-clamp-3')?.textContent).toBe('Long.');
  });

  it('lists World Details as label and value pairs after the description', () => {
    const card = renderCodeCard({
      from: 0, to: 4, signature: { kind: 'stat', path: 'stats.Fatigue', type: 'Stat' }, description: 'Tired.',
      rows: [{ label: 'Range', value: '0 – 100' }, { label: 'Owner', value: 'World' }],
    });
    const details = card.querySelector('dl[aria-label="World Details"]');
    expect([...details!.children].map((cell) => `${cell.tagName}:${cell.textContent}`)).toEqual(['DT:Range', 'DD:0 – 100', 'DT:Owner', 'DD:World']);
    expect(card.lastElementChild).toBe(details);
  });

  it('writes a declared name with no type', () => {
    const card = renderCodeCard({ from: 0, to: 5, signature: { kind: 'const', path: 'tired' } });
    expect(card.querySelector('section')?.textContent).toBe('(const) tired');
  });

  it('shows a slot’s default', () => {
    const card = renderCodeCard({ from: 0, to: 5, signature: { kind: 'slot', path: 'amount', type: 'number' }, defaultValue: '5' });
    expect(card.textContent).toContain('Default5');
  });

  it('draws Go to Line only for a host that can move the caret', () => {
    const declared: CodeCard = { from: 0, to: 5, signature: { kind: 'const', path: 'tired' }, links: [{ id: 'goToLine', at: 6, line: 4 }] };
    expect(renderCodeCard(declared).querySelector('button')).toBeNull();

    const moves: number[] = [];
    const button = renderCodeCard(declared, { goTo: (at) => moves.push(at) }).querySelector('button');
    expect(button?.textContent).toBe('Go to Line 4');
    button?.click();
    expect(moves).toEqual([6]);
  });

  it('leaves the description section out when the card has none', () => {
    const card = renderCodeCard({ from: 0, to: 5, signature: { kind: 'stat', path: 'stats.Fatigue', type: 'Stat' } });
    expect(card.querySelectorAll('section')).toHaveLength(1);
  });
});
