import { StrictMode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recordDeletionCancellation } from '@/lib/deletionCancellation';
import { AccountDeletionProvider } from './AccountDeletionContext';

beforeEach(() => sessionStorage.clear());
afterEach(() => cleanup());

describe('the canceled-deletion handoff into the game', () => {
  it('shows the site login result once after a return to /play/', async () => {
    recordDeletionCancellation();
    const first = render(
      <StrictMode>
        <AccountDeletionProvider><p>Game</p></AccountDeletionProvider>
      </StrictMode>,
    );

    expect(await screen.findByRole('heading', { name: 'Deletion Cancelled' })).toBeVisible();

    first.unmount();
    render(<AccountDeletionProvider><p>Game again</p></AccountDeletionProvider>);
    expect(screen.queryByRole('heading', { name: 'Deletion Cancelled' })).toBeNull();
  });
});
