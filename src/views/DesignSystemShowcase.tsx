import { useState, type ComponentType } from 'react';
import { BookOpen, MonitorCog } from 'lucide-react';
import {
  CheckRow,
  CheckboxOptionGroup,
  OptionSwitcher,
  Row,
  Section,
  ValueSlider,
} from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FieldError, Hint, Meta } from '@/components/ui/typography';
import {
  CONTINUE_CHOICE_MODES,
  DEFAULT_FONT,
  DEFAULT_THEME_COLOR,
  FONT_OPTIONS,
  SYSTEM_FONT_STACK,
  THEME_COLORS,
  fontSizeAdjust,
  type FontChoice,
  type ThemeColor,
  type ContinueChoiceMode,
} from '@/contexts/settingsDefaults';
import type { ThinkingMode } from '@/contexts/SettingsContext';
import { SETTINGS_OPTIONS } from '@/components/modals/settingsCopy';
import { optionRowCopy, rowCopy } from '@/components/modals/settingsRowCopy';
import PromptField from '@/components/prompt/PromptField';
import { plainVocabulary } from '@/lib/chipVocabulary';

type ReferenceDefinition = {
  id: string;
  label: string;
  description: string;
  Component: ComponentType;
};

type ThemeMode = (typeof SETTINGS_OPTIONS.theme)[number]['value'];

const LONG_ENDPOINT = 'Silver Siren local endpoint — 131,072-token creative-writing profile';
const MARKDOWN_VOCABULARY = plainVocabulary();
const MARKDOWN_EXAMPLE = `# The Night Glass

The bell above the **old observatory** rings once at midnight. Its keeper has not answered in three days, but a warm light still moves behind the highest window.

Read the [old observatory](https://example.com/observatory) ledger before you cross the salt marsh. The last entry warns that *reflections remember more than faces*.

## What the traveler knows

- The eastern stair is flooded.
- A brass key hangs in the keeper's room.
- The lens turns toward the sea when no one is watching.

> Bring no mirror past the third landing.

## Field checklist

- [x] Pack lamp oil
- [ ] Find the keeper
- [ ] Record the lens alignment

| Watch | Tide | Signal |
| --- | --- | --- |
| First | Rising | One blue flare |
| Second | High | Three white flares |
| Third | Falling | No light; leave immediately |

Use \`/listen\` at the sealed door, then note any reply in the margin.`;

function DisplayReference() {
  const { resolvedTheme } = useTheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [palette, setPalette] = useState<ThemeColor>(DEFAULT_THEME_COLOR);
  const [font, setFont] = useState<FontChoice>(DEFAULT_FONT);
  const [music, setMusic] = useState(true);
  const [locationBackdrop, setLocationBackdrop] = useState(true);
  const [fade, setFade] = useState(40);
  const [narrationScale, setNarrationScale] = useState(100);
  const previewMode = themeMode === 'system' ? resolvedTheme : themeMode;
  const selectedFont = FONT_OPTIONS.find((option) => option.value === font)?.stack;
  const previewFont = selectedFont ? `${selectedFont}, ${SYSTEM_FONT_STACK}` : SYSTEM_FONT_STACK;

  return (
    <Card role="region" aria-labelledby="display-reference-title">
      <CardHeader>
        <CardTitle id="display-reference-title" className="text-heading">Display reference</CardTitle>
        <CardDescription>Appearance, scene, and narration controls in the aligned settings stack.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <Section title="Appearance">
          <Row
            top
            {...optionRowCopy('theme', SETTINGS_OPTIONS.theme.find((option) => option.value === themeMode))}
          >
            <OptionSwitcher
              ariaLabel="Theme"
              value={themeMode}
              onChange={setThemeMode}
              options={SETTINGS_OPTIONS.theme}
            />
          </Row>
          <Row htmlFor="reference-palette" {...rowCopy('themeColor')}>
            <Select value={palette} onValueChange={(value) => setPalette(value as ThemeColor)}>
              <SelectTrigger id="reference-palette" aria-label="Palette" className="max-w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_COLORS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row htmlFor="reference-font" {...rowCopy('font')}>
            <Select value={font} onValueChange={(value) => setFont(value as FontChoice)}>
              <SelectTrigger id="reference-font" aria-label="Font" className="max-w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} style={{ fontFamily: option.stack || undefined }}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Live sample">
            <div
              data-theme={palette}
              data-reference-theme={previewMode}
              className={`${previewMode} rounded-md border border-border bg-background p-4 text-foreground`}
              style={{ fontFamily: previewFont, fontSizeAdjust: String(fontSizeAdjust(font)) }}
            >
              <p className="text-label font-semibold">The lanterns wake along the harbor.</p>
              <p className="text-helper text-muted-foreground">Theme tokens and the selected font style this sample.</p>
            </div>
          </Row>
        </Section>

        <Section title="Scene">
          <CheckRow
            htmlFor="reference-music"
            checked={music}
            onChange={setMusic}
            {...rowCopy('backgroundMusic')}
          />
          <CheckRow
            htmlFor="reference-backdrop"
            checked={locationBackdrop}
            onChange={setLocationBackdrop}
            {...rowCopy('locationBackground')}
          />
          <Row {...rowCopy('backgroundFade')}>
            <ValueSlider
              ariaLabel="Background fade"
              value={fade}
              min={0}
              max={100}
              step={5}
              onChange={setFade}
              format={(value) => `${value}%`}
            />
          </Row>
        </Section>

        <Section title="Narration">
          <Row {...rowCopy('narrationTextSize')}>
            <ValueSlider
              ariaLabel="Narration size"
              value={narrationScale}
              min={85}
              max={160}
              step={5}
              onChange={setNarrationScale}
              format={(value) => `${value}%`}
            />
          </Row>
        </Section>
      </CardContent>
    </Card>
  );
}

