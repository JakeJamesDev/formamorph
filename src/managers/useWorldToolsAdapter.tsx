import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hint, Meta } from '@/components/ui/typography';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { AvailabilityFields } from '@/components/modals/ToolsTab';
import { ToolEditor, type WorldToolCode } from '@/components/modals/ToolEditor';
import { ToolTryIt, type TryItWorld } from '@/components/modals/ToolTryIt';
import { toolSummary, type ToolEditTab } from '@/components/modals/toolsView';
import { useGameData } from '@/contexts/GameDataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { statBoxLookups, traitBoxSelf } from '@/lib/codeWorldLookup';
import { useCodeUseReveal } from '@/lib/codeUseReveal';
import { useScriptWorldNames } from '@/lib/useScriptWorldNames';
import { blankTool, finishDraft, type KeptHandlers } from '@/lib/tools/toolDraft';
import { tryWorldToolScript } from '@/lib/tools/worldToolTry';
import type { ToolSnapshot } from '@/lib/tools/toolSnapshot';
import { reorderTools, worldToolClash, type WorldToolClash } from '@/lib/tools/worldTools';
import { randomUUID } from '@/lib/uuid';
import type { Tool } from '@/types';

/** The line that names the Tool a World Tool replaces in its world. */
export function clashNote(clash: WorldToolClash | null): string | null {
  if (!clash) return null;
  const owner = clash.kind === 'catalog' ? 'the built-in' : 'your';
  return `Replaces ${owner} ${clash.name} Tool in this world`;
}

/** One World Tool open in the editor: the draft, its field tab, and the handlers a type switch set aside. */
interface ToolDraft {
  tool: Tool;
  editTab: ToolEditTab;
  kept: KeptHandlers;
  /** False for a Tool the world doesn't hold yet. */
  saved: boolean;
}

/** The selected World Tool as it reads: its handler, the clash, availability, description and Try It. */
function WorldToolDetail({ tool, clash, world, onChange }: {
  tool: Tool;
  clash: string | null;
  world: TryItWorld;
  onChange: (tool: Tool) => void;
}) {
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="min-w-0">
        <h3 className="text-label font-medium font-mono break-all">{tool.name}</h3>
        <Meta as="p">{toolSummary(tool)}</Meta>
      </div>
      {clash && <Hint role="note">{clash}</Hint>}
      <AvailabilityFields tool={tool} onChange={onChange} offeredTo />
      <Hint className="whitespace-pre-wrap">{tool.description}</Hint>
      <ToolTryIt key={tool.id} tool={tool} world={world} />
    </div>
  );
}

/**
 * The Tools tab: the world's Tools in run order. A drag reorders them. A Tool reads with its availability and
 * Try It; Edit opens the Settings Tool editor as a draft, and only Save Tool writes the world (Q21).
 */
