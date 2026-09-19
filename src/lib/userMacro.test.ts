import { describe, it, expect } from 'vitest';
import { USER_MACRO, canonicalUserMacro, hasUserMacro, isUserMacroToken, renderUserMacro } from './userMacro';

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

  it('renders the possessive as "your", capitalized at a sentence start', () => {
    expect(renderUserMacro("She takes {{user}}'s hand. {{user}}’s cup is empty. {{user}}'s"))
      .toBe('She takes your hand. Your cup is empty. Your');
  });

  it('matches a hand-typed marker regardless of case and inner spaces', () => {
    expect(renderUserMacro('Hi {{ User }}. {{USER}} smiles.')).toBe('Hi you. You smiles.');
  });

  it('leaves text without the marker untouched', () => {
    expect(renderUserMacro('{{char}} and {{ph:x:world:p1}} stay.')).toBe('{{char}} and {{ph:x:world:p1}} stay.');
  });
});

describe('renderUserMacro with a persona', () => {
  it('renders the name on both kinds of text, whatever the position', () => {
    const text = '{{user}} wakes. She hands {{user}} a cup.';
    expect(renderUserMacro(text, { name: 'Wren', kind: 'opening' })).toBe('Wren wakes. She hands Wren a cup.');
    expect(renderUserMacro(text, { name: 'Wren', kind: 'reference' })).toBe('Wren wakes. She hands Wren a cup.');
  });

  it('keeps a possessive as the text wrote it', () => {
    expect(renderUserMacro("{{user}}'s cup and {{User}}’s hat.", { name: 'Wren', kind: 'opening' }))
      .toBe("Wren's cup and Wren’s hat.");
  });

  it('falls back when the name is blank', () => {
    expect(renderUserMacro('{{user}} waits.', { name: '  ', kind: 'opening' })).toBe('You waits.');
    expect(renderUserMacro('{{user}} waits.', { name: '  ', kind: 'reference' })).toBe('The player waits.');
  });
});

describe('renderUserMacro on reference text with no persona', () => {
  it('renders "the player", capitalized where it starts a sentence', () => {
    expect(renderUserMacro('{{user}} lives here. She trusts {{user}}.', { kind: 'reference' }))
      .toBe('The player lives here. She trusts the player.');
  });

  it("renders the possessive as \"the player's\" with the apostrophe as written", () => {
    expect(renderUserMacro("She keeps {{user}}'s ring and {{user}}’s letters.", { kind: 'reference' }))
      .toBe("She keeps the player's ring and the player’s letters.");
  });
});

describe('isUserMacroToken', () => {
  it('is true only for one whole marker', () => {
    expect(isUserMacroToken('{{ USER }}')).toBe(true);
    expect(isUserMacroToken('{{user}} ')).toBe(false);
    expect(isUserMacroToken('{{char}}')).toBe(false);
  });
});

describe('hasUserMacro', () => {
  it('finds every spelling and nothing else', () => {
    expect(hasUserMacro('Hi {{ User }}.')).toBe(true);
    expect(hasUserMacro('{{char}} and {{ph:x:world:p1}}')).toBe(false);
  });
});
