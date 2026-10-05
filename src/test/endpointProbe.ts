import { vi } from 'vitest';

/**
 * Answers the AI reachability probe the game and menu run on entry, so a test never waits on the live
 * hosted endpoint. An empty model list is a reachable server, so the entry order shows the Demo AI dialog.
 * Call it in `beforeEach`; `vi.unstubAllGlobals()` in `afterEach` takes it down.
 */
export function stubReachableEndpoint(): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
}
