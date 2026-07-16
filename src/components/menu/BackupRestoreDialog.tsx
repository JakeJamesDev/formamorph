import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  buildBackup,
  saveBackup,
  listBackupItems,
  parseBackup,
  analyzeBackup,
  applyBackup,
  itemLabel,
  BACKUP_CATEGORIES,
  CATEGORY_LABELS,
  type BackupCategory,
  type BackupItem,
  type CategoryPlan,
} from '@/lib/backup';
import { applyWorldOptimize, applyImageOptimize, type OptimizeMode } from '@/lib/imageOptim';
import type { World, Entity } from '@/types';

const OPTIMIZE_MODES: { value: OptimizeMode; label: string }[] = [
  { value: 'off', label: 'Keep as-is' },
  { value: 'optimize', label: 'Optimize' },
  { value: 'downscale', label: 'Downscale' },
];

/** Compact 3-way image-handling selector for a data type on restore. */
function OptimizeSelect({ label, value, onChange }: { label: string; value: OptimizeMode; onChange: (m: OptimizeMode) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label} images</span>
      <div className="flex rounded-md border p-0.5">
        {OPTIMIZE_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={`rounded px-2 py-0.5 text-xs ${value === m.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type Step = 'home' | 'backup-what' | 'backup-done' | 'restore-what' | 'restore-done';

/** A category and the selectable rows under it; `exists` marks a restore item that collides with a stored one. */
interface Group {
  category: BackupCategory;
  rows: (BackupItem & { exists?: boolean })[];
}

type SelState = Record<BackupCategory, Set<string>>;
const emptySel = (): SelState => ({ worlds: new Set(), saves: new Set(), entities: new Set(), dictionaries: new Set() });
const emptyFlags = (): Record<BackupCategory, boolean> => ({
  worlds: false,
  saves: false,
  entities: false,
  dictionaries: false,
});

/** Grouped checklist: each category is a header with a (tri-state) select-all toggle over its child items;
 *  restore groups also expose an "Overwrite existing" toggle that governs their conflicting items. */
function CategoryTree({
  groups,
  selected,
  onToggleItem,
  onToggleAll,
  overwrite,
  onToggleOverwrite,
}: {
  groups: Group[];
  selected: SelState;
  onToggleItem: (c: BackupCategory, id: string, on: boolean) => void;
  onToggleAll: (c: BackupCategory, on: boolean) => void;
  overwrite?: Record<BackupCategory, boolean>;
  onToggleOverwrite?: (c: BackupCategory, on: boolean) => void;
}) {
  return (
    <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
      {groups.map(({ category, rows }) => {
        const sel = selected[category];
        const onCount = rows.filter((r) => sel.has(r.id)).length;
        const parent = onCount === 0 ? false : onCount === rows.length ? true : 'indeterminate';
        const hasConflicts = rows.some((r) => r.exists);
        return (
          <div key={category} className="rounded-md border">
            <div className="flex items-center justify-between gap-2 border-b p-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={parent} onCheckedChange={(v) => onToggleAll(category, v === true)} />
                {CATEGORY_LABELS[category]}
                <span className="font-normal text-muted-foreground">
                  ({onCount}/{rows.length})
                </span>
              </label>
              {overwrite && onToggleOverwrite && hasConflicts && (
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={overwrite[category]}
                    onCheckedChange={(v) => onToggleOverwrite(category, v === true)}
                  />
                  Overwrite existing
                </label>
              )}
            </div>
            <div className="flex flex-col p-1">
              {rows.map((r) => (
                <label key={r.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50">
                  <Checkbox checked={sel.has(r.id)} onCheckedChange={(v) => onToggleItem(category, r.id, v === true)} />
                  <span className="truncate">{r.label}</span>
                  {r.exists && (
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      exists
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Backup & Restore wizard. Backup: choose which individual worlds/saves/characters/dictionaries to
 * include (grouped, per-item), then save to a file (native picker, download fallback). Restore: pick a
 * file, then choose which items to bring back — items that already exist are tagged, and each group's
 * "Overwrite existing" decides whether those are replaced.
 */
export function BackupRestoreDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('home');
  const [busy, setBusy] = useState(false);

  // Backup state
  const [items, setItems] = useState<Record<BackupCategory, BackupItem[]> | null>(null);
  const [exportSel, setExportSel] = useState<SelState>(emptySel);

  // Restore state
  const [plans, setPlans] = useState<CategoryPlan[] | null>(null);
  const [restoreSel, setRestoreSel] = useState<SelState>(emptySel);
  const [overwrite, setOverwrite] = useState<Record<BackupCategory, boolean>>(emptyFlags);
  const [worldOpt, setWorldOpt] = useState<OptimizeMode>('off');
  const [entityOpt, setEntityOpt] = useState<OptimizeMode>('off');

  const reset = () => {
    setStep('home');
    setBusy(false);
    setItems(null);
    setExportSel(emptySel());
    setPlans(null);
    setRestoreSel(emptySel());
    setOverwrite(emptyFlags());
    setWorldOpt('off');
    setEntityOpt('off');
  };

  // Reset to the home step when the dialog opens (before paint), not when it closes — resetting on close
  // would swap the content back to the home options mid fade-out, flashing them during the exit animation.
  useLayoutEffect(() => {
    if (open) reset();
  }, [open]);

  // Load items (and select them all by default) when entering the backup step.
  useEffect(() => {
    if (step !== 'backup-what') return;
    let live = true;
    setItems(null);
    listBackupItems()
      .then((list) => {
        if (!live) return;
        setItems(list);
        const sel = emptySel();
        for (const c of BACKUP_CATEGORIES) sel[c] = new Set(list[c].map((i) => i.id));
        setExportSel(sel);
      })
      .catch(() => live && setItems({ worlds: [], saves: [], entities: [], dictionaries: [] }));
    return () => {
      live = false;
    };
  }, [step]);

  const toggleItem = (setter: React.Dispatch<React.SetStateAction<SelState>>) => (c: BackupCategory, id: string, on: boolean) =>
    setter((prev) => {
      const next = new Set(prev[c]);
      if (on) next.add(id);
      else next.delete(id);
      return { ...prev, [c]: next };
    });

  const toggleAll = (
    setter: React.Dispatch<React.SetStateAction<SelState>>,
    groupsFor: () => Group[],
  ) => (c: BackupCategory, on: boolean) =>
    setter((prev) => ({ ...prev, [c]: on ? new Set(groupsFor().find((g) => g.category === c)?.rows.map((r) => r.id)) : new Set() }));

  const exportGroups: Group[] = items
    ? BACKUP_CATEGORIES.filter((c) => items[c].length > 0).map((c) => ({ category: c, rows: items[c] }))
    : [];
  const exportCount = BACKUP_CATEGORIES.reduce((n, c) => n + exportSel[c].size, 0);

  const restoreGroups: Group[] = (plans ?? [])
    .filter((p) => p.fresh.length + p.conflicts.length > 0)
    .map((p) => ({
      category: p.category,
      rows: [
        ...p.fresh.map((r) => ({ id: r.id, label: itemLabel(r) })),
        ...p.conflicts.map((r) => ({ id: r.id, label: itemLabel(r), exists: true })),
      ],
    }));
  const restoreCount = BACKUP_CATEGORIES.reduce((n, c) => n + restoreSel[c].size, 0);

  const pickFile = () => fileRef.current?.click();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    try {
      const bundle = parseBackup(await file.text());
      const analyzed = await analyzeBackup(bundle);
      setPlans(analyzed);
      const sel = emptySel();
      for (const p of analyzed) sel[p.category] = new Set([...p.fresh, ...p.conflicts].map((r) => r.id));
      setRestoreSel(sel);
      setOverwrite(emptyFlags());
      setStep('restore-what');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const result = await saveBackup(await buildBackup(exportSel));
      if (result === 'saved') setStep('backup-done');
    } catch (err) {
      toast.error(`Backup failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!plans) return;
    setBusy(true);
    try {
      // Optimize/downscale a world or character record's images in place before it's written (no-op for 'off').
      const optimize = async (category: BackupCategory, rec: { id: string; [k: string]: unknown }) => {
        if (category === 'worlds' && worldOpt !== 'off') {
          const data = await applyWorldOptimize(rec.data as World, worldOpt);
          return { ...rec, data, thumbnail: data.worldOverview?.thumbnail ?? (rec as { thumbnail?: string }).thumbnail };
        }
        if (category === 'entities' && entityOpt !== 'off') {
          const data = rec.data as Entity;
          const image = await applyImageOptimize(data.image, entityOpt);
          return { ...rec, data: { ...data, image: image ?? undefined } };
        }
        return rec;
      };
      // Restore only the ticked items; overwrite still gates whether a ticked conflict replaces the existing one.
      const filtered = await Promise.all(
        plans.map(async (p) => ({
          category: p.category,
          fresh: await Promise.all(
            p.fresh.filter((r) => restoreSel[p.category].has(r.id)).map((r) => optimize(p.category, r)),
          ),
          conflicts: await Promise.all(
            p.conflicts.filter((r) => restoreSel[p.category].has(r.id)).map((r) => optimize(p.category, r)),
          ),
        })),
      );
      await applyBackup(filtered, overwrite);
      setStep('restore-done');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      toast.error(`Restore failed: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Backup &amp; Restore</DialogTitle>
          <DialogDescription>
            {step === 'home' &&
              'Save your worlds, saves, characters, and dictionaries to a file, or restore them from one. Back up before updating, especially in the itch app.'}
            {step.startsWith('backup') && 'Backup'}
            {step.startsWith('restore') && 'Restore'}
          </DialogDescription>
        </DialogHeader>

        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />

        <div className="py-2">
          {step === 'home' && (
            <div className="flex flex-col gap-3">
              <Button onClick={() => setStep('backup-what')}>Backup</Button>
              <Button variant="outline" onClick={pickFile} disabled={busy}>
                Restore
              </Button>
            </div>
          )}

          {step === 'backup-what' &&
            (items === null ? (
              <p className="text-sm text-muted-foreground">Checking your library…</p>
            ) : exportGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to back up yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Select what to back up:</p>
                <CategoryTree
                  groups={exportGroups}
                  selected={exportSel}
                  onToggleItem={toggleItem(setExportSel)}
                  onToggleAll={toggleAll(setExportSel, () => exportGroups)}
                />
              </div>
            ))}

          {step === 'backup-done' && (
            <p className="text-sm text-muted-foreground">Backup saved. Keep the file somewhere safe.</p>
          )}

          {step === 'restore-what' &&
            (restoreGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">This backup is empty — nothing to restore.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Select what to restore. Items tagged <span className="uppercase">exists</span> already exist —
                  turn on Overwrite for a group to replace those.
                </p>
                <CategoryTree
                  groups={restoreGroups}
                  selected={restoreSel}
                  onToggleItem={toggleItem(setRestoreSel)}
                  onToggleAll={toggleAll(setRestoreSel, () => restoreGroups)}
                  overwrite={overwrite}
                  onToggleOverwrite={(c, on) => setOverwrite((prev) => ({ ...prev, [c]: on }))}
                />
                {restoreGroups.some((g) => g.category === 'worlds' || g.category === 'entities') && (
                  <div className="flex flex-col gap-1.5 rounded-md border p-2">
                    {restoreGroups.some((g) => g.category === 'worlds') && (
                      <OptimizeSelect label="World" value={worldOpt} onChange={setWorldOpt} />
                    )}
                    {restoreGroups.some((g) => g.category === 'entities') && (
                      <OptimizeSelect label="Character" value={entityOpt} onChange={setEntityOpt} />
                    )}
                  </div>
                )}
              </div>
            ))}

          {step === 'restore-done' && <p className="text-sm text-muted-foreground">Backup restored. Reloading…</p>}
        </div>

        <DialogFooter>
          {step === 'home' && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}

          {step === 'backup-what' && (
            <>
              <Button variant="ghost" onClick={() => setStep('home')} disabled={busy}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={busy || exportCount === 0}>
                Save backup
              </Button>
            </>
          )}

          {step === 'backup-done' && <Button onClick={() => onOpenChange(false)}>Done</Button>}

          {step === 'restore-what' && (
            <>
              <Button variant="ghost" onClick={() => setStep('home')} disabled={busy}>
                Back
              </Button>
              <Button onClick={handleRestore} disabled={busy || restoreCount === 0}>
                Restore
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
