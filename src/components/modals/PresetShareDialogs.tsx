import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-toastify';
import { downloadBlob } from '@/lib/downloadBlob';
import {
  serializeSharedJson, serializeSharedCode, parseSharedAny,
  type SharedPreset, type ImportedPreset, type ParseResult,
} from '@/lib/promptPresetShare';

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
        <p className="text-sm text-muted-foreground">Share this preset as a code to paste, or a file to send.</p>
        <textarea
          readOnly
          value={code}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full h-24 resize-none rounded-md border bg-muted/40 p-2 font-mono text-xs"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={download}>Download .json</Button>
          <Button onClick={copy}>Copy code</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Import dialog: choose a file or paste a code → preview name + warnings → pick tuning + collision handling → add. */
export function ImportPresetDialog({ open, onOpenChange, currentAppVersion, existingUserNames, onImport }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentAppVersion: string;
  existingUserNames: { id: string; name: string }[];
  onImport: (imported: ImportedPreset, opts: { includeTuning: boolean; name: string; overwriteId?: string }) => void;
}) {
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [name, setName] = useState('');
  const [includeTuning, setIncludeTuning] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setParsed(null); setName(''); setIncludeTuning(true); setOverwrite(false); }
  }, [open]);

  const ingest = (text: string) => {
    if (!text.trim()) { setParsed(null); return; }
    const r = parseSharedAny(text, currentAppVersion);
    setParsed(r);
    setOverwrite(false);
    if (r.ok && r.preset) setName(r.preset.name);
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) ingest(await f.text());
    e.target.value = ''; // allow re-picking the same file
  };

  const hasTuning = !!(parsed?.preset && (parsed.preset.samplers || parsed.preset.reasoning || parsed.preset.verbatim));
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
          <span className="text-xs text-muted-foreground">or paste a share code below</span>
        </div>
        <textarea
          placeholder="FMPRESET1:…"
          onChange={(e) => ingest(e.target.value)}
          className="w-full h-20 resize-none rounded-md border bg-muted/40 p-2 font-mono text-xs"
        />

        {parsed && !parsed.ok && <p className="text-sm text-destructive">{parsed.error}</p>}

        {parsed?.ok && (
          <div className="flex flex-col gap-3">
            {parsed.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-500">⚠ {w}</p>
            ))}
            <label className="flex flex-col gap-1 text-sm">
              Name
              <Input value={name} onChange={(e) => { setName(e.target.value); setOverwrite(false); }} />
            </label>
            {hasTuning && (
              <label className="flex items-start gap-2">
                <Checkbox checked={includeTuning} onCheckedChange={(c) => setIncludeTuning(c === true)} className="mt-0.5 shrink-0" />
                <span className="text-xs text-muted-foreground">Include the preset&apos;s tuning (per-prompt samplers, reasoning, and verbatim turns). Uncheck to import the prompt text only.</span>
              </label>
            )}
            {collision && (
              <label className="flex items-start gap-2">
                <Checkbox checked={overwrite} onCheckedChange={(c) => setOverwrite(c === true)} className="mt-0.5 shrink-0" />
                <span className="text-xs text-muted-foreground">A preset named “{collision.name}” already exists. Overwrite it — otherwise a separate copy is added.</span>
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
