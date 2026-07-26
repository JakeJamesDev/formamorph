import { randomUUID } from "@/lib/uuid";
import { createContext } from 'react';
import type { Placeholder } from '@/types';
import type { PromptSegment } from './promptTemplate';
import { parsePromptTemplate } from './promptTemplate';
import { HIGHLIGHT_PALETTE } from './highlightUtils';
import {
  labelForToken, colorForToken, variableForToken, baseToken, tokenVariant, splitToken, joinToken,
  variantLabelForToken, variableAxes, decodeVariant, encodeVariant,
  type PromptVariable, type PromptVariantAxis,
} from './promptVariables';
import {
  parsePlaceholderText, decodePlaceholderToken, encodePlaceholderToken,
} from './placeholders';

/**
 * A chip vocabulary abstracts everything the Lexical chip editor needs to know about its tokens, so one
 * editor serves two token families: the static prompt variables (`<…>`) and the dynamic per-world
 * placeholders (`{{ph…}}`). The editor reads a vocabulary from context; each family supplies one.
 */
export interface ChipVocabulary {
  /** Split text into literal + token segments (the family's token grammar). */
  parse(text: string): PromptSegment[];
  /** True if the token is a well-formed member of this family (renders as a chip). */
  isKnown(token: string): boolean;
  /** Friendly chip label. */
  label(token: string): string;
  /** The active non-default mode label shown in parens on the chip, or null. */
  variantLabel(token: string): string | null;
  /** Accent color, or undefined. */
  color(token: string): string | undefined;
  /** The pop-out axes for this token (empty = no options). */
  axes(token: string): PromptVariantAxis[];
  /** Current per-axis selection for the token. */
  selection(token: string): Record<string, string | null>;
  /** The token with one axis changed. */
  setAxis(token: string, axisId: string, optionId: string | null): string;
  /** The placement's prefix/suffix, or null when this chip doesn't take them (it renders a block, not a
   *  phrase). See docs-internal/chip-affixes-design.md. */
  affixes(token: string): { pre: string; post: string } | null;
  /** The token with its affixes replaced. Empty strings remove them. */
  setAffixes(token: string, pre: string, post: string): string;
  /** Toolbar items to insert. */
  palette(): { token: string; label: string; color?: string }[];
  /** Prepare a palette token for a fresh insertion (placeholders re-mint their placement id). */
  freshInsertToken(token: string): string;
}

/** Vocabulary backed by the static prompt-variable registry. `palette` is the subset a given prompt offers. */
export function promptVocabulary(palette: PromptVariable[]): ChipVocabulary {
  return {
    parse: parsePromptTemplate,
    isKnown: (t) => variableForToken(t) != null,
    label: labelForToken,
    variantLabel: variantLabelForToken,
    color: colorForToken,
    axes: (t) => {
      const v = variableForToken(t);
      return v ? variableAxes(v) : [];
    },
    selection: (t) => {
      const v = variableForToken(t);
      return v ? decodeVariant(v, tokenVariant(t)) : {};
    },
    setAxis: (t, axisId, optionId) => {
      const v = variableForToken(t);
      if (!v) return t;
      const next = { ...decodeVariant(v, tokenVariant(t)), [axisId]: optionId };
      // Rebuilt through joinToken so switching a mode keeps the placement's affixes — withVariant knows
      // nothing about them and would silently drop the user's wording.
      const parts = splitToken(t);
      return joinToken({ base: baseToken(t), variantId: encodeVariant(v, next), pre: parts?.pre, post: parts?.post });
    },
    affixes: (t) => {
      const v = variableForToken(t);
      if (!v?.affixable) return null;
      const parts = splitToken(t);
      return { pre: parts?.pre ?? '', post: parts?.post ?? '' };
    },
    setAffixes: (t, pre, post) => {
      const v = variableForToken(t);
      if (!v?.affixable) return t;
      return joinToken({ base: baseToken(t), variantId: tokenVariant(t), pre, post });
    },
    palette: () => palette.map((v) => ({ token: v.token, label: v.label, color: v.color })),
    freshInsertToken: (t) => t,
  };
}

