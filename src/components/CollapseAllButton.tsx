import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import type { ListCollapse } from '@/components/treeCollapse';

/** The header button that collapses every card of a list, or expands them all once none is open. */
export function CollapseAllButton({ anyOpen, noun, onClick, disabled = false }: {
  anyOpen: boolean;
  /** What the list holds, plural: "values" reads "Collapse all values". */
  noun: string;
  onClick: () => void;
  /** Shown but inert, while the list has nothing to collapse. */
  disabled?: boolean;
}) {
  return (
    <Tip tip={anyOpen ? `Collapse all ${noun}` : `Expand all ${noun}`}>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onClick} disabled={disabled}>
        {anyOpen ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
      </Button>
    </Tip>
  );
}

/** Collapse All for a tree: closes every parent row when any is open, opens them all otherwise. */
export function TreeCollapseAllButton({ collapse, shown }: {
  collapse: ListCollapse;
  /** Whether the host draws the tree right now; a flat match list in its place disables the button. */
  shown: boolean;
}) {
  const parents = collapse.parents ?? [];
  const { value, update } = collapse.state;
  const anyOpen = !parents.length || parents.some((id) => !value.collapsed.has(id));
  return (
    <CollapseAllButton
      anyOpen={anyOpen}
      noun={collapse.noun}
      disabled={!shown || !parents.length}
      onClick={() => update((prev) => ({ ...prev, collapsed: new Set(anyOpen ? parents : []) }))}
    />
  );
}
