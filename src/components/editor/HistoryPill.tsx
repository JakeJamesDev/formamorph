import { useMemo } from 'react';
import { useWorldHistory } from '@/contexts/worldRecorder';
import { stepLabel } from '@/lib/editorHistoryLabels';
import { useDevRoute } from '@/lib/devRouter';
import { DEV_HISTORY_OPEN } from '@/lib/devRoutes';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { HistoryControls, type HistoryView } from './HistoryControls';

/** The app bar's history control over the open world: the split pill on desktop, one icon on mobile. */
export function HistoryPill({ layout = 'pill', disabled = false }: { layout?: 'pill' | 'icon'; disabled?: boolean }) {
  const { canUndo, canRedo, steps, cursor, saved, undo, redo, jump } = useWorldHistory();
  const rows = useMemo(() => steps.map(stepLabel), [steps]);
  const history = useMemo<HistoryView>(
    () => ({ canUndo, canRedo, rows, cursor, saved, undo, redo, jump }),
    [canUndo, canRedo, rows, cursor, saved, undo, redo, jump],
  );
  // The dev route is null outside DEV builds.
  const openRequest = useDevRoute()?.history === DEV_HISTORY_OPEN;
  return (
    <HistoryControls
      history={history} layout={layout} disabled={disabled} openRequest={openRequest}
      fieldAttributes={targetAttribute('worldEditor', 'history')}
    />
  );
}
