import type { NarrationListener } from './aiRequest/narrationStream';

/** The paced fade reveal (useSentenceReveal): takes complete-sentence prefixes with their sentence count. */
export interface PacedReveal {
  push: (prefix: string, sentences: number) => void;
  finish: (text: string) => void;
  reset: () => void;
}

/** The smooth crawl (useSmoothedReveal): trails whatever target it gets. */
export interface CrawlReveal {
  push: (target: string) => void;
  finish: (text: string) => void;
  reset: () => void;
}

export interface NarrationRevealOptions {
  fade: PacedReveal;
  crawl: CrawlReveal;
  /** The fade reveal drives this turn; otherwise the crawl does. */
  paced: boolean;
  /** The crawl trails complete sentences only, as a During AI Output script needs (Q21). */
  wholeSentences: boolean;
  /** The reply opened and replaces the last turn's narration on screen. */
  onOpened: () => void;
}

/**
 * The reveal's Narration Stream listener. Opening clears the last turn's narration, so a dead endpoint, which
 * fails before opening, leaves the previous narration on screen.
 */
export function narrationRevealListener({ fade, crawl, paced, wholeSentences, onOpened }: NarrationRevealOptions): NarrationListener {
  return (event) => {
    switch (event.type) {
      case 'opened':
        fade.reset(); crawl.reset();
        onOpened();
        return;
      case 'display':
        if (paced) fade.push(event.revealed, event.sentences);
        else crawl.push(wholeSentences ? event.revealed : event.text);
        return;
      case 'finished':
        if (paced) fade.finish(event.text);
        else crawl.finish(event.text);
        return;
      case 'retract':
      case 'canceled':
        fade.reset(); crawl.reset();
        return;
      default:
        return;
    }
  };
}
