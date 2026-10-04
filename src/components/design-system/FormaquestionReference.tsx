import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/typography';
import { EdgeTabButton } from '@/components/formaquestion/EdgeTab';
import { FormaquestionFrame } from '@/components/formaquestion/FormaquestionFrame';
import type { MenuActions } from '@/components/formaquestion/FormaquestionMenu';
import type { DragHandlers } from '@/components/formaquestion/usePointerDrag';
import { useGuideView } from '@/components/formaquestion/formaquestionTabs';
import { GuideBody } from '@/components/formaquestion/GuideBody';
import { MascotPiece } from '@/components/formaquestion/MascotPiece';
import { MinimalChat } from '@/components/formaquestion/MinimalChat';
import { ReaderPiece } from '@/components/formaquestion/ReaderPiece';
import type { HelpChat, HelpExchange } from '@/components/formaquestion/useHelpChat';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { createGuide } from '@/lib/formaquestion/guide';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { composeMascot } from '@/lib/formaquestion/mascot';
import { cropFrame, fitMask, headSize, type MascotSize } from '@/lib/formaquestion/mascotMask';
import { activeMascotRig } from '@/lib/formaquestion/mascotPresets';
import type { Edge } from '@/lib/formaquestion/tabPlace';
import { HEAD_HEIGHT, NARROW_WIDTH, READER_WIDTH, WIDE_WIDTH } from '@/lib/formaquestion/windowBox';

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

/** One answered question, so the sample shows a question, the model's reasoning, an answer and its sources. */
const SAMPLE_EXCHANGE: HelpExchange = {
  id: 'sample',
  question: 'How do I light a lantern?',
  images: [],
  answer: '1. Select **Lanterns**.\n2. Select **Light**.\n\nThe room shows its exits.',
  reasoning: 'The player asks about lanterns. The Lanterns page has the steps.',
  status: 'answered',
  sources: SAMPLE_GUIDE.index.get(['Lanterns#how-to-light-a-lantern']),
  flagged: false,
  nearest: [],
};

/** One answer the guide does not cover, so the sample shows the notice and the nearest sections. */
const SAMPLE_FLAGGED_EXCHANGE: HelpExchange = {
  id: 'sample-flagged',
  question: 'How long does lantern oil last?',
  images: [],
  answer: 'Lamp oil often lasts for some hours, but the time depends on the lamp and the wick.',
  reasoning: '',
  status: 'answered',
  sources: [],
  flagged: true,
  nearest: SAMPLE_GUIDE.index.get(['Oil#how-to-fill-a-lantern', 'Lanterns#how-to-light-a-lantern']),
};

/** Help settings that live in the sample alone, so the showcase writes nothing to the device. */
function useReferenceSettings() {
  const [settings, setSettings] = useState<HelpSettings>(DEFAULT_HELP_SETTINGS);
  return [settings, (change: HelpSettingsChange) => setSettings((current) => helpSettingsOf(change, current))] as const;
}

