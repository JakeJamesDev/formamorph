import { useCallback } from 'react';
import { Settings } from 'lucide-react';
import { CheckRow, HintInfo, OptionSwitcher, Row, Section, ValueSlider } from '@/components/SettingsRows';
import { PromptReasoningField } from '@/components/modals/PromptOptionFields';
import { promptReasoningFieldProps, type ReasoningFieldTarget } from '@/components/modals/promptReasoningField';
import { REASONING_NOTES } from '@/components/modals/settingsCopy';
import { RevealAnimationDemoButton } from '@/components/RevealAnimationDemo';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { SETTINGS_DIALOG_SIZE } from '@/components/modals/settingsDialogSize';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  chatChrome, HELP_HISTORY_MAX, SCRIM_OPACITY_MAX, SCRIM_OPACITY_MIN, SCRIM_OPACITY_STEP, type HelpSettings, type HelpSettingsChange,
} from '@/lib/formaquestion/helpSettings';
import { routeText, targetAttribute } from '@/lib/surface/surfaceTargets';
import { useRouteLanding } from '@/lib/surface/useLanding';
import { toolsSupported } from '@/lib/reasoningEffort';
import { EndpointTab } from './FormaquestionEndpointTab';
import { MascotTab } from './FormaquestionMascotTab';
import { PromptsTab } from './FormaquestionPromptsTab';
import { ToolsTab } from './FormaquestionToolsTab';
import { useHelpRevealSource } from './useHelpRevealSource';
import { setMascotPlacement, useMascotPlacement } from './useMascotDevice';
import { useMascotDraft } from './useMascotDraft';
import type { SemanticSearch } from './useSemanticSearch';
import { FORMAQUESTION_SETTINGS_TABS, GENERAL_COPY, type FormaquestionSettingsTab } from './formaquestionSettingsTabs';

const MB = 1048576;

/** The progress bar of the model download, and the failed state with its retry. */
function SemanticStatus({ semantic }: { semantic: SemanticSearch }) {
  const { progress, error, downloading } = semantic;
  const known = progress !== null && progress.total > 0;
  if (downloading) {
    return (
      <Row>
        <div className="flex items-center gap-2">
          <Progress className="h-2 flex-1" aria-label="Model download" value={known ? (progress.loaded / progress.total) * 100 : 0} />
          <span className="text-meta text-muted-foreground whitespace-nowrap">
            {known ? `${Math.round(progress.loaded / MB)} / ${Math.round(progress.total / MB)} MB` : 'Preparing…'}
          </span>
        </div>
      </Row>
    );
  }
  if (error === null) return null;
  return (
    <Row>
      <div className="flex items-center gap-2">
        <span className="text-helper text-destructive">Model download failed: {error}</span>
        <Button variant="outline" size="sm" onClick={() => semantic.setOn(true)}>Retry</Button>
      </div>
    </Row>
  );
}

/** The answer request's reasoning, with the effort list and the budget of the endpoint answers resolve to. */
function ReasoningRow({ settings, onChange, target }: { settings: HelpSettings; onChange: (change: HelpSettingsChange) => void; target: ReasoningFieldTarget }) {
  const row = targetAttribute('formaquestionSettings.general', 'reasoning');
  const copy = GENERAL_COPY.reasoning;
  const field = promptReasoningFieldProps({
    target, kind: 'help', setting: settings.reasoning, budgetPct: settings.reasoningBudget, suppressed: false, showAwaitingProof: true,
    onChange: (reasoning) => onChange({ reasoning }),
    onBudgetChange: (reasoningBudget) => onChange({ reasoningBudget }),
  });
  // No field: the model is ruled out, since the call is never suppressed and a pending proof still draws one.
  if (!field) {
    return (
      <Row muted target={row} label={copy.label}>
        <p className="pt-2 text-helper text-muted-foreground">{REASONING_NOTES.never}</p>
      </Row>
    );
  }
  return (
    <Row top target={row} htmlFor="fq-reasoning" label={copy.label} hint={copy.hint} info={<HintInfo>{copy.info}</HintInfo>}>
      <PromptReasoningField {...field} id="fq-reasoning" copy={null} switchLabel={copy.label} />
    </Row>
  );
}

