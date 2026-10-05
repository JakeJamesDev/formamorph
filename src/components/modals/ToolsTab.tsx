import { useId, useRef, useState, type ReactNode } from 'react';
import { Copy, Maximize2, Minimize2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { toastError } from '@/lib/linkToast';
import type { AIRequestType, Tool, ToolEnabledMap, ToolParam } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { PROMPT_TAB_REQUESTS, REQUEST_LABELS } from '@/lib/promptGroups';
import { DEFAULT_TOOL_CALL_LIMIT } from '@/contexts/settingsDefaults';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ActionIcon } from '@/lib/actionIcons';
import { downloadBlob } from '@/lib/downloadBlob';
import { filesFrom } from '@/lib/importFiles';
import { randomUUID } from '@/lib/uuid';
import { cn } from '@/lib/utils';
import { isCatalogToolId } from '@/lib/tools/toolCatalog';
import { buildToolPack, copyTool, parseToolPack, planToolImport } from '@/lib/tools/toolPack';
import { userCanStore } from '@/lib/tools/toolValidation';
import { blankTool, finishDraft } from '@/lib/tools/toolDraft';
import type { OfferedFunction } from '@/lib/tools/toolSchema';
import type { TargetAttribute } from '@/lib/surface/surfaceTargets';
import { sampleToolSnapshot, type ToolSnapshot } from '@/lib/tools/toolSnapshot';
import { toolSummary, type ToolsView } from './toolsView';
import { ToolEditor } from './ToolEditor';
import { ToolTryIt, type TryItWorld } from './ToolTryIt';

export interface ToolFileTransfer {
  readImportPack: () => Promise<string | null>;
  writeExportPack: (contents: string, filename: string) => void;
}

const iconButton = 'rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40';

/** The prompts a Tool can be offered to, in the Prompts rail's order. */
const OFFER_OPTIONS: MultiSelectOption[] = Object.values(PROMPT_TAB_REQUESTS)
  .map((kind) => ({ value: kind, label: REQUEST_LABELS[kind] }));

/** Max Calls per Request: a blank field is the default. */
function CallLimitField({ callLimit, defaultLimit, maxLimit, onChange }: {
  callLimit: number | undefined;
  defaultLimit: number;
  maxLimit?: number;
  onChange: (limit: number | undefined) => void;
}) {
  const id = useId();
  const setLimit = (text: string) => {
    const limit = Number.parseInt(text.replace(/\D/g, ''), 10);
    onChange(limit >= 1 ? limit : undefined);
  };
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`${id}-limit`}>Max Calls per Request</Label>
      <Hint id={`${id}-limit-hint`}>
        {maxLimit === undefined ? `Leave blank for the default of ${defaultLimit}` : `Takes up to ${maxLimit} calls. Leave blank for the default of ${defaultLimit}.`}
      </Hint>
      <Input
        id={`${id}-limit`} className="w-24" inputMode="numeric" placeholder={String(defaultLimit)}
        aria-describedby={`${id}-limit-hint`}
        value={callLimit?.toString() ?? ''} onChange={(e) => setLimit(e.target.value)}
      />
    </div>
  );
}

/** Offered To and Max Calls per Request, written on each change. Where one request takes every Tool, the limit alone. */
function AvailabilityFields({ tool, onChange, offeredTo }: { tool: Tool; onChange: (tool: Tool) => void; offeredTo: boolean }) {
  const id = useId();
  const setLimit = (limit: number | undefined) => {
    const { callLimit: _, ...rest } = tool;
    onChange(limit === undefined ? rest : { ...rest, callLimit: limit });
  };
  const limit = <CallLimitField callLimit={tool.callLimit} defaultLimit={DEFAULT_TOOL_CALL_LIMIT} onChange={setLimit} />;
  if (!offeredTo) return limit;
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-1 min-w-0">
        <Label id={`${id}-offered`}>Offered To</Label>
        <Hint>Sends the Tool with these prompts</Hint>
        <MultiSelect
          aria-labelledby={`${id}-offered`} options={OFFER_OPTIONS} placeholder="No Prompts" allSelectedLabel="All Prompts"
          defaultValue={tool.offeredTo} onValueChange={(kinds) => onChange({ ...tool, offeredTo: kinds as AIRequestType[] })}
        />
      </div>
      {limit}
    </div>
  );
}

