import { PromptCompareDialog } from '@/components/prompt/PromptCompareDialog';
import { HELP_CHIP, helpChipVocabulary } from '@/lib/formaquestion/helpChips';

const VOCABULARY = helpChipVocabulary(Object.values(HELP_CHIP));

/** A custom help prompt against the current default text. It opens over Formaquestion Settings. */
export function HelpPromptCompareDialog({ open, onOpenChange, label, defaultText, text }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The name of the prompt, as the rail shows it. */
  label: string;
  defaultText: string;
  text: string;
}) {
  return (
    <PromptCompareDialog
      open={open}
      onOpenChange={onOpenChange}
      name={`${label} Prompt`}
      defaultText={defaultText}
      text={text}
      vocabulary={VOCABULARY}
      surface="formaquestionCompare"
    />
  );
}
