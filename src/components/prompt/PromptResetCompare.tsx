import { useRef, useState } from 'react';
import { GitCompare, RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import type { SurfaceIdName } from '@/components/ui/surface';
import { Tip } from '@/components/ui/tooltip';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { cn } from '@/lib/utils';
import { PromptCompareDialog } from './PromptCompareDialog';
import { RESET_COMPARE_COPY } from './promptResetCompareCopy';

/**
 * Reset then Compare for one editable prompt, right-aligned. Both disable while the text equals the
 * default. The caller hides the pair on a built-in preset.
 */
export function PromptResetCompare({ name, value, defaultValue, onReset, vocabulary, surface, size = 'default', className }: {
  /** The full noun of the prompt, such as "Narration Prompt". The confirm and the compare title name it. */
  name: string;
  value: string;
  defaultValue: string;
  onReset: () => void;
  vocabulary: ChipVocabulary;
  /** The surface the compare dialog reports while open. */
  surface: SurfaceIdName;
  /** `sm` fits a label row; `default` fits a modal footer. */
  size?: 'default' | 'sm';
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [comparing, setComparing] = useState(false);
  const resetRef = useRef<HTMLButtonElement>(null);
  const edited = value !== defaultValue;
  const buttonClass = size === 'sm' ? 'h-7 gap-1 px-2' : 'gap-2';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const { reset, compare } = RESET_COMPARE_COPY;
  return (
    <div className={cn('flex items-center justify-end gap-2', className)}>
      <Tip tip={reset.hint}>
        <Button
          ref={resetRef} variant="outline" size={size} className={buttonClass}
          aria-label={reset.title(name)} disabled={!edited} onClick={() => setConfirming(true)}
        >
          <RotateCcw className={iconClass} aria-hidden /> {reset.label}
        </Button>
      </Tip>
      <Tip tip={compare.hint}>
        <Button
          variant="outline" size={size} className={buttonClass}
          aria-label={compare.name(name)} disabled={!edited} onClick={() => setComparing(true)}
        >
          <GitCompare className={iconClass} aria-hidden /> {compare.label}
        </Button>
      </Tip>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={reset.title(name)}
        description={reset.confirm(name)}
        onConfirm={onReset}
        // A confirmed reset disables the button, so focus has nowhere to go but the default.
        onCloseAutoFocus={(event) => { if (resetRef.current && !resetRef.current.disabled) { event.preventDefault(); resetRef.current.focus(); } }}
      />
      <PromptCompareDialog
        open={comparing && edited}
        onOpenChange={setComparing}
        name={name}
        defaultText={defaultValue}
        text={value}
        vocabulary={vocabulary}
        surface={surface}
      />
    </div>
  );
}
