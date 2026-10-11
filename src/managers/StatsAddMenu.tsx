import { useState, type ReactNode } from 'react';
import { ChevronRight, Copy, FilePlus, FolderPlus, Link2 } from 'lucide-react';
import { ListMenuRow } from '@/components/ListToolbar';
import { useListAdd } from '@/components/listToolbarHooks';
import { MENU_ROW } from '@/components/menuRow';
import { DrillSlide, type SlideFrom } from '@/components/DrillSlide';
import { BearerList } from '@/managers/BearerPicker';
import { statBlueprintChoices, type StatLinkWorld } from '@/lib/statLinks';

/** What a Blueprint drill-in does with the picked stat. */
type BlueprintAction = 'link' | 'copy';

const ACTION_LABEL: Record<BlueprintAction, string> = { link: 'Link Stat', copy: 'Copy Stat' };

/** A Blueprint stat row carries no icon. */
const NO_ICON = () => null;

/**
 * The entity Stats tab's + menu: its own adds, then **Link Stat** and **Copy Stat**, each a drill-in to the
 * world's Blueprint stats. Lives inside a `ListSearchToolbar` menu; the drill-in's level is menu state.
 */
export function EntityStatsAddMenu({ world, linked, onAddGroup, onAddStat, onLink, onCopy }: {
  world: StatLinkWorld;
  /** Whether the entity already links this Blueprint. */
  linked: (originalId: string) => boolean;
  onAddGroup: (typed: string) => void;
  onAddStat: (typed: string) => void;
  onLink: (originalId: string) => void;
  onCopy: (originalId: string) => void;
}) {
  const { add } = useListAdd();
  const [drilled, setDrilled] = useState<BlueprintAction | null>(null);
  const [from, setFrom] = useState<SlideFrom>(null);
  const drill = (action: BlueprintAction | null) => { setDrilled(action); setFrom(action ? 'right' : 'left'); };
  const choices = statBlueprintChoices(world);
  const drillRow = (icon: ReactNode, action: BlueprintAction) => (
    <button type="button" className={MENU_ROW} onClick={() => drill(action)}>
      {icon} <span className="flex-1">{ACTION_LABEL[action]}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
    </button>
  );
  return (
    <DrillSlide key={drilled ?? ''} from={from}>
      {drilled ? (
        <BearerList
          choices={choices}
          label="Blueprints"
          leafIcon={NO_ICON}
          held={drilled === 'link' ? linked : undefined}
          onPick={(id) => add(() => (drilled === 'link' ? onLink(id) : onCopy(id)))}
          back={{ label: ACTION_LABEL[drilled], onBack: () => drill(null) }}
        />
      ) : (
        <>
          <ListMenuRow icon={<FolderPlus className="h-4 w-4" />} label="Add Group" onAdd={onAddGroup} />
          <ListMenuRow icon={<FilePlus className="h-4 w-4" />} label="Add Stat" onAdd={onAddStat} />
          {choices.length > 0 && drillRow(<Link2 className="h-4 w-4" />, 'link')}
          {choices.length > 0 && drillRow(<Copy className="h-4 w-4" />, 'copy')}
        </>
      )}
    </DrillSlide>
  );
}