/** A built-in function of the caller with no Tool handler. Only its switch and its call limit change. */
export interface FixedFunction extends OfferedFunction {
  /** What it does, in one line. */
  summary: string;
  /** The call limit a blank Max Calls per Request field means. */
  defaultCallLimit: number;
  /** The most calls the field takes. */
  maxCallLimit?: number;
}

/** The fixed functions of a Tools tab, listed first under Built-In. */
export interface FixedFunctions {
  functions: readonly FixedFunction[];
  onCallLimitChange: (id: string, limit: number | undefined) => void;
}

/** Each parameter's name, type and description, as plain text. */
function ParamList({ params }: { params: readonly ToolParam[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-label font-medium">Parameters</h4>
      <ul className="flex flex-col gap-1">
        {params.map((param) => (
          <li key={param.name} className="text-helper">
            <span className="font-mono">{param.name}</span>
            <span className="text-muted-foreground"> · {param.type}{param.required ? '' : ', optional'}</span>
            <p className="text-muted-foreground">{param.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The player's own Tools: the My Tools list, the editor, import and export. */
interface MyToolsProps {
  userTools: readonly Tool[];
  /** Saves a user Tool, or a catalog Tool's availability. */
  onSaveTool: (tool: Tool) => void;
  onDeleteTool: (id: string) => void;
  appVersion: string;
  fileTransfer?: ToolFileTransfer;
  /**
   * One request takes every Tool that is on, so no prompt preset is involved: no Offered To field, a new Tool
   * offered to no prompt, and a delete that names no preset.
   */
  singleRequest?: boolean;
}

interface ToolsTabProps {
  catalogTools: readonly Tool[];
  fixed?: FixedFunctions;
  /** The switches, keyed by Tool or function id. */
  enabledTools: ToolEnabledMap;
  /** Whether the endpoint the requests go to takes Tools. */
  toolsSupported: boolean;
  /** The notice when the endpoint does not take Tools. */
  unsupportedNote?: string;
  /** The global Tools switch in Settings → Output. Absent: the caller's requests do not read it. */
  toolsEnabled?: boolean;
  onSetEnabled: (id: string, on: boolean) => void;
  view: ToolsView;
  onViewChange: (view: ToolsView) => void;
  presetSelector?: ReactNode;
  fullscreen?: boolean;
  /** Absent: no full-screen button. */
  onToggleFullscreen?: () => void;
  /** The Tool Snapshot of the world the player has open. Absent, Try It runs on the sample world. */
  openWorld?: () => ToolSnapshot;
  /** Marks the My Tools header and the New Tool button as Take Me There targets. */
  targets?: { shareTools?: TargetAttribute; newTool?: TargetAttribute };
}

const TEXT_ENDPOINT_NOTE = "Your text endpoint won't receive Tools. Its model doesn't support them, or support isn't confirmed yet.";

/**
 * A Tools tab: the fixed functions, the catalog and the player's own Tools with their switches, a read view of
 * the selected one, and the footer actions. Without the My Tools props, the list has no My Tools section.
 * Laid out like the stat Code Templates dialog.
 */
export function ToolsTab({
  catalogTools, fixed, userTools, enabledTools, toolsSupported, unsupportedNote = TEXT_ENDPOINT_NOTE, toolsEnabled, onSaveTool, onDeleteTool,
  onSetEnabled, view, onViewChange, presetSelector, fullscreen = false, onToggleFullscreen, appVersion, fileTransfer, singleRequest = false, openWorld, targets,
}: ToolsTabProps & (MyToolsProps | { [K in keyof MyToolsProps]?: undefined })) {
  const [confirmDelete, setConfirmDelete] = useState<Tool | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const world: TryItWorld = { snapshot: openWorld ?? sampleToolSnapshot, open: !!openWorld };

  const my: MyToolsProps | null = userTools ? { userTools, onSaveTool, onDeleteTool, appVersion, fileTransfer, singleRequest } : null;
  const fixedFunctions = fixed?.functions ?? [];
  // A fixed function's name is taken as a catalog name is: at save, import and copy.
  const reserved = fixedFunctions.map((fn) => fn.name);
  const mine = [...(my?.userTools ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const tools = [...catalogTools, ...mine];
  const rows: readonly OfferedFunction[] = [...fixedFunctions, ...tools];
  const selectedId = (rows.find((row) => row.id === view.selectedId) ?? rows[0])?.id;
  const selectedFixed = fixedFunctions.find((fn) => fn.id === selectedId);
  const selected = tools.find((t) => t.id === selectedId);
  const select = (selectedId: string | null) => onViewChange({ ...view, selectedId });

  // Named like the prompt panel's toggle: the full-screen shell hands focus back by this label.
  const fullscreenButton = onToggleFullscreen && (
    <Tip tip={fullscreen ? 'Exit full screen' : 'View full screen'}>
      <button type="button" aria-label={fullscreen ? 'Exit full screen' : 'View full screen'} onClick={onToggleFullscreen} className={cn(iconButton, 'p-1.5')}>
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </Tip>
  );

  const duplicate = (tool: Tool) => {
    if (!my) return;
    const copy = copyTool(tool, my.userTools, randomUUID(), reserved);
    if (!copy) return;
    my.onSaveTool(copy);
    onSetEnabled(copy.id, true);
    select(copy.id);
  };

  const exportPack = () => {
    if (!my) return;
    const contents = JSON.stringify(buildToolPack(my.userTools, my.appVersion), null, 2);
    const filename = 'tools.json';
    if (my.fileTransfer) my.fileTransfer.writeExportPack(contents, filename);
    else downloadBlob(new Blob([contents], { type: 'application/json' }), filename);
  };

  const importPackText = async (readText: () => Promise<string | null>) => {
    try {
      const text = await readText();
      if (text === null || !my) return;
      const { tools, warnings } = parseToolPack(text);
      const plan = planToolImport(my.userTools, tools, randomUUID, reserved);
      plan.added.forEach(my.onSaveTool);
      for (const warning of warnings) toast.warn(warning);
      if (plan.skipped.length) toast.info(`Already in My Tools: ${plan.skipped.join(', ')}`);
      if (plan.added.length) toast.success(`Imported ${plan.added.length} Tool${plan.added.length === 1 ? '' : 's'}`);
      if (plan.hasScript) toast.warn('This pack holds a Script Tool. A script runs code when the AI calls it, so read it before you turn it on.');
    } catch (error) {
      toastError(error, 'Couldn’t import those Tools');
    }
  };

  const importPack = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = filesFrom(event);
    // Clearing the input lets the same file be chosen twice.
    event.target.value = '';
    if (file) void importPackText(() => file.text());
  };

  const requestImport = () => {
    if (my?.fileTransfer) void importPackText(my.fileTransfer.readImportPack);
    else fileRef.current?.click();
  };

  if (view.draft && my) {
    const { draft } = view;
    const saved = my.userTools.some((t) => t.id === draft.id);
    return (
      <ToolEditor
        draft={draft}
        onDraftChange={(next, keptHandlers = view.keptHandlers) => onViewChange({ ...view, draft: next, keptHandlers })}
        keptHandlers={view.keptHandlers}
        editTab={view.editTab}
        onEditTabChange={(editTab) => onViewChange({ ...view, editTab })}
        userTools={my.userTools}
        reservedNames={reserved}
        editing={saved}
        world={world}
        fullscreen={fullscreen}
        fullscreenButton={fullscreenButton}
        onCancel={() => onViewChange({ ...view, draft: null })}
        onSave={() => {
          my.onSaveTool(finishDraft(draft));
          if (!saved) onSetEnabled(draft.id, true);
          onViewChange({ ...view, selectedId: draft.id, draft: null });
        }}
      />
    );
  }

  const toolButton = (tool: OfferedFunction) => (
    <button
      key={tool.id}
      type="button"
      onClick={() => select(tool.id)}
      aria-current={tool.id === selectedId ? 'true' : undefined}
      className={cn(
        'flex items-center gap-2 text-left text-label rounded px-2 py-1.5',
        tool.id === selectedId ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
      )}
    >
      <span aria-hidden className={cn('h-2 w-2 flex-shrink-0 rounded-full', enabledTools[tool.id] === true ? 'bg-primary' : 'bg-muted-foreground/40')} />
      <span className="font-mono truncate">{tool.name}</span>
    </button>
  );

  const builtInSelected = !!selected && isCatalogToolId(selected.id);

  /** The selected row's name, summary and switch. */
  const readHeader = (row: OfferedFunction, summary: string) => (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-label font-medium font-mono break-all">{row.name}</h3>
        <p className="text-meta text-muted-foreground">{summary}</p>
      </div>
      <label className="flex items-center gap-2 text-label flex-shrink-0">
        <Checkbox
          checked={enabledTools[row.id] === true}
          onCheckedChange={(c) => onSetEnabled(row.id, c === true)}
        />
        Enabled
      </label>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {my && <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" data-testid="tool-pack-input" onChange={importPack} />}
      {(presetSelector || fullscreenButton) && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0">{presetSelector}</div>
          {fullscreenButton}
        </div>
      )}
      {toolsEnabled === false ? (
        <p role="note" className="flex-shrink-0 text-helper text-muted-foreground">
          Your prompts won&apos;t receive Tools. Turn on <strong>Tools</strong> in the <strong>Output</strong> tab to send them.
        </p>
      ) : !toolsSupported && (
        <p role="note" className="flex-shrink-0 text-helper text-muted-foreground">{unsupportedNote}</p>
      )}

      <div className="grid flex-1 min-h-0 gap-4 grid-rows-[minmax(0,10rem)_minmax(0,1fr)] sm:grid-rows-1 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <ScrollArea className="h-full min-h-0 rounded-md border">
          {/* The side padding is the Landing Pulse's room around the Share Tools row. */}
          <nav aria-label="Tools" className="px-3 py-2 flex flex-col gap-1">
            <p className="text-meta text-muted-foreground px-1 pt-1">Built-In</p>
            {fixedFunctions.map(toolButton)}
            {catalogTools.map(toolButton)}

            {my && (<>
            <div className="flex items-center justify-between gap-1 px-1 pt-3" {...targets?.shareTools}>
              <p className="text-meta text-muted-foreground">My Tools</p>
              <span className="flex items-center">
                <Tip tip="Import Tools">
                  <button type="button" aria-label="Import Tools" className={iconButton} onClick={requestImport}>
                    <ActionIcon.import className="h-3.5 w-3.5" />
                  </button>
                </Tip>
                <Tip tip="Export Tools">
                  <button type="button" aria-label="Export Tools" disabled={my.userTools.length === 0} className={iconButton} onClick={exportPack}>
                    <ActionIcon.export className="h-3.5 w-3.5" />
                  </button>
                </Tip>
              </span>
            </div>
            {mine.map(toolButton)}

            <button
              type="button"
              onClick={() => onViewChange({ ...view, draft: blankTool(randomUUID(), my.singleRequest ? [] : undefined), editTab: 'definition', keptHandlers: {} })}
              className="flex items-center gap-1 rounded border border-dashed px-2 py-1.5 text-label text-muted-foreground hover:bg-muted hover:text-foreground"
              {...targets?.newTool}
            >
              <Plus className="h-4 w-4" />New Tool
            </button>
            </>)}
          </nav>
        </ScrollArea>

        <ScrollArea className="h-full min-h-0 min-w-0">
          {selectedFixed && fixed && (
            <div className="flex flex-col gap-3 min-w-0 pr-3">
              {readHeader(selectedFixed, selectedFixed.summary)}
              <CallLimitField
                callLimit={selectedFixed.callLimit} defaultLimit={selectedFixed.defaultCallLimit} maxLimit={selectedFixed.maxCallLimit}
                onChange={(limit) => fixed.onCallLimitChange(selectedFixed.id, limit)}
              />
              <p className="text-helper text-muted-foreground whitespace-pre-wrap">{selectedFixed.description}</p>
              <ParamList params={selectedFixed.params} />
            </div>
          )}
          {selected && (
            <div className="flex flex-col gap-3 min-w-0 pr-3">
              {readHeader(selected, toolSummary(selected))}
              {my && <AvailabilityFields tool={selected} onChange={my.onSaveTool} offeredTo={!my.singleRequest} />}
              <p className="text-helper text-muted-foreground whitespace-pre-wrap">{selected.description}</p>
              <ToolTryIt key={selected.id} tool={selected} world={world} />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Fixed: the actions keep their place whichever Tool is selected. */}
      {selected && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3 flex-shrink-0">
          {builtInSelected ? my && (
            <Button variant="outline" onClick={() => duplicate(selected)} disabled={!userCanStore(selected.handler)}>
              <Copy className="h-4 w-4 mr-1" />Duplicate
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onViewChange({ ...view, draft: structuredClone(selected), editTab: 'definition', keptHandlers: {} })}>
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
        description={my?.singleRequest ? `Delete “${confirmDelete?.name}”? This can't be undone.` : `Delete “${confirmDelete?.name}” from every preset? This can't be undone.`}
        onConfirm={() => {
          if (!confirmDelete || !my) return;
          my.onDeleteTool(confirmDelete.id);
          setConfirmDelete(null);
          select(null);
        }}
      />
    </div>
  );
}
