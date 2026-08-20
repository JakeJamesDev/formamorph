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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  clearWorldPromptOverride, setWorldPromptOverride, storedWorldPrompt, worldPromptEnabled, worldPromptFieldKey,
  WORLD_PROMPT_KINDS, WORLD_PROMPT_KIND_LABELS, type WorldPromptKind,
} from "@/lib/worldPrompt";
import {
  clearOpeningCue, openingCueEnabled, OPENING_CUE_FIELD_KEY, setOpeningCue, storedOpeningCue,
} from "@/lib/openingCue";
import { OPENING_SCENE_CUE } from "@/components/game/GamePrompts";
import { useEditorMode } from "@/lib/editorMode";

/** Which preset field each kind replaces, and which chip palette that prompt is written against. */
const PROMPT_KIND_VARIABLE_KEY = {
  narration: 'narration', choices: 'choices', statUpdates: 'statupdates',
} as const;

/**
 * The opening cue shares the section's picker without being a {@link WorldPromptKind}: it is the player's
 * first message rather than a system prompt, and it lives on its own overview field instead of in
 * `promptOverrides`. So the panel keys widen by one where the override type does not.
 */
type PanelKind = WorldPromptKind | 'opening';

/** The three system prompts first, then the outlier — the cue is a different kind of text. */
const PANEL_KINDS: PanelKind[] = [...WORLD_PROMPT_KINDS, 'opening'];

const PANEL_LABELS: Record<PanelKind, string> = { ...WORLD_PROMPT_KIND_LABELS, opening: 'Opening' };

/** The note-and-Reset row under whichever panel is open. Reset appears only for text the author stored. */
const PanelFooter = ({ note, onReset }: { note: ReactNode; onReset?: () => void }) => (
  <div className="flex items-start justify-between gap-2">
    <p className="text-meta text-muted-foreground">{note}</p>
    {onReset && (
      <Button variant="ghost" size="sm" className="shrink-0" onClick={onReset}>
        Reset
      </Button>
    )}
  </div>
);

/**
 * The text this world supplies in place of the player's own, one panel each with its enable checkbox in the
 * picker's chrome: the narration, choices, and stat-update system prompts, plus the opening cue the input
 * box is pre-filled with at Start Game. A panel opens on what the game would run right now — the active
 * preset's prompt, or the shipped cue — as an unstored template, so an author edits something that works;
 * the first edit is what stores it on the world, and Reset drops it back to tracking the template. Only
 * these three system prompts are replaceable; every other AI pass keeps running on the player's own preset.
 *
 * The cue needs no player-facing opt-out where the prompts do: the pre-filled box is editable, so the
 * player already has the last word on what the opening turn says.
 */
