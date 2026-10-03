import { useMemo, useState, type ReactNode } from 'react';
import { ChevronsDownUp, ChevronsUpDown, ScrollText } from 'lucide-react';
import { AiContextExportButton } from '@/components/aiContext/AiContextExportButton';
import { AiContextRequestCard, AiContextSection, type AiContextCardSection } from '@/components/aiContext/AiContextRequestCard';
import { DebugChip } from '@/components/game/DebugChip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, dialogFullHeightMobile } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { HELP_SAMPLER_FIELDS, type HelpQueryTrace, type HelpRequestTrace, type HelpSamplers, type HelpTrace, type HelpTraceSection } from '@/lib/formaquestion/helpTrace';
import { cn } from '@/lib/utils';
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

/** The Search block of one question: the screen, the preset, each query, and the sections sent. */
function SearchBlock({ trace }: { trace: HelpTrace }) {
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
    </div>
  );
}

/** The collapse key of one block of one question. */
const keyOf = (id: string, part: string | number): string => `${id}:${part}`;

/**
 * Formaquestion's AI Context: what each question of the conversation sent, newest first, in the game view's
 * AI Context layout. Each question holds its Search block and the shared request card for each request.
 * The help window stays above it.
 */
export function FormaquestionAiContext({ open, onOpenChange, exchanges }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exchanges: readonly HelpExchange[];
}) {
  const traced = useMemo(() => exchanges.filter(hasTrace), [exchanges]);
  // Which blocks the reader closed. Everything starts open, as in the game view.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const keys = traced.flatMap((exchange) => [
    keyOf(exchange.id, 'search'),
    ...exchange.trace.requests.flatMap((_request, i) => (['group', 'input', 'tools', 'reasoning', 'output'] as const).map((section) => keyOf(exchange.id, `${i}:${section}`))),
  ]);
  const allCollapsed = keys.length > 0 && keys.every((key) => collapsed[key]);
  const toggleAll = () => setCollapsed(allCollapsed ? {} : Object.fromEntries(keys.map((key) => [key, true])));
  const isOpen = (key: string) => !collapsed[key];
  const setOpen = (key: string, next: boolean) => setCollapsed((prev) => ({ ...prev, [key]: !next }));
  const exportData = traced.map(({ question, trace }) => ({ question, trace }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="formaquestionAiContext" aria-describedby={undefined} className={DIALOG_SIZE}>
        <div className="flex flex-shrink-0 items-center gap-2 pr-8">
          <DialogTitle className="flex items-center gap-1.5">
            <ScrollText className="h-5 w-5" />
            {AI_CONTEXT_COPY.title}
          </DialogTitle>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleAll} disabled={keys.length === 0} className="h-8 flex-shrink-0 gap-1">
              {allCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
              {allCollapsed ? AI_CONTEXT_COPY.expandAll : AI_CONTEXT_COPY.collapseAll}
            </Button>
            <AiContextExportButton data={exportData} name="formaquestion" tip={AI_CONTEXT_COPY.export} disabled={traced.length === 0} />
          </div>
        </div>
        <div className="min-h-0 flex-grow">
          <ScrollArea className="h-full">
            <div className="space-y-4 text-meta">
              {traced.length === 0 ? (
                <p className="text-muted-foreground">{AI_CONTEXT_COPY.empty}</p>
              ) : (
                // Numbered in conversation order, listed newest first.
                traced.map((exchange, at) => (
                  <Question key={exchange.id} exchange={exchange} number={at + 1} isOpen={isOpen} setOpen={setOpen} />
                )).reverse()
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** One question of the conversation: its Search block, then its request cards. */
function Question({ exchange, number, isOpen, setOpen }: {
  exchange: TracedExchange;
  number: number;
  isOpen: (key: string) => boolean;
  setOpen: (key: string, open: boolean) => void;
}): ReactNode {
  const { id, question, trace } = exchange;
  const searchKey = keyOf(id, 'search');
  return (
    <section role="group" aria-label={question} className="space-y-2">
      <h3 className="truncate text-label font-semibold">Question {number}: <q>{question}</q></h3>
      <AiContextSection title={AI_CONTEXT_COPY.search} open={isOpen(searchKey)} onOpenChange={(next) => setOpen(searchKey, next)}>
        <SearchBlock trace={trace} />
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
