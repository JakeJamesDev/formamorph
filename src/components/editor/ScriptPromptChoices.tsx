import { useSyncExternalStore } from 'react';
import { ChoiceRows } from '@/components/game/ChoiceRows';
import type { PendingPrompt, ScriptPromptStore } from '@/lib/scriptPrompts';

/** The rows a choice-row prompt offers: Yes and No for a confirm, else the ask's options. */
const rowsOf = ({ request }: PendingPrompt): string[] =>
  (request.kind === 'confirm' ? ['Yes', 'No'] : request.kind === 'ask' ? [...request.options] : []);

/**
 * An editor run's open prompt as the game's choice rows, the question above them (Q17, Q24). The oldest prompt
 * shows; Escape closes it, which fails its script as canceled (Q15).
 */
export function ScriptPromptChoices({ store }: { store: ScriptPromptStore }) {
  const [prompt] = useSyncExternalStore(store.subscribe, store.pending);
  if (!prompt) return null;
  const { id, request } = prompt;
  const answer = (index: number) => store.answer(id, request.kind === 'confirm' ? index === 0 : index);
  return (
    <div
      role="group"
      aria-label="Script Prompt"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        store.cancel(id);
      }}
    >
      <p className="text-body">{'question' in request ? request.question : ''}</p>
      <ChoiceRows
        // A new prompt draws fresh rows.
        key={id}
        choices={rowsOf(prompt)}
        showContinue={false}
        disabled={false}
        isSelected={() => false}
        continueSelected={false}
        choicePress={(_choice, index) => ({ onClick: () => answer(index) })}
        actions={[]}
      />
    </div>
  );
}
