import { useState, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta } from '@/components/ui/typography';
import { bubbleActions, choicesActions, type BubbleAction, type BubbleActionHandlers } from '@/lib/bubbleActions';
import { ChoiceRows } from '@/components/game/ChoiceRows';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { ScenePlate } from '@/components/game/ScenePlate';
import { TurnCard } from '@/components/game/TurnCard';

const plateArt = (sky: string, sea: string) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><rect width="320" height="320" fill="${sky}"/><circle cx="232" cy="92" r="34" fill="#f4e3b1"/><path d="M0 214h320v106H0z" fill="${sea}"/><path d="M142 214V96l18-22 18 22v118z" fill="#1d2433"/></svg>`,
)}`;

const SAMPLE_IMAGES = [plateArt('#5b4a6e', '#2c3a55'), plateArt('#33507a', '#1f2f48')];

const LATEST_NARRATION = `The keeper sets the lamp on the sill and turns to you. "You came by the marsh road," she says. "Nobody takes the marsh road after dark."

Below the window, the tide pulls at the *eastern stair*.`;

const PAST_NARRATION = `The door gives on the second push. Dust lies on every step, but one set of prints goes up. "Hello?" you call. Nothing answers.`;

const LATEST_CHOICES = [
  'Ask her why the lamp stays lit',
  'Say **"I saw a light on the water"** and watch her face',
  'Look past her at the stair',
];

const PAST_CHOICES = ['Follow the prints up the stair', 'Call out before you go in'];

const noop = () => {};
const NO_HANDLERS: BubbleActionHandlers = {
  regenerate: noop, regenerateStats: noop, sceneImage: noop, sceneTags: noop, edit: noop,
  textToSpeech: noop, regenerateAudio: noop, copy: noop, rewind: noop,
};

/** Each action reports its own label, so a click shows that the row and the menu run the same action. */
const reporting = (actions: BubbleAction[], report: (label: string) => void): BubbleAction[] =>
  actions.map((action) => ({ ...action, run: () => report(action.label) }));

const IDLE = {
  live: false,
  busy: false,
  canRegenStats: true,
  sceneImagesAvailable: true,
  sceneJob: null,
  ttsLoaded: false,
  ttsGenerating: false,
} as const;

export function NarrationTurnReference() {
  const [images, setImages] = useState(SAMPLE_IMAGES);
  const [staged, setStaged] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const latestActions = reporting(bubbleActions({ ...IDLE, isLatest: true, hasImage: images.length > 0 }, NO_HANDLERS), setLastAction);
  const pastActions = reporting(bubbleActions({ ...IDLE, isLatest: false, hasImage: false }, NO_HANDLERS), setLastAction);
  const latestChoicesActions = reporting(
    choicesActions({ canRegenerate: true, hasChoices: true, busy: false, regenerating: false }, noop),
    setLastAction,
  );

  // A click stages one choice; Ctrl or Cmd with a click appends it.
  const choicePress = (choice: string) => ({
    onClick: (event: MouseEvent) =>
      setStaged((now) => (event.ctrlKey || event.metaKey ? [...now.filter((c) => c !== choice), choice] : [choice])),
  });

  return (
    <Card role="region" aria-labelledby="narration-turn-title">
      <CardHeader>
        <CardTitle id="narration-turn-title" className="text-heading">
          Narration Turn
        </CardTitle>
        <CardDescription>
          These are the production Turn Card, Scene Plate, and choice rows, with the production action lists.
          Right-click a card for its menu. Point at the image, or press Tab past it, for its controls.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="narration-turn-latest" className="grid content-start gap-3">
          <div className="space-y-1">
            <h3 id="narration-turn-latest" className="text-label font-semibold">Latest Page</h3>
            <Meta>The plate, the narration, and the full action row. The rows stage a choice.</Meta>
          </div>
          <div>
            <TurnCard actions={latestActions} turnNumber={12}>
              <ScenePlate
                turnId="reference-latest"
                images={images}
                onDelete={(index) => setImages((now) => now.filter((_, i) => i !== index))}
                className="mb-3"
              />
              <MarkdownRenderer text={LATEST_NARRATION} dialogue />
            </TurnCard>
            <ChoiceRows
              choices={LATEST_CHOICES}
              showContinue
              disabled={false}
              isSelected={(choice) => staged.includes(choice)}
              continueSelected={false}
              choicePress={choicePress}
              actions={latestChoicesActions}
            />
          </div>
        </section>

        <section aria-labelledby="narration-turn-past" className="grid content-start gap-3">
          <div className="space-y-1">
            <h3 id="narration-turn-past" className="text-label font-semibold">Past Page</h3>
            <Meta>No image, so no plate. The row has Rewind to Here, and the rows show the choice taken.</Meta>
          </div>
          <div>
            <TurnCard actions={pastActions} turnNumber={4}>
              <MarkdownRenderer text={PAST_NARRATION} dialogue />
            </TurnCard>
            <ChoiceRows
              choices={PAST_CHOICES}
              showContinue={false}
              disabled
              isSelected={(_, index) => index === 0}
              continueSelected={false}
              choicePress={() => ({})}
              actions={[]}
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:col-span-2">
          <Meta role="status">
            {lastAction ? `Last action: ${lastAction}` : 'No action yet'}
            {' · '}
            {staged.length > 0 ? `Staged: ${staged.length}` : 'Nothing staged'}
            {' · '}
            {`Images: ${images.length}`}
          </Meta>
          {images.length < SAMPLE_IMAGES.length && (
            <Button variant="outline" size="sm" onClick={() => setImages(SAMPLE_IMAGES)}>Restore Images</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
