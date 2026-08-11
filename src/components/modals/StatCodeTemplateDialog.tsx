import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  dialogFullHeightMobile,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import { downloadBlob } from '@/lib/downloadBlob';
import { filesFrom } from '@/lib/importFiles';
import { useResetOnOpen } from '@/lib/useResetOnOpen';
import { useIsMobile } from '@/lib/useIsMobile';
import { cn } from '@/lib/utils';
import { CodeArea } from '@/components/prompt/CodeArea';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  BUILT_IN_TEMPLATES,
  DAYPART_OPTIONS,
  defaultSlotValues,
  fillTemplate,
  humanizeSlotName,
  isBuiltInTemplate,
  parseTemplateSlots,
  validateSlotValues,
  type StatCodeTemplate,
  type TemplateSlot,
} from '@/lib/statCodeTemplates';
import {
  buildTemplatePack,
  deleteUserTemplate,
  importTemplates,
  listUserTemplates,
  parseTemplatePack,
  saveUserTemplate,
} from '@/services/StatTemplateStorageService';
import type { Stat } from '@/types';

const BLANK_TEMPLATE: StatCodeTemplate = {
  id: '',
  name: '',
  description: '',
  code: 'return {{amount:number=1}};',
};

/** One control for one slot. Stat and daypart slots pick from a list so the generated string is always
 *  a name the sandbox will actually match. */
