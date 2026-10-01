import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/typography';
import { EdgeTabButton } from '@/components/formaquestion/EdgeTab';
import { FormaquestionFrame } from '@/components/formaquestion/FormaquestionFrame';
import { useGuideView } from '@/components/formaquestion/formaquestionTabs';
import { GuideBody } from '@/components/formaquestion/GuideBody';
import type { HelpChat, HelpExchange } from '@/components/formaquestion/useHelpChat';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { createGuide } from '@/lib/formaquestion/guide';
import type { Edge } from '@/lib/formaquestion/tabPlace';
import { NARROW_WIDTH, WIDE_WIDTH } from '@/lib/formaquestion/windowBox';

/** A small guide for the sample window. The app's own docs stay out of the reference. */
const SAMPLE_PAGES = {
  Lanterns: [
    '# 🏮 Lanterns',
    '',
    'A lantern lights one room. See [Oil](Oil) for its fuel, or the [lamp makers](https://example.com/lamps).',
    '',
    '## How to Light a Lantern',
    '',
    '1. Select **Lanterns**.',
    '2. Select **Light**.',
    '',
    'The room shows its exits.',
    '',
    '## Lantern Colors',
    '',
    '| Color | Use |',
    '|---|---|',
    '| Blue | The harbor |',
    '| White | The stair |',
  ].join('\n'),
  Oil: '# 🫙 Oil\n\nOil is the fuel of a lantern.\n\n## How to Fill a Lantern\n\n1. Select the lantern.\n2. Select **Fill**.\n',
};
const SAMPLE_GUIDE = createGuide(createDocsIndex({ pages: SAMPLE_PAGES }));

/** One answered question, so the sample shows a question, an answer and its sources. */
const SAMPLE_EXCHANGE: HelpExchange = {
  id: 'sample',
  question: 'How do I light a lantern?',
  answer: '1. Select **Lanterns**.\n2. Select **Light**.\n\nThe room shows its exits.',
  status: 'answered',
  sources: SAMPLE_GUIDE.index.get(['Lanterns#how-to-light-a-lantern']),
  flagged: false,
  nearest: [],
};

/** One answer the guide does not cover, so the sample shows the notice and the nearest sections. */
const SAMPLE_FLAGGED_EXCHANGE: HelpExchange = {
  id: 'sample-flagged',
  question: 'How long does lantern oil last?',
  answer: 'Lamp oil often lasts for some hours, but the time depends on the lamp and the wick.',
  status: 'answered',
  sources: [],
  flagged: true,
  nearest: SAMPLE_GUIDE.index.get(['Oil#how-to-fill-a-lantern', 'Lanterns#how-to-light-a-lantern']),
};

/** A conversation with no AI behind it: a new question shows the sample guide's search for it. */
function useSampleChat(): HelpChat {
  const [exchanges, setExchanges] = useState<HelpExchange[]>([SAMPLE_EXCHANGE, SAMPLE_FLAGGED_EXCHANGE]);
  return useMemo(() => ({
    exchanges,
    busy: false,
    held: false,
    ask: (question) => setExchanges((all) => [...all, { id: crypto.randomUUID(), question, answer: '', status: 'no-ai', sources: [], flagged: false, nearest: [] }]),
    stop: () => {},
    clear: () => setExchanges([]),
  }), [exchanges]);
}

/** Where each sample tab sits in its sample screen. */
const EDGE_PLACE: Record<Edge, string> = {
  right: 'right-0 top-1/2 -translate-y-1/2',
  left: 'left-0 top-1/2 -translate-y-1/2',
  top: 'left-1/2 top-0 -translate-x-1/2',
  bottom: 'bottom-0 left-1/2 -translate-x-1/2',
};
const EDGES: Edge[] = ['right', 'left', 'top', 'bottom'];
const SHEET_SIZE = { width: 360, height: 560 };

function SampleWindow() {
  const [wide, setWide] = useState(false);
  const [view, changeView] = useGuideView();
  const chat = useSampleChat();
  const style = useMemo(() => ({ width: wide ? WIDE_WIDTH : NARROW_WIDTH, height: 480 }), [wide]);
  return (
    <FormaquestionFrame wide={wide} onSwapWidth={() => setWide((current) => !current)} onClose={() => {}} className="relative max-w-full" style={style}>
      <GuideBody guide={SAMPLE_GUIDE} failed={false} onRetry={() => {}} view={view} onViewChange={changeView} wide={wide} chat={chat} />
    </FormaquestionFrame>
  );
}

/** The mobile sheet at a phone's width, in a box of its own. */
function SampleSheet() {
  const [view, changeView] = useGuideView();
  const chat = useSampleChat();
  return (
    <FormaquestionFrame sheet onClose={() => {}} className="relative max-w-full rounded-md border" style={SHEET_SIZE}>
      <GuideBody guide={SAMPLE_GUIDE} failed={false} onRetry={() => {}} view={view} onViewChange={changeView} wide={false} chat={chat} />
    </FormaquestionFrame>
  );
}

export function FormaquestionReference() {
  return (
    <Card role="region" aria-labelledby="formaquestion-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="formaquestion-reference-title" className="text-heading">Formaquestion Reference</CardTitle>
        <CardDescription>Select Wide View to change the layout. The samples do not move, Close does nothing here, and a question you send shows a search of the sample guide, not an AI answer.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-6">
        <section aria-label="Help Tab" className="space-y-2">
          <SectionTitle>Help Tab</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EDGES.map((edge) => (
              <div key={edge} role="group" aria-label={`${edge} edge`} className="relative h-36 overflow-hidden rounded-md border bg-muted/30">
                <EdgeTabButton edge={edge} open={edge === 'left'} className={`absolute ${EDGE_PLACE[edge]}`} />
              </div>
            ))}
          </div>
        </section>
        <section aria-label="Window" className="min-w-0 space-y-2">
          <SectionTitle>Window</SectionTitle>
          <div className="overflow-x-auto pb-2">
            <SampleWindow />
          </div>
        </section>
        <section aria-label="Mobile Sheet" className="min-w-0 space-y-2">
          <SectionTitle>Mobile Sheet</SectionTitle>
          <SampleSheet />
        </section>
      </CardContent>
    </Card>
  );
}
