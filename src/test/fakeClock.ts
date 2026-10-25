import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';

/** Runs user-event on a fake clock. Testing Library releases its zero-delay drain only for a `jest` global, so one stands in. */
export async function onFakeClock(action: (user: ReturnType<typeof userEvent.setup>) => Promise<void>) {
  const scope = globalThis as { jest?: unknown };
  scope.jest = { advanceTimersByTime: vi.advanceTimersByTime };
  try {
    await action(userEvent.setup({ advanceTimers: vi.advanceTimersByTime }));
  } finally {
    delete scope.jest;
  }
}
