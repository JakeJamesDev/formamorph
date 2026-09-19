import { describe, it, expect } from 'vitest';
import { USER_MACRO, canonicalUserMacro, renderUserMacro } from './userMacro';

describe('USER_MACRO', () => {
  it('is the SillyTavern spelling', () => {
    expect(USER_MACRO).toBe('{{user}}');
  });
});

describe('canonicalUserMacro', () => {
  it('writes every spelling as the canonical form and leaves other macros alone', () => {
    expect(canonicalUserMacro('{{User}} meets {{ user }}, {{USER}} and {{char}}.'))
      .toBe('{{user}} meets {{user}}, {{user}} and {{char}}.');
  });
});

describe('renderUserMacro', () => {
  it('renders the marker as "you" mid-sentence', () => {
    expect(renderUserMacro('She hands {{user}} a cup.')).toBe('She hands you a cup.');
  });

  it('capitalizes at the start of the text, the start of a line, and after sentence punctuation', () => {
    expect(renderUserMacro('{{user}} wakes.\n{{user}} rises! {{user}} sits? {{user}} waits.'))
      .toBe('You wakes.\nYou rises! You sits? You waits.');
  });

  it('allows opening punctuation between the boundary and the marker', () => {
    expect(renderUserMacro('*{{user}} nods.* "{{user}}, come." (_{{user}}_)'))
      .toBe('*You nods.* "You, come." (_You_)');
  });

  it('keeps the lowercase form after a comma or other mid-sentence punctuation', () => {
    expect(renderUserMacro('Well, {{user}}; "{{user}}" said.')).toBe('Well, you; "you" said.');
  });

  it('matches a hand-typed marker regardless of case and inner spaces', () => {
    expect(renderUserMacro('Hi {{ User }}. {{USER}} smiles.')).toBe('Hi you. You smiles.');
  });

  it('leaves text without the marker untouched', () => {
    expect(renderUserMacro('{{char}} and {{ph:x:world:p1}} stay.')).toBe('{{char}} and {{ph:x:world:p1}} stay.');
  });
});
