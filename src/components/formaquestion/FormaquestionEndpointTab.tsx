import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { EndpointRouteField } from '@/components/modals/EndpointRouteField';
import LlmSetupGuide from '@/components/modals/LlmSetupGuide';
import { TextEndpointEditor } from '@/components/modals/TextEndpointEditor';
import { presetEditor, type PresetEditorView } from '@/components/modals/textEndpointEditorModel';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { helpRoutes } from '@/lib/formaquestion/helpRoutes';
import { SAME_AS_ANSWER, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { useMountedRef } from '@/lib/useMountedRef';
import { ENDPOINT_COPY } from './formaquestionSettingsTabs';

type DetectSource = Pick<ReturnType<typeof useSettings>, 'detectContextWindowFor' | 'editTextEndpointPreset'>;

/** The context-window check of a preset that is not the active one. A newer check or an unmount drops a late answer. */
function usePresetDetect(s: DetectSource, id: string): Pick<PresetEditorView, 'detectStatus' | 'detectContextWindow'> {
  const [detectStatus, setDetectStatus] = useState<PresetEditorView['detectStatus']>('idle');
  const mountedRef = useMountedRef();
  const request = useRef(0);
  const { detectContextWindowFor, editTextEndpointPreset } = s;
  useEffect(() => {
    request.current += 1;
    setDetectStatus('idle');
  }, [id]);
  const detectContextWindow = useCallback(async (force = false) => {
    const ask = ++request.current;
    setDetectStatus('detecting');
    const detected = await detectContextWindowFor(id);
    if (!mountedRef.current || ask !== request.current) return;
    if (detected === null) {
      setDetectStatus(force ? 'error' : 'idle');
      return;
    }
    if (force) editTextEndpointPreset(id, () => ({ contextWindowOverride: null }));
    setDetectStatus('success');
  }, [detectContextWindowFor, editTextEndpointPreset, id, mountedRef]);
  return { detectStatus, detectContextWindow };
}

/** The ⓘ of a route: where its choice sends the request now. */
function routeInfo(presetName: string | undefined, follows: string): string {
  return presetName ? `Always goes to ${presetName}, even when you switch endpoints in Settings` : follows;
}

/**
 * The Endpoint tab: where answers and searches go, and the text-endpoint editor on the presets Settings uses.
 * The editor edits the preset the Answer route resolves to.
 */
export function EndpointTab({ settings, onChange }: { settings: HelpSettings; onChange: (change: HelpSettingsChange) => void }) {
  const s = useSettings();
  const presets = [...s.builtinTextEndpointPresets, ...s.textEndpointPresets];
  const presetOf = (id: string | null) => presets.find((p) => p.id === id);
  const routes = helpRoutes(settings);
  const answer = s.resolveEndpointForKind('help', routes.answer);
  const pick = s.resolveEndpointForKind('help', routes.pick);

  // A deleted preset shows as the default of its route, which is where it sends.
  const answerPreset = presetOf(settings.answerEndpoint);
  const pickPreset = presetOf(settings.pickEndpoint);
  const pickValue = settings.pickEndpoint === null ? null : pickPreset?.id ?? SAME_AS_ANSWER;

  // The editor always edits where Answer goes. Its select is gone, so only Add and Delete move the route.
  const editedId = answer.endpointId;
  const detect = usePresetDetect(s, editedId);
  const base = presetEditor(s, editedId, {
    onSelect: () => {},
    onAdd: (name) => onChange({ answerEndpoint: s.copyTextEndpointPreset(name, editedId) }),
    ...detect,
  });
  const model = {
    ...base,
    onDelete: (id: string) => {
      base.onDelete(id);
      if (id === settings.answerEndpoint) onChange({ answerEndpoint: null });
    },
  };
  const heading = answerPreset ? `Edit ${answerPreset.name}` : `Edit ${s.activeTextEndpointPresetName} (Active Endpoint)`;
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-shrink-0 gap-4 pt-4 sm:grid-cols-2">
        <EndpointRouteField
          {...ENDPOINT_COPY.answer}
          row={targetAttribute('formaquestionSettings.endpoint', 'answer-endpoint')}
          info={routeInfo(answerPreset?.name, ENDPOINT_COPY.followsActive)}
          value={answerPreset?.id ?? null}
          activeName={s.activeTextEndpointPresetName}
          presets={presets}
          onChange={(answerEndpoint) => onChange({ answerEndpoint })}
          target={{ url: answer.url, apiToken: answer.apiToken, model: answer.model, enabled: answer.presetId !== null }}
        />
        <EndpointRouteField
          {...ENDPOINT_COPY.pick}
          info={pickValue === SAME_AS_ANSWER ? ENDPOINT_COPY.sameAsAnswer : routeInfo(pickPreset?.name, ENDPOINT_COPY.followsActive)}
          value={pickValue}
          activeName={s.activeTextEndpointPresetName}
          extraRows={[{ value: SAME_AS_ANSWER, label: `Same as Answer (${answer.presetName})` }]}
          presets={presets}
          onChange={(pickEndpoint) => onChange({ pickEndpoint })}
          target={{ url: pick.url, apiToken: pick.apiToken, model: pick.model, enabled: pickPreset !== undefined }}
        />
      </div>
      <TextEndpointEditor heading={heading} model={model} advanced onOpenConnectionGuide={() => setGuideOpen(true)} presetDescription={ENDPOINT_COPY.presetHint} />
      <LlmSetupGuide open={guideOpen} onOpenChange={setGuideOpen} endpointUrl={model.fields.endpointUrl} />
    </div>
  );
}
