// The help request against the real settings provider, through the window's own hooks: the Output → Tools
// switch is a Tools setting that Formaquestion does not read, so the help request is the same with the switch on and off.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useHelpAi } from '@/components/formaquestion/useHelpAi';
import { useHelpChat, type HelpChat } from '@/components/formaquestion/useHelpChat';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { DOCS_LOOKUP } from '@/lib/formaquestion/docsLookup';
import { helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { sseReply, textTarget } from '@/test/aiTextFixtures';
import { stubHelpStream } from '@/test/helpFixtures';

const index = createDocsIndex({ pages: { Traits: '# Traits\n\n## How to Add a Trait\n\n1. Select **Add Trait**.\n' } });
// The one stand-in: the active endpoint's record says it takes function calls. Everything else is the app's.
const capable = textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } });

let settings: ReturnType<typeof useSettings>;
let chat: HelpChat;
// The Mascot is off, so the face call stays out of the offered functions.
function Window({ help = helpSettingsOf({ mascot: false }) }: { help?: HelpSettings }) {
  settings = useSettings();
  const ai = useHelpAi(false, help);
  chat = useHelpChat(index, { ...ai, snapshot: { ...ai.snapshot, resolveTarget: () => capable } }, help);
  return null;
}

/** Asks one question through the window's hooks and returns the body of the answer request it sent. */
async function helpRequestBody(): Promise<Record<string, unknown>> {
  const fetchSpy = stubHelpStream(sseReply('Select **Add Trait**.'));
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
  it('does not change the help request: no lookup function goes out with the switch on or off', async () => {
    render(<SettingsProvider><Window /></SettingsProvider>);

    act(() => settings.setToolsEnabled(true));
    expect(settings.toolsEnabled).toBe(true);
    const on = await helpRequestBody();

    act(() => settings.setToolsEnabled(false));
    expect(settings.toolsEnabled).toBe(false);
    const off = await helpRequestBody();

    expect(on.tools).toBeUndefined();
    expect(off).toEqual(on);
  });

  it('does not change the help request with the guide lookup on: the lookup function goes out with the switch on or off', async () => {
    render(<SettingsProvider><Window help={helpSettingsOf({ lookup: true, mascot: false })} /></SettingsProvider>);

    act(() => settings.setToolsEnabled(true));
    const on = await helpRequestBody();

    act(() => settings.setToolsEnabled(false));
    expect(settings.toolsEnabled).toBe(false);
    const off = await helpRequestBody();

    expect((on.tools as { function: { name: string } }[]).map((tool) => tool.function.name)).toEqual([DOCS_LOOKUP.name]);
    expect(off).toEqual(on);
  });
});
