import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TraitDropRefusalNotice } from './TraitTree';

describe('TraitDropRefusalNotice', () => {
  it('names the entity that already has a trait a refused link points at', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'duplicate', name: 'Paladin', bearer: 'Albus' }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Albus already has Paladin.');
  });

  it('names the one entity that keeps a linked Blueprint in Blueprints', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'blueprint-linked', name: 'Paladin', bearers: ['Albus'] }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Paladin stays in Blueprints, because Albus links to it or to something in it. Remove those links first.',
    );
  });

  it('lists every entity that keeps a linked Blueprint in Blueprints', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'blueprint-linked', name: 'Classes', bearers: ['Albus', 'Bo', 'Cy'] }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Classes stays in Blueprints, because Albus, Bo and Cy link to it or to something in it. Remove those links first.',
    );
  });

  it('dismisses', () => {
    const onDismiss = vi.fn();
    render(<TraitDropRefusalNotice refusal={{ reason: 'root', name: 'Newcomer' }} placeholders={[]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