/** A conversation with no AI behind it: a new question shows the sample guide's search for it. */
function useSampleChat(): HelpChat {
  const [exchanges, setExchanges] = useState<HelpExchange[]>([SAMPLE_EXCHANGE, SAMPLE_FLAGGED_EXCHANGE]);
  return useMemo(() => ({
    exchanges,
    busy: false,
    held: false,
    readsImages: false,
    pending: [],
    setPending: () => {},
    ask: (question) => setExchanges((all) => [...all, { id: crypto.randomUUID(), question, images: [], answer: '', reasoning: '', status: 'no-ai', sources: [], flagged: false, nearest: [] }]),
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

/** The ⋮ menu of a sample: its Chat Style choice writes the sample's settings, and the dialogs do nothing. */
const sampleMenu = (settings: HelpSettings, change: (next: HelpSettingsChange) => void, onClear?: () => void): MenuActions => ({
  onOpenAiContext: () => {},
  onOpenSettings: () => {},
  onClear,
  chatStyle: settings.chatStyle,
  onChatStyleChange: (chatStyle) => change({ chatStyle }),
});

/** Grip handlers that draw the grip and resize nothing. */
const INERT_DRAG: DragHandlers = { onPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {}, onPointerCancel: () => {} };

function SampleWindow() {
  const [wide, setWide] = useState(false);
  const [view, changeView] = useGuideView();
  const chat = useSampleChat();
  const [settings, changeSettings] = useReferenceSettings();
  const style = useMemo(() => ({ width: wide ? WIDE_WIDTH : NARROW_WIDTH, height: 480 }), [wide]);
  return (
    <FormaquestionFrame wide={wide} onSwapWidth={() => setWide((current) => !current)} menu={sampleMenu(settings, changeSettings)} onClose={() => {}} className="relative max-w-full" style={style}>
      <GuideBody guide={SAMPLE_GUIDE} failed={false} onRetry={() => {}} view={view} onViewChange={changeView} wide={wide} chat={chat} settings={settings} onSettingsChange={changeSettings} onGo={() => {}} />
    </FormaquestionFrame>
  );
}

/** The mobile sheet at a phone's width, in a box of its own. */
function SampleSheet() {
  const [view, changeView] = useGuideView();
  const chat = useSampleChat();
  const [settings, changeSettings] = useReferenceSettings();
  return (
    <FormaquestionFrame sheet menu={sampleMenu(settings, changeSettings)} onClose={() => {}} className="relative max-w-full rounded-md border" style={SHEET_SIZE}>
      <GuideBody guide={SAMPLE_GUIDE} failed={false} onRetry={() => {}} view={view} onViewChange={changeView} wide={false} chat={chat} settings={settings} onSettingsChange={changeSettings} onGo={() => {}} />
    </FormaquestionFrame>
  );
}

const MINIMAL_HEIGHT = 480;
const SAMPLE_SECTION = 'Lanterns#how-to-light-a-lantern';

/** The minimal chrome as the window draws it with the Mascot on: three floating pieces on the app. */
function SampleMinimalChrome() {
  const chat = useSampleChat();
  const [settings, changeSettings] = useReferenceSettings();
  const [base, setBase] = useState<MascotSize | null>(null);
  const [readerId, setReaderId] = useState<string | null>(SAMPLE_SECTION);
  const [draft, setDraft] = useState('');
  const [showingHead, setShowingHead] = useState(false);
  const rig = activeMascotRig(settings.mascotPresets);
  const images = useMemo(() => composeMascot(rig, 'answering', null), [rig]);
  const mascotWidth = base ? Math.round((MINIMAL_HEIGHT * base.width) / base.height) : 0;
  const crop = base && fitMask(rig.mask, base);
  const head = showingHead && (
    <MascotPiece view="head" images={images} size={crop && headSize(crop, HEAD_HEIGHT)} frame={crop && base ? cropFrame(crop, base) : undefined} onBase={setBase} />
  );
  return (
    <div className="flex items-end rounded-md border bg-muted/30 p-3" style={{ width: 'max-content', minWidth: '100%' }}>
      {!showingHead && <MascotPiece images={images} size={base && { w: mascotWidth, h: MINIMAL_HEIGHT }} onBase={setBase} />}
      <div className="flex shrink-0 flex-col" style={{ width: NARROW_WIDTH, height: MINIMAL_HEIGHT }}>
        <MinimalChat
          guide={SAMPLE_GUIDE}
          failed={false}
          onRetry={() => {}}
          chat={chat}
          settings={settings}
          onSettingsChange={changeSettings}
          draft={draft}
          onDraftChange={setDraft}
          onOpen={setReaderId}
          onGo={() => {}}
          large={false}
          head={head}
          headToggle={{ showingHead, onToggle: () => setShowingHead((current) => !current) }}
          menu={sampleMenu(settings, changeSettings, chat.exchanges.length > 0 ? chat.clear : undefined)}
          resize={INERT_DRAG}
          onClose={() => {}}
        />
      </div>
      {readerId && <ReaderPiece guide={SAMPLE_GUIDE} sectionId={readerId} size={{ w: READER_WIDTH, h: MINIMAL_HEIGHT }} onOpen={setReaderId} onClose={() => setReaderId(null)} />}
    </div>
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
        <section aria-label="Minimal Chrome" className="min-w-0 space-y-2">
          <SectionTitle>Minimal Chrome</SectionTitle>
          <p className="text-helper text-muted-foreground">Select a source name to show its section in the reader. Select Show Head Only to see the head view.</p>
          <div className="overflow-x-auto pb-2">
            <SampleMinimalChrome />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
