import { useState } from 'react';
import { ChevronRight, FilePlus, FolderPlus, Link2 } from 'lucide-react';
import { ListMenuRow } from '@/components/ListToolbar';
import { useListAdd } from '@/components/listToolbarHooks';
import { MENU_ROW } from '@/components/menuRow';
import { DrillSlide, type SlideFrom } from '@/components/DrillSlide';
import { OwnerList } from '@/managers/OwnerPicker';
import { statBlueprintChoices, type StatLinkWorld } from '@/lib/statLinks';

/** A Blueprint stat row carries no icon. */
const NO_ICON = () => null;

/**
 * The entity Stats tab's + menu: its own adds, then **Link Stat**, a drill-in to the world's Blueprint stats.
 * Lives inside a `ListSearchToolbar` menu; the drill-in's level is menu state.
 */
export function EntityStatsAddMenu({ world, refusal, onAddGroup, onAddStat, onLink }: {
  world: StatLinkWorld;
  /** Why the entity can't link this Blueprint stat; null when it can. */
  refusal: (originalId: string) => string | null;
  onAddGroup: (typed: string) => void;
  onAddStat: (typed: string) => void;
  onLink: (originalId: string) => void;
}) {
  const { add } = useListAdd();
  const [drilled, setDrilled] = useState(false);
  const [from, setFrom] = useState<SlideFrom>(null);
  const drill = (on: boolean) => { setDrilled(on); setFrom(on ? 'right' : 'left'); };
  const choices = statBlueprintChoices(world);
  return (
    <DrillSlide key={drilled ? 'link' : ''} from={from}>
      {drilled ? (
        <OwnerList
          choices={choices}
          label="Blueprints"
          leafIcon={NO_ICON}
          refusal={refusal}
          onPick={(id) => add(() => onLink(id))}
          back={{ label: 'Link Stat', onBack: () => drill(false) }}
        />
      ) : (
        <>
          <ListMenuRow icon={<FolderPlus className="h-4 w-4" />} label="Add Group" onAdd={onAddGroup} />
          <ListMenuRow icon={<FilePlus className="h-4 w-4" />} label="Add Stat" onAdd={onAddStat} />
          {choices.length > 0 && (
            <button type="button" className={MENU_ROW} onClick={() => drill(true)}>
              <Link2 className="h-4 w-4" /> <span className="flex-1">Link Stat</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </button>
          )}
        </>
      )}
    </DrillSlide>
  );
}
