import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import type { TargetAttribute } from '@/lib/surface/surfaceTargets';
import type { PresetHeaderAction } from '@/lib/presetHeaderActions';
import { PresetHeaderMenu } from './PresetHeaderMenu';

/**
 * A preset header: a label, the preset select, and the actions on the active preset. At `md` and up the
 * actions are icon buttons, destructive left of the select and file actions right. Below `md` one ⋯ menu
 * holds them all. A caller that picks the preset elsewhere passes a `heading` instead of a label and select.
 * A `layout` of `wide` or `narrow` pins one form instead of following the viewport.
 */
export function PresetHeader({ actions, testId, layout = 'auto', disabled, target, ...lead }: {
  /** In menu order, as `presetHeaderActions` builds them. */
  actions: PresetHeaderAction[];
  testId?: string;
  /** Disables the action buttons and the ⋯ menu. The caller disables the `select` it passes. */
  disabled?: boolean;
  /** `auto` follows the viewport. `wide` and `narrow` pin one form, for a reference that shows both at once. */
  layout?: 'auto' | 'wide' | 'narrow';
  /** Marks the header as a Take Me There target. */
  target?: TargetAttribute;
} & ({ label: string; select: ReactNode; heading?: never } | { heading: string; label?: never; select?: never })) {
  const [confirming, setConfirming] = useState<PresetHeaderAction | null>(null);
  // The confirm is controlled, so it returns focus to what opened it by hand.
  const opener = useRef<Element | null>(null);
  // An action with a confirm opens the dialog; the dialog runs the action.
  const gated = actions.map((action) => (action.confirm
    ? { ...action, run: () => { opener.current = document.activeElement; setConfirming(action); } }
    : action));
  // `auto` draws both forms and lets the breakpoint hide one; a pinned layout draws only its own.
  const auto = layout === 'auto';
  const showIcons = layout !== 'narrow';
  const showMenu = layout !== 'wide';
  const iconButton = (action: PresetHeaderAction) => (
    <Tip key={action.key} tip={action.tip ?? action.label}>
      <Button variant="ghost" size="icon" aria-label={action.label} className={cn('h-9 w-9 shrink-0', auto && 'hidden md:inline-flex')} disabled={disabled} onClick={action.run}>
        <action.icon className="h-4 w-4" aria-hidden />
      </Button>
    </Tip>
  );
  const icons = (section: PresetHeaderAction['section']) => (showIcons ? gated.filter((a) => a.section === section) : []);
  return (
    <div className="flex flex-shrink-0 items-center gap-2" data-testid={testId} {...target}>
      {lead.heading === undefined
        ? <span className="shrink-0 text-helper text-muted-foreground">{lead.label}</span>
        : <h3 className="text-label mr-auto min-w-0 truncate">{lead.heading}</h3>}
      {/* Mirrors the menu around the select: destructive actions outermost on the left. */}
      {icons('destructive').reverse().map(iconButton)}
      {lead.select}
      {icons('file').map(iconButton)}
      {showMenu && <PresetHeaderMenu actions={gated} disabled={disabled} className={auto ? 'md:hidden' : undefined} />}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => { if (!open) setConfirming(null); }}
        onCloseAutoFocus={(event) => {
          const target = opener.current;
          opener.current = null;
          if (!(target instanceof HTMLElement) || !target.isConnected) return;
          event.preventDefault();
          target.focus();
        }}
        title={confirming?.confirm?.title}
        description={confirming?.confirm?.description}
        onConfirm={() => confirming?.run()}
      />
    </div>
  );
}
