import { useEffect, useRef, useState } from 'react';
import { useResetOnOpen } from '@/lib/useResetOnOpen';
import { useMountedRef } from '@/lib/useMountedRef';
import { filesFrom } from '@/lib/importFiles';
import { toastError } from '@/lib/linkToast';
import { Archive } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hint, Meta } from '@/components/ui/typography';
import { BreadcrumbLabel, BreadcrumbTip } from '@/components/ui/breadcrumb-picker';
import {
  buildBackup,
  saveBackup,
  listBackupItems,
  readBackupIndex,
  analyzeBackup,
  restoreBackup,
  optimizes,
  BACKUP_CATEGORIES,
  CATEGORY_LABELS,
  type BackupCategory,
  type BackupIndex,
  type BackupItem,
  type CategoryPlan,
} from '@/lib/backup';
import type { OptimizeMode } from '@/lib/imageOptim';
import { supportsWebp } from '@/lib/imageOptimWorkerClient';
import { withOptimizeProgress } from '@/lib/optimizeProgress';
import { targetAttribute } from '@/lib/surface/surfaceTargets';

const OPTIMIZE_MODES: { value: OptimizeMode; label: string }[] = [
  { value: 'off', label: 'Keep as-is' },
  { value: 'optimize', label: 'Optimize' },
  { value: 'downscale', label: 'Downscale' },
];

