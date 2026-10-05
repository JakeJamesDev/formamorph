import { useEffect, useState, type ComponentType } from 'react';
import { PromptNavigationReference } from '@/components/design-system/PromptNavigationReference';
import { BearerFlyoutReference } from '@/components/design-system/BearerFlyoutReference';
import { BreadcrumbPickerReference } from '@/components/design-system/BreadcrumbPickerReference';
import { TravelHintPairReference } from '@/components/design-system/TravelHintPairReference';
import { FormaquestionReference } from '@/components/design-system/FormaquestionReference';
import { FeedbackFilterRowReference } from '@/components/design-system/FeedbackFilterRowReference';
import { SupporterFlairReference } from '@/components/design-system/SupporterFlairReference';
import { PresetHeaderReference } from '@/components/design-system/PresetHeaderReference';
import { LandingPulseReference } from '@/components/design-system/LandingPulseReference';
import { useDevRoute } from '@/lib/devRouter';
import { BookOpen, MonitorCog } from 'lucide-react';
import { OptionSwitcher, Row, Section } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorPicker } from '@/components/ui/color-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FieldError, Hint, Meta } from '@/components/ui/typography';
import { FONT_OPTIONS, SYSTEM_FONT_STACK, fontSizeAdjust } from '@/contexts/settingsDefaults';
import type { ParagraphLimit } from '@/lib/outputLength';
import { SETTINGS_OPTIONS } from '@/components/modals/settingsCopy';
import { optionRowCopy, rowCopy } from '@/components/modals/settingsRowCopy';
import { DisplaySettingsSection } from '@/components/modals/DisplaySettingsSection';
import { OutputSettingsSection } from '@/components/modals/OutputSettingsSection';
import { SettingsModeSwitch } from '@/components/modals/SettingsModeSwitch';
import type { SettingsSource } from '@/components/modals/settingsSource';
import { useLocalSettingsSource } from '@/components/design-system/useLocalSettingsSource';
import { settingsUseAdvancedValues, sectionHiddenFields } from '@/lib/settingsAdvancedData';
import { reasoningRuledOut } from '@/lib/reasoningEffort';
import type { SettingsMode } from '@/lib/settingsMode';
import PromptField from '@/components/prompt/PromptField';
import { plainVocabulary } from '@/lib/chipVocabulary';
import { CommunityCardReference } from '@/components/design-system/CommunityCardReference';
import { FindBarReference } from '@/components/design-system/FindBarReference';
import { CodeTemplatesReference } from '@/components/design-system/CodeTemplatesReference';
import { LocationsCanvasReference } from '@/components/design-system/LocationsCanvasReference';
import { MainMenuContextMenuReference } from '@/components/design-system/MainMenuContextMenuReference';
import { FooterActionOrderReference } from '@/components/design-system/FooterActionOrderReference';
import { NarrationTurnReference } from '@/components/design-system/NarrationTurnReference';
import { PanelTabStripReference } from '@/components/design-system/PanelTabStripReference';
import { RichListReferences } from '@/components/design-system/RichListReferences';
import { PromptChipsReference } from '@/components/design-system/PromptChipsReference';

type ReferenceDefinition = {
  id: string;
  label: string;
  description: string;
  Component: ComponentType;
};

const LONG_ENDPOINT = 'Silver Siren local endpoint — 131,072-token creative-writing profile';
const REFERENCE_COLOR = '#d4a24c';
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