function SlotField({ slot, value, problem, stats, onChange }: {
  slot: TemplateSlot;
  value: string;
  problem?: string;
  stats: Stat[];
  onChange: (value: string) => void;
}) {
  const options = slot.type === 'stat'
    ? stats.map(stat => stat.name).filter(Boolean)
    : slot.type === 'daypart'
      ? [...DAYPART_OPTIONS]
      : slot.options ?? [];

  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-label">{humanizeSlotName(slot.name)}</span>
      {slot.type === 'number' || slot.type === 'text' ? (
        <Input
          value={value}
          inputMode={slot.type === 'number' ? 'decimal' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={slot.type === 'stat' ? 'Pick a stat…' : 'Pick one…'} /></SelectTrigger>
          <SelectContent>
            {options.length === 0 && <div className="px-2 py-1.5 text-meta text-muted-foreground">Nothing to pick</div>}
            {options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {problem && <span className="text-meta text-destructive">{problem}</span>}
    </label>
  );
}

/** The fill-in form and the code it generates. Shared by the picker and the template editor's Preview tab,
 *  so an author writing a template sees the exact interface theirs will present. */
function TemplateForm({ code, stats, values, onChange }: {
  code: string;
  stats: Stat[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  const parsed = useMemo(() => parseTemplateSlots(code), [code]);
  const problems = validateSlotValues(parsed.slots, values);

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {parsed.errors.length > 0 && <p className="text-helper text-destructive">{parsed.errors.join(' ')}</p>}

      {parsed.slots.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {parsed.slots.map(slot => (
            <SlotField
              key={slot.name}
              slot={slot}
              stats={stats}
              value={values[slot.name] ?? ''}
              problem={problems[slot.name]}
              onChange={(value) => onChange({ ...values, [slot.name]: value })}
            />
          ))}
        </div>
      ) : (
        <p className="text-meta text-muted-foreground">This template asks for nothing — it inserts as it is.</p>
      )}

      <div className="flex flex-col gap-1 min-h-0">
        <Label className="text-label">Code</Label>
        <pre className="overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-meta whitespace-pre-wrap">
          {fillTemplate(code, values)}
        </pre>
      </div>
    </div>
  );
}

/**
 * Browse, fill in and manage stat-code templates. Inserting generates plain JavaScript into the stat's
 * code field — the finished stat keeps no link to the template it came from, so the author is free to
 * edit the result by hand afterwards.
 */
export function StatCodeTemplateDialog({ open, onOpenChange, stats, currentStatId, hasExistingCode, onInsert }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: Stat[];
  /** Excluded from stat pickers — a stat built from itself is a mistake, and templates reach their own
   *  value through `currentStatId` rather than by name. */
  currentStatId?: string;
  hasExistingCode: boolean;
  onInsert: (code: string) => void;
}) {
  const [userTemplates, setUserTemplates] = useState<StatCodeTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>(BUILT_IN_TEMPLATES[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<StatCodeTemplate | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<StatCodeTemplate | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const refresh = useCallback(async () => {
    try {
      setUserTemplates(await listUserTemplates());
    } catch (error) {
      toast.error(`Couldn’t read your templates: ${(error as Error).message}`);
    }
  }, []);

  useResetOnOpen(open, () => {
    setSelectedId(BUILT_IN_TEMPLATES[0].id);
    setDraft(null);
    void refresh();
  });

  const sortedUser = useMemo(
    () => [...userTemplates].sort((a, b) => a.name.localeCompare(b.name)),
    [userTemplates],
  );
  const all = useMemo(() => [...BUILT_IN_TEMPLATES, ...sortedUser], [sortedUser]);
  const selected = all.find(template => template.id === selectedId) ?? all[0];
  const pickableStats = useMemo(
    () => stats.filter(stat => stat.id !== currentStatId),
    [stats, currentStatId],
  );
  const parsed = useMemo(() => parseTemplateSlots(selected?.code ?? ''), [selected?.code]);

  // Each newly selected template starts from its own declared defaults rather than inheriting the last
  // template's answers, which would silently carry a stat name into a slot that never asked for it.
  useEffect(() => { setValues(defaultSlotValues(parsed.slots)); }, [parsed.slots]);

  const problems = validateSlotValues(parsed.slots, values);
  const blocked = Object.keys(problems).length > 0 || parsed.errors.length > 0;

  const doInsert = () => {
    onInsert(fillTemplate(selected?.code ?? '', values));
    setConfirmReplace(false);
    onOpenChange(false);
  };

  const openDraft = (template: StatCodeTemplate) => {
    setDraft(template);
    setDraftValues(defaultSlotValues(parseTemplateSlots(template.code).slots));
  };

  const saveDraft = async () => {
    if (!draft?.name.trim() || !draft.code.trim()) return;
    try {
      const saved = await saveUserTemplate({ ...draft, name: draft.name.trim() });
      await refresh();
      setSelectedId(saved.id);
      setDraft(null);
      toast.success('Template saved');
    } catch (error) {
      toast.error(`Couldn’t save: ${(error as Error).message}`);
    }
  };

  const remove = async (template: StatCodeTemplate) => {
    setConfirmDelete(null);
    try {
      await deleteUserTemplate(template.id);
      await refresh();
      setSelectedId(BUILT_IN_TEMPLATES[0].id);
    } catch (error) {
      toast.error(`Couldn’t delete: ${(error as Error).message}`);
    }
  };

  const exportPack = () => {
    if (sortedUser.length === 0) return;
    downloadBlob(
      new Blob([JSON.stringify(buildTemplatePack(sortedUser), null, 2)], { type: 'application/json' }),
      'stat-templates.json',
    );
  };

  const importPack = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = filesFrom(event);
    // Clearing the input is what lets the same file be chosen twice — an unchanged value fires no change.
    event.target.value = '';
    if (!file) return;
    try {
      const added = await importTemplates(parseTemplatePack(await file.text()));
      await refresh();
      toast.success(added > 0
        ? `Imported ${added} template${added === 1 ? '' : 's'}`
        : 'Those templates are already in your library');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const templateButton = (template: StatCodeTemplate) => (
    <button
      key={template.id}
      type="button"
      onClick={() => setSelectedId(template.id)}
      className={cn(
        'text-left text-label rounded px-2 py-1.5',
        template.id === selected?.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
      )}
    >
      {template.name}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          'flex flex-col gap-4',
          // A fixed height, not a max: the window is the same size whichever template is selected, and the
          // panes scroll inside it. The desktop height is `sm:`-scoped so it cannot outrank the mobile
          // rule: an unscoped dvh height wins on width alone, which leaves mobile measuring a viewport
          // unit that ignores the on-screen keyboard and crushes the fields underneath it.
          'sm:max-w-4xl sm:h-[85dvh]',
          dialogFullHeightMobile,
        )}
      >
        <DialogHeader><DialogTitle>Code Templates</DialogTitle></DialogHeader>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importPack} />

        {draft ? (
          <>
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-label">Name</span>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-label">Description</span>
                <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>
              {/* Preview is the creation interface the template will present, so the author edits the code
                  and reads what it asks for in the same place — side by side once full screen allows. */}
              <CodeArea
                value={draft.code}
                onChange={(code) => setDraft({ ...draft, code })}
                label="Code"
                ariaLabel="Template code"
                slots
                className="flex-1"
                preview={(
                  <TemplateForm code={draft.code} stats={pickableStats} values={draftValues} onChange={setDraftValues} />
                )}
              />
              <p className="text-meta text-muted-foreground">
                A slot is <code>{'{{name:type=default}}'}</code>. Stat and daypart slots become quoted
                strings; number, choice and text are pasted as written, so quote them yourself when you
                need a string.
              </p>
            </div>

            <DialogFooter className="flex-row justify-end">
              <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              <Button disabled={!draft.name.trim() || !draft.code.trim()} onClick={() => void saveDraft()}>
                Save Template
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className={cn('flex-1 min-h-0 gap-4', isMobile ? 'flex flex-col' : 'grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)]')}>
              {isMobile ? (
                <Select value={selected?.id} onValueChange={setSelectedId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUILT_IN_TEMPLATES.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    {sortedUser.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <ScrollArea className="h-full rounded-md border">
                  <div className="p-2 flex flex-col gap-1">
                    <p className="text-meta text-muted-foreground px-1 pt-1">Built-In</p>
                    {BUILT_IN_TEMPLATES.map(templateButton)}

                    <div className="flex items-center justify-between gap-1 px-1 pt-3">
                      <p className="text-meta text-muted-foreground">My Templates</p>
                      <span className="flex items-center">
                        <button
                          type="button" title="Import templates" aria-label="Import templates"
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          onClick={() => fileRef.current?.click()}
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button" title="Export templates" aria-label="Export templates"
                          disabled={sortedUser.length === 0}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                          onClick={exportPack}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                    {sortedUser.map(templateButton)}

                    <button
                      type="button"
                      onClick={() => openDraft({ ...BLANK_TEMPLATE })}
                      className="flex items-center gap-1 rounded border border-dashed px-2 py-1.5 text-label text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-4 w-4" />New Template
                    </button>
                  </div>
                </ScrollArea>
              )}

              <div className="flex flex-col gap-3 min-w-0 overflow-y-auto">
                {selected && (
                  <>
                    <div>
                      <p className="text-label font-medium">{selected.name}</p>
                      <p className="text-helper text-muted-foreground">{selected.description}</p>
                    </div>
                    <TemplateForm code={selected.code} stats={pickableStats} values={values} onChange={setValues} />
                  </>
                )}
              </div>
            </div>

            {/* Frozen: the actions keep their place whichever template is selected and however long its
                form runs. */}
            <DialogFooter className="flex-row flex-wrap justify-end gap-2">
              {isMobile && (
                <Button variant="outline" size="sm" onClick={() => openDraft({ ...BLANK_TEMPLATE })}>
                  <Plus className="h-4 w-4 mr-1" />New
                </Button>
              )}
              {selected && (isBuiltInTemplate(selected.id) ? (
                <Button variant="outline" onClick={() => openDraft({ ...selected, id: '', name: `${selected.name} Copy` })}>
                  <Copy className="h-4 w-4 mr-1" />Duplicate
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => openDraft({ ...selected })}>
                    <Pencil className="h-4 w-4 mr-1" />Edit
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmDelete(selected)}>
                    <Trash2 className="h-4 w-4 mr-1" />Delete
                  </Button>
                </>
              ))}
              <Button disabled={blocked} onClick={() => (hasExistingCode ? setConfirmReplace(true) : doInsert())}>
                Insert Code
              </Button>
            </DialogFooter>
          </>
        )}

        <ConfirmDialog
          open={!!confirmDelete}
          onOpenChange={(o) => !o && setConfirmDelete(null)}
          title="Delete Template"
          description={`Delete “${confirmDelete?.name}” from your library? Stats already using code from it are unaffected.`}
          onConfirm={() => confirmDelete && void remove(confirmDelete)}
        />

        <ConfirmDialog
          open={confirmReplace}
          onOpenChange={setConfirmReplace}
          title="Replace The Existing Code"
          description="This stat already has code. Inserting this template writes over it."
          onConfirm={doInsert}
        />
      </DialogContent>
    </Dialog>
  );
}

export default StatCodeTemplateDialog;
