import { describe, expect, it } from 'vitest';
import { readIntent } from './helpIntent';

describe('a classifier reply', () => {
  it('reads the schema object, fenced or bare, and one with no second-ask field as no', () => {
    expect(readIntent('{"intent":"Help"}')).toEqual({ intent: 'Help', secondAsk: false });
    expect(readIntent('{"intent":"Code","secondAsk":"no"}')).toEqual({ intent: 'Code', secondAsk: false });
    expect(readIntent('```json\n{"intent":"World","secondAsk":"yes"}\n```')).toEqual({ intent: 'World', secondAsk: true });
  });

  it('reads the prompted lines in any case, with bold, and a missing second-ask line as no', () => {
    expect(readIntent('Intent: help\nSecond ask: YES')).toEqual({ intent: 'Help', secondAsk: true });
    expect(readIntent('**Intent:** Chat\n**Second ask:** no')).toEqual({ intent: 'Chat', secondAsk: false });
    expect(readIntent('Intent: Create')).toEqual({ intent: 'Create', secondAsk: false });
    expect(readIntent('Intent: Help.')).toEqual({ intent: 'Help', secondAsk: false });
  });

  it('reads a reply that is one label alone', () => {
    expect(readIntent('World.')).toEqual({ intent: 'World', secondAsk: false });
  });

  it('names no Intent for an unknown label, a sentence, two labels, or a schema object with a bad label', () => {
    expect(readIntent('Intent: Lore')).toBeNull();
    expect(readIntent('This is about the world.')).toBeNull();
    expect(readIntent('Help or Code')).toBeNull();
    expect(readIntent('{"intent":"Lore","secondAsk":"no"}')).toBeNull();
    expect(readIntent('{"secondAsk":"no"}')).toBeNull();
  });
});
