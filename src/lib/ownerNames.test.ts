// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as bearers from './bearers';
import * as owners from './owners';
import * as bearerChoices from './bearerChoices';
import * as ownerChoices from './ownerChoices';
import * as requirementBearers from './requirementBearers';
import * as requirementOwners from './requirementOwners';
import * as ownedTraitsInPlay from './ownedTraitsInPlay';
import * as traitGates from './traitGates';
import * as statOwners from './statOwners';
import * as statCodeTraits from './statCodeTraits';
import * as placeholders from './placeholders';
import * as traitRuntime from './traitRuntime';
import * as codeCards from './codeCards';
import * as rules from './testBench/rules';
import * as bearerPicker from '@/managers/BearerPicker';
import * as ownerPicker from '@/managers/OwnerPicker';
import * as bearerFlyouts from '@/components/design-system/BearerFlyoutReference';
import * as ownerFlyouts from '@/components/design-system/OwnerFlyoutReference';
import { BearerStatNote, OwnerStatNote } from '@/managers/TraitManager';

type Pair = readonly [oldName: string, oldHome: object, newName: string, newHome: object];

// Each old export is the same value as its owner-named twin, so a call site on either name behaves alike.
const PAIRS: readonly Pair[] = [
  ['PLAYER_BEARER', bearers, 'PLAYER_OWNER', traitGates],
  ['WORLD_OWNER', traitGates, 'PLAYER_OWNER', traitGates],
  ['PLAYER_OWNER', statOwners, 'PLAYER_OWNER', traitGates],
  ['resolveBearers', bearers, 'resolveOwners', owners],
  ['bearsTraits', bearers, 'ownsOrLinksTraits', owners],
  ['bearerChoices', bearerChoices, 'ownerChoices', ownerChoices],
  ['soleBearerRequirement', requirementBearers, 'soleOwnerRequirement', requirementOwners],
  ['bearerOf', traitGates, 'requirementOwnerOf', traitGates],
  ['bearerKey', traitGates, 'requirementOwnerKey', traitGates],
  ['withBearer', traitGates, 'withRequirementOwner', traitGates],
  ['inPlayBearers', ownedTraitsInPlay, 'inPlayOwners', ownedTraitsInPlay],
  ['bearerGroupId', ownedTraitsInPlay, 'ownerGroupId', ownedTraitsInPlay],
  ['bearerTraitTree', ownedTraitsInPlay, 'ownerTraitTree', ownedTraitsInPlay],
  ['rowBearer', ownedTraitsInPlay, 'rowOwner', ownedTraitsInPlay],
  ['bearerPins', ownedTraitsInPlay, 'ownerPins', ownedTraitsInPlay],
  ['bearerPreview', ownedTraitsInPlay, 'ownerPreview', ownedTraitsInPlay],
  ['withBearerTrees', ownedTraitsInPlay, 'withOwnerTrees', ownedTraitsInPlay],
  ['inBearerPlaces', ownedTraitsInPlay, 'inOwnerPlaces', ownedTraitsInPlay],
  ['withBearerNames', ownedTraitsInPlay, 'withOwnerNames', ownedTraitsInPlay],
  ['bearerPriming', ownedTraitsInPlay, 'ownerPriming', ownedTraitsInPlay],
  ['traitHolders', statCodeTraits, 'traitOwnerMaps', statCodeTraits],
  ['resolveBearerText', placeholders, 'resolveOwnerText', placeholders],
  ['bearerStatTraitsInForce', traitRuntime, 'entityStatTraitsInForce', traitRuntime],
  ['placeholderHolders', codeCards, 'reachedPlaceholderOwners', codeCards],
  ['bearerWorldOf', rules, 'ownerWorldOf', rules],
  ['BearerList', bearerPicker, 'OwnerList', ownerPicker],
  ['LinkToBearerButton', bearerPicker, 'LinkToOwnerButton', ownerPicker],
  ['BearerFlyoutReference', bearerFlyouts, 'OwnerFlyoutReference', ownerFlyouts],
];

describe('owner names beside bearer names', () => {
  for (const [oldName, oldHome, newName, newHome] of PAIRS) {
    it(`${oldName} is the same export as ${newName}`, () => {
      const twin = (newHome as Record<string, unknown>)[newName];
      expect(twin).toBeDefined();
      expect((oldHome as Record<string, unknown>)[oldName]).toBe(twin);
    });
  }

  it('exports the Traits tab note under both names', () => {
    expect(BearerStatNote).toBe(OwnerStatNote);
  });

  it('keeps the player key value', () => {
    expect(traitGates.PLAYER_OWNER).toBe('world');
  });
});