// Placeholder chip mode axis: World (default) shares one value per placeholder; Unique rolls per placement.
const PLACEHOLDER_MODE_AXIS: PromptVariantAxis = {
  id: 'mode',
  label: '',
  options: [
    { id: null, label: 'World', help: 'Rolls the same value everywhere in the World.' },
    { id: 'unique', label: 'Unique', help: 'Rolls its own value for this instance.' },
  ],
};

// Stable accent per placeholder id (so a chip keeps its color across the world).
function placeholderColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return HIGHLIGHT_PALETTE[h % HIGHLIGHT_PALETTE.length];
}

// Palette tokens carry a sentinel placement id; freshInsertToken re-mints a real one on insertion.
const PALETTE_PID = 'palette';

/**
 * A vocabulary with no token family at all: everything is literal text and the insert toolbar is empty.
 * For fields that render before any roll exists (the world description), where a `{{ph…}}` token would
 * never resolve — so it stays visible as the inert text the player would actually see, rather than
 * masquerading as a working chip.
 */
export function plainVocabulary(): ChipVocabulary {
  return {
    parse: (text) => (text ? [{ type: 'text', value: text }] : []),
    isKnown: () => false,
    label: (t) => t,
    variantLabel: () => null,
    color: () => undefined,
    axes: () => [],
    selection: () => ({}),
    setAxis: (t) => t,
    affixes: () => null,
    setAffixes: (t: string) => t,
    palette: () => [],
    freshInsertToken: (t) => t,
  };
}

/** Vocabulary backed by a world's placeholders. A chip's World/Unique axis only appears once the placeholder
 *  has 2+ values (a single-value Variable has nothing to randomize). */
export function placeholderVocabulary(placeholders: Placeholder[]): ChipVocabulary {
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  return {
    parse: parsePlaceholderText,
    isKnown: (t) => decodePlaceholderToken(t) != null,
    label: (t) => {
      const d = decodePlaceholderToken(t);
      if (!d) return t;
      return byId.get(d.id)?.name ?? '(missing)';
    },
    variantLabel: (t) => (decodePlaceholderToken(t)?.mode === 'unique' ? 'Unique' : null),
    color: (t) => {
      const d = decodePlaceholderToken(t);
      return d && byId.has(d.id) ? placeholderColor(d.id) : undefined;
    },
    axes: (t) => {
      const d = decodePlaceholderToken(t);
      const ph = d && byId.get(d.id);
      return ph && ph.values.length >= 2 ? [PLACEHOLDER_MODE_AXIS] : [];
    },
    selection: (t) => ({ mode: decodePlaceholderToken(t)?.mode === 'unique' ? 'unique' : null }),
    setAxis: (t, axisId, optionId) => {
      const d = decodePlaceholderToken(t);
      if (!d || axisId !== 'mode') return t;
      return encodePlaceholderToken({ ...d, mode: optionId === 'unique' ? 'unique' : 'world' });
    },
    affixes: () => null,
    setAffixes: (t: string) => t,
    palette: () =>
      placeholders.map((p) => ({
        token: encodePlaceholderToken({ id: p.id, mode: 'world', placementId: PALETTE_PID }),
        label: p.name,
        color: placeholderColor(p.id),
      })),
    freshInsertToken: (t) => {
      const d = decodePlaceholderToken(t);
      return d ? encodePlaceholderToken({ ...d, placementId: randomUUID() }) : t;
    },
  };
}

/** The editor reads its vocabulary here. Defaults to the prompt family (empty palette) so existing prompt
 *  chips render unchanged when no provider is present. */
export const ChipVocabularyContext = createContext<ChipVocabulary>(promptVocabulary([]));
