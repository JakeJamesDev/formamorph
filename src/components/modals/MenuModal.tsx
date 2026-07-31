import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Menu, Save, FolderOpen, SquarePen, Braces, Settings, MessageSquarePlus, DoorOpen } from "lucide-react";
import { ConfirmDialog } from '../ConfirmDialog';
import { getAllSaveRecords } from './dbUtils';
import { useDevRoute } from '../../lib/devRouter';
import { LoadGameDialog } from './LoadGameDialog';
import { useGameplay } from '../../contexts/GameplayContext';
import { useClosingSnapshot } from '@/lib/useClosingSnapshot';
import { sceneImageWeight } from '@/lib/sceneImages';
import { formatBytes } from '@/lib/imageOptim';
import type { WorldOverview, SaveRecord } from "@/types";

export const MenuModal = ({ onSettingsClick, onReportBug, onSave, onLoad, worldOverview, worldId, onExitToMenu, onEditWorld, onShowAiContext }: {
  onSettingsClick: () => void;
  /** Opens the feedback form. Omitted when the community server is off or nobody is signed in. */
  onReportBug?: () => void;
  onSave: (saveName: string, opts?: { overwriteId?: string; includeSceneImages?: boolean }) => Promise<unknown> | void;
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

  const { lastSaveName, sceneImages } = useGameplay();
  // Scene images are dropped from a save unless asked for — they dwarf everything else in it. The row only
  // appears once the session actually has some, with the real weight rather than a vague warning.
  const [includeSceneImages, setIncludeSceneImages] = React.useState(false);
  const sceneWeight = React.useMemo(
    () => (showSaveDialog ? sceneImageWeight(sceneImages) : { count: 0, bytes: 0 }),
    [showSaveDialog, sceneImages],
  );
  // Hold the conflicting save's name while the "already exists" dialog fades out (dupConflict goes null on close).
  const shownDup = useClosingSnapshot(!!dupConflict, dupConflict);

  // Load existing saves when the Save dialog opens (to detect a same-name save), and prefill the name with
  // the save the player is currently in this session (last loaded or saved), so re-saving is one step.
  React.useEffect(() => {
    if (!showSaveDialog) return;
    setSaveName(lastSaveName);
    let cancelled = false;
    void getAllSaveRecords().then(all => { if (!cancelled) setRecords(all); }).catch(() => {});
    return () => { cancelled = true; };
  }, [showSaveDialog, lastSaveName]);

  const resolvesToCurrent = React.useCallback((r: SaveRecord) =>
    r.worldId ? r.worldId === current.id : (r.currentState?.worldName ?? null) === current.name,
    [current],
  );

  const commitSave = async (name: string, overwriteId?: string) => {
    try {
      await onSave(name, { ...(overwriteId ? { overwriteId } : {}), includeSceneImages });
      // Don't clear the name here — the box would blank out as the dialog fades. The next open re-prefills it.
      setShowSaveDialog(false);
      setDupConflict(null);
    } catch (error) {
      console.error('Error saving game:', error);
    }
  };

  const handleSaveClick = async () => {
    const name = saveName.trim();
    if (!name) return;
    const existing = records.find(r => r.name === name && resolvesToCurrent(r) && !r.isAutosave);
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
        {/* Wide enough for `Exit to Main Menu` plus its icon with room to spare — at w-48 it had 14px. */}
        <PopoverContent align="end" className="w-60 p-1">
          <div className="flex flex-col">
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); setShowSaveDialog(true); }}>
              <Save className="mr-2 h-4 w-4" /> Save Game
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); setShowLoadDialog(true); }}>
              <FolderOpen className="mr-2 h-4 w-4" /> Load Game
            </Button>
            {onEditWorld && (
              <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); onEditWorld(); }}>
                {/* Matches the header's Edit World button, which this folds into on mobile. */}
                <SquarePen className="mr-2 h-4 w-4" /> Edit World
              </Button>
            )}
            {onShowAiContext && (
              <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); onShowAiContext(); }}>
                <Braces className="mr-2 h-4 w-4" /> AI Context
              </Button>
            )}
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); onSettingsClick(); }}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </Button>
            {/* Opened from here so a bug can be reported where it happened, rather than backing out first. */}
            {onReportBug && (
              <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); onReportBug(); }}>
                <MessageSquarePlus className="mr-2 h-4 w-4" /> Send Feedback
              </Button>
            )}
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setMenuOpen(false); setShowExitConfirm(true); }}>
              <DoorOpen className="mr-2 h-4 w-4" /> Exit to Main Menu
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={showExitConfirm}
        onOpenChange={setShowExitConfirm}
        title="Exit to Main Menu"
        icon={<DoorOpen className="h-4 w-4" />}
        description="Are you sure you want to exit to the main menu? Any unsaved progress will be lost."
        onConfirm={onExitToMenu}
      />

      {/* Save Game popup: the same browser as Load, but clicking a save fills the name box (to overwrite it)
          rather than loading. The name input + Save button ride at the top. */}
      <LoadGameDialog
        open={showSaveDialog}
        onOpenChange={(open) => setShowSaveDialog(open)}
        current={current}
        onLoad={() => {}}
        title="Save Game"
        icon={<Save className="h-4 w-4" />}
        onPickSave={(row) => setSaveName(row.name)}
        topSlot={
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Enter save name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveClick(); }}
              />
              <Button onClick={handleSaveClick} className="flex items-center justify-center gap-2 shrink-0">
                <Save className="h-4 w-4" />
                <span>Save</span>
              </Button>
            </div>
            {sceneWeight.count > 0 && (
              <label htmlFor="includeSceneImages" className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  id="includeSceneImages"
                  checked={includeSceneImages}
                  onCheckedChange={(c) => setIncludeSceneImages(c === true)}
                  className="shrink-0 mt-0.5"
                />
                <span>
                  Save the {sceneWeight.count} scene image{sceneWeight.count === 1 ? '' : 's'} too
                  <span className="text-muted-foreground"> — adds about {formatBytes(sceneWeight.bytes)} to this save. Left off, the story keeps its tags and the pictures are gone.</span>
                </span>
              </label>
            )}
          </div>
        }
      />

      {/* Duplicate-name-in-world resolution */}
      <Dialog open={!!dupConflict} onOpenChange={(open) => { if (!open) setDupConflict(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save already exists</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            A save named “{shownDup?.name}” already exists in this world. Overwrite it, or keep both?
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