/** The reveal button and dialog of Narration Reveal, on help's own values. */
function AnswerRevealRow({ settings, onChange }: { settings: HelpSettings; onChange: (change: HelpSettingsChange) => void }) {
  const source = useHelpRevealSource(settings.reveal, useCallback((reveal) => onChange({ reveal }), [onChange]));
  return (
    <Row {...GENERAL_COPY.answerReveal}>
      <RevealAnimationDemoButton source={source} kind="answer" />
    </Row>
  );
}

function GeneralTab({ settings, onChange, semantic, answerTarget }: {
  settings: HelpSettings;
  onChange: (change: HelpSettingsChange) => void;
  semantic: SemanticSearch;
  answerTarget: ReasoningFieldTarget;
}) {
  const placement = useMascotPlacement();
  return (
    <div className="grid gap-6 py-4">
      <Section title="Window">
        <CheckRow
          htmlFor="fq-mascot"
          checked={settings.mascot}
          onChange={(mascot) => onChange({ mascot })}
          target={targetAttribute('formaquestionSettings.general', 'mascot-switch')}
          {...GENERAL_COPY.mascot}
        />
        <Row target={targetAttribute('formaquestionSettings.general', 'chat-style')} label={GENERAL_COPY.chatStyle.label} hint={GENERAL_COPY.chatStyle.hint}>
          <OptionSwitcher
            ariaLabel={GENERAL_COPY.chatStyle.label}
            value={settings.chatStyle}
            options={GENERAL_COPY.chatStyle.options}
            onChange={(chatStyle) => onChange({ chatStyle })}
          />
        </Row>
        {/* Bubble ignores Mascot Position (Q9). */}
        {chatChrome(settings) !== 'bubble' && (
          <Row
            target={targetAttribute('formaquestionSettings.general', 'mascot-position')}
            label={GENERAL_COPY.mascotPosition.label}
            hint={GENERAL_COPY.mascotPosition.hint}
            info={<HintInfo>{GENERAL_COPY.mascotPosition.info}</HintInfo>}
          >
            <OptionSwitcher
              ariaLabel={GENERAL_COPY.mascotPosition.label}
              value={placement}
              options={GENERAL_COPY.mascotPosition.options}
              onChange={setMascotPlacement}
            />
          </Row>
        )}
        <Row htmlFor="fq-scrim-opacity" target={targetAttribute('formaquestionSettings.general', 'backdrop')} label={GENERAL_COPY.scrimOpacity.label} hint={GENERAL_COPY.scrimOpacity.hint}>
          <ValueSlider
            id="fq-scrim-opacity"
            ariaLabel={GENERAL_COPY.scrimOpacity.label}
            value={settings.scrimOpacity}
            min={SCRIM_OPACITY_MIN}
            max={SCRIM_OPACITY_MAX}
            step={SCRIM_OPACITY_STEP}
            format={(value) => `${value}%`}
            onChange={(scrimOpacity) => onChange({ scrimOpacity })}
            valueClassName="w-14 shrink-0 whitespace-nowrap"
          />
        </Row>
      </Section>
      <Section title="Answer">
        <ReasoningRow settings={settings} onChange={onChange} target={answerTarget} />
        <AnswerRevealRow settings={settings} onChange={onChange} />
      </Section>
      <Section title="Search">
        <CheckRow
          htmlFor="fq-keyword"
          target={targetAttribute('formaquestionSettings.general', 'keyword-search')}
          checked={settings.sources.keyword}
          onChange={(keyword) => onChange({ sources: { keyword } })}
          {...GENERAL_COPY.keyword}
        />
        <CheckRow
          htmlFor="fq-ai-picks"
          checked={settings.sources.aiPicks}
          onChange={(aiPicks) => onChange({ sources: { aiPicks } })}
          {...GENERAL_COPY.aiPicks}
        />
        <CheckRow
          htmlFor="fq-semantic"
          checked={semantic.on}
          onChange={semantic.setOn}
          target={targetAttribute('formaquestionSettings.general', 'semantic-search')}
          {...GENERAL_COPY.semantic}
        />
        <SemanticStatus semantic={semantic} />
      </Section>
      <Section title="Request">
        <CheckRow
          htmlFor="fq-open-screen"
          checked={settings.openScreen}
          onChange={(openScreen) => onChange({ openScreen })}
          {...GENERAL_COPY.openScreen}
        />
        <Row htmlFor="fq-history-length" {...GENERAL_COPY.historyLength}>
          <Input
            id="fq-history-length"
            type="number"
            min={0}
            max={HELP_HISTORY_MAX}
            value={settings.historyLength}
            onChange={(event) => onChange({ historyLength: Math.min(HELP_HISTORY_MAX, Math.max(0, parseInt(event.target.value) || 0)) })}
            className="w-20"
          />
        </Row>
      </Section>
    </div>
  );
}

