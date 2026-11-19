import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OptionStatRowList } from './OptionStatRowList';
import type { Item, Placement } from '@/types';

const potion: Placement = { id: 'p', where: { kind: 'you' }, quantity: 2, source: { kind: 'item', itemId: 'potion' } };
const world = { stats: [], statGroups: [], entities: [], items: [{ id: 'potion', name: 'Potion' } as Item] };

describe('OptionStatRowList Starting Items', () => {
  it('lists them at new game', () => {
    render(<ul><OptionStatRowList rows={[]} items={[potion]} view={{ world }} resolveText={(t) => t} /></ul>);
    expect(screen.getByText('Potion ×2')).toBeInTheDocument();
  });

  it('leaves them out of the in-play tab, where a switch gives nothing', () => {
    const { container } = render(<div><OptionStatRowList rows={[]} items={[potion]} view={{ world, play: true }} resolveText={(t) => t} /></div>);
    expect(container.textContent).toBe('');
  });
});
