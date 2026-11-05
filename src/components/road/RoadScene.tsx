import { useState } from 'react';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, dialogFullHeight, dialogSafeArea } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Meta } from '@/components/ui/typography';
import { SUPPORTER_TIERS } from '@/lib/supporterFlair';
import type { SupporterTier } from '@/types';
import { checklistFireTier } from '@/lib/supportChecklist';
import type { RoadSceneView } from './roadSceneStore';
import { RoadStage } from './RoadStage';
import { SupportChecklist } from './SupportChecklist';
import type { SupportChecklistModel } from './useSupportChecklist';
import { DEFAULT_ROAD_TIER, ROAD_LEVELS, ROAD_SAMPLES, roadLevel, useRoadLevelName, useRoadLevelPrice } from './roadLevels';
import { useMorphieJelly } from './useMorphieJelly';

const isTier = (value: string): value is SupporterTier => (SUPPORTER_TIERS as readonly string[]).includes(value);

/** Picks a level. Each option shows its name and, when the server gave one, its price. */
export function RoadLevelPicker({ tier, onPick }: { tier: SupporterTier; onPick: (tier: SupporterTier) => void }) {
  const name = useRoadLevelName();
  const price = useRoadLevelPrice();
  return (
    <ToggleGroup
      type="single"
      aria-label="Level"
      value={tier}
      // A press on the picked level clears a single toggle group, and a level is always picked.
      onValueChange={(next) => { if (isTier(next)) onPick(next); }}
      className="grid h-auto w-full grid-cols-3 gap-1"
    >
      {ROAD_LEVELS.map((level) => {
        const levelPrice = price(level.tier);
        return (
          <ToggleGroupItem key={level.tier} value={level.tier} className="flex h-auto min-w-0 flex-col gap-0.5 whitespace-normal">
            <span className="max-w-full truncate">{name(level.tier)}</span>
            {levelPrice && <span className="text-meta font-normal">{levelPrice}</span>}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

function SampleBlock({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className={accent ? 'mb-1 text-meta font-medium text-foreground' : 'mb-1 text-meta font-medium text-muted-foreground'}>{label}</div>
      <div className="text-body"><MarkdownRenderer text={text} /></div>
    </div>
  );
}

/**
 * The full-screen scene that shows what each level of support includes. The page follows the theme, and the stage
 * stays dark so the light reads. Picking a level plays the Jelly on Morphie, and the stage swaps to it at the dip.
 */
export function RoadScene({ open = true, initialTier = DEFAULT_ROAD_TIER, initialView = 'levels', checklist, onKeepPlaying }: {
  open?: boolean;
  initialTier?: SupporterTier;
  initialView?: RoadSceneView;
  checklist: SupportChecklistModel;
  onKeepPlaying: () => void;
}) {
  const [tier, setTier] = useState(initialTier);
  const [view, setView] = useState(initialView);
  const checklistView = view === 'checklist';
  const allDone = checklistView && checklist.main.action === 'back';
  // The Jelly plays on each change of pose: a picked level, or one more finished step.
  const pose = checklistView ? `checklist:${checklist.doneCount}` : `levels:${tier}`;
  const { ref, shown } = useMorphieJelly(pose, { enter: true });
  const name = useRoadLevelName();
  const [shownView, shownValue = ''] = shown.split(':');
  const shownTier = shownView === 'checklist'
    ? checklistFireTier(Number(shownValue))
    : isTier(shownValue) ? shownValue : tier;
  const level = roadLevel(shownTier);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onKeepPlaying(); }}>
      <DialogContent
        surface="road"
        placement="own"
        hideClose
        unanimated
        className={cn(
          'left-0 flex w-screen max-w-none translate-x-0 flex-col gap-0 border-0 p-0 text-foreground shadow-none duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 sm:rounded-none',
          dialogFullHeight,
          dialogSafeArea,
        )}
      >
        <ScrollArea className="min-h-0 flex-1 [[data-window-overlay]_&]:mt-[var(--header-line)]">
          <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
            <div className="text-center">
              <DialogTitle className="text-heading">
                {allDone ? 'You’re All Set' : checklistView ? 'Set Up Formamorph AI' : 'Better Narration for Your Stories'}
              </DialogTitle>
              <DialogDescription className="text-body">
                {allDone
                  ? 'Formamorph AI is on for your stories. Thank you for supporting Formamorph.'
                  : checklistView
                  ? 'Four steps. Each one shows when it’s done, and you can leave and come back.'
                  : 'Your support keeps Formamorph’s updates coming, and it includes Formamorph AI: sharper narration and more consistent characters, with no setup. Higher levels add more turns each week, then more room for large worlds.'}
              </DialogDescription>
            </div>
            <RoadStage tier={shownTier} morphieRef={ref} />
            {checklistView ? <SupportChecklist checklist={checklist} /> : (
              <>
                <RoadLevelPicker tier={tier} onPick={setTier} />
                <p className="text-center text-label">{level.line(name)}</p>
                <div>
                  <p className="mb-1 text-label font-medium">Your support includes:</p>
                  <ul className="list-disc space-y-1 pl-5 text-body">
                    {level.perks(name).map((perk) => <li key={perk}>{perk}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-label font-medium">Your Action</p>
                  <p className="mb-2 text-body">{ROAD_SAMPLES.action}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SampleBlock {...ROAD_SAMPLES.demo} />
                    <SampleBlock {...ROAD_SAMPLES.hosted} accent />
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
        <div className="shrink-0 border-t border-border">
          {!checklistView && (
            <Meta as="p" className="mx-auto max-w-4xl px-4 pt-3 text-center">
              Whatever the perks are worth to you, every pledge helps keep the updates coming
            </Meta>
          )}
          <DialogFooter className="mx-auto max-w-4xl gap-2 p-4">
            {checklistView ? (
              <>
                {!allDone && <Button variant="outline" onClick={onKeepPlaying}>Finish Later</Button>}
                <Button disabled={checklist.main.busy} onClick={checklist.main.run}>{checklist.main.label}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onKeepPlaying}>Keep Playing</Button>
                <Button onClick={() => setView('checklist')}>Support on Patreon</Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
