import { describe, it, expect } from 'vitest';
import {
  BUILTIN_PLACEHOLDERS, CHARACTER_NAME, PLAYER_NAME, builtinForToken, builtinLabel, canonicalBuiltins, hasBuiltin, labelBuiltins,
  renderBuiltins,
} from './builtinPlaceholders';

describe('the Built-in registry', () => {
  it('lists Player Name first, stored in the SillyTavern spelling', () => {
    expect(BUILTIN_PLACEHOLDERS[0]).toBe(PLAYER_NAME);
    expect(PLAYER_NAME.token).toBe('{{user}}');
    expect(PLAYER_NAME.label).toBe('Player Name');
    expect(PLAYER_NAME.searchTerms).toContain('user');
  });

  it('offers Player Name in fields that offer Built-ins and nowhere else', () => {
    expect(PLAYER_NAME.visible({ offered: true })).toBe(true);
    expect(PLAYER_NAME.visible({ offered: false })).toBe(false);
  });

  it('lists Character Name second, stored in the SillyTavern spelling', () => {
    expect(BUILTIN_PLACEHOLDERS[1]).toBe(CHARACTER_NAME);
    expect(CHARACTER_NAME.token).toBe('{{char}}');
    expect(CHARACTER_NAME.label).toBe('Character Name');
    expect(CHARACTER_NAME.searchTerms).toContain('char');
  });

  it('offers Character Name only in an entity’s own fields', () => {
    expect(CHARACTER_NAME.visible({ offered: true, ownerKind: 'entity' })).toBe(true);
    expect(CHARACTER_NAME.visible({ offered: true, ownerKind: 'dictionary' })).toBe(false);
    expect(CHARACTER_NAME.visible({ offered: true })).toBe(false);
    expect(CHARACTER_NAME.visible({ offered: false, ownerKind: 'entity' })).toBe(false);
  });

  it('offers Player Name whoever owns the field', () => {
    expect(PLAYER_NAME.visible({ offered: true, ownerKind: 'dictionary' })).toBe(true);
    expect(PLAYER_NAME.visible({ offered: true, ownerKind: 'entity' })).toBe(true);
  });
});

describe('builtinForToken', () => {
  it('is the row for one whole token in any spelling', () => {
    expect(builtinForToken('{{ USER }}')).toBe(PLAYER_NAME);
    expect(builtinForToken('{{user}}')).toBe(PLAYER_NAME);
    expect(builtinForToken('{{ Char }}')).toBe(CHARACTER_NAME);
  });

  it('is nothing for a token with text around it or another macro', () => {
    expect(builtinForToken('{{user}} ')).toBeUndefined();
    expect(builtinForToken('{{random}}')).toBeUndefined();
    expect(builtinForToken('{{ph:x:world:p1}}')).toBeUndefined();
  });
});

describe('builtinLabel', () => {
  it('names a Built-in token and nothing else', () => {
    expect(builtinLabel('{{User}}')).toBe('Player Name');
    expect(builtinLabel('{{ph:x:world:p1}}')).toBeUndefined();
  });
});

describe('labelBuiltins', () => {
  it('writes every Built-in in the text as its label', () => {
    expect(labelBuiltins('Hi {{user}}, {{ User }}’s cup.')).toBe('Hi Player Name, Player Name’s cup.');
  });
});

describe('hasBuiltin', () => {
  it('finds every spelling and nothing else', () => {
    expect(hasBuiltin('Hi {{ User }}.')).toBe(true);
    expect(hasBuiltin('{{random}} and {{ph:x:world:p1}}')).toBe(false);
    expect(hasBuiltin('Hi {{ CHAR }}.')).toBe(true);
  });

  it('answers the same on every call', () => {
    expect([hasBuiltin('{{user}}'), hasBuiltin('{{user}}'), hasBuiltin('{{user}}')]).toEqual([true, true, true]);
  });
});

