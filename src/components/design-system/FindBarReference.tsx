import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import EditorFindBar from '@/components/editor/EditorFindBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Meta } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import type { SearchMatch, SearchRecord, SearchTarget } from '@/lib/worldSearch';

type SampleField = {
  id: string;
  tab: 'overview' | 'locations' | 'entities';
  itemId: string | null;
  itemLabel: string;
  fieldKey: string;
  fieldLabel: string;
  value: string;
};

const SAMPLE_FIELDS: readonly SampleField[] = [
  {
    id: 'overview:introduction',
    tab: 'overview',
    itemId: null,
    itemLabel: 'World',
    fieldKey: 'introReadme',
    fieldLabel: 'World Introduction',
    value: 'Lanterns mark the harbor entrance. The harbor bell warns travelers when the tide covers the eastern stair.',
  },
  {
    id: 'location:watchtower',
    tab: 'locations',
    itemId: 'watchtower',
    itemLabel: 'Salt Marsh Watchtower',
    fieldKey: 'description',
    fieldLabel: 'Location Description',
    value: 'A Harbor watchtower overlooks the marsh, the flooded road, and the long causeway to the observatory.',
  },
  {
    id: 'entity:keeper',
    tab: 'entities',
    itemId: 'keeper',
    itemLabel: 'Keeper',
    fieldKey: 'description',
    fieldLabel: 'Keeper Description',
    value: 'The harbormaster records each harbor signal in a salt-stained ledger before the midnight watch begins.',
  },
];

const cloneSample = () => SAMPLE_FIELDS.map((field) => ({ ...field }));

export function FindBarReference() {
  const [fields, setFields] = useState<SampleField[]>(cloneSample);
  const [open, setOpen] = useState(true);
  const [session, setSession] = useState(0);
  const [startWithReplace, setStartWithReplace] = useState(false);
  const [currentFieldId, setCurrentFieldId] = useState<string | null>(null);
  const [activity, setActivity] = useState('The reference has no selected match.');
  const restoreFocus = useRef(false);
  const findTriggerRef = useRef<HTMLButtonElement>(null);

  const updateField = useCallback((id: string, value: string) => {
    setFields((current) => current.map((field) => (field.id === id ? { ...field, value } : field)));
  }, []);

  const targets = useMemo<SearchTarget[]>(() => fields.map((field) => ({
    itemKey: field.id,
    record: { value: field.value },
    applyTo: (_record: SearchRecord, next: string) => ({ value: next }),
    commit: (record: SearchRecord) => {
      if ('value' in record && typeof record.value === 'string') updateField(field.id, record.value);
    },
    tab: field.tab,
    itemId: field.itemId,
    itemLabel: field.itemLabel,
    fieldKey: field.fieldKey,
    fieldLabel: field.fieldLabel,
    chipCapable: true,
    inChipList: false,
    value: field.value,
    write: (next: string) => updateField(field.id, next),
  })), [fields, updateField]);

  useEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      findTriggerRef.current?.focus();
    }
  }, [open]);

  const openFind = (withReplace: boolean) => {
    setStartWithReplace(withReplace);
    setSession((current) => current + 1);
    setOpen(true);
    setActivity(withReplace ? 'The Find and Replace bar is open.' : 'The Find bar is open.');
  };

  const closeFind = () => {
    restoreFocus.current = true;
    setOpen(false);
    setCurrentFieldId(null);
    setActivity('The Find bar is closed.');
  };

  const navigate = (match: SearchMatch | null) => {
    setCurrentFieldId(match?.target.itemKey ?? null);
    setActivity(match
      ? `The selected field is ${match.target.itemLabel} — ${match.target.fieldLabel}.`
      : 'The reference has no selected match.');
  };

  const resetSample = () => {
    setFields(cloneSample());
    setCurrentFieldId(null);
  };

  return (
    <Card role="region" aria-labelledby="find-bar-reference-title" data-find-bar-reference>
      <CardHeader>
        <CardTitle id="find-bar-reference-title" className="text-heading">Find Bar Reference</CardTitle>
        <CardDescription>Search and replace text in a local World Editor sample.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button ref={findTriggerRef} type="button" size="sm" onClick={() => openFind(false)} disabled={open}>
            <Search className="mr-2 h-4 w-4" /> Find
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openFind(true)}>
            Find and Replace
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={resetSample}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Sample
          </Button>
          <Meta role="status" aria-live="polite" className="ml-auto">{activity}</Meta>
        </div>

        <div className="relative min-h-[34rem] overflow-hidden rounded-md border bg-background shadow-sm">
          {open && (
            <EditorFindBar
              key={session}
              targets={targets}
              placeholders={[]}
              placementLetters={new Map()}
              allowPlaceholderReplace={false}
              startWithReplace={startWithReplace}
              onNavigate={navigate}
              onAddPlaceholder={() => {}}
              onClose={closeFind}
            />
          )}

          <div className={cn('grid min-h-[34rem] sm:grid-cols-[11rem_minmax(0,1fr)]', open && 'pt-28 sm:pt-32')}>
            <aside className="border-b bg-muted/30 p-3 sm:border-b-0 sm:border-r" aria-label="World Editor sections">
              <Meta className="mb-2 uppercase tracking-wider">World Editor</Meta>
              <ul className="grid gap-1 text-label">
                {fields.map((field) => (
                  <li
                    key={field.id}
                    className={cn('rounded px-2 py-1.5', currentFieldId === field.id && 'bg-accent text-accent-foreground')}
                  >
                    {field.itemLabel}
                  </li>
                ))}
              </ul>
            </aside>

            <section className="grid content-start gap-4 p-4" aria-label="Sample document">
              {fields.map((field) => (
                <label key={field.id} className="grid min-w-0 gap-1.5 text-label font-medium">
                  {field.fieldLabel}
                  <Textarea
                    aria-label={field.fieldLabel}
                    data-find-current={currentFieldId === field.id ? 'true' : 'false'}
                    value={field.value}
                    onChange={(event) => updateField(field.id, event.target.value)}
                    className={cn(
                      'min-h-20 resize-y font-normal',
                      currentFieldId === field.id && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                    )}
                  />
                </label>
              ))}
            </section>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
