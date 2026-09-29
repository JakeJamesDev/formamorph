import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';

/** The header button that collapses every card of a list, or expands them all once none is open. */
export function CollapseAllButton({ anyOpen, noun, onClick }: {
  anyOpen: boolean;
  /** What the list holds, plural: "values" reads "Collapse all values". */
  noun: string;
  onClick: () => void;
}) {
  return (
    <Tip tip={anyOpen ? `Collapse all ${noun}` : `Expand all ${noun}`}>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onClick}>
        {anyOpen ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
      </Button>
    </Tip>
  );
}
