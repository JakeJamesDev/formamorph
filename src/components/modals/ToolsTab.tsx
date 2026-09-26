import { useRef, useState, type ReactNode } from 'react';
import { Copy, Maximize2, Minimize2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import type { Tool, ToolEnabledMap } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ActionIcon } from '@/lib/actionIcons';
import { downloadBlob } from '@/lib/downloadBlob';
import { filesFrom } from '@/lib/importFiles';
import { randomUUID } from '@/lib/uuid';
import { cn } from '@/lib/utils';
import { isCatalogToolId } from '@/lib/tools/toolCatalog';
import { buildToolPack, copyTool, parseToolPack, planToolImport } from '@/lib/tools/toolPack';
import { blankTool, finishDraft } from '@/lib/tools/toolDraft';
import { sampleToolSnapshot, type ToolSnapshot } from '@/lib/tools/toolSnapshot';
import { toolSummary, type ToolsView } from './toolsView';
import { ToolEditor } from './ToolEditor';
import { ToolTryIt, type TryItWorld } from './ToolTryIt';

export interface ToolFileTransfer {
  readImportPack: () => Promise<string | null>;
  writeExportPack: (contents: string, filename: string) => void;
}

const iconButton = 'rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40';

/**
 * Settings → Tools: the catalog and the player's own Tools with the active preset's switches, a read view of
 * the selected one, and the footer actions. Laid out like the stat Code Templates dialog.
 */
