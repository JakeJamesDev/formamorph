import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import PromptField from "@/components/prompt/PromptField";
import PlaceholderField from "@/components/prompt/PlaceholderField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { PROMPT_KIND_VARIABLES } from "@/lib/promptVariables";
import { authoredPreviewValues } from "@/lib/authoredPreviewValues";
import { composePreviewValues, languagePreviewValue } from "@/lib/previewValuePool";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/typography";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HintInfo } from "@/components/SettingsRows";
import {
  clearWorldPromptOverride, setWorldPromptOverride, storedWorldPrompt, worldPromptEnabled, worldPromptFieldKey,
  WORLD_PROMPT_KINDS, WORLD_PROMPT_KIND_LABELS, type WorldPromptKind,
} from "@/lib/worldPrompt";
import { isOpeningFieldKey, openingsEnabled, setOpeningsEnabled } from "@/lib/openings";
import { OpeningsPanel } from "./OpeningsPanel";
import { useEditorMode } from "@/lib/editorMode";
import type { FocusFieldHint } from "@/types";

/** Which preset field each kind replaces, and which chip palette that prompt is written against. */
const PROMPT_KIND_VARIABLE_KEY = {
  narration: 'narration', choices: 'choices', statUpdates: 'statupdates',
} as const;

/**
 * The openings share the section's picker without being a {@link WorldPromptKind}: they are the player's
 * first message rather than a system prompt, and they live on their own overview fields instead of in
 * `promptOverrides`. So the panel keys widen by one where the override type does not.
 */
type PanelKind = WorldPromptKind | 'opening';

/** The three system prompts first, then the outlier — an opening is a different kind of text. */
const PANEL_KINDS: PanelKind[] = [...WORLD_PROMPT_KINDS, 'opening'];

const PANEL_LABELS: Record<PanelKind, string> = { ...WORLD_PROMPT_KIND_LABELS, opening: 'Openings' };

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

/**
 * The text this world supplies in place of the player's own, one panel each with its enable checkbox in the
 * picker's chrome: the narration, choices, and stat-update system prompts, plus the world's openings. A
 * prompt panel opens on the active preset's prompt as an unstored template, so an author edits something
 * that works; the first edit is what stores it on the world, and Reset drops it back to tracking the
 * template. Only these three system prompts are replaceable; every other AI pass keeps running on the
 * player's own preset.
 *
 * Openings need no player-facing opt-out where the prompts do: the pre-filled box is editable, so the
 * player already has the last word on what the opening turn says.
 */
