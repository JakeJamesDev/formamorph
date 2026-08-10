import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Sparkles, Loader2 } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { summarizeDescription } from '@/lib/summarize';
import { bridgeDescription, type BridgeKind } from '@/lib/bridgeDescription';
import { buildImagePrompt, type ImageSubjectKind } from '@/lib/imagePrompt';
import { TOOLBAR_BTN } from '@/components/prompt/toolbarStyles';

type GenerateMode = 'summary' | 'tags' | 'playerDesc' | 'aiDesc';

const NOUN: Record<GenerateMode, string> = {
  summary: 'summary',
  tags: 'image tags',
  playerDesc: 'player-facing description',
  aiDesc: 'AI-facing description',
};

const SOURCE_NOUN: Record<GenerateMode, string> = {
  summary: 'the description',
  tags: 'the description',
  playerDesc: 'the AI-facing description',
  aiDesc: 'the player-facing description',
};

/**
 * Fills a text field from the connected LLM. `mode` picks the generator — 'summary' condenses the
 * AI-Facing Description, 'tags' writes booru image tags from a description, and 'playerDesc'/'aiDesc'
 * rewrite one description into the other. `source` is the text fed in; the result goes out through
 * `onChange`, so undo belongs to whatever field owns the value.
 */
const AiGenerateButton = ({ mode, source, onChange, kind }: {
  mode: GenerateMode;
  source: string | undefined;
  onChange: (v: string) => void;
  kind?: ImageSubjectKind; // tags/playerDesc/aiDesc: subject kind
}) => {
  const { activeEndpointUrl, activeApiToken, activeModelName, imageTagPrompt } = useSettings();
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request if the editor switches items (managers remount per id).
  useEffect(() => () => abortRef.current?.abort(), []);

  const noun = NOUN[mode];

  const generate = async () => {
    const text = source?.trim();
    if (!text || loading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const opts = { endpointUrl: activeEndpointUrl, apiToken: activeApiToken, modelName: activeModelName, signal: controller.signal };
      const bridgeKind: BridgeKind = kind === 'location' ? 'location' : 'character';
      const result = mode === 'tags'
        // The subject's name is deliberately not sent: models answer with it as a tag, and no image model
        // knows a person's name. An author who wants one in the tags can type it.
        ? await buildImagePrompt({ description: text, kind: kind ?? 'character' }, { ...opts, tagPrompt: imageTagPrompt })
        : mode === 'summary'
          ? await summarizeDescription(text, opts)
          : await bridgeDescription(text, mode, bridgeKind, opts);
      onChange(result);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      toast.error(`Failed to generate ${noun}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={TOOLBAR_BTN}
      onClick={generate}
      disabled={loading || !source?.trim()}
      title={loading ? `Generating ${noun}…` : `Generate ${noun} from ${SOURCE_NOUN[mode]}`}
      aria-label={`Generate ${noun}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
    </button>
  );
};

export default AiGenerateButton;
