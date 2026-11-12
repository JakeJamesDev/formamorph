import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/typography';
import type { SupporterTier } from '@/types';
import { DEFAULT_ROAD_TIER, roadLevel, useRoadLevelName } from './roadLevels';
import { RoadLevelPicker } from './RoadScene';
import { openRoadScene } from './roadSceneStore';
import { RoadStage } from './RoadStage';
import { useMorphieJelly } from './useMorphieJelly';

/**
 * Formamorph AI's locked state in AI settings: the scene's stage and level picker inline, in place of the plain
 * reason. It opens nothing by itself. See Levels raises the scene and Support on Patreon raises its checklist.
 */
export function LockedPresetPanel({ reason }: { reason: string }) {
  const name = useRoadLevelName();
  const [tier, setTier] = useState<SupporterTier>(DEFAULT_ROAD_TIER);
  const { ref, shown } = useMorphieJelly(tier);
  return (
    <div data-locked-preset className="flex w-full max-w-xl flex-col gap-3">
      <Hint>{reason}</Hint>
      <RoadStage tier={shown} morphieRef={ref} />
      <RoadLevelPicker tier={tier} onPick={setTier} />
      <p className="text-label">{roadLevel(tier).line(name)}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => openRoadScene('locked')}>See Levels</Button>
        <Button onClick={() => openRoadScene('locked', 'checklist')}>Support on Patreon</Button>
      </div>
    </div>
  );
}
