// The docs lookup against the real settings provider: the Output → Tools switch is a Tools setting, and the
// lookup is no Tool, so the help request is the same with the switch on and off.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { useAiSettingsSnapshot } from '@/lib/aiRequest/useAiSettingsSnapshot';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { toolSchema } from '@/lib/tools/toolSchema';
import { sseReply, sseResponse, textTarget } from '@/test/aiTextFixtures';
import { DOCS_LOOKUP } from './docsLookup';
import { askHelp } from './helpSession';

const index = createDocsIndex({ pages: { Traits: '# Traits\n\n## How to Add a Trait\n\n1. Select **Add Trait**.\n' } });
const capable = textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } });

let settings: ReturnType<typeof useSettings>;
let snapshot: AiSettingsSnapshot;
function Probe() {
  settings = useSettings();
  snapshot = useAiSettingsSnapshot();
  return null;
}

/** The body of the help request that the app's current settings produce, on an endpoint that takes function calls. */
async function helpRequestBody(): Promise<Record<string, unknown>> {
  const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => sseResponse(sseReply('Select **Add Trait**.')));
  const events = askHelp({
    question: 'How do I add a trait?', index, fetchImpl: fetchImpl as unknown as typeof fetch,
    snapshot: { ...snapshot, resolveTarget: () => capable },
  });
  for await (const _event of events) { /* run to the end */ }
  return JSON.parse(fetchImpl.mock.calls[0][1].body as string) as Record<string, unknown>;
}

afterEach(() => localStorage.clear());

describe('the Output → Tools switch', () => {
  it('does not change the help request: the lookup function goes out with the switch on and off', async () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);

    act(() => settings.setToolsEnabled(true));
    expect(settings.toolsEnabled).toBe(true);
    const on = await helpRequestBody();

    act(() => settings.setToolsEnabled(false));
    expect(settings.toolsEnabled).toBe(false);
    const off = await helpRequestBody();

    expect(on.tools).toEqual([toolSchema(DOCS_LOOKUP)]);
    expect(off).toEqual(on);
  });
});