describe('canonicalBuiltins', () => {
  it('writes every spelling as the canonical form and leaves other macros alone', () => {
    expect(canonicalBuiltins('{{User}} meets {{ user }}, {{Char}} and {{ CHAR }}, not {{random}}.'))
      .toBe('{{user}} meets {{user}}, {{char}} and {{char}}, not {{random}}.');
  });
});

describe('renderBuiltins', () => {
  it('renders the marker as "you" mid-sentence', () => {
    expect(renderBuiltins('She hands {{user}} a cup.')).toBe('She hands you a cup.');
  });

  it('capitalizes at the start of the text, the start of a line, and after sentence punctuation', () => {
    expect(renderBuiltins('{{user}} wakes.\n{{user}} rises! {{user}} sits? {{user}} waits.'))
      .toBe('You wakes.\nYou rises! You sits? You waits.');
  });

  it('allows opening punctuation between the boundary and the marker', () => {
    expect(renderBuiltins('*{{user}} nods.* "{{user}}, come." (_{{user}}_)'))
      .toBe('*You nods.* "You, come." (_You_)');
  });

  it('keeps the lowercase form after a comma or other mid-sentence punctuation', () => {
    expect(renderBuiltins('Well, {{user}}; "{{user}}" said.')).toBe('Well, you; "you" said.');
  });

  it('renders the possessive as "your", capitalized at a sentence start', () => {
    expect(renderBuiltins("She takes {{user}}'s hand. {{user}}’s cup is empty. {{user}}'s"))
      .toBe('She takes your hand. Your cup is empty. Your');
  });

  it('matches a hand-typed marker regardless of case and inner spaces', () => {
    expect(renderBuiltins('Hi {{ User }}. {{USER}} smiles.')).toBe('Hi you. You smiles.');
  });

  it('leaves text without the marker untouched', () => {
    expect(renderBuiltins('{{random}} and {{ph:x:world:p1}} stay.')).toBe('{{random}} and {{ph:x:world:p1}} stay.');
  });
});

describe('renderBuiltins for Character Name', () => {
  it('renders the character in any spelling, with no capital rule of its own', () => {
    expect(renderBuiltins("{{char}} waits. She sees {{ Char }}'s boat.", { character: 'vos' }))
      .toBe("vos waits. She sees vos's boat.");
  });

  it('renders nothing with no character or a blank one', () => {
    expect(renderBuiltins('[{{char}}]')).toBe('[]');
    expect(renderBuiltins('[{{char}}]', { character: '  ' })).toBe('[]');
  });
});

describe('renderBuiltins with a persona', () => {
  it('renders the name on both kinds of text, whatever the position', () => {
    const text = '{{user}} wakes. She hands {{user}} a cup.';
    expect(renderBuiltins(text, { name: 'Wren', kind: 'opening' })).toBe('Wren wakes. She hands Wren a cup.');
    expect(renderBuiltins(text, { name: 'Wren', kind: 'reference' })).toBe('Wren wakes. She hands Wren a cup.');
  });

  it('keeps a possessive as the text wrote it', () => {
    expect(renderBuiltins("{{user}}'s cup and {{User}}’s hat.", { name: 'Wren', kind: 'opening' }))
      .toBe("Wren's cup and Wren’s hat.");
  });

  it('falls back when the name is blank', () => {
    expect(renderBuiltins('{{user}} waits.', { name: '  ', kind: 'opening' })).toBe('You waits.');
    expect(renderBuiltins('{{user}} waits.', { name: '  ', kind: 'reference' })).toBe('The player waits.');
  });
});

describe('renderBuiltins on reference text with no persona', () => {
  it('renders "the player", capitalized where it starts a sentence', () => {
    expect(renderBuiltins('{{user}} lives here. She trusts {{user}}.', { kind: 'reference' }))
      .toBe('The player lives here. She trusts the player.');
  });

  it("renders the possessive as \"the player's\" with the apostrophe as written", () => {
    expect(renderBuiltins("She keeps {{user}}'s ring and {{user}}’s letters.", { kind: 'reference' }))
      .toBe("She keeps the player's ring and the player’s letters.");
  });
});
