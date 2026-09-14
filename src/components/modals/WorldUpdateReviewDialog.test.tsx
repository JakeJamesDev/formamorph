import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorldUpdateReviewDialog } from './WorldUpdateReviewDialog';

afterEach(cleanup);

describe('WorldUpdateReviewDialog', () => {
  it('mounts the linked-content help in its title bar, opening on the Updates tab', () => {
    render(
      <WorldUpdateReviewDialog
        open
        review={{
          world: { id: 'srv-1', name: 'Marsh' },
          localId: 'w1',
          localName: 'Marsh',
          rows: [{ sourceId: 'src-1', name: 'Sedge', rowKind: 'changed', library: 'entity', state: 'linked', itemId: 'copy-1' }],
          previous: {},
        }}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Update This World' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('About Linked Content'));
    expect(screen.getByRole('tab', { name: 'Updates' })).toHaveAttribute('aria-selected', 'true');
  });
});
