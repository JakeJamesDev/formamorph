import { useMemo, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AskPanel } from '@/components/formaquestion/AskParts';
import { useHelpAi } from '@/components/formaquestion/useHelpAi';
import { useHelpChat } from '@/components/formaquestion/useHelpChat';
import { useHelpSettings } from '@/components/formaquestion/useHelpSettings';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { DocsIndex } from '@/lib/docs/docsIndex';
import { createGuide } from '@/lib/formaquestion/guide';

/** The Ask part of the window on the real chat and settings. The calling file `vi.mock`s `useHelpAi`. */
function AskPanelHost({ index }: { index: DocsIndex }) {
  const guide = useMemo(() => createGuide(index), [index]);
  const [settings, changeSettings] = useHelpSettings();
  const ai = useHelpAi(true, settings);
  const chat = useHelpChat(index, ai, settings);
  const [draft, setDraft] = useState('');
  return (
    <AskPanel
      guide={guide}
      chat={chat}
      settings={settings}
      onSettingsChange={changeSettings}
      draft={draft}
      onDraftChange={setDraft}
      onOpen={() => {}}
      onGo={() => {}}
    />
  );
}

export const renderAskPanel = (index: DocsIndex) => render(<TooltipProvider><AskPanelHost index={index} /></TooltipProvider>);

/** Puts a question in the field and sends it, for a test that only needs the text there. */
export async function sendQuestion(question: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask a Question' }), { target: { value: question } });
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}
