import { useState } from 'react';
import { ToolsTab as ToolsLayout, type FixedFunction, type FixedFunctions } from '@/components/modals/ToolsTab';
import { EMPTY_TOOLS_VIEW, type ToolsView } from '@/components/modals/toolsView';
import { DOCS_LOOKUP, DOCS_LOOKUP_CALL_LIMIT } from '@/lib/formaquestion/docsLookup';
import { HELP_LOOKUP_CALL_LIMIT_MAX, lookupCallLimitOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { TOOLS_COPY } from './formaquestionSettingsTabs';

/**
 * The Tools tab of Formaquestion Settings: the functions a help answer request can call, switched on this
 * device. The guide lookup is a fixed row; its switch is lookup mode.
 */
export function ToolsTab({ settings, onChange, toolsSupported }: {
  settings: HelpSettings;
  onChange: (change: HelpSettingsChange) => void;
  /** Whether the endpoint answers resolve to takes function calls. */
  toolsSupported: boolean;
}) {
  const [view, setView] = useState<ToolsView>(EMPTY_TOOLS_VIEW);
  const lookup: FixedFunction = {
    ...DOCS_LOOKUP,
    summary: TOOLS_COPY.lookupSummary,
    defaultCallLimit: DOCS_LOOKUP_CALL_LIMIT,
    maxCallLimit: HELP_LOOKUP_CALL_LIMIT_MAX,
    // The default shows as a blank field, as an unset Tool limit does.
    callLimit: settings.lookupCallLimit === DOCS_LOOKUP_CALL_LIMIT ? undefined : settings.lookupCallLimit,
  };
  const fixed: FixedFunctions = {
    functions: [lookup],
    onCallLimitChange: (_id, limit) => onChange({ lookupCallLimit: lookupCallLimitOf(limit) }),
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col py-4">
      <ToolsLayout
        catalogTools={[]}
        fixed={fixed}
        enabledTools={{ [DOCS_LOOKUP.id]: settings.lookup }}
        toolsSupported={toolsSupported}
        unsupportedNote={TOOLS_COPY.unsupported}
        onSetEnabled={(_id, on) => onChange({ lookup: on })}
        view={view}
        onViewChange={setView}
      />
    </div>
  );
}
