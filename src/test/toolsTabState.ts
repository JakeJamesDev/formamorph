import { fireEvent, screen } from '@testing-library/react';
import type { CatalogToolOverrides, Tool, ToolEnabledMap } from '@/types';
import { activeEnabledTools, type BuiltinToolSwitches, type PromptPresetStore, type PromptValues } from '@/lib/promptPresets';

/** What the Tools harness holds: the global user Tool list, the preset store, the built-in switches, and the catalog overrides. */
export interface ToolsState {
  tools: Tool[];
  store: PromptPresetStore;
  builtinSwitches: BuiltinToolSwitches;
  catalogOverrides: CatalogToolOverrides;
}

const values = {} as PromptValues;

/** The global list `tools`, with `enabled` switched on for "mine", and `activeId` selected. */
export const toolsState = (tools: Tool[] = [], enabled: ToolEnabledMap = {}, activeId = 'mine'): ToolsState => ({
  tools,
  store: {
    activeId,
    presets: [{ id: 'mine', name: 'Mine', values, enabledTools: enabled }, { id: 'other', name: 'Other', values }],
  },
  builtinSwitches: {},
  catalogOverrides: {},
});

let latest: ToolsState;
/** Called by the harness on every render. */
export const recordState = (s: ToolsState) => { latest = s; };
/** The state the tab last rendered with. */
export const current = () => latest;
/** The switches preset `presetId` holds in the current state. */
export const switchesOf = (presetId: string) => activeEnabledTools({ ...latest.store, activeId: presetId }, latest.builtinSwitches);
/** Choose a preset in the tab's selector. */
export const choosePreset = (presetId: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Preset' }), { target: { value: presetId } });
