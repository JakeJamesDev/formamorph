import { useCallback, useRef } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import { GameText } from "@/components/game/GameText";
import { useCatalogTags } from "@/lib/useCatalogTags";

/** The AI-facing world content fields (description, tags, system prompt), shown in the editor's right
 *  column on the Overview tab. Identity/media fields live in WorldOverviewManager (left column). */
const WorldDetailsManager = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const { tags: tagOptions, refresh: refreshTags, refreshing } = useCatalogTags();

  // Share the description height across the Edit textarea and Preview box: resizing either pane records
  // the height, and the other pane adopts it when it mounts (only one is mounted at a time per tab).
  const descHeightRef = useRef<number>();
  const descObserverRef = useRef<ResizeObserver | null>(null);
  const attachDescResize = useCallback((node: HTMLElement | null) => {
    descObserverRef.current?.disconnect();
    if (!node) return;
    if (descHeightRef.current != null) node.style.height = `${descHeightRef.current}px`;
    const observer = new ResizeObserver(() => {
      descHeightRef.current = node.getBoundingClientRect().height;
    });
    observer.observe(node);
    descObserverRef.current = observer;
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>World Description</Label>
        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <Textarea
              ref={attachDescResize}
              value={worldOverview.description}
              onChange={(e) => updateWorldOverview({ description: e.target.value })}
              placeholder="Enter world description..."
              className="min-h-[100px] resize-y"
            />
          </TabsContent>
          <TabsContent value="preview">
            <div
              ref={attachDescResize}
              className="min-h-[100px] resize-y overflow-auto rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {worldOverview.description?.trim()
                ? <GameText text={worldOverview.description} />
                : <span className="text-muted-foreground">Nothing to preview.</span>}
            </div>
          </TabsContent>
        </Tabs>
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
