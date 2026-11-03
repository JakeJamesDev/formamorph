import { vi } from 'vitest';

/**
 * Answers the AI reachability probe the game and menu run on entry, so a test never waits on the live
 * hosted endpoint or a developer's local one. An empty model list is a reachable server, so no setup gate
 * opens. `renderGameViewer` installs it for every test; `vi.unstubAllGlobals()` takes it down.
 */
export function stubReachableEndpoint(): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
}