export function ToolsTab({
  catalogTools, userTools, enabledTools, toolsSupported, toolsEnabled, onSaveTool, onDeleteTool, onSetEnabled,
  view, onViewChange, presetSelector, fullscreen, onToggleFullscreen, appVersion, fileTransfer, openWorld,
}: {
  catalogTools: readonly Tool[];
  userTools: readonly Tool[];
  /** The active preset's switches. */
  enabledTools: ToolEnabledMap;
  /** Whether the active text endpoint and model take Tools. */
  toolsSupported: boolean;
  /** The global Tools switch in Settings → Output. */
  toolsEnabled: boolean;
  onSaveTool: (tool: Tool) => void;
  onDeleteTool: (id: string) => void;
  onSetEnabled: (id: string, on: boolean) => void;
  view: ToolsView;
  onViewChange: (view: ToolsView) => void;
  presetSelector: ReactNode;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  appVersion: string;
  fileTransfer?: ToolFileTransfer;
  /** The Tool Snapshot of the world the player has open. Absent, Try It runs on the sample world. */
  openWorld?: () => ToolSnapshot;
}) {
  const [confirmDelete, setConfirmDelete] = useState<Tool | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const world: TryItWorld = { snapshot: openWorld ?? sampleToolSnapshot, open: !!openWorld };

  const mine = [...userTools].sort((a, b) => a.name.localeCompare(b.name));
  const all = [...catalogTools, ...mine];
  const selected = all.find((t) => t.id === view.selectedId) ?? all[0];
  const select = (selectedId: string | null) => onViewChange({ ...view, selectedId });

  // Named like the prompt panel's toggle: the full-screen shell hands focus back by this label.
  const fullscreenButton = (
    <Tip tip={fullscreen ? 'Exit full screen' : 'View full screen'}>
      <button type="button" aria-label={fullscreen ? 'Exit full screen' : 'View full screen'} onClick={onToggleFullscreen} className={cn(iconButton, 'p-1.5')}>
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </Tip>
  );

  const duplicate = (tool: Tool) => {
    const copy = copyTool(tool, userTools, randomUUID());
    onSaveTool(copy);
    onSetEnabled(copy.id, true);
    select(copy.id);
  };

  const exportPack = () => {
    const contents = JSON.stringify(buildToolPack(userTools, appVersion), null, 2);
    const filename = 'tools.json';
    if (fileTransfer) fileTransfer.writeExportPack(contents, filename);
    else downloadBlob(new Blob([contents], { type: 'application/json' }), filename);
  };

  const importPackText = async (readText: () => Promise<string | null>) => {
    try {
      const text = await readText();
      if (text === null) return;
      const { tools, warnings } = parseToolPack(text);
      const plan = planToolImport(userTools, tools, randomUUID);
      plan.added.forEach(onSaveTool);
      for (const warning of warnings) toast.warn(warning);
      if (plan.skipped.length) toast.info(`Already in My Tools: ${plan.skipped.join(', ')}`);
      if (plan.added.length) toast.success(`Imported ${plan.added.length} Tool${plan.added.length === 1 ? '' : 's'}`);
      if (plan.hasScript) toast.warn('This pack holds a Script Tool. A script runs code when the AI calls it, so read it before you turn it on.');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const importPack = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = filesFrom(event);
    // Clearing the input lets the same file be chosen twice.
    event.target.value = '';
    if (file) void importPackText(() => file.text());
  };

  const requestImport = () => {
    if (fileTransfer) void importPackText(fileTransfer.readImportPack);
    else fileRef.current?.click();
  };

  if (view.draft) {
    const { draft } = view;
    return (
      <ToolEditor
        draft={draft}
        onDraftChange={(next) => onViewChange({ ...view, draft: next })}
        editTab={view.editTab}
        onEditTabChange={(editTab) => onViewChange({ ...view, editTab })}
        userTools={userTools}
        editing={userTools.some((t) => t.id === draft.id)}
        world={world}
        fullscreen={fullscreen}
        fullscreenButton={fullscreenButton}
        onCancel={() => onViewChange({ ...view, draft: null })}
        onSave={() => {
          onSaveTool(finishDraft(draft));
          if (!userTools.some((t) => t.id === draft.id)) onSetEnabled(draft.id, true);
          onViewChange({ ...view, selectedId: draft.id, draft: null });
        }}
      />
    );
  }

  const toolButton = (tool: Tool) => (
    <button
      key={tool.id}
      type="button"
      onClick={() => select(tool.id)}
      aria-current={tool.id === selected?.id ? 'true' : undefined}
      className={cn(
        'flex items-center gap-2 text-left text-label rounded px-2 py-1.5',
        tool.id === selected?.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
      )}
    >
      <span aria-hidden className={cn('h-2 w-2 flex-shrink-0 rounded-full', enabledTools[tool.id] === true ? 'bg-primary' : 'bg-muted-foreground/40')} />
      <span className="font-mono truncate">{tool.name}</span>
    </button>
  );

  const builtInSelected = !!selected && isCatalogToolId(selected.id);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" data-testid="tool-pack-input" onChange={importPack} />
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex-1 min-w-0">{presetSelector}</div>
        {fullscreenButton}
      </div>
      {!toolsEnabled ? (
        <p role="note" className="flex-shrink-0 text-helper text-muted-foreground">
          Your prompts won&apos;t receive Tools. Turn on <strong>Tools</strong> in the <strong>Output</strong> tab to send them.
        </p>
      ) : !toolsSupported && (
        <p role="note" className="flex-shrink-0 text-helper text-muted-foreground">
          Your text endpoint won&apos;t receive Tools. Its model doesn&apos;t support them, or support isn&apos;t confirmed yet.
        </p>
      )}

      <div className="grid flex-1 min-h-0 gap-4 grid-rows-[minmax(0,10rem)_minmax(0,1fr)] sm:grid-rows-1 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <ScrollArea className="h-full min-h-0 rounded-md border">
          <nav aria-label="Tools" className="p-2 flex flex-col gap-1">
            <p className="text-meta text-muted-foreground px-1 pt-1">Built-In</p>
            {catalogTools.map(toolButton)}

            <div className="flex items-center justify-between gap-1 px-1 pt-3">
              <p className="text-meta text-muted-foreground">My Tools</p>
              <span className="flex items-center">
                <Tip tip="Import Tools">
                  <button type="button" aria-label="Import Tools" className={iconButton} onClick={requestImport}>
                    <ActionIcon.import className="h-3.5 w-3.5" />
                  </button>
                </Tip>
                <Tip tip="Export Tools">
                  <button type="button" aria-label="Export Tools" disabled={userTools.length === 0} className={iconButton} onClick={exportPack}>
                    <ActionIcon.export className="h-3.5 w-3.5" />
                  </button>
                </Tip>
              </span>
            </div>
            {mine.map(toolButton)}

            <button
              type="button"
              onClick={() => onViewChange({ ...view, draft: blankTool(randomUUID()), editTab: 'definition' })}
              className="flex items-center gap-1 rounded border border-dashed px-2 py-1.5 text-label text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-4 w-4" />New Tool
            </button>
          </nav>
        </ScrollArea>

        <ScrollArea className="h-full min-h-0 min-w-0">
          {selected && (
            <div className="flex flex-col gap-3 min-w-0 pr-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-label font-medium font-mono break-all">{selected.name}</h3>
                  <p className="text-meta text-muted-foreground">{toolSummary(selected)}</p>
                </div>
                <label className="flex items-center gap-2 text-label flex-shrink-0">
                  <Checkbox
                    checked={enabledTools[selected.id] === true}
                    onCheckedChange={(c) => onSetEnabled(selected.id, c === true)}
                  />
                  Enabled
                </label>
              </div>
              <p className="text-helper text-muted-foreground whitespace-pre-wrap">{selected.description}</p>
              <ToolTryIt key={selected.id} tool={selected} world={world} />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Fixed: the actions keep their place whichever Tool is selected. */}
      {selected && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3 flex-shrink-0">
          {builtInSelected ? (
            <Button variant="outline" onClick={() => duplicate(selected)}>
              <Copy className="h-4 w-4 mr-1" />Duplicate
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onViewChange({ ...view, draft: structuredClone(selected), editTab: 'definition' })}>
                <Pencil className="h-4 w-4 mr-1" />Edit
              </Button>
              <Button variant="outline" onClick={() => setConfirmDelete(selected)}>
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete Tool"
        description={`Delete “${confirmDelete?.name}” from every preset? This can't be undone.`}
        onConfirm={() => {
          if (!confirmDelete) return;
          onDeleteTool(confirmDelete.id);
          setConfirmDelete(null);
          select(null);
        }}
      />
    </div>
  );
}
