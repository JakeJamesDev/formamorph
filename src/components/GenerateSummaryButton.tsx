import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Sparkles, Loader2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { summarizeDescription } from '@/lib/summarize';

/**
 * Right-aligned control that summarizes an AI-Facing Description into the AI-Facing Summary via the
 * connected LLM. `source` is the description to summarize; `current` is the present summary (so undo
 * can restore what a generation overwrote).
 */
const GenerateSummaryButton = ({ source, current, onGenerated }: {
  source: string | undefined;
  current: string | undefined;
  onGenerated: (summary: string) => void;
}) => {
  const { activeEndpointUrl, activeApiToken, activeModelName } = useSettings();
  const [loading, setLoading] = useState(false);
  const [prevValue, setPrevValue] = useState<string | null>(null);
  const [generatedValue, setGeneratedValue] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request if the editor switches items (the managers remount per id).
  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = async () => {
    const text = source?.trim();
    if (!text || loading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const summary = await summarizeDescription(text, {
        endpointUrl: activeEndpointUrl,
        apiToken: activeApiToken,
        modelName: activeModelName,
        signal: controller.signal,
      });
      setPrevValue(current ?? '');
      setGeneratedValue(summary);
      onGenerated(summary);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      toast.dark('Failed to generate summary.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const undo = () => {
    onGenerated(prevValue ?? '');
    setPrevValue(null);
    setGeneratedValue(null);
  };

  // Offer undo only while the generated text is still in the field (manual edits auto-hide it).
  const canUndo = prevValue !== null && current === generatedValue;

  return (
    <div className="flex items-center gap-1">
      {canUndo && (
        <Button variant="ghost" size="icon" onClick={undo} title="Undo generated summary">
          <Undo2 className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={generate}
        disabled={loading || !source?.trim()}
        title={loading ? 'Generating summary…' : 'Generate summary from the AI-Facing Description'}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default GenerateSummaryButton;
