import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MyBugsTab } from './MyBugsTab';
import BugService from '@/services/BugService';
import { scopeFilterValue } from '@/lib/bugPresentation';
import type { BugReport } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const report = (over: Partial<BugReport> = {}): BugReport => ({
  id: 'b1',
  title: 'Save button does nothing',
  category: 'crash',
  body: 'Pressing save just spins.',
  status: 'open',
  reporter: { id: 'u1', username: 'finder' },
  diagnostics: {},
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  unread: false,
  ...over,
});

const stubList = () =>
  vi.spyOn(BugService, 'list').mockResolvedValue({ reports: [report()], total: 1 });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the scope dropdown', () => {
  it('opens on the reader’s own reports', async () => {
    // This tab is where their replies are, and its badge counts their threads — everyone else's is a
    // deliberate switch, not the default.
    const list = stubList();

    render(<MyBugsTab active />);

    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).toMatchObject({ scope: undefined });
  });

  it('sits beside the report button', async () => {
    stubList();

    render(<MyBugsTab active />);

    expect(await screen.findByLabelText('Which reports')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Report a Bug/ })).toBeTruthy();
  });

  // Radix's Select cannot be opened in jsdom, so the mapping it drives is asserted directly; the wiring
  // from the dropdown to the list is one expression on each side of `scopeFilterValue`.
  it('maps its two choices to what the list asks the server for', () => {
    expect(scopeFilterValue('mine')).toBeUndefined();
    expect(scopeFilterValue('all')).toBe('all');
  });
});
