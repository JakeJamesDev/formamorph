import { randomUUID } from "@/lib/uuid";
import { createContext, useMemo } from 'react';
import { usePlaceholderStoreOptional } from '@/contexts/PlaceholderStoreContext';
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
  parsePlaceholderText, decodePlaceholderToken, encodePlaceholderToken, placeholderValueSummary,
  placeholderPathChildren, placeholderPathLevel, newPlaceholder,
} from './placeholders';
import type { PlaceholderKindNoun, PlaceholderSegment } from './placeholders';

/** One token a menu or picker offers, named for the reader. */
export interface ChipRow {
  token: string;
  label: string;
  color?: string;
}

/** A part reached through whichever value the level rolls, rather than by naming one. */
export interface ChipSlot extends ChipRow {
  /** Some value holds no part of this name, so a roll landing there resolves to nothing. */
  partial: boolean;
}

/** What a picker says about the level a chip stands on, over and above its parts (which come from
 *  {@link ChipVocabulary.drill}). */
export interface ChipStructure {
  /** Heading for the parts section, in the family's own nouns for what this level is. */
  partsLabel: string;
  /** The path walked to here, root first and ending at this level — each crumb the same chip cut back. */
  trail: ChipRow[];
  slots: ChipSlot[];
  /** Values no path can address, because each is not exactly one token. */
  plain: number;
}

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
  /** Extra detail for the chip's tooltip — a placeholder chip names itself and puts its values here.
   *  Undefined when the label already says everything. */
  hint?(token: string): string | undefined;
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
  palette(): ChipRow[];
  /** Prepare a palette token for a fresh insertion (placeholders re-mint their placement id). */
  freshInsertToken(token: string): string;
  /** The rows one level under this token — each the same chip drilled one segment deeper. Present only where
   *  the family has structure to walk; the static prompt variables have none. */
  drill?(token: string): ChipRow[];
  /** Where this token stands and what else is reachable from there, for a picker that walks the structure.
   *  `null` when the token names nothing. Present alongside {@link drill}. */
  structure?(token: string): ChipStructure | null;
  /** `token` re-aimed at what `at` names, keeping everything the placement itself decided. Re-picking moves
   *  a chip rather than replacing it, so its mode and its roll survive the move. */
  repoint?(token: string, at: string): string;
  /** Mint a new member of the family under this name and return a token to insert. Present only where the
   *  family is authored and a store is bound to write to. */
  create?(name: string): string;
  /** Rename what the chip stands for, everywhere it is used. Present only where the family is authored and
   *  a store is bound to write to — prompt variables are fixed, so they never offer it. */
  rename?(token: string, next: string): void;
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

// What a chip reads as when the placeholder it names is gone. Displays only — resolution says `''`.
const MISSING_NAME = '(missing)';
// Reads a drill path as one name. Matches the separator the trait groups and the location canvas use.
const PATH_SEPARATOR = ' › ';

