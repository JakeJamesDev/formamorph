import { memo } from 'react';
import type { ParagraphLimit } from '@/contexts/SettingsContext';
import { THEME_COLORS, FONT_OPTIONS, NARRATION_FONT_OPTIONS, DEFAULT_NARRATION_SCALE, DEFAULT_NARRATION_LINE_HEIGHT, NARRATION_LAYOUTS, type ThemeColor, type FontChoice, type NarrationFont } from '@/contexts/settingsDefaults';
import { ThemePreviewButton } from '@/components/ThemePreviewDialog';
import { RevealAnimationDemoButton } from '@/components/RevealAnimationDemo';
import { FontTuneButton } from '@/components/FontTuneDialog';
import { Row, CheckRow, Section, SubGroup, RecommendedMark, OptionSwitcher } from '@/components/SettingsRows';
import { SETTINGS_BUTTONS, SETTINGS_CONFIRMS, SETTINGS_OPTIONS, type SettingOptionCopy } from '@/components/modals/settingsCopy';
import { rowCopy, optionRowCopy } from '@/components/modals/settingsRowCopy';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
import { COMMON_LANGUAGES } from '@/lib/languages';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ColorPicker } from '@/components/ui/color-picker';
import { useRootSnapshot } from '@/lib/useRootSnapshot';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { hslTripleToHex } from '@/lib/hslColor';
import type { SettingsMode } from '@/lib/settingsMode';
import type { DisplaySettingsSource } from './settingsSource';

// These bindings narrow each option's `value` to the setting's union, so a drifted option fails to compile.
const THEME_OPTIONS: readonly SettingOptionCopy<'light' | 'dark' | 'system'>[] = SETTINGS_OPTIONS.theme;
const PARAGRAPH_LIMIT_OPTIONS: readonly SettingOptionCopy<ParagraphLimit>[] = SETTINGS_OPTIONS.paragraphLimit;

/** The active theme's own dialogue color, before any custom override. */
const readThemeDialogueHex = () =>
  hslTripleToHex(getComputedStyle(document.documentElement).getPropertyValue('--dialogue'));

/** The custom quote color for the mode on screen. Memoized so the style read skips the owner's re-renders. */
const QuoteColorField = memo(function QuoteColorField({ quoteColorMode, activeQuoteColor, setActiveQuoteColor }:
  Pick<DisplaySettingsSource, 'quoteColorMode' | 'activeQuoteColor' | 'setActiveQuoteColor'>) {
  const themeDialogueHex = useRootSnapshot(readThemeDialogueHex);
  return (
    <Row htmlFor="quoteColorCustom" {...rowCopy(quoteColorMode === 'dark' ? 'quoteColorDark' : 'quoteColorLight')}>
      <ColorPicker
        id="quoteColorCustom"
        value={activeQuoteColor ?? themeDialogueHex}
        onChange={setActiveQuoteColor}
        onReset={() => setActiveQuoteColor(null)}
        resetLabel={SETTINGS_BUTTONS.resetToTheme}
      />
    </Row>
  );
});