const CustomPromptsSection = ({ focusField, onOpenEntity }: {
  focusField?: FocusFieldHint | null;
  onOpenEntity?: (entityId: string) => void;
}) => {
  const {
    worldOverview, updateWorldOverview, stats, locations, connections, entities, traits, traitGroups, dictionaries,
    placeholders,
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
    () => composePreviewValues(
      {
        paragraphLimit, maxTokens, markdownOutput, sectionStyle: activeSectionStyle,
        limitActiveCharacters, activeCharacterLimit, language,
      },
      authoredPreviewValues({
        worldOverview, stats, locations, connections, entities, traits, traitGroups, dictionaries, placeholders,
      }),
    ),
    [
      paragraphLimit, maxTokens, markdownOutput, activeSectionStyle, limitActiveCharacters, activeCharacterLimit,
      language,
      worldOverview, stats, locations, connections, entities, traits, traitGroups, dictionaries, placeholders,
    ],
  );
  const { advanced } = useEditorMode();
  // Nothing open by default, and picking the open one again closes it: four large fields is more of the
  // panel than an author who isn't writing prompts should have to scroll past.
  const [tab, setTab] = useState<PanelKind | null>(null);
  const [resetKind, setResetKind] = useState<WorldPromptKind | null>(null);

  // The prompt each tab tracks: what the game would send right now, preset pins and all — not the shipped
  // default, which an author with an edited preset would not recognize as theirs.
  const presetPrompts: Record<WorldPromptKind, string> = {
    narration: presetNarrationPrompt,
    choices: presetChoicesPrompt,
    statUpdates: presetStatUpdatesPrompt,
  };

  // Only the find bar can reach a panel that isn't showing, and it arrives as a fresh object per navigation.
  useEffect(() => {
    if (isOpeningFieldKey(focusField?.fieldKey)) { setTab('opening'); return; }
    const hit = WORLD_PROMPT_KINDS.find((kind) => focusField?.fieldKey === worldPromptFieldKey(kind));
    if (hit) setTab(hit);
  }, [focusField]);

  if (!advanced) return null;

  // Nothing to switch until an opening exists: the box derives off, so a click would write a flag that
  // reads off again. The world plays the default opening either way.
  const noOpenings = !openingsEnabled(worldOverview, entities) && worldOverview.openingsEnabled !== false;

  const write = (kind: WorldPromptKind, update: { text?: string; enabled?: boolean }) =>
    updateWorldOverview({ promptOverrides: setWorldPromptOverride(worldOverview.promptOverrides, kind, update) });

  // Switching off keeps the text and only clears the flag, so a stray click costs nothing — the editor
  // writes straight through to world state, where the only undo is discarding every unsaved edit at once.
  // Switching on opens the kind, since the author is about to want it; switching off leaves the panel as
  // it stands rather than yanking a field open around the click.
  const toggle = (kind: PanelKind, on: boolean) => {
    if (on) setTab(kind);
    if (kind === 'opening') updateWorldOverview(setOpeningsEnabled(on));
    else write(kind, { enabled: on });
  };

  const reset = () => {
    if (resetKind) {
      updateWorldOverview({ promptOverrides: clearWorldPromptOverride(worldOverview.promptOverrides, resetKind) });
    }
    setResetKind(null);
  };

  return (
    // A query container, so the picker below folds on the width it actually gets: this panel is a
    // drag-resizable pane on desktop, where a viewport breakpoint would say "wide" for a column the
    // author has just dragged narrow.
    <div className="space-y-2 [container-type:inline-size]">
      <Label className="block leading-none">Custom Prompts</Label>
      {/* A segmented control rather than tabs: picking the open kind again clears the selection, which
          Tabs cannot express. The checkbox sits beside its item rather than inside it — a button inside
          a button is invalid — so the wrapper carries the selected chrome for the pair. Its own row, and
          a grid rather than wrapping flex: four checkbox-and-label pairs do not fit a narrow column, and
          letting them wrap freely strands the fourth alone on a full-width second row. */}
      <ToggleGroup
        type="single"
        value={tab ?? ''}
        onValueChange={(v) => setTab((v || null) as PanelKind | null)}
        // Four across only once the row clears the column with room to spare; two-up below that. Sized to
        // its own labels rather than the column, so it stays a control instead of stretching into a banner.
        className="inline-grid h-auto grid-cols-2 [@container(min-width:32rem)]:grid-cols-4"
      >
        {PANEL_KINDS.map((kind, i) => (
          <div key={kind} className="inline-flex items-center">
            {/* The app's pipe (see PromptField's toolbar), pairing each checkbox with the label after it
                rather than the one before. Only between neighbors on a row, never opening one: the second
                of each pair always, the third only once the same query above puts all four on one row.
                On this muted chrome the usual bg-border is invisible, hence the stronger fill. */}
            <span
              aria-hidden
              className={cn('mx-0.5 h-4 w-hairline shrink-0 bg-muted-foreground/40',
                i % 2 === 0 && 'hidden',
                i === 2 && '[@container(min-width:32rem)]:inline-block')}
            />
            <div
              className={cn('inline-flex flex-1 items-center gap-2 rounded-sm pl-2 transition-all',
                tab === kind && 'bg-background shadow-sm')}
            >
              <Checkbox
                className="shrink-0"
                checked={kind === 'opening' ? openingsEnabled(worldOverview, entities) : worldPromptEnabled(worldOverview, kind)}
                disabled={kind === 'opening' && noOpenings}
                onCheckedChange={(c) => toggle(kind, c === true)}
                aria-label={kind === 'opening'
                  ? "Use this world's openings"
                  : `Use this world's ${PANEL_LABELS[kind].toLowerCase()} prompt`}
              />
              <ToggleGroupItem
                value={kind}
                className="flex-1 px-2 data-[state=on]:bg-transparent data-[state=on]:shadow-none"
              >
                {PANEL_LABELS[kind]}
              </ToggleGroupItem>
            </div>
          </div>
        ))}
      </ToggleGroup>

      {tab === 'opening' && <OpeningsPanel onOpenEntity={onOpenEntity} />}

      {tab !== null && tab !== 'opening' && (() => {
        const kind = tab;
        const label = WORLD_PROMPT_KIND_LABELS[kind].toLowerCase();
        const stored = storedWorldPrompt(worldOverview, kind);
        const enabled = worldPromptEnabled(worldOverview, kind);
        return (
          <div className="space-y-2">
            <PlaceholderField
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
                  ? { ...previewValues, ...languagePreviewValue('choices', language) }
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
                    : `Not applied until you switch this one on. Players use their own ${label} prompt.`}
                  {stored === undefined && ` Shows your current ${label} prompt and follows it until you edit it here.`}
                </>
              )}
              onReset={stored === undefined ? undefined : () => setResetKind(kind)}
            />
          </div>
        );
      })()}

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