function OutputReference() {
  const [choices, setChoices] = useState(true);
  const [statUpdates, setStatUpdates] = useState(true);
  const [locationChange, setLocationChange] = useState(false);
  const [thinking, setThinking] = useState<ThinkingMode>('off');
  const [continueMode, setContinueMode] = useState<ContinueChoiceMode>('on');

  return (
    <Card role="region" aria-labelledby="output-reference-title">
      <CardHeader>
        <CardTitle id="output-reference-title" className="text-heading">Output reference</CardTitle>
        <CardDescription>Optional passes, reasoning, and choices with production control behavior.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <Section title="Turn Extras" hint="Optional passes that run alongside each turn's narration.">
          <Row {...rowCopy('systemPrompts')}>
            <CheckboxOptionGroup options={[
              { id: 'reference-choices', label: 'Choices', checked: choices, onChange: setChoices },
              { id: 'reference-stat-updates', label: 'Stat Updates', checked: statUpdates, onChange: setStatUpdates },
              { id: 'reference-location-change', label: 'Location Change', checked: locationChange, onChange: setLocationChange },
            ]} />
          </Row>
        </Section>

        <Section title="Reasoning">
          <Row top {...optionRowCopy('thinking', SETTINGS_OPTIONS.thinking.find((option) => option.value === thinking))}>
            <OptionSwitcher
              ariaLabel="Thinking"
              value={thinking}
              onChange={setThinking}
              options={SETTINGS_OPTIONS.thinking}
            />
          </Row>
        </Section>

        <Section title="Choices">
          <Row {...rowCopy('continueTheStory')}>
            <OptionSwitcher
              ariaLabel="Continue the story"
              value={continueMode}
              onChange={setContinueMode}
              options={CONTINUE_CHOICE_MODES}
            />
          </Row>
        </Section>
      </CardContent>
    </Card>
  );
}

