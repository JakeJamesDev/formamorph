import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsingTabsList } from '@/components/ui/collapsing-tabs-list';
import { CollapsingToggleGroup } from '@/components/ui/collapsing-toggle-group';
import { SEGMENT_MOTIONS, SegmentMotionContext, type SegmentMotionName } from '@/components/ui/segmentMotion';
import { Slider } from '@/components/ui/slider';
import { Tabs } from '@/components/ui/tabs';
import { Meta } from '@/components/ui/typography';
import { ENTITY_EDITOR_TABS, type EntityEditorTab } from '@/views/entityPanelTabs';
import { MAIN_MENU_CARD_OPTIONS, type MainMenuCardTab } from '@/views/mainMenuTabs';

const NAMES: Record<SegmentMotionName, string> = {
  baseline: 'Current',
  stretch: 'Stretchy Pill',
  spring: 'Spring Overshoot',
  fade: 'Label Fade, No Slide',
};

/** One candidate's three kinds of strip, each with its own selection, at the shared cell width. */
function CandidateRow({ name, width }: { name: SegmentMotionName; width: number }) {
  const [card, setCard] = useState<MainMenuCardTab>('worlds');
  const [fill, setFill] = useState<EntityEditorTab>('entity');
  const [hug, setHug] = useState<EntityEditorTab>('entity');
  return (
    <SegmentMotionContext.Provider value={SEGMENT_MOTIONS[name]}>
      <section aria-label={NAMES[name]} className="space-y-2 rounded-md border p-3">
        <Meta>{NAMES[name]}</Meta>
        <div className="space-y-2" style={{ width, maxWidth: '100%' }}>
          <CollapsingToggleGroup options={MAIN_MENU_CARD_OPTIONS} value={card} onValueChange={setCard} aria-label={`${NAMES[name]} Toggle Group`} />
          <Tabs value={fill} onValueChange={(v) => setFill(v as EntityEditorTab)}>
            <CollapsingTabsList tabs={ENTITY_EDITOR_TABS} value={fill} aria-label={`${NAMES[name]} Tab Strip`} />
          </Tabs>
          <Tabs value={hug} onValueChange={(v) => setHug(v as EntityEditorTab)}>
            <div className="flex justify-center">
              <CollapsingTabsList hug tabs={ENTITY_EDITOR_TABS} value={hug} aria-label={`${NAMES[name]} Centered Strip`} />
            </div>
          </Tabs>
        </div>
      </section>
    </SegmentMotionContext.Provider>
  );
}

/** Dev-only trial: every motion candidate on the real strips, side by side, at one cell width. */
export function SegmentMotionTrial() {
  const [width, setWidth] = useState(480);
  return (
    <Card role="region" aria-labelledby="segment-motion-trial-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="segment-motion-trial-title" className="text-heading">Segment Motion Trial</CardTitle>
        <CardDescription>Pick tabs to compare how each candidate slides. Drag the width to compare how it folds.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Slider value={[width]} min={140} max={720} step={10} onValueChange={([w]) => setWidth(w)} aria-label="Cell Width" />
          <Meta>{width}px cell</Meta>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {(Object.keys(SEGMENT_MOTIONS) as SegmentMotionName[]).map((name) => <CandidateRow key={name} name={name} width={width} />)}
        </div>
      </CardContent>
    </Card>
  );
}
