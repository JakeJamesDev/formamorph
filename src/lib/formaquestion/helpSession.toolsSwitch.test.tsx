// The docs lookup against the real settings provider, through the window's own hooks: the Output → Tools
// switch is a Tools setting, and the lookup is no Tool, so the help request is the same with the switch on and off.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useHelpAi } from '@/components/formaquestion/useHelpAi';
import { useHelpChat, type HelpChat } from '@/components/formaquestion/useHelpChat';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { toolSchema } from '@/lib/tools/toolSchema';
import { sseReply, stubStream, textTarget } from '@/test/aiTextFixtures';
import { DOCS_LOOKUP } from './docsLookup';

const index = createDocsIndex({ pages: { Traits: '# Traits\n\n## How to Add a Trait\n\n1. Select **Add Trait**.\n' } });
// The one stand-in: the active endpoint's record says it takes function calls. Everything else is the app's.
const capable = textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } });

let settings: ReturnType<typeof useSettings>;
let chat: HelpChat;
function Window() {
  settings = useSettings();
  const ai = useHelpAi(false);
  chat = useHelpChat(index, { ...ai, snapshot: { ...ai.snapshot, resolveTarget: () => capable } });
  return null;
}

/** Asks one question through the window's hooks and returns the body of the request it sent. */
async function helpRequestBody(): Promise<Record<string, unknown>> {
  const fetchSpy = stubStream(sseReply('Select **Add Trait**.'));
  act(() => chat.clear());
  act(() => chat.ask('How do I add a trait?'));
  await waitFor(() => expect(chat.exchanges.at(-1)?.status).toBe('answered'));
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  return JSON.parse(fetchSpy.mock.calls[0][1].body as string) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('the Output → Tools switch', () => {
  it('does not change the help request: the lookup function goes out with the switch on and off', async () => {
    render(<SettingsProvider><Window /></SettingsProvider>);

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
