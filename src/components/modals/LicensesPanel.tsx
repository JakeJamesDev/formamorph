import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SearchField } from '@/components/ui/search-field';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseNotices, SUMMARY_SECTION, type NoticeEntry } from '@/lib/noticesFormat';
import { useMountedRef } from '@/lib/useMountedRef';

type State =
  | { status: 'loading' }
  | { status: 'ready'; entries: NoticeEntry[] }
  | { status: 'failed' };

/** Section names as the file spells them, mapped to the headings the tab shows. The summary repeats the software rows, so it has none. */
const HEADINGS: Record<string, string> = {
  'Bundled assets': 'Bundled Assets',
  'Standards & specifications': 'Standards & Specifications',
  'Components and license texts': 'Software',
};

async function readNotices(): Promise<NoticeEntry[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}THIRD-PARTY-NOTICES.md`);
  if (!response.ok) throw new Error(`Notices read failed: ${response.status}`);
  return parseNotices(await response.text()).filter((entry) => entry.section !== SUMMARY_SECTION);
}

/**
 * Reads the shipped notices file once, the first time `wanted` turns true.
 * The caller keeps the hook mounted, so closing and reopening the tab reads nothing again.
 */
export function useNotices(wanted: boolean) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const mounted = useMountedRef();

  useEffect(() => {
    if (!wanted) return;
    readNotices()
      .then((entries) => { if (mounted.current) setState({ status: 'ready', entries }); })
      .catch(() => { if (mounted.current) setState({ status: 'failed' }); });
  }, [wanted, attempt, mounted]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  };
  return { state, retry };
}

function LicenseRow({ entry }: { entry: NoticeEntry }) {
  return (
    <Collapsible className="border-b border-border last:border-b-0">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center justify-between gap-2 rounded-sm py-2 text-left text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="min-w-0 break-words">{entry.name}</span>
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="whitespace-pre-wrap break-words pb-3 font-mono text-helper text-muted-foreground">{entry.text}</pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The Licenses tab: every notice as a collapsed row under its section, with a filter by name. */
export function LicensesPanel({ state, retry }: ReturnType<typeof useNotices>) {
  const [filter, setFilter] = useState('');
  const entries = state.status === 'ready' ? state.entries : null;

  const groups = useMemo(() => {
    if (!entries) return [];
    const needle = filter.trim().toLowerCase();
    // `at` is the row's place in the file, so a row keeps its open state while the filter changes.
    const matching = entries
      .map((entry, at) => ({ entry, at }))
      .filter(({ entry }) => entry.name.toLowerCase().includes(needle));
    return Object.keys(HEADINGS)
      .map((section) => ({ section, rows: matching.filter(({ entry }) => entry.section === section) }))
      .filter((group) => group.rows.length > 0);
  }, [entries, filter]);

  if (state.status === 'loading') {
    return <p className="text-helper text-muted-foreground">Loading licenses…</p>;
  }

  if (state.status === 'failed') {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-label text-destructive">Could not load the licenses.</p>
        <Button variant="outline" size="sm" onClick={retry}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SearchField value={filter} onChange={setFilter} placeholder="Filter by Name" aria-label="Filter Licenses" />
      {groups.length === 0 ? (
        <p className="text-body text-muted-foreground">No license has that name.</p>
      ) : (
        <ScrollArea className="max-h-[50dvh]">
          <div className="space-y-4 pr-3">
            {groups.map(({ section, rows }) => (
              <section key={section} aria-labelledby={`licenses-${HEADINGS[section].replace(/\W+/g, '-')}`} className="space-y-1">
                <h2 id={`licenses-${HEADINGS[section].replace(/\W+/g, '-')}`} className="text-title font-semibold">{HEADINGS[section]}</h2>
                <div>
                  {rows.map(({ entry, at }) => <LicenseRow key={at} entry={entry} />)}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
