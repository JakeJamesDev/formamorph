import { useEffect, useReducer, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Sparkles, Loader2, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { summarizeDescription } from '@/lib/summarize';
import { buildImagePrompt, type ImageSubjectKind } from '@/lib/imagePrompt';
import {
  initHistory, commitHistory, undoHistory, redoHistory, canUndo, canRedo, type HistoryState,
} from '@/lib/textHistory';

// Group consecutive keystrokes within this window into a single undo step.
const COALESCE_MS = 500;

/**
 * Right-aligned toolbar that fills a text field from the connected LLM: undo | redo | generate.
 * `mode` picks the generator — 'summary' condenses the AI-Facing Description; 'tags' writes booru image
 * tags from a description. Undo/redo are always shown and walk a linear history of both generations and
 * manual edits (a manual edit forgets the redo branch); the field value stays parent-owned, so manual
 * typing reaches the history through the `value` prop. `source` is the description fed in.
 */
const AiFieldToolbar = ({ mode, source, value, onChange, kind }: {
  mode: 'summary' | 'tags';
  source: string | undefined;
  value: string | undefined;
  onChange: (v: string) => void;
  kind?: ImageSubjectKind; // tags: subject kind
}) => {
  const { activeEndpointUrl, activeApiToken, activeModelName, imageTagPrompt } = useSettings();
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const snap = (v: string) => ({ value: v, selectionStart: 0, selectionEnd: 0 }); // selection unused here
  const historyRef = useRef<HistoryState>(initHistory(snap(value ?? '')));
  const expectedValueRef = useRef(value ?? ''); // the value our own commits pushed; spots external edits
  const lastTypeRef = useRef(0);
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  // Cancel any in-flight request if the editor switches items (managers remount per id).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Fold manual edits (typed in the sibling textarea → parent onChange → new value prop) into history.
  useEffect(() => {
    const v = value ?? '';
    if (v === expectedValueRef.current) return; // our own change
    const now = Date.now();
    const coalesce = now - lastTypeRef.current < COALESCE_MS;
    lastTypeRef.current = now;
    historyRef.current = commitHistory(historyRef.current, snap(v), coalesce);
    expectedValueRef.current = v;
    forceUpdate();
  }, [value]);

  const noun = mode === 'tags' ? 'image tags' : 'summary';

  // Apply one of our own history moves: sync refs so the resulting value-prop change isn't re-committed,
  // and break coalescing so a manual edit right after starts a fresh undo step.
  const commit = (next: HistoryState) => {
    historyRef.current = next;
    expectedValueRef.current = next.present.value;
    lastTypeRef.current = 0;
    onChange(next.present.value);
    forceUpdate();
  };

  const generate = async () => {
    const text = source?.trim();
    if (!text || loading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const opts = { endpointUrl: activeEndpointUrl, apiToken: activeApiToken, modelName: activeModelName, signal: controller.signal };
      const result = mode === 'tags'
        // The subject's name is deliberately not sent: models answer with it as a tag, and no image model
        // knows a person's name. An author who wants one in the tags can type it.
        ? await buildImagePrompt({ description: text, kind: kind ?? 'character' }, { ...opts, tagPrompt: imageTagPrompt })
        : await summarizeDescription(text, opts);
      commit(commitHistory(historyRef.current, snap(result), false)); // a generation is a discrete step
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      toast.error(`Failed to generate ${noun}.`);
    } finally {
      setLoading(false);
    }
  };

  const doUndo = () => {
    const next = undoHistory(historyRef.current);
    if (next !== historyRef.current) commit(next);
  };
  const doRedo = () => {
    const next = redoHistory(historyRef.current);
    if (next !== historyRef.current) commit(next);
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={doUndo} disabled={!canUndo(historyRef.current)} title="Undo" aria-label="Undo">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={doRedo} disabled={!canRedo(historyRef.current)} title="Redo" aria-label="Redo">
        <Redo2 className="h-4 w-4" />
      </Button>
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