function StateReference() {
  const [contextWindow, setContextWindow] = useState('131072');
  const invalidContext = Number(contextWindow) > 65536;

  return (
    <Card role="region" aria-labelledby="control-states-title">
      <CardHeader>
        <CardTitle id="control-states-title" className="text-heading">Control states</CardTitle>
        <CardDescription>Inspectable examples for focus, disabled, validation, and overflow behavior.</CardDescription>
      </CardHeader>
      <CardContent>
        <Section title="Reference States">
          <Row label="Keyboard focus" hint="The ring uses the active theme's focus token.">
            <Button autoFocus variant="outline">Focused action</Button>
          </Row>
          <Row label="Unavailable option" muted>
            <label htmlFor="reference-disabled" className="flex items-center gap-2">
              <Checkbox id="reference-disabled" aria-label="Scene images" checked disabled />
              <Hint as="span">No image endpoint is configured.</Hint>
            </label>
          </Row>
          <Row top label="Context window" htmlFor="reference-context-window">
            <div className="space-y-1">
              <Input
                id="reference-context-window"
                value={contextWindow}
                onChange={(event) => setContextWindow(event.target.value)}
                aria-invalid={invalidContext}
                aria-describedby="reference-context-error"
                className={invalidContext ? 'border-destructive' : undefined}
              />
              {invalidContext && (
                <FieldError id="reference-context-error">Exceeds the reference endpoint limit of 65,536 tokens.</FieldError>
              )}
            </div>
          </Row>
          <Row label="Endpoint profile" hint="Long selected values stay on one line without widening the row.">
            <Select value={LONG_ENDPOINT} onValueChange={() => {}}>
              <SelectTrigger aria-label="Endpoint profile" title={LONG_ENDPOINT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LONG_ENDPOINT}>{LONG_ENDPOINT}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </Section>
      </CardContent>
    </Card>
  );
}

function SettingsReference() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <DisplayReference />
        <OutputReference />
      </div>
      <StateReference />
    </div>
  );
}

function MarkdownReference() {
  const [content, setContent] = useState(MARKDOWN_EXAMPLE);

  return (
    <Card role="region" aria-labelledby="markdown-reference-title">
      <CardHeader>
        <CardTitle id="markdown-reference-title" className="text-heading">Markdown editing reference</CardTitle>
        <CardDescription>
          Long-form authoring with production formatting, history, view, and full-screen controls.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PromptField
          value={content}
          onChange={setContent}
          vocabulary={MARKDOWN_VOCABULARY}
          markdown
          label="World introduction"
          ariaLabel="World introduction"
          className="h-[30rem] max-h-[70dvh]"
        />
      </CardContent>
    </Card>
  );
}

/** Add later approved references here; the shell and responsive navigation need no redesign. */
const DESIGN_SYSTEM_REFERENCES: readonly ReferenceDefinition[] = [
  {
    id: 'settings',
    label: 'Settings',
    description: 'Display and Output composition',
    Component: SettingsReference,
  },
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Compact long-form editing',
    Component: MarkdownReference,
  },
];

export function DesignSystemShowcase() {
  const [activeReference, setActiveReference] = useState(DESIGN_SYSTEM_REFERENCES[0].id);

  return (
    <main data-design-system-showcase className="fixed inset-0 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-8">
        <header className="grid gap-3 border-b border-border pb-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Meta className="inline-flex items-center gap-1.5 uppercase tracking-wider">
              <MonitorCog className="h-3.5 w-3.5" /> Development reference
            </Meta>
            <h1 className="text-display font-semibold">Formamorph design system</h1>
            <Hint className="max-w-3xl">
              Live production components for visual review. Changes here never alter saved settings or call an endpoint.
            </Hint>
          </div>
          <div className="flex items-center gap-2 text-meta text-muted-foreground">
            <BookOpen className="h-4 w-4" /> Guide: docs/Design-System.md
          </div>
        </header>

        <Tabs value={activeReference} onValueChange={setActiveReference}>
          <TabsList
            aria-label="Design references"
            className="grid w-full sm:w-auto"
            style={{ gridTemplateColumns: `repeat(${DESIGN_SYSTEM_REFERENCES.length}, minmax(8rem, 1fr))` }}
          >
            {DESIGN_SYSTEM_REFERENCES.map((reference) => (
              <TabsTrigger key={reference.id} value={reference.id}>{reference.label}</TabsTrigger>
            ))}
          </TabsList>
          {DESIGN_SYSTEM_REFERENCES.map(({ id, label, description, Component }) => (
            <TabsContent key={id} value={id} className="grid gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-title font-semibold">{label} pattern</h2>
                <Meta>{description}</Meta>
              </div>
              <Component />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </main>
  );
}

export default DesignSystemShowcase;
