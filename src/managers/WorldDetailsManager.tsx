import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PanelTabContent, PanelTabs, type PanelTab } from "@/components/ui/panel-tabs";
import PromptField from "@/components/prompt/PromptField";
import PlaceholderField from "@/components/prompt/PlaceholderField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { PROMPT_KIND_VARIABLES } from "@/lib/promptVariables";
import { authoredChipScene } from "@/lib/chipValues/authoredScene";
import { chipValues } from "@/lib/chipValues/chipValues";
import { composePreviewValues, languagePreviewValue } from "@/lib/previewValuePool";
import { layerValues, omitValues } from "@/lib/promptValues";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/ui/typography";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HintInfo } from "@/components/SettingsRows";
import {
  clearWorldPromptOverride, setWorldPromptOverride, storedWorldPrompt, worldPromptEnabled,
  WORLD_PROMPT_KINDS, WORLD_PROMPT_KIND_LABELS, type WorldPromptKind,
} from "@/lib/worldPrompt";
import { openingsEnabled, setOpeningsEnabled } from "@/lib/openings";
import { OpeningsPanel } from "./OpeningsPanel";
import type { OverviewPanelTab, OverviewPlace } from '@/views/overviewPanelTabs';
import type { FieldReveal } from '@/views/useHistoryReveal';
import { fieldFrame, fieldPath } from '@/lib/historyField';
import type { FocusFieldHint } from "@/types";

/** Which preset field each kind replaces, and which chip palette that prompt is written against. */
const PROMPT_KIND_VARIABLE_KEY = {
  narration: 'narration', choices: 'choices', statUpdates: 'statupdates',
} as const;

/** The note-and-Reset row under whichever panel is open. Reset appears only for text the author stored. */
const PanelFooter = ({ note, onReset }: { note: ReactNode; onReset?: () => void }) => (
  <div className="flex items-start justify-between gap-2">
    <Hint>{note}</Hint>
    {onReset && (
      <Button variant="ghost" size="sm" className="shrink-0" onClick={onReset}>
        Reset
      </Button>
    )}
  </div>
);

/** The checkbox at the top of a tab that says whether the world uses what the tab holds. */
const EnableRow = ({ label, checked, disabled, onChange, frame }: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  frame: ReturnType<typeof fieldFrame>;
}) => (
  <label className="flex w-fit cursor-pointer items-center space-x-2 has-[:disabled]:cursor-not-allowed" {...frame}>
    <Checkbox checked={checked} disabled={disabled} onCheckedChange={(c) => onChange(c === true)} />
    <span>{label}</span>
  </label>
);

/**
 * The system prompts this world supplies in place of the player's own: narration, choices, and stat
 * updates, one status row each above the selected prompt. A prompt opens on the active preset's prompt as
 * an unstored template, so an author edits something that works; the first edit is what stores it on the world, and Reset drops it back
 * to tracking the template. Only these three system prompts are replaceable; every other AI pass keeps
 * running on the player's own preset.
 */
