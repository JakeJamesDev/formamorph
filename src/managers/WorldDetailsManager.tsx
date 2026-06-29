import { useGameData } from '@/contexts/GameDataContext';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import MarkdownField from "@/components/MarkdownField";
import { useCatalogTags } from "@/lib/useCatalogTags";

/** The AI-facing world content fields (description, tags, system prompt), shown in the editor's right
 *  column on the Overview tab. Identity/media fields live in WorldOverviewManager (left column). */
const WorldDetailsManager = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const { tags: tagOptions, refresh: refreshTags, refreshing } = useCatalogTags();

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
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <TokenAutocomplete
              values={worldOverview.tags || []}
              onChange={(tags) => updateWorldOverview({ tags })}
              options={tagOptions}
              openOnFocus
              reorderable
              placeholder="Add tags..."
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={refreshTags}
            disabled={refreshing}
            title="Refresh tag suggestions"
            aria-label="Refresh tag suggestions"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
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
    </div>
  );
};

export default WorldDetailsManager;
