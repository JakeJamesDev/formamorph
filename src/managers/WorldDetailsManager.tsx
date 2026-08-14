import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import PromptField from "@/components/prompt/PromptField";
import PlaceholderField from "@/components/prompt/PlaceholderField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { PROMPT_KIND_VARIABLES } from "@/lib/promptVariables";
import { authoredPreviewValues } from "@/lib/authoredPreviewValues";
import { composePreviewValues } from "@/lib/previewValuePool";
import { storedNarrationPrompt } from "@/lib/worldPrompt";
import { defaultSystemPrompt } from "@/components/game/GamePrompts";
import { useEditorMode } from "@/lib/editorMode";

/**
 * Optional per-world replacement for the player's narration system prompt. Off by default: turning it on
 * seeds the shipped default so an author edits a working prompt rather than facing a blank field, and
 * turning it off drops the override entirely. Only narration is replaceable — every other AI pass keeps
 * running on the player's own preset.
 */
const NarrationPromptField = () => {
  const {
    worldOverview, updateWorldOverview, stats, locations, connections, entities, traits, traitGroups, dictionaries,
    placeholders,
  } = useGameData();
  const {
    paragraphLimit, maxTokens, markdownOutput, activeSectionStyle, limitActiveCharacters, activeCharacterLimit,
  } = useSettings();
  // The world being edited, previewed as its own opening scene — the author reads their entities and their
  // location, not a stand-in's. Tokens only a turn can fill (the action, the narration, who is speaking)
  // fall through to the shared samples, exactly as they do for a live game between turns.
  const previewValues = useMemo(
    () => composePreviewValues(
      {
        paragraphLimit, maxTokens, markdownOutput, sectionStyle: activeSectionStyle,
        limitActiveCharacters, activeCharacterLimit,
      },
      authoredPreviewValues({
        worldOverview, stats, locations, connections, entities, traits, traitGroups, dictionaries, placeholders,
      }),
    ),
    [
      paragraphLimit, maxTokens, markdownOutput, activeSectionStyle, limitActiveCharacters, activeCharacterLimit,
      worldOverview, stats, locations, connections, entities, traits, traitGroups, dictionaries, placeholders,
    ],
  );
  const stored = storedNarrationPrompt(worldOverview);
  const { advanced } = useEditorMode();
  const enabled = typeof stored === 'string' && worldOverview.promptOverrides?.systemPromptEnabled !== false;
  const value = stored ?? '';

  // Switching off keeps the text and only clears the flag, so a stray click costs nothing — the editor
  // writes straight through to world state, where the only undo is discarding every unsaved edit at once.
  const toggle = (on: boolean) =>
    updateWorldOverview({
      promptOverrides: {
        ...worldOverview.promptOverrides,
        systemPrompt: stored ?? defaultSystemPrompt,
        systemPromptEnabled: on,
      },
    });

  if (!advanced) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox id="worldNarrationPrompt" checked={enabled} onCheckedChange={(c) => toggle(c === true)} />
        <Label htmlFor="worldNarrationPrompt" className="cursor-pointer">Custom Narration Prompt</Label>
      </div>
      {enabled ? (
        <>
          <PromptField
            value={value}
            onChange={(systemPrompt) => updateWorldOverview({ promptOverrides: { ...worldOverview.promptOverrides, systemPrompt } })}
            variables={PROMPT_KIND_VARIABLES.narration}
            previewValues={previewValues}
            sampleData="Your world, sample turn"
            ariaLabel="World narration prompt"
            resizable
          />
          <p className="text-meta text-muted-foreground">
            Replaces the player&apos;s narration prompt while they play this world. They can decline it from the
            world&apos;s details window. Choices, planning, stats, and memory always use the player&apos;s own prompts.
          </p>
        </>
      ) : (
        <p className="text-meta text-muted-foreground">
          This world uses whichever narration prompt the player has set. Turn this on to write your own.
          {stored !== undefined && ' Your prompt is kept and comes back when you switch this on again.'}
        </p>
      )}
    </div>
  );
};

/** The AI-facing world content fields (description, system prompt, readme), shown in the editor's right
 *  column on the Overview tab. Identity/listing fields live in WorldOverviewManager (left column). */
const WorldDetailsManager = () => {
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

      <NarrationPromptField />

      <div className="space-y-2">
        {/* Shown on entry, so a playthrough's rolls exist by then — placeholders resolve here. */}
        <PlaceholderField
          label="Readme"
          value={worldOverview.readme ?? ''}
          onChange={(readme) => updateWorldOverview({ readme })}
          placeholders={placeholders}
          markdown
          placeholder="Shown to the player when they enter the world. Supports markdown."
          resizable
        />
      </div>
    </div>
  );
};

export default WorldDetailsManager;
