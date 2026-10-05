import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronsDownUp, ChevronsUpDown, ScrollText } from 'lucide-react';
import { AiContextExportButton } from '@/components/aiContext/AiContextExportButton';
import { AiContextRequestCard, AiContextSection, type AiContextCardSection } from '@/components/aiContext/AiContextRequestCard';
import { DebugChip } from '@/components/game/DebugChip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, dialogFullHeightMobile } from '@/components/ui/dialog';
import { Pager } from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { HELP_SAMPLER_FIELDS, type HelpQueryTrace, type HelpRequestTrace, type HelpSamplers, type HelpTrace, type HelpTraceSection } from '@/lib/formaquestion/helpTrace';
import { cn } from '@/lib/utils';
import type { SurfaceRoute } from '@/lib/surface/surfaceRoute';
import { routeText } from '@/lib/surface/surfaceTargets';
import { answerRoute } from './answerRoute';
import { AI_CONTEXT_COPY, GENERAL_COPY } from './formaquestionSettingsTabs';
import type { HelpExchange } from './useHelpChat';

/** The game view's AI Context size, and the whole screen on mobile. */
const DIALOG_SIZE = cn(
  'flex flex-col overflow-hidden sm:max-w-[95vw] sm:w-[95vw] sm:h-[90dvh]',
  dialogFullHeightMobile,
  'max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0',
);

/** A question that an AI answered, so it has a trace. */
type TracedExchange = HelpExchange & { trace: HelpTrace };

const hasTrace = (exchange: HelpExchange): exchange is TracedExchange => exchange.trace !== undefined;

/** The sampler chip's words: the settings' names on the chip, the wire names in the tip. */
function samplersChip(samplers: HelpSamplers): { label: string; tip: string } | null {
  const sent = HELP_SAMPLER_FIELDS.flatMap((field) => (samplers[field.key] === undefined ? [] : [{ ...field, value: samplers[field.key] }]));
  if (sent.length === 0) return null;
  return { label: sent.map(({ label, value }) => `${label} ${value}`).join(' · '), tip: sent.map(({ wire, value }) => `${wire}: ${value}`).join(' · ') };
}

/** The chips the help card adds after the endpoint chips: the samplers, and the custom-prompt mark. */
function HelpChips({ request }: { request: HelpRequestTrace }) {
  const samplers = samplersChip(request.samplers);
  return (
    <>
      {samplers && <DebugChip label={samplers.label} tip={samplers.tip} />}
      {request.customPrompt && (
        <Tip tip={AI_CONTEXT_COPY.customPrompt.tip} labelsChild={false}>
          <span className="rounded border border-primary/60 bg-primary/15 px-1.5 py-0.5 text-meta font-normal text-foreground">{AI_CONTEXT_COPY.customPrompt.label}</span>
        </Tip>
      )}
    </>
  );
}

