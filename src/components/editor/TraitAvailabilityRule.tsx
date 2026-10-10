import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { OptionSwitcher } from '@/components/SettingsRows';
import { fieldFrame } from '@/lib/historyField';
import { isAlwaysOn } from '@/lib/traitEffects';
import type { Trait, TraitLinkFields } from '@/types';

const MODE_OPTIONS = [
  { value: 'optional', label: 'Optional' },
  { value: 'alwaysOn', label: 'Automatic' },
  { value: 'hidden', label: 'Hidden' },
] as const;

const STARTS_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
] as const;

const IN_GAME_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'toggleable', label: 'Toggleable' },
] as const;

/** The sentence the three rows make together. */
function ruleSentence(trait: Trait): string {
  switch (trait.mode ?? 'optional') {
    case 'alwaysOn': return 'Turns on whenever its requirements hold. The player never switches it.';
    case 'hidden': return 'Turns on whenever its requirements hold. The player never sees it. The AI does.';
    default: return [
      'Lets the player pick it at game start.',
      trait.isDefault ? 'It starts on.' : 'It starts off.',
      trait.playerToggle ? 'The player can switch it during the game.' : "The player can't switch it during the game.",
    ].join(' ');
  }
}

/**
 * The top of the Availability tab: Mode, Starts and In Game as three rows, then the rule they make. Starts and
 * In Game stay in place and disable under Automatic and Hidden, which ignore them. Each row ends in the Reset
 * `reset` returns for its field, so a link shows one on an overridden field.
 */
export function TraitAvailabilityRule({ trait, onChange, reset }: {
  trait: Trait;
  onChange: (patch: Partial<Trait>) => void;
  reset: (field: keyof TraitLinkFields, label: string) => ReactNode;
}) {
  const automatic = isAlwaysOn(trait);
  const row = (label: string, field: keyof TraitLinkFields, control: ReactNode) => (
    <div className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]" {...fieldFrame(field)}>
      <Label>{label}</Label>
      {control}
      <div className="flex min-h-6 items-center">{reset(field, label)}</div>
    </div>
  );
  return (
    <div className="space-y-2">
      {row('Mode', 'mode', (
        <OptionSwitcher
          value={trait.mode ?? 'optional'}
          onChange={(v) => onChange({ mode: v === 'optional' ? undefined : v })}
          options={MODE_OPTIONS}
          ariaLabel="Mode"
        />
      ))}
      {row('Starts', 'isDefault', (
        <OptionSwitcher
          value={trait.isDefault ? 'on' : 'off'}
          onChange={(v) => onChange({ isDefault: v === 'on' })}
          options={STARTS_OPTIONS}
          ariaLabel="Starts"
          slots={MODE_OPTIONS.length}
          disabled={automatic}
        />
      ))}
      {row('In Game', 'playerToggle', (
        <OptionSwitcher
          value={trait.playerToggle ? 'toggleable' : 'fixed'}
          onChange={(v) => onChange({ playerToggle: v === 'toggleable' })}
          options={IN_GAME_OPTIONS}
          ariaLabel="In Game"
          slots={MODE_OPTIONS.length}
          disabled={automatic}
        />
      ))}
      <Hint>{ruleSentence(trait)}</Hint>
    </div>
  );
}
