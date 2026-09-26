import { useState } from 'react';
import {
  activeBuiltinId, activeEnabledTools, deleteUserTool, dropToolEverywhere, dropToolFromBuiltins, saveUserTool, setActive,
  setBuiltinToolEnabled, setToolEnabled,
} from '@/lib/promptPresets';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import type { ToolSnapshot } from '@/lib/tools/toolSnapshot';
import { ToolsTab, type ToolFileTransfer } from '@/components/modals/ToolsTab';
import { EMPTY_TOOLS_VIEW, type ToolsView } from '@/components/modals/toolsView';
import { recordState, type ToolsState } from './toolsTabState';

/**
 * Render helper for Settings → Tools. The tab runs against the real store operations the settings context
 * composes: the global user Tool list, plus a preset store with two user presets ("mine", "other") and the
 * built-ins, whose switches live beside it. The preset selector is a native select, so a test can switch whose switches it edits. Build the
 * state and read it back with `./toolsTabState`.
 */
export function ToolsHarness({ initial, toolsSupported = true, toolsEnabled = true, fileTransfer, openWorld, fullscreen = false }: {
  initial: ToolsState; toolsSupported?: boolean; toolsEnabled?: boolean; fileTransfer?: ToolFileTransfer;
  openWorld?: () => ToolSnapshot; fullscreen?: boolean;
}) {
  const [s, setS] = useState(initial);
  const [view, setView] = useState<ToolsView>(EMPTY_TOOLS_VIEW);
  recordState(s);
  return (
    <ToolsTab
      catalogTools={TOOL_CATALOG}
      userTools={s.tools}
      enabledTools={activeEnabledTools(s.store, s.builtinSwitches)}
      toolsSupported={toolsSupported}
      toolsEnabled={toolsEnabled}
      onSaveTool={(t) => setS((p) => ({ ...p, tools: saveUserTool(p.tools, t) }))}
      onDeleteTool={(id) => setS((p) => ({
        tools: deleteUserTool(p.tools, id), store: dropToolEverywhere(p.store, id), builtinSwitches: dropToolFromBuiltins(p.builtinSwitches, id),
      }))}
      onSetEnabled={(id, on) => setS((p) => {
        const builtinId = activeBuiltinId(p.store);
        return builtinId
          ? { ...p, builtinSwitches: setBuiltinToolEnabled(p.builtinSwitches, builtinId, id, on) }
          : { ...p, store: setToolEnabled(p.store, id, on) };
      })}
      view={view}
      onViewChange={setView}
      presetSelector={(
        <select aria-label="Preset" value={s.store.activeId} onChange={(e) => { const id = e.target.value; setS((p) => ({ ...p, store: setActive(p.store, id) })); }}>
          {['mine', 'other', 'experimental', 'default'].map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      )}
      fullscreen={fullscreen}
      onToggleFullscreen={() => {}}
      appVersion="9.9.9"
      fileTransfer={fileTransfer}
      openWorld={openWorld}
    />
  );
}