/** The Settings Display tab body: how the app and the story look. */
export function DisplaySettingsSection({ source, mode }: { source: DisplaySettingsSource; mode: SettingsMode }) {
  const advanced = mode === 'advanced';
  const {
    theme, setTheme,
    themeColor, setThemeColor,
    fontFamily, setFontFamily,
    bgmEnabled, setBgmEnabled,
    locationBackground, setLocationBackground,
    backgroundOverlay, setBackgroundOverlay,
    imageGenDisabled,
    sceneImageAuto, setSceneImageAuto,
    narrationLayout, setNarrationLayout,
    language, setLanguage,
    paragraphLimit, setParagraphLimit,
    markdownOutput, setMarkdownOutput,
    narrationFont, setNarrationFont,
    narrationScale, setNarrationScale,
    narrationLineHeight, setNarrationLineHeight,
    quoteColor, setQuoteColor,
    quoteColorMode, activeQuoteColor, setActiveQuoteColor,
    quoteItalic, setQuoteItalic,
    showReasoning, setShowReasoning,
    showSilentRequests, setShowSilentRequests,
  } = source;
  return (
    <div className="grid gap-6 py-4">
      <Section title="Appearance">
      <Row top {...optionRowCopy('theme', THEME_OPTIONS.find((o) => o.value === theme))}>
        <div>
          <ToggleGroup
            type="single"
            value={theme}
            // A single ToggleGroup clears its value when the active item is clicked again; a theme
            // is always set, so an empty result is ignored rather than stored.
            onValueChange={(v) => { if (v) setTheme(v as 'light' | 'dark' | 'system'); }}
            className="grid w-full grid-cols-3"
          >
            {THEME_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>{o.label}{o.recommended && <RecommendedMark />}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          {/* Help texts stacked in one cell so switching options doesn't reflow the layout. */}
          <div className="grid mt-2">
            {THEME_OPTIONS.map((o) => (
              <p
                key={o.value}
                className={`col-start-1 row-start-1 text-helper text-muted-foreground${o.value === theme ? '' : ' invisible'}`}
              >
                {o.help}
              </p>
            ))}
          </div>
        </div>
      </Row>
      <Row htmlFor="themeColor" {...rowCopy('themeColor')}>
        <div className="flex items-center gap-3">
          <Select value={themeColor} onValueChange={(v) => setThemeColor(v as ThemeColor)}>
            <SelectTrigger id="themeColor" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_COLORS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ThemePreviewButton source={source} />
        </div>
      </Row>
      <Row htmlFor="fontFamily" {...rowCopy('font')}>
        <div className="flex items-center gap-3">
          <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as FontChoice)}>
            <SelectTrigger id="fontFamily" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} style={{ fontFamily: o.stack || undefined }}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FontTuneButton font={fontFamily} source={source} />
        </div>
      </Row>
      </Section>

      <Section title="Scene">
      <CheckRow
        htmlFor="bgmEnabled"
        checked={bgmEnabled}
        onChange={setBgmEnabled}
        {...rowCopy('backgroundMusic')}
      />
      <CheckRow
        htmlFor="locationBackground"
        checked={locationBackground}
        onChange={setLocationBackground}
        {...rowCopy('locationBackground')}
      />
      {locationBackground && (
        <SubGroup>
        <Row {...rowCopy('backgroundFade')}>
          <div className="flex items-center gap-3">
            <Slider
              value={[backgroundOverlay]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(v) => setBackgroundOverlay(v[0])}
              className="max-w-[220px]"
            />
            <span className="text-meta text-muted-foreground tabular-nums w-9 shrink-0">
              {Math.round(backgroundOverlay * 100)}%
            </span>
          </div>
        </Row>
        </SubGroup>
      )}
      {/* Whether every turn gets a picture is a scene setting; the server that draws it stays on
          Endpoints. Hidden with image generation itself, which is the switch it depends on. */}
      {!imageGenDisabled && (
        <CheckRow
          htmlFor="sceneImageAuto"
          checked={sceneImageAuto}
          onChange={setSceneImageAuto}
          {...rowCopy('sceneImages')}
        />
      )}
      </Section>

      <Section title="Narration">
      <Row target={targetAttribute('settings.display', 'narration-layout')} {...rowCopy('narrationLayout')}>
        <OptionSwitcher
          ariaLabel="Narration Layout"
          value={narrationLayout}
          onChange={setNarrationLayout}
          options={NARRATION_LAYOUTS}
        />
      </Row>
      <Row {...rowCopy('narrationReveal')}>
        <RevealAnimationDemoButton source={source} />
      </Row>
      <Row {...rowCopy('aiLanguage')}>
        <TokenAutocomplete
          single
          openOnFocus
          values={language ? [language] : []}
          onChange={(vals) => setLanguage(vals[0] ?? '')}
          options={COMMON_LANGUAGES}
          placeholder="Language or style…"
        />
      </Row>
      {advanced && (
      <Row top {...optionRowCopy('paragraphLimit', PARAGRAPH_LIMIT_OPTIONS.find((o) => o.value === paragraphLimit))}>
        <div>
          <ToggleGroup
            type="single"
            value={paragraphLimit}
            // A single ToggleGroup clears its value when the active item is clicked again; the limit
            // always has a setting, so an empty result is ignored rather than stored.
            onValueChange={(v) => { if (v) setParagraphLimit(v as ParagraphLimit); }}
            className="grid w-full grid-cols-3"
          >
            {PARAGRAPH_LIMIT_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>{o.label}{o.recommended && <RecommendedMark />}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          {/* All option texts stacked in one grid cell so the block is always as tall as the
              longest — switching options shows the active one without reflowing the layout. */}
          <div className="grid mt-2">
            {PARAGRAPH_LIMIT_OPTIONS.map((o) => (
              <p
                key={o.value}
                className={`col-start-1 row-start-1 text-helper text-muted-foreground${o.value === paragraphLimit ? '' : ' invisible'}`}
              >
                {o.help}
              </p>
            ))}
          </div>
        </div>
      </Row>
      )}
      {advanced && (
      <CheckRow
        htmlFor="markdownOutput"
        checked={markdownOutput}
        onChange={setMarkdownOutput}
        {...rowCopy('markdownFormatting')}
      />
      )}
      </Section>

      {/* These rows sit with the rest of what the story looks like; the section keeps the word
          "Accessibility" so the term stays findable. */}
      <Section title="Accessibility" hint="Applies to the story text only, not the rest of the app.">
      <Row htmlFor="narrationFont" target={targetAttribute('settings.display', 'narration-font')} {...rowCopy('narrationFont')}>
        <div className="flex items-center gap-3">
          <Select value={narrationFont} onValueChange={(v) => setNarrationFont(v as NarrationFont)}>
            <SelectTrigger id="narrationFont" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NARRATION_FONT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} style={{ fontFamily: o.stack || undefined }}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* `global` ⇒ this pane runs on the app font, so Customize tunes that same font. */}
          <FontTuneButton font={narrationFont === 'global' ? fontFamily : narrationFont} source={source} />
        </div>
      </Row>
      <Row {...rowCopy('narrationTextSize')}>
        <div className="flex items-center gap-3">
          <Slider
            value={[narrationScale]}
            min={0.85}
            max={1.6}
            step={0.05}
            onValueChange={(v) => setNarrationScale(v[0])}
            className="max-w-[220px]"
          />
          <span className="text-meta text-muted-foreground tabular-nums w-10 shrink-0">
            {Math.round(narrationScale * 100)}%
          </span>
        </div>
      </Row>
      <Row {...rowCopy('lineSpacing')}>
        <div className="flex items-center gap-3">
          <Slider
            value={[narrationLineHeight]}
            min={1.2}
            max={2.2}
            step={0.05}
            onValueChange={(v) => setNarrationLineHeight(v[0])}
            className="max-w-[220px]"
          />
          <span className="text-meta text-muted-foreground tabular-nums w-10 shrink-0">
            {narrationLineHeight.toFixed(2)}
          </span>
        </div>
      </Row>
      <CheckRow
        htmlFor="quoteColor"
        checked={quoteColor}
        onChange={setQuoteColor}
        target={targetAttribute('settings.display', 'quote-color')}
        {...rowCopy('quoteColor')}
      />
      {quoteColor && (
        <QuoteColorField quoteColorMode={quoteColorMode} activeQuoteColor={activeQuoteColor} setActiveQuoteColor={setActiveQuoteColor} />
      )}
      <CheckRow
        htmlFor="quoteItalic"
        checked={quoteItalic}
        onChange={setQuoteItalic}
        {...rowCopy('quoteItalic')}
      />
      <Row>
        <div>
          <ConfirmDialog
            {...SETTINGS_CONFIRMS.resetSizeSpacing}
            onConfirm={() => { setNarrationScale(DEFAULT_NARRATION_SCALE); setNarrationLineHeight(DEFAULT_NARRATION_LINE_HEIGHT); }}
          >
            <Button
              variant="outline"
              size="sm"
              disabled={narrationScale === DEFAULT_NARRATION_SCALE && narrationLineHeight === DEFAULT_NARRATION_LINE_HEIGHT}
            >
              {SETTINGS_BUTTONS.resetSizeSpacing}
            </Button>
          </ConfirmDialog>
        </div>
      </Row>
      </Section>

      {/* Both rows only decide whether a panel appears on screen — nothing about them changes what
          the AI produces, which is what keeps the Output tab honest. */}
      {advanced && (
      <Section title="Inspection" hint="Surfaces work that normally happens out of sight.">
      <CheckRow
        htmlFor="showReasoning"
        checked={showReasoning}
        onChange={setShowReasoning}
        {...rowCopy('showReasoning')}
      />
      <CheckRow
        htmlFor="showSilentRequests"
        checked={showSilentRequests}
        onChange={setShowSilentRequests}
        {...rowCopy('showSilentRequests')}
      />
      </Section>
      )}
    </div>
  );
}