function LiveSample({ source }: { source: SettingsSource }) {
  const selectedFont = FONT_OPTIONS.find((option) => option.value === source.fontFamily)?.stack;
  const previewFont = selectedFont ? `${selectedFont}, ${SYSTEM_FONT_STACK}` : SYSTEM_FONT_STACK;

  return (
    <Card role="region" aria-labelledby="live-sample-title">
      <CardHeader>
        <CardTitle id="live-sample-title" className="text-heading">Live Sample</CardTitle>
        <CardDescription>This sample shows the reference theme, palette, and font.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          data-theme={source.themeColor}
          data-reference-theme={source.resolvedTheme}
          className={`${source.resolvedTheme} rounded-md border border-border bg-background p-4 text-foreground`}
          style={{ fontFamily: previewFont, fontSizeAdjust: String(fontSizeAdjust(source.fontFamily)) }}
        >
          <p className="text-label font-semibold">The lanterns wake along the harbor.</p>
          <p className="text-helper text-muted-foreground">This sample shows the selected theme and font.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StateReference() {
  const [contextWindow, setContextWindow] = useState('131072');
  const invalidContext = Number(contextWindow) > 65536;
  const [modelName, setModelName] = useState('Silver Siren 12B');
  const [paragraphLimit, setParagraphLimit] = useState<ParagraphLimit>('auto');
  const [dialogueColor, setDialogueColor] = useState(REFERENCE_COLOR);

  return (
    <Card role="region" aria-labelledby="control-states-title">
      <CardHeader>
        <CardTitle id="control-states-title" className="text-heading">Control States</CardTitle>
        <CardDescription>These examples show the control states.</CardDescription>
      </CardHeader>
      <CardContent>
        <Section title="Reference States">
          <Row htmlFor="reference-model-name" {...rowCopy('modelName')}>
            <Input id="reference-model-name" value={modelName} onChange={(event) => setModelName(event.target.value)} />
          </Row>
          <Row top {...optionRowCopy('paragraphLimit', SETTINGS_OPTIONS.paragraphLimit.find((option) => option.value === paragraphLimit))}>
            <OptionSwitcher
              ariaLabel="Paragraph Limit"
              value={paragraphLimit}
              onChange={setParagraphLimit}
              options={SETTINGS_OPTIONS.paragraphLimit}
            />
          </Row>
          <Row label="Color" htmlFor="reference-color" hint="Accepts 6-digit hex values only">
            <ColorPicker
              id="reference-color"
              value={dialogueColor}
              onChange={setDialogueColor}
              onReset={() => setDialogueColor(REFERENCE_COLOR)}
              resetLabel="Reset to Theme"
            />
          </Row>
          <Row label="Keyboard Focus" hint="The selected theme controls the focus ring color.">
            <Button autoFocus variant="outline">Focused Action</Button>
          </Row>
          <Row label="Unavailable Option" muted>
            <label htmlFor="reference-disabled" className="flex items-center gap-2">
              <Checkbox id="reference-disabled" aria-label="Scene Images" checked disabled />
              <Hint as="span">This example has no image endpoint.</Hint>
            </label>
          </Row>
          <Row top label="Context Window" htmlFor="reference-context-window">
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
                <FieldError id="reference-context-error">The value is more than 65,536 tokens.</FieldError>
              )}
            </div>
          </Row>
          <Row label="Endpoint Profile" hint="The control shows long values on one line.">
            <Select value={LONG_ENDPOINT} onValueChange={() => {}}>
              <SelectTrigger aria-label="Endpoint Profile" title={LONG_ENDPOINT}>
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
  const [status, setStatus] = useState('This line shows the effects that the reference skips.');
  const source = useLocalSettingsSource(setStatus);
  const [mode, setMode] = useState<SettingsMode>('advanced');
  const nativeReasoningRuledOut = reasoningRuledOut(source.reasoningCapability);
  const hasHiddenValues = mode === 'simple' && settingsUseAdvancedValues(sectionHiddenFields(source));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Meta role="status" aria-live="polite" className="min-w-0 flex-1">{status}</Meta>
        <SettingsModeSwitch mode={mode} onModeChange={setMode} hasHiddenValues={hasHiddenValues} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card role="region" aria-labelledby="display-reference-title">
          <CardHeader>
            <CardTitle id="display-reference-title" className="text-heading">Display Reference</CardTitle>
            <CardDescription>This reference shows the production Display section with local values.</CardDescription>
          </CardHeader>
          <CardContent>
            <DisplaySettingsSection source={source} mode={mode} />
          </CardContent>
        </Card>
        <Card role="region" aria-labelledby="output-reference-title">
          <CardHeader>
            <CardTitle id="output-reference-title" className="text-heading">Output Reference</CardTitle>
            <CardDescription>This reference shows the production Output section with local values.</CardDescription>
          </CardHeader>
          <CardContent>
            <OutputSettingsSection source={source} mode={mode} nativeReasoningRuledOut={nativeReasoningRuledOut} />
          </CardContent>
        </Card>
      </div>
      <LiveSample source={source} />
      <StateReference />
    </div>
  );
}