export function useWorldToolsAdapter({ selectedId, onSelect, snapshot }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The world as the editor holds it, for Try It and the Variable menu. */
  snapshot: () => ToolSnapshot;
}): ListEditorAdapter {
  const gameData = useGameData();
  const { worldTools, setWorldTools } = gameData;
  const { userTools } = useSettings();
  const [draft, setDraft] = useState<ToolDraft | null>(null);
  // Try It and the script box read the world's names as the Scripts tab's boxes do, unsaved edits included.
  const { names, placeholderPlaces, world: foldWorld } = useScriptWorldNames();
  const lookups = useMemo(() => statBoxLookups(gameData), [gameData]);
  const world = useMemo<TryItWorld>(() => ({
    snapshot, open: true, runScript: (tool, argsText, options) => tryWorldToolScript(tool, argsText, foldWorld, options),
  }), [snapshot, foldWorld]);
  const worldCode = useMemo<WorldToolCode>(() => ({
    names, placeholderPlaces, lookup: (timing) => lookups({ owner: null, timing, self: traitBoxSelf('', '') }),
  }), [names, placeholderPlaces, lookups]);
  const byId = useMemo(() => new Map(worldTools.map((tool) => [tool.id, tool])), [worldTools]);
  const clashFor = useCallback((tool: Tool) => clashNote(worldToolClash(tool, userTools)), [userTools]);
  // A draft belongs to the row it opened on; another selection leaves it.
  const openDraft = draft && draft.tool.id === selectedId ? draft : null;
  // A Find All Uses row bound for the selected Tool opens its script, the only place the code reads.
  const reveal = useCodeUseReveal(selectedId ?? '', null, 'tool');
  useEffect(() => {
    const tool = reveal && byId.get(reveal.rowId);
    if (!tool) return;
    setDraft((now) => (now?.tool.id === tool.id
      ? { ...now, editTab: 'handler' }
      : { tool: structuredClone(tool), editTab: 'handler', kept: {}, saved: true }));
  }, [reveal, byId]);

  const write = (tool: Tool) => setWorldTools(byId.has(tool.id)
    ? worldTools.map((t) => (t.id === tool.id ? tool : t))
    : [...worldTools, tool]);

  const remove = (id: string) => {
    setWorldTools(worldTools.filter((t) => t.id !== id));
    if (draft?.tool.id === id) setDraft(null);
    if (selectedId === id) onSelect(null);
  };

  const add = (name: string) => {
    const tool = { ...blankTool(randomUUID()), name };
    setDraft({ tool, editTab: 'definition', kept: {}, saved: false });
    onSelect(tool.id);
  };

  const detail = (id: string | null) => {
    if (openDraft) {
      const { tool, saved } = openDraft;
      return (
        <ToolEditor
          draft={tool}
          onDraftChange={(next, kept = openDraft.kept) => setDraft({ ...openDraft, tool: next, kept })}
          keptHandlers={openDraft.kept}
          editTab={openDraft.editTab}
          onEditTabChange={(editTab) => setDraft({ ...openDraft, editTab })}
          userTools={worldTools}
          home="world"
          nameNote={clashFor(tool)}
          worldCode={worldCode}
          editing={saved}
          world={world}
          fullscreen={false}
          fullscreenButton={null}
          onCancel={() => {
            setDraft(null);
            if (!saved) onSelect(null);
          }}
          onSave={() => {
            write(finishDraft(tool));
            setDraft(null);
          }}
        />
      );
    }
    const tool = id ? byId.get(id) : undefined;
    if (tool) return <WorldToolDetail key={tool.id} tool={tool} clash={clashFor(tool)} world={world} onChange={write} />;
    return (
      <div className="space-y-2">
        <span className="font-medium">Tools</span>
        <Hint>
          Lists the Tools the AI can call in this world, in the order they run. Drag a Tool to change when it runs
          among the Tools of its timing.
        </Hint>
      </div>
    );
  };

  return {
    rows: () => [
      ...worldTools.map((tool) => ({
        id: tool.id, name: tool.name, labelClass: 'font-mono', sortable: true,
        actions: [{ icon: <X className="h-4 w-4" />, destructive: true, title: 'Delete', onClick: () => remove(tool.id) }],
      })),
      ...(openDraft && !openDraft.saved ? [{ id: openDraft.tool.id, name: openDraft.tool.name || 'New Tool', actions: [] }] : []),
    ],
    names: { placeholders: [] },
    noun: 'tools',
    detail,
    fills: () => !!openDraft,
    footer: (id) => {
      const tool = byId.get(id);
      if (!tool || openDraft) return null;
      return (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t p-3">
          <Button
            variant="outline" size="sm"
            onClick={() => setDraft({ tool: structuredClone(tool), editTab: 'definition', kept: {}, saved: true })}
          >
            <Pencil className="h-4 w-4 mr-1" />Edit
          </Button>
        </div>
      );
    },
    onReorder: (activeId, overId) => {
      const next = reorderTools(worldTools, activeId, overId);
      if (next !== worldTools) setWorldTools([...next]);
    },
    add: { label: 'Add Tool', onAdd: add },
    placeholder: 'Search tools',
    holds: (id) => byId.has(id) || draft?.tool.id === id,
    isEmpty: worldTools.length === 0 && !openDraft,
    emptyHint: (
      <Hint className="p-3">Add a Tool the AI can call in every playthrough of this world</Hint>
    ),
  };
}
