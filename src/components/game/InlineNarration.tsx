import { Fragment, type ReactNode } from 'react';
import { narrationParts } from '@/lib/inlineImages';
import type { ScriptImageTell } from '@/lib/scriptTells';
import { useMediaList } from '@/lib/useMediaList';
import { ScriptImage, shownEntry } from './ScriptImage';

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
  const list = useMediaList();
  const drawn = images.flatMap((image) => {
    const entry = shownEntry(list, image);
    return entry ? [{ image, entry }] : [];
  });
  const entries = new Map(drawn.map(({ image, entry }) => [image, entry]));
  let runs = 0;
  return (
    <>
      {narrationParts(text, drawn.map(({ image }) => image), shown).map((part) => {
        if (part.kind === 'text') {
          const index = runs++;
          return <Fragment key={`text:${index}`}>{renderText(part.text, index)}</Fragment>;
        }
        const entry = entries.get(part.image);
        // Keyed by call order, so an image that arrives later never remounts one already shown.
        return entry && <ScriptImage key={`image:${images.indexOf(part.image)}`} entry={entry} size={part.image.size} className="my-3" />;
      })}
    </>
  );
}
