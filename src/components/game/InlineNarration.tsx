import { Fragment, type ReactNode } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { narrationParts, shownSentences } from '@/lib/inlineImages';
import { revealAnimName } from '@/lib/narrationRevealConfig';
import type { ScriptImageTell } from '@/lib/scriptTells';
import { useMediaList } from '@/lib/useMediaList';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MentionTurn, type turnCardTriggers } from './MentionCards';
import { ScriptImage, shownTells } from './ScriptImage';

/**
 * A turn's narration with its During AI Output images between the sentences (Q5). `renderText` draws one run
 * of text; `index` counts the runs, so each run keeps its renderer as images cut the text. An image no longer
 * on the Media List cuts nothing.
 */
export function InlineNarration({ text, images, shown, renderText }: {
  text: string;
  images: readonly ScriptImageTell[];
  /** How many of the narration's sentences are on screen. */
  shown: number;
  renderText: (text: string, index: number) => ReactNode;
}) {
  const drawn = shownTells(images, useMediaList());
  const entries = new Map(drawn.map(({ tell, entry }) => [tell, entry]));
  let runs = 0;
  return (
    // flow-root holds a float inside the narration, so the last sentence's image never reaches the turn below.
    <div className="flow-root">
      {narrationParts(text, drawn.map(({ tell }) => tell), shown).map((part) => {
        if (part.kind === 'text') {
          const index = runs++;
          return <Fragment key={`text:${index}`}>{renderText(part.text, index)}</Fragment>;
        }
        const entry = entries.get(part.image);
        // Keyed by call order, so an image that arrives later never remounts one already shown.
        if (!entry) return null;
        return <ScriptImage key={`image:${images.indexOf(part.image)}`} entry={entry} size={part.image.size} wrap={part.image.wrap} className="my-3" />;
      })}
    </div>
  );
}

/** One turn's narration as Pages and Chat draw it: revealed runs of Markdown with the turn's inline images. */
export function TurnNarration({ turnId, text, images, live, revealOn, resumed = false, triggers }: {
  turnId: string | undefined;
  text: string;
  images: readonly ScriptImageTell[];
  live: boolean;
  revealOn: boolean;
  /** The first run has shown its words already. */
  resumed?: boolean;
  triggers: ReturnType<typeof turnCardTriggers>;
}) {
  const { revealSpec, revealEasing } = useSettings();
  return (
    <MentionTurn turnId={turnId}>
      <InlineNarration
        text={text}
        images={images}
        shown={shownSentences(text, live, revealOn)}
        renderText={(run, index) => (
          <MarkdownRenderer
            // Streamdown memoizes on source position, not text, so committed text keys by its content.
            key={live ? 'live' : `committed:${text}`}
            text={run}
            animate={live && revealOn}
            // A run cut from the live text has shown its words already.
            resume={index > 0 || resumed}
            fitShown
            animation={revealAnimName(revealSpec)}
            easing={revealEasing}
            dialogue
            {...triggers}
          />
        )}
      />
    </MentionTurn>
  );
}
