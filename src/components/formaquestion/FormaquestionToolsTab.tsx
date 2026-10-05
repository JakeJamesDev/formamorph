import { useState } from 'react';
import { ToolsTab as ToolsLayout, type FixedFunction, type FixedFunctions } from '@/components/modals/ToolsTab';
import { EMPTY_TOOLS_VIEW, type ToolsView } from '@/components/modals/toolsView';
import { DOCS_LOOKUP, DOCS_LOOKUP_CALL_LIMIT } from '@/lib/formaquestion/docsLookup';
import { HELP_ROLL, HELP_ROLL_CALL_LIMIT } from '@/lib/formaquestion/helpRoll';
import { callLimitOf, HELP_CALL_LIMIT_MAX, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { deleteHelpTool, dropHelpToolSwitch, saveHelpTool } from '@/lib/formaquestion/helpTools';
import { useHelpWorld } from '@/lib/formaquestion/helpWorld';
import type { OfferedFunction } from '@/lib/tools/toolSchema';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { APP_VERSION } from '@/lib/version';
import { TOOLS_COPY } from './formaquestionSettingsTabs';

/** A fixed row: its function, its copy, and the settings that hold its switch and its call limit. */
interface FixedRow {
  fn: OfferedFunction;
  summary: string;
  defaultCallLimit: number;
  switchKey: 'lookup' | 'roll';
  limitKey: 'lookupCallLimit' | 'rollCallLimit';
}

const FIXED_ROWS: readonly FixedRow[] = [
  { fn: DOCS_LOOKUP, summary: TOOLS_COPY.lookupSummary, defaultCallLimit: DOCS_LOOKUP_CALL_LIMIT, switchKey: 'lookup', limitKey: 'lookupCallLimit' },
  { fn: HELP_ROLL, summary: TOOLS_COPY.rollSummary, defaultCallLimit: HELP_ROLL_CALL_LIMIT, switchKey: 'roll', limitKey: 'rollCallLimit' },
];

const rowOf = (id: string): FixedRow | undefined => FIXED_ROWS.find((row) => row.fn.id === id);

/**
 * The Tools tab of Formaquestion Settings: the functions a help answer request can call, switched on this
 * device. The guide lookup and the dice roll are fixed rows; the lookup's switch is lookup mode. Under them,
 * the player's own Formaquestion Tools: a list apart from the gameplay Tools (ADR-0010), with the Tool editor
 * and the Tool pack file.
 */
export function ToolsTab({ settings, onChange, toolsSupported }: {
  settings: HelpSettings;
  onChange: (change: HelpSettingsChange) => void;
  /** Whether the endpoint answers resolve to takes function calls. */
  toolsSupported: boolean;
}) {
  const [view, setView] = useState<ToolsView>(EMPTY_TOOLS_VIEW);
  const openWorld = useHelpWorld();
  const functions = FIXED_ROWS.map(({ fn, summary, defaultCallLimit, limitKey }): FixedFunction => ({
    id: fn.id, name: fn.name, description: fn.description, params: fn.params,
    summary, defaultCallLimit, maxCallLimit: HELP_CALL_LIMIT_MAX,
    // The default shows as a blank field, as an unset Tool limit does.
    callLimit: settings[limitKey] === defaultCallLimit ? undefined : settings[limitKey],
  }));
  const fixed: FixedFunctions = {
    functions,
    onCallLimitChange: (id, limit) => {
      const row = rowOf(id);
      if (row) onChange({ [row.limitKey]: callLimitOf(limit, row.defaultCallLimit) });
    },
  };
  const setEnabled = (id: string, on: boolean) => {
    const row = rowOf(id);
    if (row) onChange({ [row.switchKey]: on });
    else onChange({ toolSwitches: { ...settings.toolSwitches, [id]: on } });
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 py-4">
      <ToolsLayout
        catalogTools={[]}
        fixed={fixed}
        userTools={settings.tools}
        onSaveTool={(tool) => onChange({ tools: saveHelpTool(settings.tools, tool) })}
        onDeleteTool={(id) => onChange({ tools: deleteHelpTool(settings.tools, id), toolSwitches: dropHelpToolSwitch(settings.toolSwitches, id) })}
        appVersion={APP_VERSION}
        singleRequest
        targets={{ newTool: targetAttribute('formaquestionSettings.tools', 'new-tool') }}
        enabledTools={{ ...settings.toolSwitches, ...Object.fromEntries(FIXED_ROWS.map((row) => [row.fn.id, settings[row.switchKey]])) }}
        toolsSupported={toolsSupported}
        unsupportedNote={TOOLS_COPY.unsupported}
        onSetEnabled={setEnabled}
        view={view}
        onViewChange={setView}
        openWorld={openWorld}
      />
      <p className="flex-shrink-0 text-helper text-muted-foreground">{TOOLS_COPY.worldText}</p>
    </div>
  );
}