const CustomPromptsSection = ({ focusField }: { focusField?: { fieldKey: string } | null }) => {
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
  const [resetKind, setResetKind] = useState<PanelKind | null>(null);

  // The prompt each tab tracks: what the game would send right now, preset pins and all — not the shipped
  // default, which an author with an edited preset would not recognize as theirs.
  const presetPrompts: Record<WorldPromptKind, string> = {
    narration: presetNarrationPrompt,
    choices: presetChoicesPrompt,
    statUpdates: presetStatUpdatesPrompt,
  };

  // Only the find bar can reach a panel that isn't showing, and it arrives as a fresh object per navigation.
  useEffect(() => {
    if (focusField?.fieldKey === OPENING_CUE_FIELD_KEY) { setTab('opening'); return; }
    const hit = WORLD_PROMPT_KINDS.find((kind) => focusField?.fieldKey === worldPromptFieldKey(kind));
    if (hit) setTab(hit);
  }, [focusField]);

  if (!advanced) return null;

  const storedCue = storedOpeningCue(worldOverview);
  const cueEnabled = openingCueEnabled(worldOverview);

  const write = (kind: WorldPromptKind, update: { text?: string; enabled?: boolean }) =>
    updateWorldOverview({ promptOverrides: setWorldPromptOverride(worldOverview.promptOverrides, kind, update) });

  // Switching off keeps the text and only clears the flag, so a stray click costs nothing — the editor
  // writes straight through to world state, where the only undo is discarding every unsaved edit at once.
  // Switching on opens the kind, since the author is about to want it; switching off leaves the panel as
  // it stands rather than yanking a field open around the click.
  const toggle = (kind: PanelKind, on: boolean) => {
    if (on) setTab(kind);
    if (kind === 'opening') updateWorldOverview(setOpeningCue({ enabled: on }));
    else write(kind, { enabled: on });
  };

  const reset = () => {
    if (resetKind === 'opening') updateWorldOverview(clearOpeningCue());
    else if (resetKind) {
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
                checked={kind === 'opening' ? cueEnabled : worldPromptEnabled(worldOverview, kind)}
                onCheckedChange={(c) => toggle(kind, c === true)}
                aria-label={kind === 'opening'
                  ? "Use this world's opening cue"
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

      {tab === 'opening' && (
        <div className="space-y-2">
          <PlaceholderField
            value={storedCue ?? OPENING_SCENE_CUE}
            // Storing on the first divergence is what keeps an untouched world tracking the shipped cue: a
            // world only carries a cue its author actually wrote.
            onChange={(text) => {
              if (storedCue === undefined && text === OPENING_SCENE_CUE) return;
              updateWorldOverview(setOpeningCue({ text, enabled: cueEnabled }));
            }}
            placeholders={placeholders}
            ariaLabel="World opening cue"
            resizable
          />
          <PanelFooter
            note={(
              <>
                {cueEnabled
                  ? 'Pre-fills the player’s input box when they start this world. They can still edit it before they send it.'
                  : 'Not applied until you switch this one on — players start on the standard cue.'}
                {storedCue === undefined && ' This is the standard cue, and follows it until you edit it here.'}
              </>
            )}
            onReset={storedCue === undefined ? undefined : () => setResetKind('opening')}
          />
        </div>
      )}

      {tab !== null && tab !== 'opening' && (() => {
        const kind = tab;
        const label = WORLD_PROMPT_KIND_LABELS[kind].toLowerCase();
        const stored = storedWorldPrompt(worldOverview, kind);
        const enabled = worldPromptEnabled(worldOverview, kind);
        return (
          <div className="space-y-2">
            <PromptField
              value={stored ?? presetPrompts[kind]}
              // Storing on the first divergence is what keeps an untouched kind tracking the preset: a
              // world only carries a prompt its author actually wrote.
              onChange={(text) => {
                if (stored === undefined && text === presetPrompts[kind]) return;
                write(kind, { text, enabled });
              }}
              variables={PROMPT_KIND_VARIABLES[PROMPT_KIND_VARIABLE_KEY[kind]]}
              // The choices prompt's language chip names itself in the directive, so its preview says
              // "choices" where the pool's default says "narration".
              previewValues={kind === 'choices'
                ? { ...previewValues, ...languagePreviewValue('choices', language) }
                : previewValues}
              sampleData="Your world, sample turn"
              ariaLabel={`World ${label} prompt`}
              resizable
            />
            <PanelFooter
              note={(
                <>
                  {enabled
                    ? `Replaces the player's ${label} prompt while they play this world. They can decline it from the world's details window.`
                    : `Not applied until you switch this one on — players use their own ${label} prompt.`}
                  {stored === undefined && ` This is your current ${label} prompt, and follows it until you edit it here.`}
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
        title={resetKind === 'opening'
          ? "Discard this world's opening cue?"
          : `Discard this world's ${WORLD_PROMPT_KIND_LABELS[resetKind ?? 'narration'].toLowerCase()} prompt?`}
        description={resetKind === 'opening'
          ? 'It goes back to following the standard cue. The text you wrote here is not kept.'
          : 'It goes back to following your own prompt. The text you wrote here is not kept.'}
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
const ReadmeSection = ({ focusField }: { focusField?: { fieldKey: string } | null }) => {
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
      {/* Both are shown once a playthrough's rolls exist, so placeholders resolve in either. */}
      <TabsContent value="introduction">
        <PlaceholderField
          value={worldOverview.introReadme ?? ''}
          onChange={(introReadme) => updateWorldOverview({ introReadme })}
          placeholders={placeholders}
          markdown
          placeholder="Shown to the player before they make any setup choices. Supports markdown."
          resizable
        />
      </TabsContent>
      <TabsContent value="gameplay">
        <PlaceholderField
          value={worldOverview.readme ?? ''}
          onChange={(readme) => updateWorldOverview({ readme })}
          placeholders={placeholders}
          markdown
          placeholder="Shown to the player when they enter the world. Supports markdown."
          resizable
        />
      </TabsContent>
    </Tabs>
  );
};

/** The AI-facing world content fields (description, system prompt, readmes), shown in the editor's right
 *  column on the Overview tab. Identity/listing fields live in WorldOverviewManager (left column). */
const WorldDetailsManager = ({ focusField }: { focusField?: { fieldKey: string } | null }) => {
  const { worldOverview, updateWorldOverview, placeholders } = useGameData();
  // The description shows in the library, before a playthrough exists — so placeholders can never be rolled
  // for it. No chip family here: any `{{ph…}}` an old world carries stays inert text, exactly as it'd read.
  const plainVocab = useMemo(() => plainVocabulary(), []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PromptField
          label="World Description"
          value={worldOverview.description}
          onChange={(description) => updateWorldOverview({ description })}
          vocabulary={plainVocab}
          markdown
          placeholder="Enter world description..."
          resizable
        />
      </div>

      <div className="space-y-2">
        <PlaceholderField
          label="System Prompt Addition"
          value={worldOverview.systemPrompt || ''}
          onChange={(systemPrompt) => updateWorldOverview({ systemPrompt })}
          placeholders={placeholders}
          resizable
        />
      </div>

      <CustomPromptsSection focusField={focusField} />

      <ReadmeSection focusField={focusField} />
    </div>
  );
};

export default WorldDetailsManager;
