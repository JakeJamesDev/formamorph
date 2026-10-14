import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TraitDropRefusalNotice } from './TraitTree';

describe('TraitDropRefusalNotice', () => {
  it('names the entity that already has a trait a refused link points at', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'duplicate', name: 'Paladin', owner: 'Albus' }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Albus already has Paladin.');
  });

  it('names the one entity that keeps a linked Blueprint in Blueprints', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'blueprint-linked', name: 'Paladin', owners: ['Albus'] }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Paladin stays in Blueprints, because Albus links to it or to something in it. Remove those links first.',
    );
  });

  it('lists every entity that keeps a linked Blueprint in Blueprints', () => {
    render(<TraitDropRefusalNotice refusal={{ reason: 'blueprint-linked', name: 'Classes', owners: ['Albus', 'Bo', 'Cy'] }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Classes stays in Blueprints, because Albus, Bo and Cy link to it or to something in it. Remove those links first.',
    );
  });

  it('names what keeps a read trait out of Blueprints', () => {
    const { unmount } = render(<TraitDropRefusalNotice refusal={{ reason: 'into-blueprints', name: 'Brave', reader: { kind: 'requires', trait: "Ash's Bold" } }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Brave stays out of Blueprints, because Ash's Bold requires it. Remove that requirement first.",
    );
    unmount();
    render(<TraitDropRefusalNotice refusal={{ reason: 'into-blueprints', name: 'Brave', reader: { kind: 'readBy', stat: 'Mood' } }} placeholders={[]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Brave stays out of Blueprints, because the code of Mood reads it.');
  });

  it('dismisses', () => {
    const onDismiss = vi.fn();
    render(<TraitDropRefusalNotice refusal={{ reason: 'root', name: 'Newcomer' }} placeholders={[]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
