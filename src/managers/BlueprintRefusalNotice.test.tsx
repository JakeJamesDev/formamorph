import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlueprintRefusalNotice } from './BlueprintRefusalNotice';
import type { BlueprintRefusal } from '@/lib/placeholderBlueprints';

const line = (refusal: BlueprintRefusal, removing = false) => {
  render(<BlueprintRefusalNotice refusal={refusal} removing={removing} placeholders={[]} onDismiss={() => {}} />);
  return screen.getByRole('status').textContent;
};

describe('BlueprintRefusalNotice', () => {
  it('names the uses that keep a blueprint in', () => {
    expect(line({ reason: 'out', names: ['Class Garb'], uses: [{ kind: 'trait', name: 'Paladin' }, { kind: 'copy', name: 'Albus.Class Garb' }] }))
      .toBe('Class Garb stays in Blueprints, because Trait: Paladin and Copy: Albus.Class Garb use it. Remove those uses first.Dismiss');
  });

  it('names the blueprints a leaving placeholder still reaches', () => {
    expect(line({ reason: 'out', names: ['Heritage', 'Title'], uses: [{ kind: 'blueprint', name: 'Crest' }], reaches: ['Class Garb'] }))
      .toBe('Heritage and Title stay in Blueprints, because Blueprint: Crest uses them and their values use Class Garb. Remove those uses first.Dismiss');
  });

  it('names the world-side uses that keep a placeholder out', () => {
    expect(line({ reason: 'into', names: ['Eyes'], uses: [{ kind: 'entity', name: 'Molly' }, { kind: 'location', name: 'Fen' }, { kind: 'stat', name: 'Hunger' }] }))
      .toBe('Eyes stays out of Blueprints, because Entity: Molly, Location: Fen and Stat: Hunger use it. A blueprint works only in trait text and blueprint values.Dismiss');
  });

  it('words the group removal for the group, and dismisses', () => {
    const onDismiss = vi.fn();
    render(<BlueprintRefusalNotice refusal={{ reason: 'out', names: ['A'], uses: [{ kind: 'trait', name: 'Paladin' }] }} removing placeholders={[]} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toHaveTextContent('Blueprints stays, because Trait: Paladin uses its blueprints. Remove those uses first.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
