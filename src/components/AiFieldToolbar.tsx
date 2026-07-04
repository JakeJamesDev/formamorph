import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Sparkles, Loader2, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { summarizeDescription } from '@/lib/summarize';
import { buildImagePrompt, type ImageSubjectKind } from '@/lib/imagePrompt';

/**
 * Right-aligned toolbar that fills a text field from the connected LLM: undo | redo | generate.
 * `mode` picks the generator — 'summary' condenses the AI-Facing Description; 'tags' writes booru image
 * tags from a description. Undo/redo revert/reapply the last generation (both hidden once the field is
 * manually edited). `source` is the description fed in; `value`/`onChange` are the target field.
 */
const AiFieldToolbar = ({ mode, source, value, onChange, name, kind }: {
  mode: 'summary' | 'tags';
  source: string | undefined;
  value: string | undefined;
  onChange: (v: string) => void;
  name?: string;           // tags: subject name
  kind?: ImageSubjectKind; // tags: subject kind
}) => {
  const { activeEndpointUrl, activeApiToken, activeModelName, imageTagPrompt } = useSettings();
  const [loading, setLoading] = useState(false);
  const [before, setBefore] = useState<string | null>(null); // field value prior to the last generation
  const [after, setAfter] = useState<string | null>(null);   // the last generated value
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request if the editor switches items (managers remount per id).
  useEffect(() => () => abortRef.current?.abort(), []);

  const noun = mode === 'tags' ? 'image tags' : 'summary';

  const generate = async () => {
    const text = source?.trim();
    if (!text || loading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const opts = { endpointUrl: activeEndpointUrl, apiToken: activeApiToken, modelName: activeModelName, signal: controller.signal };
      const result = mode === 'tags'
        ? await buildImagePrompt({ name: name ?? '', description: text, kind: kind ?? 'character' }, { ...opts, tagPrompt: imageTagPrompt })
        : await summarizeDescription(text, opts);
      setBefore(value ?? '');
      setAfter(result);
      onChange(result);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      toast.dark(`Failed to generate ${noun}.`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const undo = () => onChange(before ?? '');
  const redo = () => onChange(after ?? '');

  // Undo shows while the generated text is still in the field; redo shows once it's been reverted.
  const canUndo = after !== null && value === after;
  const canRedo = before !== null && after !== null && value === before;

  return (
    <div className="flex items-center gap-1">
      {canUndo && (
        <Button variant="ghost" size="icon" onClick={undo} title={`Undo generated ${noun}`}>
          <Undo2 className="h-4 w-4" />
        </Button>
      )}
      {canRedo && (
        <Button variant="ghost" size="icon" onClick={redo} title={`Redo generated ${noun}`}>
          <Redo2 className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={generate}
        disabled={loading || !source?.trim()}
        title={loading ? `Generating ${noun}…` : `Generate ${noun} from the description`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default AiFieldToolbar;
