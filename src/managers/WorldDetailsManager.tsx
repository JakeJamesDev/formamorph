import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import PromptField from "@/components/prompt/PromptField";
import PlaceholderField from "@/components/prompt/PlaceholderField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { PROMPT_KIND_VARIABLES } from "@/lib/promptVariables";
import { storedNarrationPrompt } from "@/lib/worldPrompt";
import { defaultSystemPrompt } from "@/components/game/GamePrompts";
import { useDanbooruTags } from "@/lib/useDanbooruTags";

/**
 * Optional per-world replacement for the player's narration system prompt. Off by default: turning it on
 * seeds the shipped default so an author edits a working prompt rather than facing a blank field, and
 * turning it off drops the override entirely. Only narration is replaceable — every other AI pass keeps
 * running on the player's own preset.
 */
const NarrationPromptField = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const stored = storedNarrationPrompt(worldOverview);
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
            ariaLabel="World narration prompt"
            resizable
          />
          <p className="text-xs text-muted-foreground">
            Replaces the player&apos;s narration prompt while they play this world. They can decline it from the
            world&apos;s details window. Choices, planning, stats, and memory always use the player&apos;s own prompts.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          This world uses whichever narration prompt the player has set. Turn this on to write your own.
          {stored !== undefined && ' Your prompt is kept and comes back when you switch this on again.'}
        </p>
      )}
    </div>
  );
};

/** The AI-facing world content fields (description, tags, system prompt), shown in the editor's right
 *  column on the Overview tab. Identity/media fields live in WorldOverviewManager (left column). */
const WorldDetailsManager = () => {
  const { worldOverview, updateWorldOverview, placeholders } = useGameData();
  const tagOptions = useDanbooruTags();
  // The description shows in the library, before a playthrough exists — so placeholders can never be rolled
  // for it. No chip family here: any `{{ph…}}` an old world carries stays inert text, exactly as it'd read.
  const plainVocab = useMemo(() => plainVocabulary(), []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>World Description</Label>
        <PromptField
          value={worldOverview.description}
          onChange={(description) => updateWorldOverview({ description })}
          vocabulary={plainVocab}
          markdown
          placeholder="Enter world description..."
          resizable
        />
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <TokenAutocomplete
          values={worldOverview.tags || []}
          onChange={(tags) => updateWorldOverview({ tags })}
          options={tagOptions}
          preserveOrder
          reorderable
          editable
          placeholder="Add tags..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="systemPrompt">System Prompt Addition</Label>
        <PlaceholderField
          value={worldOverview.systemPrompt || ''}
          onChange={(systemPrompt) => updateWorldOverview({ systemPrompt })}
          placeholders={placeholders}
          resizable
        />
      </div>

      <NarrationPromptField />

      <div className="space-y-2">
        <Label>Readme</Label>
        {/* Shown on entry, so a playthrough's rolls exist by then — placeholders resolve here. */}
        <PlaceholderField
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
