import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, Save } from "lucide-react";
import { ConfirmDialog } from '../ConfirmDialog';
import { getAllSaveRecords } from './dbUtils';
import { useDevRoute } from '../../lib/devRouter';
import { LoadGameDialog } from './LoadGameDialog';
import type { WorldOverview, SaveRecord } from "@/types";

export const MenuModal = ({ onSettingsClick, onSave, onLoad, worldOverview, worldId, onExitToMenu, onEditWorld, onShowAiContext }: {
  onSettingsClick: () => void;
  onSave: (saveName: string, opts?: { overwriteId?: string }) => Promise<unknown> | void;
  /** `worldId` set ⇒ the save belongs to a different (installed) world; the loader switches to it first. */
  onLoad: (saveId: string, worldId?: string) => Promise<unknown> | void;
  worldOverview?: WorldOverview;
  /** Stable id of the currently loaded world (from GameData) — the current world's folder key. */
  worldId?: string;
  onExitToMenu: () => void;
  /** Optional extra items — used on mobile, where these live in the menu instead of their own header buttons. */
  onEditWorld?: () => void;
  onShowAiContext?: () => void;
}) => {
  const current = React.useMemo(
    () => ({ id: worldId ? String(worldId) : '__none__', name: worldOverview?.name ?? 'Current World' }),
    [worldId, worldOverview],
  );

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [showLoadDialog, setShowLoadDialog] = React.useState(false);
  const devRoute = useDevRoute();
  React.useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'menu') setShowLoadDialog(true);
  }, [devRoute?.modal]);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [saveName, setSaveName] = React.useState('');
  const [records, setRecords] = React.useState<SaveRecord[]>([]);
  const [dupConflict, setDupConflict] = React.useState<{ name: string; existingId: string } | null>(null);

  // Load existing saves when the Save dialog opens, to detect a same-name save in the current world.
  React.useEffect(() => {
    if (!showSaveDialog) return;
    let cancelled = false;
    void getAllSaveRecords().then(all => { if (!cancelled) setRecords(all); }).catch(() => {});
    return () => { cancelled = true; };
  }, [showSaveDialog]);

  const resolvesToCurrent = React.useCallback((r: SaveRecord) =>
    r.worldId ? r.worldId === current.id : (r.currentState?.worldName ?? null) === current.name,
    [current],
  );

  const commitSave = async (name: string, overwriteId?: string) => {
    try {
      await onSave(name, overwriteId ? { overwriteId } : undefined);
      setSaveName('');
      setShowSaveDialog(false);
      setDupConflict(null);
    } catch (error) {
      console.error('Error saving game:', error);
    }
  };

  const handleSaveClick = async () => {
    const name = saveName.trim();
    if (!name) return;
    const existing = records.find(r => r.name === name && resolvesToCurrent(r));
    if (existing) setDupConflict({ name, existingId: existing.id });
    else await commitSave(name);
  };

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button className="flex items-center justify-center rounded-full w-10 h-10 p-0" title="Menu">
            <Menu className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          <div className="flex flex-col">
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); setShowSaveDialog(true); }}>Save Game</Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); setShowLoadDialog(true); }}>Load Game</Button>
            {onEditWorld && <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); onEditWorld(); }}>Edit World</Button>}
            {onShowAiContext && <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); onShowAiContext(); }}>AI Context</Button>}
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); onSettingsClick(); }}>Settings</Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); setShowExitConfirm(true); }}>Exit to Main Menu</Button>
          </div>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={showExitConfirm}
        onOpenChange={setShowExitConfirm}
        title="Exit to Main Menu"
        description="Are you sure you want to exit to the main menu? Any unsaved progress will be lost."
        onConfirm={onExitToMenu}
      />

      {/* Save Game popup */}
      <Dialog open={showSaveDialog} onOpenChange={(open) => { setShowSaveDialog(open); if (!open) setSaveName(''); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save Game</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 py-4">
            <Input
              placeholder="Enter save name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveClick(); }}
            />
            <Button onClick={handleSaveClick} className="flex items-center justify-center gap-2">
              <Save className="h-4 w-4" />
              <span>Save</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate-name-in-world resolution */}
      <Dialog open={!!dupConflict} onOpenChange={(open) => { if (!open) setDupConflict(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save already exists</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            A save named “{dupConflict?.name}” already exists in this world. Overwrite it, or keep both?
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDupConflict(null)}>Cancel</Button>
            <Button variant="secondary" onClick={() => dupConflict && commitSave(dupConflict.name)}>Keep both</Button>
            <Button variant="destructive" onClick={() => dupConflict && commitSave(dupConflict.name, dupConflict.existingId)}>Overwrite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LoadGameDialog open={showLoadDialog} onOpenChange={setShowLoadDialog} current={current} onLoad={onLoad} />
    </>
  );
};
