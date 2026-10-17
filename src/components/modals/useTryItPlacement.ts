import { useEffect, useRef } from 'react';
import { useElementSize } from '@/lib/useElementSize';
import { TOOL_EDIT_TABS, type ToolEditTab, type ToolFormTab } from './toolsView';

/** Below this editor width in pixels the form and the 22rem Try It column no longer fit side by side. */
export const TRY_IT_COLUMN_MIN_WIDTH = 720;

/**
 * Where Try It sits in the Tool editor. The editor's own width decides, not the window's: the World Editor
 * shares its screen with other panes. A narrow editor gets Try It as a fourth tab, a wide one a column.
 *
 * Try It has no tab while it has a column, so the open tab falls back to the form tab the author left, and
 * the caller's tab follows.
 */
export function useTryItPlacement(editTab: ToolEditTab, onEditTabChange: (tab: ToolEditTab) => void) {
  const [gridRef, { width }] = useElementSize();
  // A zero width is a box not measured yet, which keeps the wide layout.
  const narrow = width > 0 && width < TRY_IT_COLUMN_MIN_WIDTH;
  const lastFormTab = useRef<ToolFormTab>('definition');
  useEffect(() => {
    if (editTab !== 'tryIt') lastFormTab.current = editTab;
  }, [editTab]);
  const stranded = !narrow && editTab === 'tryIt';
  useEffect(() => {
    if (stranded && width > 0) onEditTabChange(lastFormTab.current);
  }, [stranded, width, onEditTabChange]);
  const shownTab: ToolEditTab = stranded ? lastFormTab.current : editTab;
  return {
    gridRef,
    narrow,
    shownTab,
    /** Try It fills the editor in place of the form. */
    tryItOpen: narrow && shownTab === 'tryIt',
    tabs: narrow ? TOOL_EDIT_TABS : TOOL_EDIT_TABS.filter((t) => t.value !== 'tryIt'),
  };
}