/** One ranked list of sections, with the ones that reached the model marked. */
function SectionList({ sections, sent, label }: { sections: readonly HelpTraceSection[]; sent: ReadonlySet<string>; label: string }) {
  if (sections.length === 0) return <p className="text-muted-foreground">{label}: {AI_CONTEXT_COPY.noRanking}</p>;
  return (
    <div>
      <p className="font-medium">{label}</p>
      <ol className="list-decimal pl-6">
        {sections.map((section) => {
          const reached = sent.has(section.id);
          return (
            <li key={section.id} data-sent={reached ? '' : undefined} className={reached ? 'font-semibold' : 'text-muted-foreground'}>
              {section.page} › {section.label}
              {reached && <span className="ml-1 rounded bg-primary/15 px-1 font-normal text-foreground">{AI_CONTEXT_COPY.sent}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** One query the search ran: each source's ranking, then the merged order. */
function QueryBlock({ query, sent }: { query: HelpQueryTrace; sent: ReadonlySet<string> }) {
  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <p>{AI_CONTEXT_COPY.query}: <q>{query.query}</q></p>
      {query.sources.map((source) => <SectionList key={source.source} label={AI_CONTEXT_COPY.sources[source.source]} sections={source.sections} sent={sent} />)}
      <SectionList label={AI_CONTEXT_COPY.merged} sections={query.merged} sent={sent} />
    </div>
  );
}

/** The Search block of one question: the screen, the preset, each query, the sections sent, and the route. */
function SearchBlock({ trace, route }: { trace: HelpTrace; route: SurfaceRoute | null }) {
  const sent = useMemo(() => new Set(trace.sent.map((section) => section.id)), [trace.sent]);
  const off = trace.search?.on.length === 0;
  return (
    <div className="space-y-2 text-meta">
      <p>
        {trace.surface ?? AI_CONTEXT_COPY.noScreen} · {GENERAL_COPY.openScreen.label} {trace.openScreen ? 'on' : 'off'}
        {trace.lead && <> · {AI_CONTEXT_COPY.lead}: {trace.lead.page} › {trace.lead.label}</>}
      </p>
      <p>{AI_CONTEXT_COPY.preset}: {trace.preset}</p>
      {trace.search === null ? (
        <p className="text-muted-foreground">{AI_CONTEXT_COPY.bare}</p>
      ) : (
        <>
          <p>{AI_CONTEXT_COPY.sourcesOn}: {off ? AI_CONTEXT_COPY.none : trace.search.on.map((source) => AI_CONTEXT_COPY.sources[source]).join(', ')}</p>
          {trace.search.queries.map((query) => <QueryBlock key={query.query} query={query} sent={sent} />)}
        </>
      )}
      <SectionList label={AI_CONTEXT_COPY.sentList} sections={trace.sent} sent={sent} />
      <p>{AI_CONTEXT_COPY.route}: {route ? routeText(route.id, route.target) : AI_CONTEXT_COPY.none}</p>
    </div>
  );
}

/** The collapse key of one block of one question. */
const keyOf = (id: string, part: string | number): string => `${id}:${part}`;

/**
 * Formaquestion's AI Context: what each question of the conversation sent, one question per page, in the
 * game view's AI Context layout. A page holds the question's Search block and the shared request card for
 * each request. The newest question opens first, as the game view opens on the newest turn.
 */
export function FormaquestionAiContext({ open, onOpenChange, exchanges }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exchanges: readonly HelpExchange[];
}) {
  const traced = useMemo(() => exchanges.filter(hasTrace), [exchanges]);
  // Page = question, 1-based. A new question turns to its page, as the game view turns to a new turn.
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (traced.length > 0) setPage(traced.length);
  }, [traced.length]);
  const pageIndex = Math.min(Math.max(page, 1), Math.max(traced.length, 1)) - 1;
  const current = traced[pageIndex];
  // Which blocks the reader closed. Everything starts open, as in the game view. Collapse all acts on the open page.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const keys = current === undefined ? [] : [
    keyOf(current.id, 'search'),
    ...current.trace.requests.flatMap((_request, i) => (['group', 'input', 'tools', 'reasoning', 'output'] as const).map((section) => keyOf(current.id, `${i}:${section}`))),
  ];
  const allCollapsed = keys.length > 0 && keys.every((key) => collapsed[key]);
  const toggleAll = () => setCollapsed((prev) => {
    const next = { ...prev };
    for (const key of keys) next[key] = !allCollapsed;
    return next;
  });
  const isOpen = (key: string) => !collapsed[key];
  const setOpen = (key: string, next: boolean) => setCollapsed((prev) => ({ ...prev, [key]: !next }));
  const exportData = traced.map(({ question, trace }) => ({ question, trace }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="formaquestionAiContext" aria-describedby={undefined} className={DIALOG_SIZE}>
        <DialogTitle className="flex flex-shrink-0 items-center gap-1.5 pr-8">
          <ScrollText className="h-5 w-5" />
          {AI_CONTEXT_COPY.title}
        </DialogTitle>
        {/* The question line and the view controls share one row, as the game view's turn line does. */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="min-w-0 flex-grow truncate text-meta text-muted-foreground">
            {current && <>{AI_CONTEXT_COPY.question} {pageIndex + 1} of {traced.length} — <q>{current.question}</q></>}
          </div>
          <Button variant="outline" size="sm" onClick={toggleAll} disabled={keys.length === 0} className="h-8 flex-shrink-0 gap-1">
            {allCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
            {allCollapsed ? AI_CONTEXT_COPY.expandAll : AI_CONTEXT_COPY.collapseAll}
          </Button>
          <AiContextExportButton data={exportData} name="formaquestion" tip={AI_CONTEXT_COPY.export} disabled={traced.length === 0} />
        </div>
        <div className="min-h-0 flex-grow">
          <ScrollArea className="h-full">
            <div className="space-y-4 text-meta">
              {current === undefined ? (
                <p className="text-muted-foreground">{AI_CONTEXT_COPY.empty}</p>
              ) : (
                <Question key={current.id} exchange={current} isOpen={isOpen} setOpen={setOpen} />
              )}
            </div>
          </ScrollArea>
        </div>
        {traced.length > 1 && (
          <div className="flex flex-shrink-0 justify-center pt-2">
            <Pager page={pageIndex + 1} pageCount={traced.length} onPageChange={setPage} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** One question of the conversation: its Search block, then its request cards. */
function Question({ exchange, isOpen, setOpen }: {
  exchange: TracedExchange;
  isOpen: (key: string) => boolean;
  setOpen: (key: string, open: boolean) => void;
}): ReactNode {
  const { id, question, trace } = exchange;
  const searchKey = keyOf(id, 'search');
  return (
    <section role="group" aria-label={question} className="space-y-2">
      <AiContextSection title={AI_CONTEXT_COPY.search} open={isOpen(searchKey)} onOpenChange={(next) => setOpen(searchKey, next)}>
        <SearchBlock trace={trace} route={answerRoute(exchange)} />
      </AiContextSection>
      {trace.requests.map((request, i) => {
        const sectionKey = (section: AiContextCardSection) => keyOf(id, `${i}:${section}`);
        return (
          <AiContextRequestCard
            key={i}
            record={request.record}
            index={i}
            isOpen={(section) => isOpen(sectionKey(section))}
            onOpenChange={(section, next) => setOpen(sectionKey(section), next)}
            chips={<HelpChips request={request} />}
          />
        );
      })}
    </section>
  );
}