/**
 * The world's two readmes, one tab each. The player never sees them together: the Introduction opens over
 * the first enter-world setup screen and the Gameplay one on entering the game, so writing for a player
 * who has already built their character stays out of the pre-trait window.
 *
 * `focusField` is the search target the find bar just navigated to, which is the only way it can reach
 * whichever readme isn't currently showing. It arrives as a fresh object per navigation so that stepping
 * onto a second hit in the same readme re-opens that tab after the author has flipped away from it.
 */
const ReadmeSection = ({ focusField }: { focusField?: FocusFieldHint | null }) => {
  const { worldOverview, updateWorldOverview, placeholders } = useGameData();
  // Opens on the Introduction, except for a world that only has the older Gameplay readme — an author
  // whose readme is on the other tab would otherwise be met by an empty field where their text used to be.
  const [tab, setTab] = useState(() =>
    !worldOverview.introReadme?.trim() && worldOverview.readme?.trim() ? 'gameplay' : 'introduction');

  useEffect(() => {
    if (focusField?.fieldKey === 'introReadme') setTab('introduction');
    else if (focusField?.fieldKey === 'readme') setTab('gameplay');
  }, [focusField]);

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
          value={worldOverview.introReadme ?? ''}
          onChange={(introReadme) => updateWorldOverview({ introReadme })}
          placeholders={placeholders}
          markdown
          ariaLabel="Readme (Introduction)"
          resizable
        />
      </TabsContent>
      <TabsContent value="gameplay" className="space-y-2">
        <Hint>Shown when the player enters the world</Hint>
        <PlaceholderField
          value={worldOverview.readme ?? ''}
          onChange={(readme) => updateWorldOverview({ readme })}
          placeholders={placeholders}
          markdown
          ariaLabel="Readme (Gameplay)"
          resizable
        />
      </TabsContent>
    </Tabs>
  );
};

/** The ⓘ behind each Overview description: who reads it, and who never does. */
export const PLAYER_DESCRIPTION_INFO = 'Shows on your world\'s library card and community listing. The AI never reads it.';
export const AI_DESCRIPTION_INFO = "Goes to the AI on every turn as your world's description. Players never see it.";

/** The AI-facing world content fields (description, system prompt, readmes), shown in the editor's right
 *  column on the Overview tab. Identity/listing fields live in WorldOverviewManager (left column). */
const WorldDetailsManager = ({ focusField, onOpenEntity }: {
  focusField?: FocusFieldHint | null;
  /** Opens an entity's Openings tab, from the openings panel's group header. */
  onOpenEntity?: (entityId: string) => void;
}) => {
  const { worldOverview, updateWorldOverview, placeholders } = useGameData();
  // The description shows in the library, before a playthrough exists — so placeholders can never be rolled
  // for it. No chip family here: any `{{ph…}}` an old world carries stays inert text, exactly as it'd read.
  const plainVocab = useMemo(() => plainVocabulary(), []);

  return (
    // Player-facing text first, then the AI-facing prompts, so the Advanced-only section is last and a
    // Simple-mode column ends on the AI-Facing Description.
    <div className="space-y-4">
      <PromptField
        label="Player-Facing Description"
        info={<HintInfo>{PLAYER_DESCRIPTION_INFO}</HintInfo>}
        value={worldOverview.description}
        onChange={(description) => updateWorldOverview({ description })}
        vocabulary={plainVocab}
        markdown
        resizable
      />

      <ReadmeSection focusField={focusField} />

      <PlaceholderField
        label="AI-Facing Description"
        info={<HintInfo>{AI_DESCRIPTION_INFO}</HintInfo>}
        value={worldOverview.systemPrompt || ''}
        onChange={(systemPrompt) => updateWorldOverview({ systemPrompt })}
        placeholders={placeholders}
        resizable
        tourAnchor="world-ai-description"
      />

      <CustomPromptsSection focusField={focusField} onOpenEntity={onOpenEntity} />
    </div>
  );
};

export default WorldDetailsManager;
