import { describe, expect, it } from 'vitest';
import { stripMarkdown } from './stripMarkdown';

describe('stripMarkdown', () => {
  it.each([
    ['***Health***', 'Health'],
    ['=r=**Health**==', 'Health'],
    ['==*Health*==', 'Health'],
    ['~~Health~~', 'Health'],
    ['H~2~O and x^2^', 'H2O and x2'],
    ['[**Health**](https://example.com/a_(b))', 'Health'],
    ['![Health][icon]\n\n[icon]: health.png', 'Health'],
    ['![Health](health.png)', 'Health'],
    ['# Health\n\n---\n\nStamina', 'Health\n\nStamina'],
    ['> - [x] Health\n> - [ ] Stamina', 'Health\nStamina'],
    ['| Name | Value |\n| --- | --- |\n| Health | 100 |', 'Name Value\nHealth 100'],
    ['Health  \nStamina', 'Health\nStamina'],
    ['Health\nStamina', 'Health\nStamina'],
    ['Health\n\nStamina', 'Health\n\nStamina'],
    ['<https://example.com>', 'https://example.com'],
    ['Health &amp; Stamina', 'Health & Stamina'],
    ['=c===', ''],
    ['', ''],
  ])('extracts readable text from %j', (input, expected) => {
    expect(stripMarkdown(input)).toBe(expected);
  });

  it.each([
    'Health+ / Health−: 50% ❤️',
    '生命力 + Énergie',
    'snake_case and ~5 minutes',
    'x = y and a == b',
    'lonely * marker',
  ])('preserves meaningful punctuation and Unicode in %j', (text) => {
    expect(stripMarkdown(text)).toBe(text);
  });

  it('preserves code contents and escaped punctuation literally', () => {
    expect(stripMarkdown('`=c=Health==`')).toBe('=c=Health==');
    expect(stripMarkdown('```text\nx^2^ * y\n```')).toBe('x^2^ * y');
    expect(stripMarkdown('\\*Health\\*')).toBe('*Health*');
  });
});
