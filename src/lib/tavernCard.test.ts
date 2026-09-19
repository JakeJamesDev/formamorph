import { describe, it, expect } from 'vitest';
import { readTavernCard } from './tavernCard';
import { openingWeight } from './openings';
import { USER_MACRO } from './userMacro';

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const enc = new TextEncoder();

function chunk(type: string, data: Uint8Array): number[] {
  const len = data.length;
  return [
    (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
    ...enc.encode(type),
    ...data,
    0, 0, 0, 0, // CRC (parser ignores it)
  ];
}

/** Base64 of a UTF-8 string (matches how card tools embed the JSON). */
function b64(s: string): string {
  let bin = '';
  for (const byte of enc.encode(s)) bin += String.fromCharCode(byte);
  return btoa(bin);
}

/** A PNG carrying one text chunk (keyword\0text). */
function png(keyword: string, text: string): Uint8Array {
  return new Uint8Array([
    ...PNG_SIG,
    ...chunk('tEXt', enc.encode(`${keyword}\0${text}`)),
    ...chunk('IEND', new Uint8Array()),
  ]);
}

const v2Card = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    name: 'Aria',
    description: '{{char}} greets {{user}} warmly by the fire.',
    personality: 'kind, curious',
    scenario: 'a riverside tavern',
    first_mes: 'Hello, traveler!', // an opening, never description text
    character_book: { entries: [{ keys: ['sword'], content: 'a keen blade' }] },
  },
};

describe('readTavernCard', () => {
  it('maps name + description/personality/scenario and substitutes macros', () => {
    const result = readTavernCard(png('chara', b64(JSON.stringify(v2Card))));
    expect(result).not.toBeNull();
    const { entity } = result!;
    expect(entity.name).toBe('Aria');
    expect(entity.aiDescription).toContain('Aria greets the player warmly by the fire.');
    expect(entity.aiDescription).toContain('Personality: kind, curious');
    expect(entity.aiDescription).toContain('Scenario: a riverside tavern');
    expect(entity.aiDescription).not.toContain('Hello, traveler!');
    expect(entity.id).toBeTruthy();
  });

  it('extracts the embedded character_book as a dictionary', () => {
    const { book } = readTavernCard(png('chara', b64(JSON.stringify(v2Card))))!;
    expect(book).not.toBeNull();
    expect(book!.entries).toHaveLength(1);
    expect(book!.name).toBe('Aria'); // falls back to the character name
  });

  it('prefers the ccv3 chunk over chara', () => {
    const chara = { data: { name: 'OldName', description: 'v2' } };
    const ccv3 = { data: { name: 'NewName', description: 'v3' } };
    const bytes = new Uint8Array([
      ...PNG_SIG,
      ...chunk('tEXt', enc.encode(`chara\0${b64(JSON.stringify(chara))}`)),
      ...chunk('tEXt', enc.encode(`ccv3\0${b64(JSON.stringify(ccv3))}`)),
      ...chunk('IEND', new Uint8Array()),
    ]);
    expect(readTavernCard(bytes)!.entity.name).toBe('NewName');
  });

  it('reads a flat V1 card (no data wrapper) and reports no book when absent', () => {
    const result = readTavernCard(png('chara', b64(JSON.stringify({ name: 'Bram', description: 'a one-armed smith' }))))!;
    expect(result.entity.name).toBe('Bram');
    expect(result.entity.aiDescription).toBe('a one-armed smith');
    expect(result.book).toBeNull();
  });

  it('returns null for a PNG with no character chunk', () => {
    expect(readTavernCard(png('parameters', 'just an SD prompt'))).toBeNull();
  });
});

describe('readTavernCard greetings', () => {
  const read = (card: object, keyword = 'chara') => readTavernCard(png(keyword, b64(JSON.stringify(card))))!.entity;
  const texts = (card: object, keyword?: string) => (read(card, keyword).openings ?? []).map((o) => o.text);

  it('turns a V2 first message and its alternate greetings into Narration rows at weight 1, in card order', () => {
    const entity = read({ spec: 'chara_card_v2', data: { name: 'Aria', first_mes: 'One.', alternate_greetings: ['Two.', 'Three.'] } });
    expect(entity.openings?.map((o) => [o.text, o.kind])).toEqual([['One.', 'narration'], ['Two.', 'narration'], ['Three.', 'narration']]);
    for (const o of entity.openings!) expect(openingWeight(entity.openingWeights, o.id)).toBe(1);
    expect(new Set(entity.openings!.map((o) => o.id)).size).toBe(3);
  });

  it('reads a V3 card from its ccv3 chunk', () => {
    expect(texts({ spec: 'chara_card_v3', data: { name: 'Aria', first_mes: 'V3 hello.', alternate_greetings: ['V3 again.'] } }, 'ccv3'))
      .toEqual(['V3 hello.', 'V3 again.']);
  });

  it('reads a flat V1 first message', () => {
    expect(texts({ name: 'Bram', first_mes: 'The forge hisses.' })).toEqual(['The forge hisses.']);
  });

  it('skips blank and non-string greetings and keeps the rest in order', () => {
    expect(texts({ data: { name: 'Aria', first_mes: '   ', alternate_greetings: ['A.', '', 7, '\n\t', 'B.'] } })).toEqual(['A.', 'B.']);
  });

  it('writes the name into openings and stores every user macro spelling in its one canonical form', () => {
    const [text] = texts({ data: { name: 'Aria', first_mes: '{{char}} smiles at {{user}}. {{ Char }} waves to {{User}} and {{ USER }}.' } });
    expect(text).toBe(`Aria smiles at ${USER_MACRO}. Aria waves to ${USER_MACRO} and ${USER_MACRO}.`);
  });

  it('leaves the description macro handling as it is', () => {
    expect(read({ data: { name: 'Aria', description: '{{char}} likes {{user}}.', first_mes: 'Hi {{user}}.' } }).aiDescription)
      .toBe('Aria likes the player.');
  });

  it('imports a card with no greetings with no openings', () => {
    const entity = read({ data: { name: 'Bram', description: 'a smith', alternate_greetings: [] } });
    expect(entity).not.toHaveProperty('openings');
    expect(entity).not.toHaveProperty('openingWeights');
  });
});