// What a level's parts are called, by what the level is. A Variable holds one value, so it holds one part.
const PARTS_LABEL: Record<PlaceholderKindNoun, string> = {
  Wildcard: 'Wildcard Variants',
  Object: 'Object Parts',
  Variable: 'Variable Part',
};

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
export function placeholderVocabulary(
  placeholders: Placeholder[],
  /** What the vocabulary may write back. Omit where placeholders are only being displayed — the chips are
   *  then not renameable and the typeahead offers no inline create. */
  { onRename, onCreate }: {
    onRename?: (placeholder: Placeholder) => void;
    onCreate?: (placeholder: Placeholder) => void;
  } = {},
): ChipVocabulary {
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  /** What one path segment adds, named by itself: a slot is already a name, a val names what it picks. */
  const segLabel = (seg: PlaceholderSegment) =>
    (seg.kind === 'slot' ? seg.name : byId.get(seg.ref)?.name ?? MISSING_NAME);
  return {
    rename: onRename && ((token, next) => {
      const id = decodePlaceholderToken(token)?.id;
      const ph = id ? byId.get(id) : undefined;
      const name = next.trim();
      // A chip labels itself with the name, so an empty one would leave nothing to grab hold of.
      if (ph && name && name !== ph.name) onRename({ ...ph, name });
    }),
    parse: parsePlaceholderText,
    isKnown: (t) => decodePlaceholderToken(t) != null,
    label: (t) => {
      const d = decodePlaceholderToken(t);
      if (!d) return t;
      const root = byId.get(d.id)?.name ?? MISSING_NAME;
      if (!d.path?.length) return root;
      // The whole path, so `Molly › Hair` and a root `Hair` never read alike.
      return [root, ...d.path.map(segLabel)].join(PATH_SEPARATOR);
    },
    // A chip in a field names its placeholder; what it will become goes in the tooltip, so the chip stays
    // one short word wide however many values there are.
    hint: (t) => {
      const d = decodePlaceholderToken(t);
      const ph = d && byId.get(d.id);
      if (!ph) return undefined;
      return ph.values.length ? placeholderValueSummary(ph) : 'no values';
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
    // A row names only the part it adds; the breadcrumb above it carries where that part sits, and the
    // inserted chip's own label spells the whole path out.
    drill: (t) => {
      const d = decodePlaceholderToken(t);
      if (!d) return [];
      return placeholderPathChildren(d, placeholders).map((child) => ({
        token: encodePlaceholderToken({ ...d, path: [...(d.path ?? []), { kind: 'val', ref: child.id }] }),
        label: child.name,
        color: placeholderColor(d.id),
      }));
    },
    // Everything a picker adds to `drill`: where the chip stands, what a roll can still route to, and how
    // much of the level no path reaches.
    structure: (t) => {
      const d = decodePlaceholderToken(t);
      const level = d && placeholderPathLevel(d, placeholders);
      if (!d || !level) return null;
      // Cut to what the walk could follow, so every crumb and every slot hangs off a level a picker can
      // actually stand on. A chip aimed through a slot describes the level that slot was chosen from.
      const path = (d.path ?? []).slice(0, level.depth);
      const color = placeholderColor(d.id);
      return {
        partsLabel: PARTS_LABEL[level.kind],
        trail: [{ token: encodePlaceholderToken({ ...d, path: [] }), label: byId.get(d.id)?.name ?? MISSING_NAME, color },
          ...path.map((seg, i) => ({
            token: encodePlaceholderToken({ ...d, path: path.slice(0, i + 1) }),
            label: segLabel(seg),
            color,
          }))],
        slots: level.slots.map((s) => ({
          token: encodePlaceholderToken({ ...d, path: [...path, { kind: 'slot', name: s.name }] }),
          label: s.name,
          partial: s.partial,
          color,
        })),
        plain: level.plain,
      };
    },
    repoint: (t, at) => {
      const from = decodePlaceholderToken(t);
      const to = decodePlaceholderToken(at);
      if (!from || !to) return t;
      // The placement is the chip's own: its mode and the id its Unique roll is filed under both outlive a
      // re-aim, so re-picking never silently re-rolls what the placement already drew.
      return encodePlaceholderToken({ ...to, mode: from.mode, placementId: from.placementId });
    },
    create: onCreate && ((name) => {
      const made = newPlaceholder(name);
      onCreate(made);
      return encodePlaceholderToken({ id: made.id, mode: 'world', placementId: PALETTE_PID });
    }),
  };
}

/**
 * The placeholder vocabulary for a field, wired to rename through whatever placeholder store is bound.
 *
 * Reading the store here rather than taking it as a prop is what keeps double-click-to-rename working the
 * same in every field without each call site having to thread an updater down to its chips. Outside an
 * editor no store is bound, and the chips are simply not renameable.
 */
export function usePlaceholderChipVocabulary(placeholders: Placeholder[]): ChipVocabulary {
  const store = usePlaceholderStoreOptional();
  const onRename = store?.updatePlaceholder;
  const onCreate = store?.addPlaceholder;
  return useMemo(
    () => placeholderVocabulary(placeholders, { onRename, onCreate }),
    [placeholders, onRename, onCreate],
  );
}

/** The editor reads its vocabulary here. Defaults to the prompt family (empty palette) so existing prompt
 *  chips render unchanged when no provider is present. */
export const ChipVocabularyContext = createContext<ChipVocabulary>(promptVocabulary([]));
