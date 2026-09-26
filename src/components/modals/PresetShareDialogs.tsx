import { useMemo, useRef, useState } from 'react';
import { useResetOnOpen } from '@/lib/useResetOnOpen';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-toastify';
import { downloadBlob } from '@/lib/downloadBlob';
import { filesFrom } from '@/lib/importFiles';
import { CHIP_BASE } from '@/components/Chip';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { cn } from '@/lib/utils';
import { hasOverviewContent, type PresetOverview } from '@/lib/promptPresets';
import {
  serializeSharedJson, serializeSharedCode, parseSharedAny,
  type SharedPreset, type ImportedPreset, type ParseResult,
} from '@/lib/promptPresetShare';
import { PRESET_SCRIPT_TOOL_WARNING, planPresetTools } from '@/lib/tools/toolPack';
import type { Tool } from '@/types';

const safeFile = (name: string) => (name.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'preset');

/** Export dialog: the share code (copy) plus a .json download, for the selected preset. */
export function ExportPresetDialog({ open, onOpenChange, shared }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shared: SharedPreset | null;
}) {
  if (!shared) return null;
  const code = serializeSharedCode(shared);
  const copy = () => { void navigator.clipboard.writeText(code).then(() => toast.success('Share code copied')); };
  const download = () => downloadBlob(new Blob([serializeSharedJson(shared)], { type: 'application/json' }), `${safeFile(shared.name)}.preset.json`);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Export “{shared.name}”</DialogTitle></DialogHeader>
        <p className="text-helper text-muted-foreground">Share this preset as a code to paste, or a file to send.</p>
        <textarea
          readOnly
          value={code}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full h-24 resize-none rounded-md border bg-muted/40 p-2 font-mono text-meta"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={download}>Export .json</Button>
          <Button onClick={copy}>Copy code</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The imported preset's Overview, one row per field that has content. */
function OverviewPreview({ overview }: { overview: PresetOverview }) {
  const chips = (items: string[]) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => <span key={t} className={cn(CHIP_BASE, 'bg-primary text-primary-foreground')}>{t}</span>)}
    </div>
  );
  if (!hasOverviewContent(overview)) return null;
  const { author, description, tags, models } = overview;
  return (
    <dl aria-label="Overview" className="flex flex-col gap-2 rounded-md border p-3 max-h-60 overflow-y-auto">
      {author && <OverviewRow label="Author"><span className="text-label">{author}</span></OverviewRow>}
      {description && <OverviewRow label="Description"><div className="text-muted-foreground"><MarkdownRenderer text={description} /></div></OverviewRow>}
      {tags.length > 0 && <OverviewRow label="Tags">{chips(tags)}</OverviewRow>}
      {models.length > 0 && <OverviewRow label="Models">{chips(models)}</OverviewRow>}
    </dl>
  );
}

function OverviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-helper font-semibold text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Import dialog: choose a file or paste a code → preview warnings, Overview, and name → pick tuning + collision handling → add. */
export function ImportPresetDialog({ open, onOpenChange, currentAppVersion, existingUserNames, userTools, onImport }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentAppVersion: string;
  existingUserNames: { id: string; name: string }[];
  /** The player's Tools, which embedded Tools merge into by name. */
  userTools: readonly Tool[];
  onImport: (imported: ImportedPreset, opts: { includeTuning: boolean; name: string; overwriteId?: string }) => void;
}) {
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [name, setName] = useState('');
  const [includeTuning, setIncludeTuning] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset on open, not close — clearing on close blanks the still-visible fields during the fade-out.
  useResetOnOpen(open, () => { setParsed(null); setName(''); setIncludeTuning(true); setOverwrite(false); });

  const ingest = (text: string) => {
    if (!text.trim()) { setParsed(null); return; }
    const r = parseSharedAny(text, currentAppVersion);
    setParsed(r);
    setOverwrite(false);
    if (r.ok && r.preset) setName(r.preset.name);
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const [f] = filesFrom(e);
    if (f) ingest(await f.text());
  };

  const warnings = useMemo(() => {
    if (!parsed?.preset) return [];
    const addsScript = planPresetTools(userTools, parsed.preset.tools ?? [], () => '').hasScript;
    return addsScript ? [...parsed.warnings, PRESET_SCRIPT_TOOL_WARNING] : parsed.warnings;
  }, [parsed, userTools]);
  const hasTuning = !!(parsed?.preset && (parsed.preset.samplers || parsed.preset.reasoning || parsed.preset.maxOutput || parsed.preset.verbatim));
  const collision = parsed?.ok ? existingUserNames.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()) : undefined;
  const canAdd = !!(parsed?.ok && name.trim());
  const submit = () => {
    if (!parsed?.preset) return;
    onImport(parsed.preset, { includeTuning, name: name.trim(), overwriteId: collision && overwrite ? collision.id : undefined });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Import Preset</DialogTitle></DialogHeader>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose file…</Button>
          <span className="text-meta text-muted-foreground">or paste a share code below</span>
        </div>
        <textarea
          placeholder="FMPRESET1:…"
          onChange={(e) => ingest(e.target.value)}
          className="w-full h-20 resize-none rounded-md border bg-muted/40 p-2 font-mono text-meta"
        />

        {parsed && !parsed.ok && <p className="text-label text-destructive">{parsed.error}</p>}

        {parsed?.ok && (
          <div className="flex flex-col gap-3">
            {warnings.map((w, i) => (
              <p key={i} className="text-meta text-amber-600 dark:text-amber-500">⚠ {w}</p>
            ))}
            {parsed.preset?.overview && <OverviewPreview overview={parsed.preset.overview} />}
            <label className="flex flex-col gap-1 text-label">
              Name
              <Input value={name} onChange={(e) => { setName(e.target.value); setOverwrite(false); }} />
            </label>
            {hasTuning && (
              <label className="flex items-start gap-2">
                <Checkbox checked={includeTuning} onCheckedChange={(c) => setIncludeTuning(c === true)} className="mt-0.5 shrink-0" />
                <span className="text-meta text-muted-foreground">Include the preset&apos;s tuning (per-prompt samplers, reasoning, max output, and verbatim turns). Uncheck to import the prompt text only.</span>
              </label>
            )}
            {collision && (
              <label className="flex items-start gap-2">
                <Checkbox checked={overwrite} onCheckedChange={(c) => setOverwrite(c === true)} className="mt-0.5 shrink-0" />
                <span className="text-meta text-muted-foreground">A preset named “{collision.name}” already exists. Overwrite it — otherwise a separate copy is added.</span>
              </label>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canAdd} onClick={submit}>{collision && overwrite ? 'Overwrite' : 'Import'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
