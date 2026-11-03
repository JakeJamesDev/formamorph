import { useState } from 'react';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SUPPORTER_TIERS } from '@/lib/supporterFlair';
import type { SupporterTier } from '@/types';
import { RoadStage } from './RoadStage';
import { DEFAULT_ROAD_TIER, ROAD_LEVELS, ROAD_SAMPLES, ROAD_SHARED_LINE, roadLevel, useRoadLevelName, useRoadLevelPrice } from './roadLevels';
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
 * The full-screen scene that shows what each level of support includes. It stays dark in either theme, so the
 * light reads. Picking a level plays the Jelly on Morphie, and the stage swaps to it at the dip.
 */
export function RoadScene({ initialTier = DEFAULT_ROAD_TIER, onKeepPlaying, onSupport }: {
  initialTier?: SupporterTier;
  onKeepPlaying: () => void;
  onSupport: () => void;
}) {
  const [tier, setTier] = useState(initialTier);
  const { ref, shown } = useMorphieJelly(tier, { enter: true });
  const name = useRoadLevelName();
  const level = roadLevel(shown);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onKeepPlaying(); }}>
      <DialogContent
        surface="road"
        hideClose
        unanimated
        className="dark left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 border-0 p-0 text-foreground shadow-none sm:rounded-none"
      >
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
            <div className="text-center">
              <DialogTitle className="text-heading">How Far Should Your Story Go?</DialogTitle>
              <DialogDescription className="text-body">
                Your support includes Formamorph AI. Every level adds more turns and more room for your world and your story.
              </DialogDescription>
            </div>
            <RoadStage tier={shown} morphieRef={ref} />
            <RoadLevelPicker tier={tier} onPick={setTier} />
            <div className="text-center">
              <p className="text-label">{level.line}</p>
              <p className="text-meta text-muted-foreground">{ROAD_SHARED_LINE}</p>
            </div>
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
          </div>
        </ScrollArea>
        <div className="shrink-0 border-t border-border">
          <DialogFooter className="mx-auto max-w-4xl gap-2 p-4">
            <Button variant="outline" onClick={onKeepPlaying}>Keep Playing</Button>
            <Button onClick={onSupport}>Support on Patreon</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
