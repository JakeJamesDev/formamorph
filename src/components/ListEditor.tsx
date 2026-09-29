import type { ReactNode } from 'react';
import { ListDetail } from '@/components/ui/list-detail';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useListEditor, type ListEditorAdapter } from '@/components/listEditorHooks';

/** Side by side splits the pane into list and detail; stacked pushes the detail over the list. */
export type ListEditorLayout = 'sideBySide' | 'stacked';

/**
 * The List Editor in a panel or modal: the toolbar above the scrolled list, and the detail beside it or
 * pushed over it. A host that lays the parts out itself uses `useListEditor` instead.
 */
export function ListEditor({ adapter, layout, selectedId, onSelect, backLabel, toolbarChildren, detailHeader }: {
  adapter: ListEditorAdapter;
  layout: ListEditorLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The list's name; the pushed detail's arrow reads "Back to <backLabel>". */
  backLabel: string;
  /** Sits in the toolbar row after the +. */
  toolbarChildren?: ReactNode;
  /** Tops the detail pane with or without a selection: the host's placeholder palette. */
  detailHeader?: ReactNode;
}) {
  const parts = useListEditor(adapter, { selectedId, onSelect });
  return (
    <ListDetail
      stacked={layout === 'stacked'}
      showDetail={parts.showDetail}
      onBack={parts.onBack}
      backLabel={backLabel}
      scrollList={false}
      scrollDetail={!parts.fills}
      detailFooter={parts.footer}
      list={
        <div className="flex h-full min-h-0 flex-col">
          {parts.toolbar('p-2 pb-0', { children: toolbarChildren })}
          {parts.ownsSlot ? <div className="min-h-0 flex-1">{parts.list}</div> : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-2">{parts.list}</div>
            </ScrollArea>
          )}
        </div>
      }
      detail={detailHeader ? <>{detailHeader}{parts.detail}</> : parts.detail}
    />
  );
}
