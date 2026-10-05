import type { ThinkingMode } from '@/contexts/SettingsContext';
import { CONTINUE_CHOICE_MODES, type ContinueChoiceMode } from '@/contexts/settingsDefaults';
import { Row, CheckRow, Section, SubGroup, OptionSwitcher, CheckboxOptionGroup } from '@/components/SettingsRows';
import { SETTINGS_COPY, SETTINGS_OPTIONS, REASONING_EFFORT_HELP, REASONING_NOTES, TOOLS_NOTES, type SettingOptionCopy } from '@/components/modals/settingsCopy';
import { rowCopy, optionRowCopy } from '@/components/modals/settingsRowCopy';
import { reasoningLevelOptions, reasoningOffRefused, toolsSupported, type ReasoningSetting } from '@/lib/reasoningEffort';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import type { SettingsMode } from '@/lib/settingsMode';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { ReasoningSwitch } from './ReasoningSwitch';
import type { OutputSettingsSource } from './settingsSource';

// Narrows each option's `value` to the setting's union, so a drifted option fails to compile.
const THINKING_OPTIONS: readonly SettingOptionCopy<ThinkingMode>[] = SETTINGS_OPTIONS.thinking;

/** The Settings Output tab body: what the AI produces each turn, and what it carries forward. */
export function OutputSettingsSection({ source, mode, nativeReasoningRuledOut }: {
  source: OutputSettingsSource;
  mode: SettingsMode;
  /** The record rules native reasoning out, so the row shows why instead of a control. */
  nativeReasoningRuledOut: boolean;
}) {
  const advanced = mode === 'advanced';
  const {
    choicesEnabled, setChoicesEnabled,
    statUpdatesEnabled, setStatUpdatesEnabled,
    locationChangeEnabled, setLocationChangeEnabled,
    locationAutoApply, setLocationAutoApply,
    thinkingMode, setThinkingMode,
    limitActiveCharacters, setLimitActiveCharacters,
    activeCharacterLimit, setActiveCharacterLimit,
    reasoningEffort, nativeReasoning, setNativeReasoning, reasoningCapability,
    toolsEnabled, setToolsEnabled,
    memoryDigests, setMemoryDigests,
    semanticMemory, setSemanticMemory,
    semanticBandCap, setSemanticBandCap,
    semanticRehydration, setSemanticRehydration,
    timeContext, setTimeContext,
    aiClock, setAiClock,
    semanticLore, setSemanticLore,
    describeCharacters, setDescribeCharacters,
    characterDiaries, setCharacterDiaries,
    semanticDiaries, setSemanticDiaries,
    continueChoiceMode, setContinueChoiceMode,
    concurrentTurnRequests, setConcurrentTurnRequests,
    imageAttachments, setImageAttachments,
    embeddingModel,
  } = source;
  // The Output rows read the ACTIVE endpoint's record.
  const activeReasoningAlwaysOn = reasoningOffRefused(reasoningCapability);
  const activeToolsSupported = toolsSupported(reasoningCapability);
  const handleSemanticMemoryToggle = (on: boolean) => {
    setSemanticMemory(on);
    if (on) embeddingModel.start();
    else if (!semanticLore) embeddingModel.dispose(); // model stays while any semantic feature needs it
  };
  const handleSemanticLoreToggle = (on: boolean) => {
    setSemanticLore(on);
    if (on) embeddingModel.start();
    else if (!semanticMemory) embeddingModel.dispose();
  };
  const { loading: embedLoading, progress: embedProgress, error: embedError } = embeddingModel;

  return (
    <div className="grid gap-6 py-4">
      <Section title="Turn Extras" hint="Optional passes that run alongside each turn's narration.">
      {/* Enable/disable the optional per-turn requests. Synced with the System Prompts tab, which
          shows a prompt's editor tab only while it's enabled here. */}
      <Row target={targetAttribute('settings.output', 'choices')} {...rowCopy('systemPrompts')}>
        <CheckboxOptionGroup options={[
          { id: 'choicesEnabled', label: 'Choices', checked: choicesEnabled, onChange: setChoicesEnabled },
          { id: 'statUpdatesEnabled', label: 'Stat Updates', checked: statUpdatesEnabled, onChange: setStatUpdatesEnabled },
          { id: 'locationChangeEnabled', label: 'Location Change', checked: locationChangeEnabled, onChange: setLocationChangeEnabled },
        ]} />
      </Row>
      {/* Auto-apply detected location changes — its own row, only shown while Location Change is on. */}
      {locationChangeEnabled && (
        <SubGroup>
        <CheckRow
          htmlFor="locationAutoApply"
          checked={locationAutoApply}
          onChange={setLocationAutoApply}
          {...rowCopy('moveAutomatically')}
        />
        </SubGroup>
      )}
      </Section>

      <Section title="Reasoning">
      <Row
        top
        target={targetAttribute('settings.output', 'thinking-mode')}
        {...optionRowCopy('thinking', THINKING_OPTIONS.find((o) => o.value === thinkingMode))}
      >
        <div>
          <OptionSwitcher value={thinkingMode} onChange={(v) => setThinkingMode(v as ThinkingMode)} options={THINKING_OPTIONS} />
          {/* Stacked like Paragraph Limit so switching thinking modes doesn't reflow the layout. */}
          <div className="grid mt-2">
            {THINKING_OPTIONS.map((o) => (
              <p
                key={o.value}
                className={`col-start-1 row-start-1 text-helper text-muted-foreground${o.value === thinkingMode ? '' : ' invisible'}`}
              >
                {o.help}
              </p>
            ))}
          </div>
        </div>
      </Row>
      {/* Staged only: cap how many characters the director stages per turn (each is its own pass). Off =
          unbounded. Feeds both the hard cap and the <ACTIVE CHARACTER GUIDANCE> chip in the director prompt. */}
      {advanced && thinkingMode === 'staged' && (
        <SubGroup>
        <Row {...rowCopy('limitActiveCharacters')}>
          <div className="flex items-center gap-3">
            <Checkbox
              checked={limitActiveCharacters}
              onCheckedChange={(v) => setLimitActiveCharacters(v === true)}
            />
            <Input
              type="number"
              min={1}
              value={activeCharacterLimit}
              disabled={!limitActiveCharacters}
              onChange={(e) => setActiveCharacterLimit(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20"
            />
          </div>
        </Row>
        </SubGroup>
      )}
      {/* The endpoint-wide effort every prompt set to Global follows, in every Thinking mode. The levels
          are whichever the active endpoint accepts (detected on connect). */}
      {advanced && nativeReasoningRuledOut && (
        <SubGroup>
        <Row muted label={SETTINGS_COPY.nativeReasoning.label}>
          <p className="pt-2 text-helper text-muted-foreground">{REASONING_NOTES.never}</p>
        </Row>
        </SubGroup>
      )}
      {advanced && !nativeReasoningRuledOut && (
        <SubGroup>
        <Row top htmlFor="nativeReasoning" {...optionRowCopy('nativeReasoning')}>
          {/* Stacks the selected level's help under the control, so the label pins to the first line. */}
          <div data-row-stacked>
            <ReasoningSwitch
              id="nativeReasoning"
              enabled={nativeReasoning.enabled}
              onEnabledChange={(enabled) => setNativeReasoning({ ...nativeReasoning, enabled })}
              lockedOn={activeReasoningAlwaysOn}
              strength={{
                kind: 'level',
                value: nativeReasoning.level,
                options: reasoningLevelOptions(reasoningCapability, nativeReasoning.level),
                onChange: (level: ReasoningSetting['level']) => setNativeReasoning({ ...nativeReasoning, level }),
              }}
            />
            <p className="mt-2 text-helper text-muted-foreground">
              {activeReasoningAlwaysOn ? REASONING_NOTES.always : REASONING_EFFORT_HELP[reasoningEffort]}
            </p>
          </div>
        </Row>
        </SubGroup>
      )}
      </Section>

      {/* Reads the active endpoint's record, like the Native Reasoning row; the wire gate checks each
          prompt's own target. */}
      {advanced && (
      <Section title="Tools" hint="What the AI can look up while it works.">
      {activeToolsSupported ? (
        <CheckRow
          htmlFor="toolsEnabled"
          checked={toolsEnabled}
          onChange={setToolsEnabled}
          {...rowCopy('tools')}
        />
      ) : (
        <Row muted label={SETTINGS_COPY.tools.label} experimental={SETTINGS_COPY.tools.experimental}>
          <p className="pt-2 text-helper text-muted-foreground">{TOOLS_NOTES.unsupported}</p>
        </Row>
      )}
      </Section>
      )}

      {advanced && (<>
      <Section title="Memory" hint="What the AI carries forward from earlier turns.">
      <CheckRow
        htmlFor="memoryDigests"
        checked={memoryDigests}
        onChange={setMemoryDigests}
        {...rowCopy('memorySummaries')}
      />
      {memoryDigests && (
        <SubGroup>
        <CheckRow
          htmlFor="semanticMemory"
          checked={semanticMemory}
          onChange={handleSemanticMemoryToggle}
          {...rowCopy('semanticMemory')}
        />
        {semanticMemory && (
          <SubGroup>
          {/* Always-on top-K cap: derived checkbox (cap > 0), enabling seeds a sensible default. */}
          <Row {...rowCopy('memoryCap')}>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={semanticBandCap > 0}
                onCheckedChange={(v) => setSemanticBandCap(v === true ? 12 : 0)}
              />
              <Input
                type="number"
                min={3}
                value={semanticBandCap > 0 ? semanticBandCap : 12}
                disabled={semanticBandCap === 0}
                onChange={(e) => setSemanticBandCap(Math.max(3, parseInt(e.target.value) || 3))}
                className="w-20"
              />
            </div>
          </Row>
          <CheckRow
            htmlFor="semanticRehydration"
            checked={semanticRehydration}
            onChange={setSemanticRehydration}
            {...rowCopy('sceneRecall')}
          />
          </SubGroup>
        )}
        </SubGroup>
      )}
      {embedLoading && (
        <Row>
          <div className="flex items-center gap-2">
            <Progress
              className="h-2 flex-1"
              value={embedProgress && embedProgress.total > 0 ? (embedProgress.loaded / embedProgress.total) * 100 : 0}
            />
            <span className="text-meta text-muted-foreground whitespace-nowrap">
              {embedProgress && embedProgress.total > 0
                ? `${Math.round(embedProgress.loaded / 1048576)} / ${Math.round(embedProgress.total / 1048576)} MB`
                : 'Preparing…'}
            </span>
          </div>
        </Row>
      )}
      {embedError && !embedLoading && (semanticMemory || semanticLore) && (
        <Row>
          <div className="flex items-center gap-2">
            <span className="text-helper text-destructive">Model download failed: {embedError}</span>
            <Button variant="outline" size="sm" onClick={embeddingModel.start}>Retry</Button>
          </div>
        </Row>
      )}
      </Section>

      {/* Both rows are about the story's clock rather than what the AI remembers, so they get their
          own section — gated on Memory Summaries, which is what they already depended on as rows. */}
      {memoryDigests && (
      <Section title="Time" hint="How long each turn takes, and when things happened.">
      <CheckRow
        htmlFor="timeContext"
        checked={timeContext}
        onChange={setTimeContext}
        {...rowCopy('timeInMemory')}
      />
      <CheckRow
        htmlFor="aiClock"
        checked={aiClock}
        onChange={setAiClock}
        {...rowCopy('measuredClock')}
      />
      </Section>
      )}

      {/* Semantic Lore acts on the dictionary, not on memories — it sat under Memory only because it
          shares Semantic Memory's on-device model, whose download progress stays up there. */}
      <Section title="Lore" hint="How dictionary entries reach the AI.">
      <CheckRow
        htmlFor="semanticLore"
        checked={semanticLore}
        onChange={handleSemanticLoreToggle}
        {...rowCopy('semanticLore')}
      />
      </Section>

      {/* Split out of Memory: these three are about the cast, and only sat under Memory because
          that is where the code for them happens to live. */}
      <Section title="Characters">
      {/* Descriptions work from the narration alone, so unlike diaries this is offered in every mode. */}
      <CheckRow
        htmlFor="describeCharacters"
        checked={describeCharacters}
        onChange={setDescribeCharacters}
        {...rowCopy('describeNewCharacters')}
      />
      {/* Diaries are only read by the staged character pass, so the option only appears in that mode. */}
      {thinkingMode === 'staged' && (
        <>
        <CheckRow
          htmlFor="characterDiaries"
          checked={characterDiaries}
          onChange={setCharacterDiaries}
          {...rowCopy('characterDiaries')}
        />
        {characterDiaries && semanticMemory && (
          <SubGroup>
          <CheckRow
            htmlFor="semanticDiaries"
            checked={semanticDiaries}
            onChange={setSemanticDiaries}
            {...rowCopy('diaryRecall')}
          />
          </SubGroup>
        )}
        </>
      )}
      </Section>
      </>)}

      <Section title="Choices">
      <Row {...rowCopy('continueTheStory')}>
        <OptionSwitcher
          value={continueChoiceMode}
          onChange={(v) => setContinueChoiceMode(v as ContinueChoiceMode)}
          options={CONTINUE_CHOICE_MODES}
        />
      </Row>
      </Section>

      <Section title="Attachments">
      <CheckRow
        htmlFor="imageAttachments"
        checked={imageAttachments}
        onChange={setImageAttachments}
        {...rowCopy('imageAttachments')}
      />
      </Section>

      {advanced && (
      <Section title="Performance">
      <CheckRow
        htmlFor="concurrentTurnRequests"
        checked={concurrentTurnRequests}
        onChange={setConcurrentTurnRequests}
        {...rowCopy('concurrentRequests')}
      />
      </Section>
      )}
    </div>
  );
}
