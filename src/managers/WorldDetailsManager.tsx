import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Label } from "@/components/ui/label";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import PromptField from "@/components/prompt/PromptField";
import PlaceholderField from "@/components/prompt/PlaceholderField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { useDanbooruTags } from "@/lib/useDanbooruTags";

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
        />
      </div>

      <div className="space-y-2">
        <Label>Readme</Label>
        {/* Shown on entry, so a playthrough's rolls exist by then — placeholders resolve here. */}
        <PlaceholderField
          value={worldOverview.readme ?? ''}
          onChange={(readme) => updateWorldOverview({ readme })}
          placeholders={placeholders}
          markdown
          placeholder="Shown to the player when they enter the world. Supports markdown."
        />
      </div>
    </div>
  );
};

export default WorldDetailsManager;
