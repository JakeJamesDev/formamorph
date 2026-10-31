/**
 * The Help Request Plan: what the answer request of one help question carries. `askHelp` builds the body from
 * the plan alone, so a narrower plan sends a narrower request. Every field is final: the settings and the
 * endpoint's function calls were already checked.
 */
import type { DocSection } from '@/lib/docs/docsIndex';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import type { Tool } from '@/types';
import { isCodeTurn, isOnCodeTab } from './helpCodeRider';
import type { HelpSettings } from './helpSettings';
import { helpToolsOn } from './helpTools';
import type { SurfaceHint } from './surfaceHint';

export interface HelpRequestPlan {
  /** The guide block: the lead, the pinned sections, the search hits and the screen line. */
  readonly guide: boolean;
  /** The world block, with the world rules rider. */
  readonly world: boolean;
  /** The story so far, in the game. */
  readonly story: boolean;
  /** The code rider with the open script home's line, and the Quick Reference pin; `test` adds the code test. */
  readonly code: { readonly test: boolean } | null;
  /** The docs lookup, on the lookup prompt. */
  readonly lookup: boolean;
  /** The help dice roll. */
  readonly roll: boolean;
  /** The Mascot's face call. */
  readonly face: boolean;
  /** The player's Formaquestion Tools. */
  readonly tools: readonly Tool[];
  /** The riders after the world rules, in order. */
  readonly riders: readonly string[];
}

/**
 * The sections a turn sends before its search hits, and the screen its message names. A code turn sends the
 * Quick Reference: after the lead on the Code tab, and as the lead on any other screen, which then goes unnamed.
 */
export function turnLead(hint: SurfaceHint | null, quickReference: DocSection | null, onCodeTab: boolean): { lead?: DocSection; pinned: DocSection[]; where?: string } {
  if (!quickReference) return { lead: hint?.section, pinned: [], where: hint?.where };
  if (hint && onCodeTab) return { lead: hint.section, pinned: [quickReference], where: hint.where };
  return { lead: quickReference, pinned: [] };
}

/**
 * The full request: every block the settings, the open screen and the question's code words call for.
 * `surface` and `hint` are the open screen's while Open Screen is on.
 */
export function fullHelpPlan({ question, settings, surface, hint, quickReference, takesFunctions }: {
  question: string;
  settings: HelpSettings;
  surface: Surface | null | undefined;
  hint: SurfaceHint | null;
  quickReference: DocSection | null;
  /** The answer endpoint is known to take function calls. */
  takesFunctions: boolean;
}): HelpRequestPlan {
  const code = isCodeTurn(question, surface);
  const lookup = settings.lookup && takesFunctions;
  const { lead } = turnLead(hint, code ? quickReference : null, isOnCodeTab(surface));
  // With no lead, no lookup and no source, no part of the request can carry a section.
  const guide = lead !== undefined || lookup || Object.values(settings.sources).some(Boolean);
  const world = guide && settings.readWorld;
  return {
    guide,
    world,
    story: world,
    code: code ? { test: settings.codeTest && takesFunctions } : null,
    lookup,
    roll: settings.roll && takesFunctions,
    face: settings.mascot && takesFunctions,
    tools: takesFunctions ? helpToolsOn(settings.tools, settings.toolSwitches) : [],
    riders: [],
  };
}
