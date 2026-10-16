import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta } from '@/components/ui/typography';
import { BubbleActionButton, BubbleMenu } from '@/components/game/BubbleMenu';
import { bubbleActions, choicesActions, withEndpoints, type BubbleAction, type BubbleActionHandlers } from '@/lib/bubbleActions';
import { endpointTipLine } from '@/lib/endpointTip';
import type { AIRequestType } from '@/types';

const noop = () => {};
const NO_HANDLERS: BubbleActionHandlers = {
  regenerate: noop, regenerateStats: noop, sceneImage: noop, sceneTags: noop, edit: noop,
  textToSpeech: noop, regenerateAudio: noop, copy: noop, rewind: noop,
};

// Sample routing: the Demo AI preset, a short pinned preset, and a long one that truncates.
const SAMPLE_ROUTES: Partial<Record<AIRequestType, [string, string]>> = {
  narration: ['Default', 'default'],
  sceneTags: ['Default', 'default'],
  statUpdates: ['Quick Stats', 'gemma-4-e4b'],
  choices: ['Silver Siren local endpoint — 131,072-token creative-writing profile', 'cydonia-24b-v4.3@q4_k_m'],
};

const sampleTip = (kind: AIRequestType) => {
  const route = SAMPLE_ROUTES[kind];
  return route ? endpointTipLine(...route) : '';
};

const IDLE = {
  live: false,
  busy: false,
  canRegenStats: true,
  sceneImagesAvailable: true,
  sceneJob: null,
  ttsLoaded: false,
  ttsGenerating: false,
} as const;

/** Each action reports its own label, so a click shows which item ran. */
const reporting = (actions: BubbleAction[], report: (label: string) => void): BubbleAction[] =>
  actions.map((action) => ({ ...action, run: () => report(action.label) }));

const TARGET_CLASS = 'rounded-md border border-border bg-card p-4 text-body text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

export function MenuDetailLineReference() {
  const [lastAction, setLastAction] = useState<string | null>(null);
  const narration = reporting(withEndpoints(bubbleActions({ ...IDLE, isLatest: true, hasImage: true }, NO_HANDLERS), sampleTip), setLastAction);
  const choices = reporting(
    withEndpoints(choicesActions({ canRegenerate: true, hasChoices: true, busy: false, regenerating: false }, noop), sampleTip),
    setLastAction,
  );
  const regenerate = narration.find((action) => action.key === 'regenerate');

  return (
    <Card role="region" aria-labelledby="menu-detail-line-title">
      <CardHeader>
        <CardTitle id="menu-detail-line-title" className="text-heading">Item Detail Line</CardTitle>
        <CardDescription>
          These are the production Chat bubble menus with sample endpoints. Right-click a sample. On a touch screen, press and hold a sample. For keyboard access, focus a sample and press Shift+F10. A button shows the same line in its tooltip.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <BubbleMenu actions={narration}>
          <div role="button" tabIndex={0} aria-label="Sample narration" className={TARGET_CLASS}>The keeper sets the lamp on the sill and turns to you.</div>
        </BubbleMenu>
        <BubbleMenu actions={choices}>
          <div role="button" tabIndex={0} aria-label="Sample choices" className={TARGET_CLASS}>Ask her why the lamp stays lit.</div>
        </BubbleMenu>
        <div className="flex items-center gap-2">
          {regenerate && <BubbleActionButton action={regenerate} />}
          <Meta>Point at the button for its tooltip.</Meta>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-3 sm:col-span-2" role="status" aria-live="polite">
          <Meta>{lastAction ? `${lastAction} ran on the local sample.` : 'No action has run.'}</Meta>
        </div>
      </CardContent>
    </Card>
  );
}
