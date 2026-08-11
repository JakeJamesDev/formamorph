import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import { downloadBlob } from '@/lib/downloadBlob';
import { filesFrom } from '@/lib/importFiles';
import { useResetOnOpen } from '@/lib/useResetOnOpen';
import {
  BUILT_IN_TEMPLATES,
  DAYPART_OPTIONS,
  defaultSlotValues,
  fillTemplate,
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
  code: '// {{amount:number=1}} is a slot — the picker turns it into a form field.\nreturn {{amount}};',
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
    <label className="flex flex-col gap-1">
      <span className="text-label">{slot.name}</span>
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
            {options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {problem && <span className="text-meta text-destructive">{problem}</span>}
    </label>
  );
}

/**
 * Browse, fill in and manage stat-code templates. Inserting generates plain JavaScript into the stat's
 * code field — the finished stat keeps no link to the template it came from, so the author is free to
 * edit the result by hand afterwards.
 */
export function StatCodeTemplateDialog({ open, onOpenChange, stats, hasExistingCode, onInsert }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: Stat[];
  hasExistingCode: boolean;
  onInsert: (code: string) => void;
}) {
  const [userTemplates, setUserTemplates] = useState<StatCodeTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>(BUILT_IN_TEMPLATES[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<StatCodeTemplate | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const all = useMemo(
    () => [...BUILT_IN_TEMPLATES, ...[...userTemplates].sort((a, b) => a.name.localeCompare(b.name))],
    [userTemplates],
  );
  const selected = all.find(template => template.id === selectedId) ?? all[0];
  const parsed = useMemo(() => parseTemplateSlots(selected?.code ?? ''), [selected?.code]);

  // Each newly selected template starts from its own declared defaults rather than inheriting the last
  // template's answers, which would silently carry a stat name into a slot that never asked for it.
  useEffect(() => {
    setValues(defaultSlotValues(parsed.slots));
  }, [parsed.slots]);

  const problems = validateSlotValues(parsed.slots, values);
  const filled = fillTemplate(selected?.code ?? '', values);
  const blocked = Object.keys(problems).length > 0 || parsed.errors.length > 0;

  const insert = () => {
    onInsert(filled);
    onOpenChange(false);
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
    try {
      await deleteUserTemplate(template.id);
      await refresh();
      setSelectedId(BUILT_IN_TEMPLATES[0].id);
    } catch (error) {
      toast.error(`Couldn’t delete: ${(error as Error).message}`);
    }
  };

  const exportPack = () => {
    if (userTemplates.length === 0) return;
    const json = JSON.stringify(buildTemplatePack(userTemplates), null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }), 'stat-templates.json');
  };

  const importPack = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = filesFrom(event);
    if (!file) return;
    try {
      const added = await importTemplates(parseTemplatePack(await file.text()));
      await refresh();
      toast.success(added > 0 ? `Imported ${added} template${added === 1 ? '' : 's'}` : 'Those templates are already in your library');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const draftSlots = draft ? parseTemplateSlots(draft.code) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Code Templates</DialogTitle></DialogHeader>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importPack} />

        {draft ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-label">Name</span>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label">Description</span>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label">Code</span>
              <Textarea
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                className="font-mono text-label"
                rows={10}
              />
            </label>
            <p className="text-meta text-muted-foreground">
              Write a slot as <code>{'{{name:type=default}}'}</code>. Types are <code>stat</code>,{' '}
              <code>number</code>, <code>daypart</code>, <code>choice(a|b)</code> and <code>text</code>.
              Stat and daypart slots become quoted strings; the rest are pasted as written, so quote them
              yourself when you need a string.
            </p>
            {draftSlots && (
              <p className="text-meta text-muted-foreground">
                {draftSlots.errors.length > 0
                  ? <span className="text-destructive">{draftSlots.errors.join(' ')}</span>
                  : `Fields this template will ask for: ${draftSlots.slots.map(slot => `${slot.name} (${slot.type})`).join(', ') || 'none'}`}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              <Button disabled={!draft.name.trim() || !draft.code.trim()} onClick={() => void saveDraft()}>Save Template</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2 min-w-0">
              <ScrollArea className="h-72 rounded-md border">
                <div className="p-2 flex flex-col gap-1">
                  <p className="text-meta text-muted-foreground px-1 pt-1">Built-In</p>
                  {BUILT_IN_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedId(template.id)}
                      className={`text-left text-label rounded px-2 py-1 ${template.id === selected?.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
                    >
                      {template.name}
                    </button>
                  ))}
                  <p className="text-meta text-muted-foreground px-1 pt-2">My Templates</p>
                  {userTemplates.length === 0 && <p className="text-meta text-muted-foreground px-2 py-1">None yet.</p>}
                  {[...userTemplates].sort((a, b) => a.name.localeCompare(b.name)).map(template => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedId(template.id)}
                      className={`text-left text-label rounded px-2 py-1 ${template.id === selected?.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex flex-wrap gap-1">
                <Button variant="outline" size="sm" onClick={() => setDraft({ ...BLANK_TEMPLATE })}>
                  <Plus className="h-4 w-4 mr-1" />New
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" />Import
                </Button>
                <Button variant="outline" size="sm" disabled={userTemplates.length === 0} onClick={exportPack}>
                  <Download className="h-4 w-4 mr-1" />Export
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-0">
              {selected && (
                <>
                  <div>
                    <p className="text-label font-medium">{selected.name}</p>
                    <p className="text-helper text-muted-foreground">{selected.description}</p>
                  </div>

                  {parsed.errors.length > 0 && (
                    <p className="text-helper text-destructive">{parsed.errors.join(' ')}</p>
                  )}

                  {parsed.slots.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {parsed.slots.map(slot => (
                        <SlotField
                          key={slot.name}
                          slot={slot}
                          stats={stats}
                          value={values[slot.name] ?? ''}
                          problem={problems[slot.name]}
                          onChange={(value) => setValues(prev => ({ ...prev, [slot.name]: value }))}
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <Label className="text-label">Preview</Label>
                    <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-meta whitespace-pre-wrap">{filled}</pre>
                  </div>

                  {hasExistingCode && (
                    <p className="text-meta text-muted-foreground">This replaces the code already in the field.</p>
                  )}

                  <div className="flex flex-wrap justify-end gap-2">
                    {isBuiltInTemplate(selected.id) ? (
                      <Button
                        variant="outline"
                        onClick={() => setDraft({ ...selected, id: '', name: `${selected.name} Copy` })}
                      >
                        <Copy className="h-4 w-4 mr-1" />Duplicate
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setDraft({ ...selected })}>
                          <Pencil className="h-4 w-4 mr-1" />Edit
                        </Button>
                        <Button variant="outline" onClick={() => void remove(selected)}>
                          <Trash2 className="h-4 w-4 mr-1" />Delete
                        </Button>
                      </>
                    )}
                    <Button disabled={blocked} onClick={insert}>
                      {hasExistingCode ? 'Replace Code' : 'Insert Code'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default StatCodeTemplateDialog;