const CustomPromptsSection = ({ kind, onKindChange }: {
  kind: WorldPromptKind;
  onKindChange: (kind: WorldPromptKind) => void;
}) => {
  const {
    worldOverview, updateWorldOverview, stats, statGroups, locations, connections, entities, traits, traitGroups, dictionaries,
    placeholders, items, placements, slots, bodies, currencies,
  } = useGameData();
  const {
    paragraphLimit, maxTokens, markdownOutput, activeSectionStyle, limitActiveCharacters, activeCharacterLimit,
    language,
    systemPrompt: presetNarrationPrompt, choicesPrompt: presetChoicesPrompt,
    statUpdatesPrompt: presetStatUpdatesPrompt,
  } = useSettings();
  // The world being edited, previewed as its own opening scene — the author reads their entities and their
  // location, not a stand-in's. Tokens only a turn can fill (the action, the narration, who is speaking)
  // fall through to the shared samples, exactly as they do for a live game between turns.
  const previewValues = useMemo(
    () => {
      // A world has no notes or clock, so the pool's sample turn supplies both, as it does the per-turn chips.
      const authored = omitValues(chipValues(authoredChipScene({
        worldOverview, stats, statGroups, locations, connections, entities, traits, traitGroups, dictionaries, placeholders,
        items, placements, slots, bodies, currencies,
      })), (key) => key === '<NOTES>' || key === '<TIME>');
      return composePreviewValues(
        {
          paragraphLimit, maxTokens, markdownOutput, sectionStyle: activeSectionStyle,
          limitActiveCharacters, activeCharacterLimit, language,
        },
        authored,
      );
    },
    [
      paragraphLimit, maxTokens, markdownOutput, activeSectionStyle, limitActiveCharacters, activeCharacterLimit,
      language,
      worldOverview, stats, statGroups, locations, connections, entities, traits, traitGroups, dictionaries, placeholders,
      items, placements, slots, bodies, currencies,
    ],
  );
  const [resetKind, setResetKind] = useState<WorldPromptKind | null>(null);

  // The prompt each tab tracks: what the game would send right now, preset pins and all — not the shipped
  // default, which an author with an edited preset would not recognize as theirs.
  const presetPrompts: Record<WorldPromptKind, string> = {
    narration: presetNarrationPrompt,
    choices: presetChoicesPrompt,
    statUpdates: presetStatUpdatesPrompt,
  };

  // Off keeps the text and only clears the flag, so a stray click costs nothing.
  const write = (kind: WorldPromptKind, update: { text?: string; enabled?: boolean }) =>
    updateWorldOverview({ promptOverrides: setWorldPromptOverride(worldOverview.promptOverrides, kind, update) });

  const reset = () => {
    if (resetKind) {
      updateWorldOverview({ promptOverrides: clearWorldPromptOverride(worldOverview.promptOverrides, resetKind) });
    }
    setResetKind(null);
  };

  const stored = storedWorldPrompt(worldOverview, kind);
  const enabled = worldPromptEnabled(worldOverview, kind);
  const kindName = WORLD_PROMPT_KIND_LABELS[kind];
  const label = kindName.toLowerCase();

  return (
    <div className="space-y-2">
      <ul aria-label="Custom Prompt Kinds" className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {WORLD_PROMPT_KINDS.map((k) => {
          const rowName = WORLD_PROMPT_KIND_LABELS[k];
          const rowEnabled = worldPromptEnabled(worldOverview, k);
          const selected = k === kind;
          const status = rowEnabled ? 'Custom' : 'Default';
          return (
            <li key={k} className={cn('flex items-center', selected ? 'bg-accent' : 'hover:bg-accent/60')}>
              <span className="flex items-center pl-3" {...fieldFrame('prompts', k, 'enabled')}>
                <Checkbox
                  checked={rowEnabled}
                  aria-label={`Use ${rowName} Prompt`}
                  onCheckedChange={(c) => write(k, { enabled: c === true })}
                />
              </span>
              <button
                type="button"
                aria-current={selected ? 'true' : undefined}
                aria-label={`${rowName}, ${status}`}
                onClick={() => onKindChange(k)}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 py-2 pl-2 pr-3 text-left text-label outline-none',
                  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  selected && 'font-medium',
                )}
              >
                <span className="flex-1 truncate">{rowName}</span>
                <span className={cn('text-meta', rowEnabled ? 'text-foreground' : 'text-muted-foreground')}>{status}</span>
                <ChevronRight aria-hidden className={cn('h-4 w-4 shrink-0', !selected && 'invisible')} />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="pt-1 text-helper font-medium text-muted-foreground">{kindName} Prompt</p>
      <PlaceholderField
        key={kind}
        historyField={fieldPath('prompts', kind)}
        value={stored ?? presetPrompts[kind]}
        // Storing on the first divergence is what keeps an untouched kind tracking the preset: a
        // world only carries a prompt its author actually wrote.
        onChange={(text) => {
          if (stored === undefined && text === presetPrompts[kind]) return;
          write(kind, { text, enabled });
        }}
        placeholders={placeholders}
        promptChips={{
          variables: PROMPT_KIND_VARIABLES[PROMPT_KIND_VARIABLE_KEY[kind]],
          // The choices prompt's language chip names itself in the directive, so its preview says
          // "choices" where the pool's default says "narration".
          previewValues: kind === 'choices'
            ? layerValues(previewValues, languagePreviewValue('choices', language))
            : previewValues,
          sampleData: 'Your world, sample turn',
        }}
        ariaLabel={`World ${label} prompt`}
        resizable
      />
      <PanelFooter
        note={(
          <>
            {enabled
              ? `Replaces the player's ${label} prompt while they play this world. They can decline it from the world's details window.`
              : `Not applied until you check ${kindName} above. Players use their own ${label} prompt.`}
            {stored === undefined && ` Shows your current ${label} prompt and follows it until you edit it here.`}
          </>
        )}
        onReset={stored === undefined ? undefined : () => setResetKind(kind)}
      />

      <ConfirmDialog
        open={resetKind !== null}
        onOpenChange={(open) => { if (!open) setResetKind(null); }}
        title={`Discard this world's ${WORLD_PROMPT_KIND_LABELS[resetKind ?? 'narration'].toLowerCase()} prompt?`}
        description="It goes back to following your own prompt. The text you wrote here is not kept."
        onConfirm={reset}
      />
    </div>
  );
};

/** The world's openings, under the checkbox that says whether the world uses them. */
const OpeningsTab = ({ onOpenEntity, onOpenLocation }: {
  onOpenEntity?: (entityId: string) => void;
  onOpenLocation?: (locationId: string) => void;
}) => {
  const { worldOverview, updateWorldOverview, entities, locations } = useGameData();
  const enabled = openingsEnabled(worldOverview, [...entities, ...locations]);
  // Nothing to switch until an opening exists: the box derives off, so a click would write a flag that
  // reads off again. The world plays the default opening either way.
  const noOpenings = !enabled && worldOverview.openingsEnabled !== false;
  return (
    <div className="space-y-4">
      <EnableRow
        label="Use These Openings"
        checked={enabled}
        disabled={noOpenings}
        onChange={(on) => updateWorldOverview(setOpeningsEnabled(on))}
        frame={fieldFrame('prompts', 'opening', 'enabled')}
      />
      <OpeningsPanel onOpenEntity={onOpenEntity} onOpenLocation={onOpenLocation} />
    </div>
  );
};

/** The readme tab that shows each readme field, by its find-bar field key and its field identity alike. */
const README_TABS: Partial<Record<string, 'introduction' | 'gameplay'>> = { introReadme: 'introduction', readme: 'gameplay' };

/**
 * The world's two readmes, one tab each. The player never sees them together: the Introduction opens over
 * the first enter-world setup screen and the Gameplay one on entering the game, so writing for a player
 * who has already built their character stays out of the pre-trait window.
 *
 * `focusField` is the search target the find bar just navigated to, and `fieldReveal` the field an undo or
 * redo returns to. Either is the only way to reach whichever readme isn't showing. Each arrives as a fresh
 * object per navigation, so a second visit to the same readme re-opens its tab after the author flipped away.
 */
const ReadmeSection = ({ focusField, fieldReveal }: {
  focusField?: FocusFieldHint | null;
  fieldReveal?: FieldReveal | null;
}) => {
  const { worldOverview, updateWorldOverview, placeholders } = useGameData();
  // Opens on the Introduction, except for a world that only has the older Gameplay readme — an author
  // whose readme is on the other tab would otherwise be met by an empty field where their text used to be.
  const [tab, setTab] = useState(() =>
    !worldOverview.introReadme?.trim() && worldOverview.readme?.trim() ? 'gameplay' : 'introduction');

  useEffect(() => {
    const shows = README_TABS[focusField?.fieldKey ?? ''];
    if (shows) setTab(shows);
  }, [focusField]);
  useEffect(() => {
    const shows = README_TABS[fieldReveal?.field ?? ''];
    if (shows) setTab(shows);
  }, [fieldReveal]);

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="leading-none">Readme</Label>
        <TabsList>
          <TabsTrigger value="introduction">Introduction</TabsTrigger>
          <TabsTrigger value="gameplay">Gameplay</TabsTrigger>
        </TabsList>
      </div>
      {/* Both are shown once a playthrough's rolls exist, so placeholders resolve in either. Each tab's
          guidance is a hint above its field, where a resizable field cannot push it out of view. */}
      <TabsContent value="introduction" className="space-y-2">
        <Hint>Shown before the player makes any setup choices</Hint>
        <PlaceholderField
          historyField="introReadme"
          value={worldOverview.introReadme ?? ''}
          onChange={(introReadme) => updateWorldOverview({ introReadme })}
          placeholders={placeholders}
          markdown
          ariaLabel="Introduction Readme"
          resizable
        />
      </TabsContent>
      <TabsContent value="gameplay" className="space-y-2">
        <Hint>Shown when the player enters the world</Hint>
        <PlaceholderField
          historyField="readme"
          value={worldOverview.readme ?? ''}
          onChange={(readme) => updateWorldOverview({ readme })}
          placeholders={placeholders}
          markdown
          ariaLabel="Gameplay Readme"
          resizable
        />
      </TabsContent>
    </Tabs>
  );
};

/** The ⓘ behind each Overview description: who reads it, and who never does. */
export const PLAYER_DESCRIPTION_INFO = 'Shows on your world\'s library card and community listing. The AI never reads it.';
export const AI_DESCRIPTION_INFO = "Goes to the AI on every turn as your world's description. Players never see it.";

/** The Overview's right column: the world's descriptions and readme on Details, then its custom prompts
 *  and its openings on tabs of their own. The listing fields live in WorldOverviewManager (left column). */
const WorldDetailsManager = ({ focusField, fieldReveal, place, onPlaceChange, tabs, onOpenEntity, onOpenLocation }: {
  focusField?: FocusFieldHint | null;
  /** The field the latest undo or redo returns to. */
  fieldReveal?: FieldReveal | null;
  /** The shown tab and prompt kind, held by the editor, which also moves it for Find and undo. */
  place: OverviewPlace;
  onPlaceChange: Dispatch<SetStateAction<OverviewPlace>>;
  /** The tabs the editor mode offers. */
  tabs: readonly (PanelTab & { value: OverviewPanelTab })[];
  /** Opens an entity's Openings tab, from the openings panel's group header. */
  onOpenEntity?: (entityId: string) => void;
  /** Opens a location's Openings tab, from the openings panel's group header. */
  onOpenLocation?: (locationId: string) => void;
}) => {
  const { worldOverview, updateWorldOverview, placeholders } = useGameData();
  // The description shows in the library, before a playthrough exists — so placeholders can never be rolled
  // for it. No chip family here: any `{{ph…}}` an old world carries stays inert text, exactly as it'd read.
  const plainVocab = useMemo(() => plainVocabulary(), []);
  return (
    <PanelTabs
      tabs={tabs}
      value={place.tab}
      onValueChange={(tab) => onPlaceChange((held) => ({ ...held, tab }))}
      stripLabel="Overview Fields"
      surfaceTabs="worldEditorOverview"
    >
      <PanelTabContent value="details">
        <PromptField
          label="Player-Facing Description"
          historyField="description"
          info={<HintInfo>{PLAYER_DESCRIPTION_INFO}</HintInfo>}
          value={worldOverview.description}
          onChange={(description) => updateWorldOverview({ description })}
          vocabulary={plainVocab}
          markdown
          resizable
        />

        <ReadmeSection focusField={focusField} fieldReveal={fieldReveal} />

        <PlaceholderField
          label="AI-Facing Description"
          historyField="systemPrompt"
          info={<HintInfo>{AI_DESCRIPTION_INFO}</HintInfo>}
          value={worldOverview.systemPrompt || ''}
          onChange={(systemPrompt) => updateWorldOverview({ systemPrompt })}
          placeholders={placeholders}
          resizable
          tourAnchor="world-ai-description"
        />
      </PanelTabContent>
      <PanelTabContent value="prompts">
        <CustomPromptsSection kind={place.kind} onKindChange={(kind) => onPlaceChange((held) => ({ ...held, kind }))} />
      </PanelTabContent>
      <PanelTabContent value="openings">
        <OpeningsTab onOpenEntity={onOpenEntity} onOpenLocation={onOpenLocation} />
      </PanelTabContent>
    </PanelTabs>
  );
};

export default WorldDetailsManager;