/**
 * Formaquestion Settings: a dialog the size of Settings, opened from the gear in the Formaquestion header.
 * The help window stays above it. A dirty mascot draft holds the tab and the dialog until it is saved or discarded.
 */
export function FormaquestionSettings({ open, onOpenChange, tab, onTabChange, settings, onChange, semantic, answerTarget }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: FormaquestionSettingsTab;
  onTabChange: (tab: FormaquestionSettingsTab) => void;
  settings: HelpSettings;
  onChange: (change: HelpSettingsChange) => void;
  semantic: SemanticSearch;
  /** The endpoint answers resolve to, which the Reasoning row and the Tools tab read. */
  answerTarget: ReasoningFieldTarget;
}) {
  const mascotDraft = useMascotDraft(settings, onChange);
  const changeTab = (next: FormaquestionSettingsTab) => mascotDraft.guard(() => onTabChange(next));
  // The Mascot tab's off-state link lands on the switch it names, as Take Me There lands on a row.
  const land = useRouteLanding();
  const openGeneralAtMascot = () => mascotDraft.guard(() => {
    onTabChange('general');
    land(routeText('formaquestionSettings.general', 'mascot-switch'));
  });
  return (
    <>
      {/* A close drops the draft, so an upload a clean draft no longer holds goes with it. */}
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : mascotDraft.guard(() => { mascotDraft.cancel(); onOpenChange(false); }))}>
        <DialogContent
          surface="formaquestionSettings"
          aria-describedby={undefined}
          className={SETTINGS_DIALOG_SIZE}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Formaquestion Settings</DialogTitle>
          </DialogHeader>
          <Tabs
            surfaceTabs="formaquestionSettings"
            value={tab}
            onValueChange={(value) => changeTab(value as FormaquestionSettingsTab)}
            className="flex min-h-0 w-full flex-1 flex-col"
          >
            {/* Below sm the tab strip is a dropdown of the active tab, as in Settings; both drive one value. */}
            <Select value={tab} onValueChange={(value) => changeTab(value as FormaquestionSettingsTab)}>
              <SelectTrigger aria-label="Tab" className="w-full flex-shrink-0 sm:hidden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAQUESTION_SETTINGS_TABS.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <TabsList className="hidden w-full flex-shrink-0 grid-cols-5 sm:grid">
              {FORMAQUESTION_SETTINGS_TABS.map((entry) => <TabsTrigger key={entry.value} value={entry.value}>{entry.label}</TabsTrigger>)}
            </TabsList>
            <TabsContent value="general" className="min-h-0 flex-1 px-2 data-[state=active]:flex flex-col">
              <ScrollArea landingRoom className="min-h-0 flex-1">
                <GeneralTab settings={settings} onChange={onChange} semantic={semantic} answerTarget={answerTarget} />
              </ScrollArea>
            </TabsContent>
            <TabsContent value="endpoint" className="min-h-0 flex-1 px-2 data-[state=active]:flex flex-col">
              <EndpointTab settings={settings} onChange={onChange} />
            </TabsContent>
            <TabsContent value="prompts" className="min-h-0 flex-1 px-2 data-[state=active]:flex flex-col">
              <PromptsTab settings={settings} onChange={onChange} />
            </TabsContent>
            <TabsContent value="tools" className="min-h-0 flex-1 px-2 data-[state=active]:flex flex-col">
              <ToolsTab settings={settings} onChange={onChange} toolsSupported={toolsSupported(answerTarget.reasoning)} />
            </TabsContent>
            <TabsContent value="mascot" className="min-h-0 flex-1 px-2 data-[state=active]:flex flex-col">
              <MascotTab settings={settings} control={mascotDraft} onOpenGeneral={openGeneralAtMascot} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...mascotDraft.leavePrompt} />
    </>
  );
}
