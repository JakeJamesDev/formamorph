import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { PresetHeaderAction } from '@/lib/presetHeaderActions';
import { PresetHeaderMenu } from './PresetHeaderMenu';

/**
 * A preset header: a label, the preset select, and the actions on the active preset. At `md` and up the
 * actions are icon buttons, destructive left of the select and file actions right. Below `md` one ⋯ menu
 * holds them all.
 */
export function PresetHeader({ label, select, actions, testId }: {
  label: string;
  select: ReactNode;
  /** In menu order, as `presetHeaderActions` builds them. */
  actions: PresetHeaderAction[];
  testId?: string;
}) {
  const [confirming, setConfirming] = useState<PresetHeaderAction | null>(null);
  // The confirm is controlled, so it returns focus to what opened it by hand.
  const opener = useRef<Element | null>(null);
  // An action with a confirm opens the dialog; the dialog runs the action.
  const gated = actions.map((action) => (action.confirm
    ? { ...action, run: () => { opener.current = document.activeElement; setConfirming(action); } }
    : action));
  const iconButton = (action: PresetHeaderAction) => (
    <Tip key={action.key} tip={action.label}>
      <Button variant="ghost" size="icon" className="hidden h-9 w-9 shrink-0 md:inline-flex" onClick={action.run}>
        <action.icon className="h-4 w-4" aria-hidden />
      </Button>
    </Tip>
  );
  return (
    <div className="flex flex-shrink-0 items-center gap-2" data-testid={testId}>
      <span className="text-helper text-muted-foreground">{label}</span>
      {/* Mirrors the menu around the select: destructive actions outermost on the left. */}
      {gated.filter((a) => a.section === 'destructive').reverse().map(iconButton)}
      {select}
      {gated.filter((a) => a.section === 'file').map(iconButton)}
      <PresetHeaderMenu actions={gated} className="md:hidden" />
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
