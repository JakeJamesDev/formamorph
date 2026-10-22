import { Fragment, type ReactNode } from 'react';
import { statPanelBlocks, type StatLayoutNode } from '@/lib/statGroupTree';
import { PanelSubheader } from './PanelOwnerCard';

/**
 * One owner's stat rows laid out as the author grouped them, the way the Traits tab draws groups: the
 * ungrouped stats first, then each group's own stats under a flat subheader of its path. `nameOf` resolves a
 * group's chips for display.
 */
export function StatGroupSections<T>({ nodes, idOf, nameOf, renderStat }: {
  nodes: StatLayoutNode<T>[];
  idOf: (item: T) => string;
  nameOf: (name: string) => string;
  renderStat: (item: T) => ReactNode;
}) {
  return (
    <>
      {statPanelBlocks(nodes).map((block) => (
        <div key={block.key}>
          {block.path && <PanelSubheader>{block.path.map(nameOf).join(' › ')}</PanelSubheader>}
          {block.items.map((item) => <Fragment key={idOf(item)}>{renderStat(item)}</Fragment>)}
        </div>
      ))}
    </>
  );
}
