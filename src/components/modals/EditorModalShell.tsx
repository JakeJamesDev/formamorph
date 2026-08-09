import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Save, Upload } from 'lucide-react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';

interface EditorModalShellProps {
  open: boolean;
  /** Header title — the record's name, or a fallback while unnamed. */
  title: string;
  /** Width/height overrides for the dialog surface (the two editors differ in width). */
  contentClassName: string;
  /** While true, the body/footer are replaced by a centered "Loading…"; tabs are hidden. */
  loading: boolean;
  tabs: { value: string; label: string }[];
  tab: string;
  onTabChange: (value: string) => void;
  /** Drives the Save button's disabled state and the close-time unsaved prompt. */
  hasUnsavedChanges: boolean;
  /** Persist; resolves `true` on success so save-and-exit only closes when the write succeeded. */
  onSave: () => Promise<boolean>;
  onClose: () => void;
  onExport: () => void;
  /** When provided (signed in), renders a Publish button wired to this handler. */
  onPublish?: () => void;
  /** The loaded editor body (already tab-switched and, for dictionaries, store-wrapped by the caller). */
  children: ReactNode;
}

/**
 * Shared chrome for the library entity/dictionary editors: the dialog surface, a title + two-tab header,
 * the Export / Publish / Save footer, and the unsaved-changes-on-close handshake. The concrete editor
 * supplies the tab labels, the loaded body, and the save/download/publish handlers; everything data-model
 * specific stays in the caller.
 */
const EditorModalShell = ({
  open, title, contentClassName, loading, tabs, tab, onTabChange,
  hasUnsavedChanges, onSave, onClose, onExport, onPublish, children,
}: EditorModalShellProps) => {
  const [showUnsaved, setShowUnsaved] = useState(false);
  const attemptClose = () => { if (hasUnsavedChanges) setShowUnsaved(true); else onClose(); };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) attemptClose(); }}>
        <DialogContent aria-describedby={undefined} className={contentClassName}>
          {/* The switcher sits in the header and the body below it, so one root spans both. `contents` on the
              root and each panel keeps the body a direct flex child of the dialog, as it was unwrapped. */}
          <Tabs value={tab} onValueChange={onTabChange} className="contents">
            <DialogHeader className="px-4 py-3 border-b shrink-0 flex-row items-center gap-3">
              {/* `leading-normal` replaces DialogTitle's `leading-none`, whose one-em line box crops
                  descenders under `truncate`'s overflow clip. */}
              <DialogTitle className="truncate flex-1 leading-normal">{title}</DialogTitle>
              {!loading && (
                <TabsList>
                  {tabs.map((t) => (
                    <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                  ))}
                </TabsList>
              )}
              <div className="flex-1" />
            </DialogHeader>
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-helper text-muted-foreground">Loading…</div>
            ) : (
              <>
                {/* A panel per tab so every trigger's `aria-controls` resolves; the caller hands us only the
                    active tab's body, so the rest render empty. */}
                {tabs.map((t) => (
                  <TabsContent key={t.value} value={t.value} className="contents">
                    {t.value === tab ? children : null}
                  </TabsContent>
                ))}
                <div className="px-4 py-3 border-t shrink-0 flex justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={onExport}>
                    <Download className="h-4 w-4 mr-2" /> Export
                  </Button>
                  <div className="flex gap-2">
                    {onPublish && (
                      // Publishes what's on screen, saved or not — the same thing Save would write.
                      <Button variant="outline" size="sm" onClick={onPublish}>
                        <Upload className="h-4 w-4 mr-2" /> Publish
                      </Button>
                    )}
                    <Button size="sm" onClick={onSave} disabled={!hasUnsavedChanges}>
                      <Save className="h-4 w-4 mr-2" /> Save
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog
        open={showUnsaved}
        onOpenChange={setShowUnsaved}
        onSave={async () => { if (await onSave()) onClose(); }}
        onExit={onClose}
      />
    </>
  );
};

export default EditorModalShell;