/** Compact 3-way image-handling selector for a data type on restore. */
function OptimizeSelect({ label, value, onChange }: { label: string; value: OptimizeMode; onChange: (m: OptimizeMode) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-label">
      <span className="text-muted-foreground">{label} images</span>
      <div className="flex rounded-md border p-0.5">
        {OPTIMIZE_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={`rounded px-2 py-0.5 text-meta ${value === m.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type Step = 'backup-what' | 'backup-done' | 'restore-reading' | 'restore-what' | 'restore-done';

/** What the dialog opens on: the backup list, or the restore list for a picked file. */
export type BackupStart = { kind: 'backup' } | { kind: 'restore'; file: File };

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
    <ScrollArea className="max-h-[55dvh]">
      <div className="flex flex-col gap-2">
        {groups.map(({ category, rows }) => {
          const sel = selected[category];
          const onCount = rows.filter((r) => sel.has(r.id)).length;
          const parent = onCount === 0 ? false : onCount === rows.length ? true : 'indeterminate';
          const hasConflicts = rows.some((r) => r.exists);
          return (
            <div key={category} className="rounded-md border">
              <div className="flex items-center justify-between gap-2 border-b p-2">
                <label className="flex items-center gap-2 text-label font-medium">
                  <Checkbox checked={parent} onCheckedChange={(v) => onToggleAll(category, v === true)} />
                  {CATEGORY_LABELS[category]}
                  <span className="font-normal text-muted-foreground">
                    ({onCount}/{rows.length})
                  </span>
                </label>
                {overwrite && onToggleOverwrite && hasConflicts && (
                  <label className="flex items-center gap-1.5 text-meta">
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
                  <BreadcrumbTip key={r.id} breadcrumb={r.breadcrumb}>
                    <label className="flex items-center gap-2 rounded px-2 py-1 text-label hover:bg-muted/50">
                      <Checkbox checked={sel.has(r.id)} onCheckedChange={(v) => onToggleItem(category, r.id, v === true)} />
                      <BreadcrumbLabel name={r.label} breadcrumb={r.breadcrumb} />
                      {r.exists && (
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                          exists
                        </span>
                      )}
                    </label>
                  </BreadcrumbTip>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

/** The Settings Data row's Back Up and Restore buttons. Restore picks the file before the dialog opens. */
export function BackupRestoreButtons({ onStart, backUpLabel, restoreLabel }: { onStart: (start: BackupStart) => void; backUpLabel: string; restoreLabel: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = filesFrom(event);
    if (file) onStart({ kind: 'restore', file });
  };
  return (
    <div className="flex flex-wrap gap-2">
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
      <Button variant="outline" size="sm" onClick={() => onStart({ kind: 'backup' })} {...targetAttribute('settings.data', 'start-backup')}>
        {backUpLabel}
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} {...targetAttribute('settings.data', 'start-restore')}>
        {restoreLabel}
      </Button>
    </div>
  );
}

/**
 * Backup & Restore. Backup picks the worlds, saves, entities and dictionaries to save to a file. Restore
 * reads the file `start` carries, then picks what to bring back; each group's Overwrite existing governs
 * its stored items.
 */
export function BackupRestoreDialog({ open, start, onOpenChange }: { open: boolean; start: BackupStart; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<Step>(start.kind === 'backup' ? 'backup-what' : 'restore-reading');
  const [busy, setBusy] = useState(false);
  const mounted = useMountedRef();

  // Backup state
  const [items, setItems] = useState<Record<BackupCategory, BackupItem[]> | null>(null);
  const [exportSel, setExportSel] = useState<SelState>(emptySel);

  // Restore state
  const [index, setIndex] = useState<BackupIndex | null>(null);
  const [plans, setPlans] = useState<CategoryPlan[] | null>(null);
  const [restoreSel, setRestoreSel] = useState<SelState>(emptySel);
  const [overwrite, setOverwrite] = useState<Record<BackupCategory, boolean>>(emptyFlags);
  const [worldOpt, setWorldOpt] = useState<OptimizeMode>('off');
  const [entityOpt, setEntityOpt] = useState<OptimizeMode>('off');

  const reset = () => {
    setStep(start.kind === 'backup' ? 'backup-what' : 'restore-reading');
    setBusy(false);
    setItems(null);
    setExportSel(emptySel());
    setIndex(null);
    setPlans(null);
    setRestoreSel(emptySel());
    setOverwrite(emptyFlags());
    setWorldOpt('off');
    setEntityOpt('off');
  };

  // Resets on open, before paint; a reset on close would swap the content during the exit animation.
  useResetOnOpen(open, reset);

  // Load items (and select them all by default) each time the dialog opens on the backup step.
  useEffect(() => {
    if (!open || step !== 'backup-what') return;
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
  }, [open, step]);

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
        ...p.fresh.map((r) => ({ id: r.id, label: r.label, breadcrumb: r.breadcrumb })),
        ...p.conflicts.map((r) => ({ id: r.id, label: r.label, breadcrumb: r.breadcrumb, exists: true })),
      ],
    }));
  const restoreCount = BACKUP_CATEGORIES.reduce((n, c) => n + restoreSel[c].size, 0);

  // Reads the picked file once the dialog opens on it. A file that fails to read closes the dialog.
  const restoreFile = open && start.kind === 'restore' ? start.file : null;
  useEffect(() => {
    if (!restoreFile) return;
    let live = true;
    (async () => {
      try {
        const read = await readBackupIndex(restoreFile);
        const analyzed = await analyzeBackup(read);
        if (!live) return;
        setIndex(read);
        setPlans(analyzed);
        const sel = emptySel();
        for (const p of analyzed) sel[p.category] = new Set([...p.fresh, ...p.conflicts].map((r) => r.id));
        setRestoreSel(sel);
        setOverwrite(emptyFlags());
        setStep('restore-what');
      } catch (err) {
        if (!live) return;
        toastError(err, 'Failed to read the backup');
        onOpenChange(false);
      }
    })();
    return () => {
      live = false;
    };
    // onOpenChange is a fresh closure each render; the read belongs to the file alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreFile]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await saveBackup(await buildBackup(exportSel));
      if (mounted.current) setStep('backup-done');
    } catch (err) {
      toastError(err, { headline: `Backup failed: ${(err as Error).message}` });
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!plans || !index) return;
    setBusy(true);
    try {
      // Restore only the ticked items; overwrite still gates whether a ticked conflict replaces the existing one.
      const ticked = plans.map((p) => {
        const keep = (r: CategoryPlan['fresh'][number]) => restoreSel[p.category].has(r.id);
        return { category: p.category, fresh: p.fresh.filter(keep), conflicts: p.conflicts.filter(keep) };
      });
      const modes = { worlds: worldOpt, entities: entityOpt };
      // How many images the chosen modes will touch, for the progress dialog.
      const totalImages = ticked.reduce((n, p) => {
        if (!optimizes(modes, p.category)) return n;
        const written = [...p.fresh, ...(overwrite[p.category] ? p.conflicts : [])];
        return n + written.reduce((m, r) => m + r.images, 0);
      }, 0);

      // The worker reads, optimizes and writes each record in turn; the WebP probe needs this thread's DOM.
      // It runs to the end even if the dialog closes: stopping midway would leave half a restore.
      const request = { index, plans: ticked, overwrite, modes, webpSupported: supportsWebp() };
      if (totalImages) await withOptimizeProgress(totalImages, (tick) => restoreBackup(request, tick));
      else await restoreBackup(request);
      if (mounted.current) setStep('restore-done');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      toastError(err, { headline: `Restore failed: ${(err as Error).message}` });
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="backup" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Archive className="h-4 w-4" /> Backup &amp; Restore</DialogTitle>
          <DialogDescription>
            {step.startsWith('backup') && 'Backup'}
            {step.startsWith('restore') && 'Restore'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {step === 'restore-reading' && <Meta as="p">Reading the backup…</Meta>}

          {step === 'backup-what' &&
            (items === null ? (
              <Meta as="p">Checking your library…</Meta>
            ) : exportGroups.length === 0 ? (
              <Meta as="p">Nothing to back up yet</Meta>
            ) : (
              <div className="flex flex-col gap-2">
                <Hint>Select what to back up</Hint>
                <CategoryTree
                  groups={exportGroups}
                  selected={exportSel}
                  onToggleItem={toggleItem(setExportSel)}
                  onToggleAll={toggleAll(setExportSel, () => exportGroups)}
                />
              </div>
            ))}

          {step === 'backup-done' && (
            <Meta as="p">Backup saved. Keep the file somewhere safe.</Meta>
          )}

          {step === 'restore-what' &&
            (restoreGroups.length === 0 ? (
              <Meta as="p">This backup is empty, so there&apos;s nothing to restore.</Meta>
            ) : (
              <div className="flex flex-col gap-2">
                <Hint>
                  Select what to restore. An item tagged <span className="uppercase">exists</span> is already
                  stored. Turn on <strong>Overwrite existing</strong> for its group to replace it.
                </Hint>
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
                      <OptimizeSelect label="Entity" value={entityOpt} onChange={setEntityOpt} />
                    )}
                  </div>
                )}
              </div>
            ))}

          {step === 'restore-done' && <Meta as="p">Backup restored. Reloading…</Meta>}
        </div>

        <DialogFooter>
          {step === 'restore-reading' && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === 'backup-what' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy || exportCount === 0}>
                Save backup
              </Button>
            </>
          )}

          {step === 'backup-done' && <Button onClick={() => onOpenChange(false)}>Done</Button>}

          {step === 'restore-what' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
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
