// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { cardAnnouncement, renderCodeCard } from './codeCardView';

describe('cardAnnouncement', () => {
  it('reads the signature, the badge and the description as sentences', () => {
    const card = {
      from: 0, to: 5, signature: { kind: 'property', path: 'Stat.value', type: 'number' }, access: 'afterRun', description: 'The current value.',
    } as const;
    expect(cardAnnouncement(card)).toBe('property Stat.value: number. Writable After This Run. The current value');
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

  it('leaves the description section out when the card has none', () => {
    const card = renderCodeCard({ from: 0, to: 5, signature: { kind: 'stat', path: 'stats.Fatigue', type: 'Stat' } });
    expect(card.querySelectorAll('section')).toHaveLength(1);
  });
});