function MarkdownReference() {
  const [content, setContent] = useState(MARKDOWN_EXAMPLE);

  return (
    <Card role="region" aria-labelledby="markdown-reference-title">
      <CardHeader>
        <CardTitle id="markdown-reference-title" className="text-heading">Markdown Editing Reference</CardTitle>
        <CardDescription>
          This editor shows the world introduction.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PromptField
          value={content}
          onChange={setContent}
          vocabulary={MARKDOWN_VOCABULARY}
          markdown
          label="World Introduction"
          ariaLabel="World Introduction"
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
  {
    id: 'prompt-chips',
    label: 'Prompt Chips',
    description: 'Inline conditional text and chip editing',
    Component: PromptChipsReference,
  },
  {
    id: 'community-cards',
    label: 'Community Cards',
    description: 'Image-led creation listings',
    Component: CommunityCardReference,
  },
  {
    id: 'find-bar',
    label: 'Find',
    description: 'Compact editor search and replacement',
    Component: FindBarReference,
  },
  {
    id: 'code-templates',
    label: 'Code Templates',
    description: 'Selection, parameters, validation, and generated code',
    Component: CodeTemplatesReference,
  },
  {
    id: 'locations',
    label: 'Locations',
    description: 'Bounded spatial editing',
    Component: LocationsCanvasReference,
  },
  {
    id: 'context-menu',
    label: 'Context Menu',
    description: 'Grouped library tile actions',
    Component: MainMenuContextMenuReference,
  },
  {
    id: 'rich-lists',
    label: 'Rich Lists',
    description: 'Editor and Save/Load list composition',
    Component: RichListReferences,
  },
  {
    id: 'footer-actions',
    label: 'Footer Actions',
    description: 'Negative and affirmative dialog actions',
    Component: FooterActionOrderReference,
  },
  {
    id: 'panel-tabs',
    label: 'Panel Tabs',
    description: 'Editor detail panel tab strips',
    Component: PanelTabStripReference,
  },
  {
    id: 'prompt-navigation',
    label: 'Prompt Navigation',
    description: 'Nested prompt selection and independent scrolling',
    Component: PromptNavigationReference,
  },
  {
    id: 'narration-turn',
    label: 'Narration Turn',
    description: 'Turn Card, Scene Plate, and choice rows',
    Component: NarrationTurnReference,
  },
  {
    id: 'bearer-flyouts',
    label: 'Bearer Flyouts',
    description: 'Drill-down entity pickers in a menu and on a button',
    Component: BearerFlyoutReference,
  },
  {
    id: 'breadcrumb-picker',
    label: 'Breadcrumb Picker',
    description: 'Searchable single-select popover over world content',
    Component: BreadcrumbPickerReference,
  },
  {
    id: 'travel-hints',
    label: 'Travel Hints',
    description: 'Two Travel Hint boxes joined by a link toggle',
    Component: TravelHintPairReference,
  },
  {
    id: 'formaquestion',
    label: 'Formaquestion',
    description: 'Help tab, floating window, search results, and reader',
    Component: FormaquestionReference,
  },
  {
    id: 'filter-row',
    label: 'Filter Row',
    description: 'Search, the main filters, and a Filters popover',
    Component: FeedbackFilterRowReference,
  },
  {
    id: 'supporter-flair',
    label: 'Supporter Flair',
    description: 'Tier colors, badges, names, and Profile Image rings',
    Component: SupporterFlairReference,
  },
  {
    id: 'preset-header',
    label: 'Preset Header',
    description: 'Preset select, actions, reachability, and Reset and Compare',
    Component: PresetHeaderReference,
  },
  {
    id: 'landing-pulse',
    label: 'Landing Pulse',
    description: 'One ring pulse on the row a Take Me There landing points at',
    Component: LandingPulseReference,
  },
];

export function DesignSystemShowcase() {
  const route = useDevRoute();
  const [activeReference, setActiveReference] = useState(DESIGN_SYSTEM_REFERENCES[0].id);
  useEffect(() => {
    if (route?.modal === 'designSystem' && DESIGN_SYSTEM_REFERENCES.some((reference) => reference.id === route.tab)) {
      setActiveReference(route.tab!);
    }
  }, [route]);

  return (
    <main data-design-system-showcase className="fixed inset-0 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-8">
        <header className="grid gap-3 border-b border-border pb-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Meta className="inline-flex items-center gap-1.5 uppercase tracking-wider">
              <MonitorCog className="h-3.5 w-3.5" /> Development Reference
            </Meta>
            <h1 className="text-display font-semibold">Formamorph Design System</h1>
            <Hint className="max-w-3xl">
              Select a reference.
            </Hint>
          </div>
          <div className="flex items-center gap-2 text-meta text-muted-foreground">
            <BookOpen className="h-4 w-4" /> Guide: docs/Design-System.md
          </div>
        </header>

        <Tabs value={activeReference} onValueChange={setActiveReference}>
          <TabsList
            aria-label="Design References"
            className="grid h-auto w-full"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))' }}
          >
            {DESIGN_SYSTEM_REFERENCES.map((reference) => (
              <TabsTrigger key={reference.id} value={reference.id} className="min-h-10 min-w-0 whitespace-normal px-2 text-center">{reference.label}</TabsTrigger>
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
