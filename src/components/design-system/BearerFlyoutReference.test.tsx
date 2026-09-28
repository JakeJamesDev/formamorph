import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { BearerFlyoutReference } from './BearerFlyoutReference';

const level = (label: string) => [...screen.getByRole('group', { name: label }).children].map((row) => row.textContent);
const row = (label: string, name: string) => within(screen.getByRole('group', { name: label })).getByRole('button', { name });

describe('BearerFlyoutReference', () => {
  it('drills from the menu into entity group levels and adds to the sample without a world', () => {
    render(<BearerFlyoutReference />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Traits' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Trait to Entity' }));
    expect(level('Entities')).toEqual(['Heroes', 'Villains', 'Sam', 'Newcomer']);
    fireEvent.click(row('Entities', 'Heroes'));
    fireEvent.click(row('Entities', 'City Guard'));
    fireEvent.click(row('Entities', 'Captain Tomas Wexley of the Lower Ward'));
    expect(screen.getByRole('status')).toHaveTextContent('The sample added a trait to Captain Tomas Wexley of the Lower Ward.');
  });

  it('links a bearer in place, keeping held bearers checked and disabled', () => {
    render(<BearerFlyoutReference />);
    fireEvent.click(screen.getByRole('button', { name: 'Link To…' }));
    expect(level('Link To')).toEqual(['Heroes', 'Villains', 'Sam', 'Newcomer']);
    expect(row('Link To', 'Newcomer').querySelector('.lucide-circle-user-round')).not.toBeNull();
    expect(row('Link To', 'Sam').querySelector('.lucide-circle-user-round')).toBeNull();
    fireEvent.click(row('Link To', 'Heroes'));
    expect(row('Link To', 'Albus')).toBeDisabled();
    fireEvent.click(row('Link To', 'Mira'));
    expect(row('Link To', 'Mira')).toBeDisabled();
    expect(screen.getByText('The sample links Albus, Mira.')).toBeInTheDocument();
  });
});
