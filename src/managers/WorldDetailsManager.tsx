import { useGameData } from '@/contexts/GameDataContext';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import MarkdownField from "@/components/MarkdownField";
import { useDanbooruTags } from "@/lib/useDanbooruTags";

/** The AI-facing world content fields (description, tags, system prompt), shown in the editor's right
 *  column on the Overview tab. Identity/media fields live in WorldOverviewManager (left column). */
const WorldDetailsManager = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const tagOptions = useDanbooruTags();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>World Description</Label>
        <MarkdownField
          value={worldOverview.description}
          onChange={(description) => updateWorldOverview({ description })}
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
        <Textarea
          id="systemPrompt"
          value={worldOverview.systemPrompt}
          onChange={(e) => updateWorldOverview({ systemPrompt: e.target.value })}
          placeholder="Enter an overview of your world that the AI should know, and rules it should follow..."
          className="min-h-[150px]"
        />
      </div>

      <div className="space-y-2">
        <Label>Readme</Label>
        <MarkdownField
          value={worldOverview.readme ?? ''}
          onChange={(readme) => updateWorldOverview({ readme })}
          placeholder="Shown to the player when they enter the world. Supports markdown."
        />
      </div>
    </div>
  );
};

export default WorldDetailsManager;
