import { randomUUID } from "@/lib/uuid";
import { createContext, useMemo } from 'react';
import { usePlaceholderStoreOptional } from '@/contexts/PlaceholderStoreContext';
import { usePlacementLetters } from '@/contexts/PlacementLettersContext';
import { chipPathName, EMPTY_LETTERS, labelPlaceholders, ownerPrefix, placementDisplayName, type PlacementLetters } from './placementLetters';
import {
  placeholderOwnerRef, type PlaceholderHome, type PlaceholderHomesWorld, type PlaceholderOwnerRef, type PlaceholderOwners,
} from './placeholderHomes';
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
  placeholderValueSummary, placeholderPathChildren, placeholderPathLevel, newPlaceholder,
  describePlaceholders, placeholderRandomizes,
} from './placeholders';
import type { PlaceholderKindNoun, PlaceholderSegment } from './placeholders';
import {
  isOwnedPlaceholder, promotePlaceholder, qualifiedPlaceholderName, topLevelPlaceholders,
} from './placeholderTree';
import { placeholderGroupOf, placeholderGroupsInTreeOrder } from './placeholderGroups';
import type { PlaceholderGroup } from '@/types';

/** One token a menu or picker offers, named for the reader. */
export interface ChipRow {
  token: string;
  label: string;
  color?: string;
  /** The section this row sits under — a folder's path or an owner's name. Rows sharing a heading sit
   *  together, so a surface draws the heading once, where it changes; absent for a loose row. */
  heading?: string;
  /** The placeholder belongs to another one, so a chip cannot be aimed at it from outside its owner. Set
   *  only where a surface offers owned rows at all (see {@link ChipVocabulary.allRows}). */
  owned?: boolean;
}

/** True where row `i` starts a new section of a sectioned list: the first row, or one whose heading
 *  differs from the row before it. A surface draws a heading (or a rule, for a loose run after a headed
 *  one) exactly there, so a section the filter emptied never shows a heading. */
export function chipSectionOpens(rows: readonly Pick<ChipRow, 'heading'>[], i: number): boolean {
  return i === 0 || rows[i - 1].heading !== rows[i].heading;
}

/** A part reached through whichever value the level rolls, rather than by naming one. */
export interface ChipSlot extends ChipRow {
  /** Some value holds no part of this name, so a roll landing there resolves to nothing. */
  partial: boolean;
}

/** What a picker says about the level a chip stands on, over and above what it holds (which comes from
 *  {@link ChipVocabulary.drill}). */
export interface ChipStructure {
  /** Heading for the section of what this level holds, in the family's own nouns for what the level is. */
  holdsLabel: string;
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
  /** Friendly chip label: what the token stands for, bare. Rename edits this; the remove button is named
   *  by it. */
  label(token: string): string;
  /** What the chip reads as on the surface, where that differs from the label — a placement's own name or
   *  letter. Absent, the chip shows the label plus its {@link variantLabel} in parens. */
  display?(token: string): string;
  /** Extra detail for the chip's tooltip — a placeholder chip names itself and puts its mode and values
   *  here. Undefined when the label already says everything. */
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
  /** The author's name for this one placement (`''` when unset), or null while the chip cannot take one.
   *  Only a Unique placeholder chip takes one: a World chip is every other World chip of its placeholder. */
  placementLabel?(token: string): string | null;
  /** The token with its placement label replaced. An empty string removes it. */
  setPlacementLabel?(token: string, label: string): string;
  /** Toolbar items to insert. Owned members are left out — they belong to one placeholder and are reached
   *  by drilling into it. */
  palette(): ChipRow[];
  /** Every member the family has, owned ones included and flagged. For a picker that has to find a
   *  placeholder by name before it can say why the chip cannot be aimed there. */
  allRows?(): ChipRow[];
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
  /** How the create row reads for `name` here — the wording says who the new member will belong to when
   *  the field being typed into is a placeholder's own value list. */
  createLabel?(name: string): string;
  /** Send an owned member back to the top level, so a chip can be aimed at it. Present alongside
   *  {@link ChipVocabulary.allRows}. */
  promote?(token: string): void;
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

/** Stable accent per placeholder id, so a chip keeps its color across the world — and every surface that
 *  draws one by id draws the same one. */
export function placeholderAccent(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return HIGHLIGHT_PALETTE[h % HIGHLIGHT_PALETTE.length];
}

// Palette tokens carry a sentinel placement id; freshInsertToken re-mints a real one on insertion.
const PALETTE_PID = 'palette';

// What a chip reads as when the placeholder it names is gone. Displays only — resolution says `''`.
const MISSING_NAME = '(missing)';

// What a level holds, by what the level is. A Variable holds one value, so it heads one row.
const HOLDS_LABEL: Record<PlaceholderKindNoun, string> = {
  Wildcard: 'Wildcard Variants',
  Object: 'Object Values',
  Variable: 'Variable Value',
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
  placeholders: readonly Placeholder[],
  /** What the vocabulary may write back, and where its fields sit. Omit where placeholders are only being
   *  displayed — the chips are then not renameable and the typeahead offers no inline create. */
  { onRename, onCreate, onPromote, ownerId, owners, scope: scopeOwner, groups, letters = EMPTY_LETTERS }: {
    onRename?: (placeholder: Placeholder) => void;
    /** `home` names the list a member made inside an entity's or book's fields lands in. */
    onCreate?: (placeholder: Placeholder, home?: PlaceholderHome) => void;
    onPromote?: (id: string) => void;
    /** Whose fields these are: a placeholder (its own value list) or an entity or book (its fields). A
     *  member created in a placeholder's values is born owned by it, and its owned rows read bare because
     *  the panel already says whose they are; one created in an entity's or book's fields lands in that
     *  owner's list, and the owner's scoped placeholders read bare and are offered first. */
    ownerId?: string;
    /** Who owns each scoped placeholder, so a chip aimed at one reads `Molly.Eyes` away from Molly. */
    owners?: PlaceholderOwners;
    /** The entity or book `ownerId` names, when it names one. An owner that owns nothing yet has no entry
     *  in `owners`, so the fields say who they belong to outright. */
    scope?: PlaceholderOwnerRef;
    /** The world's placeholder folders, so the palette and the `{` menu head a folder's placeholders with
     *  its name. Absent, or where nothing is grouped, every shared row is loose. */
    groups?: PlaceholderGroup[];
    /** The document's placement letters, so a Unique chip reads `Name (A)`. Absent, it reads `Name (Unique)`. */
    letters?: PlacementLetters;
  } = {},
): ChipVocabulary {
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  /** What one path segment adds, named by itself: a slot is already a name, a val names what it picks. */
  const segLabel = (seg: PlaceholderSegment) =>
    (seg.kind === 'slot' ? seg.name : byId.get(seg.ref)?.name ?? MISSING_NAME);
  // The entity or book these fields belong to, when they belong to one: named outright, or through the
  // placeholder whose values are being edited.
  const scope = scopeOwner ?? (ownerId ? owners?.get(ownerId) : undefined);
  const prefixFor = (id: string) => ownerPrefix(id, placeholders, { relativeTo: ownerId, owners, letters });
  // An owned placeholder carries its owner chain, so a chip in a location description reading `Hair` says
  // which Hair. Inside its owner's own panel the chain is already given, and drops away. A scoped one
  // carries its entity's or book's name the same way, and drops it inside that owner's fields.
  const vocabLabel = (t: string) => {
    const d = decodePlaceholderToken(t);
    if (!d) return t;
    return chipPathName(d, placeholders, { relativeTo: ownerId, missing: MISSING_NAME, owners, letters }) ?? MISSING_NAME;
  };
  const paletteToken = (p: Placeholder) => encodePlaceholderToken({ id: p.id, mode: 'world', placementId: PALETTE_PID });
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
    label: vocabLabel,
    // A placement reads as its own name: the author's label, or the placeholder's name with its letter. A
    // chip whose placeholder is gone keeps the label beside the missing mark, since the label is the one
    // thing left that says what it was for.
    display: (t) => {
      const d = decodePlaceholderToken(t);
      if (!d) return t;
      if (!byId.has(d.id)) return d.label ? `${MISSING_NAME} ${d.label}` : MISSING_NAME;
      return placementDisplayName(d, vocabLabel(t), letters);
    },
    // A chip in a field names its placement; the placeholder's mode and what it will become go in the
    // tooltip, so the chip stays one short word wide however many values there are.
    hint: (t) => {
      const d = decodePlaceholderToken(t);
      const ph = d && byId.get(d.id);
      if (!ph) return undefined;
      // A path chip stands for the part it names, so it previews that part rather than the root's own pool.
      const values = d.path?.length
        ? describePlaceholders(t, placeholders) || 'no values'
        : placeholderValueSummary(ph, placeholders) || 'no values';
      return `${d.mode === 'unique' ? 'Unique' : 'World'} · ${values}`;
    },
    variantLabel: (t) => (decodePlaceholderToken(t)?.mode === 'unique' ? 'Unique' : null),
    color: (t) => {
      const d = decodePlaceholderToken(t);
      return d && byId.has(d.id) ? placeholderAccent(d.id) : undefined;
    },
    // World | Unique only where a roll can differ per placement: a Wildcard, or anything whose values reach
    // one. A plain Object applies every value and never draws, so the picker would change nothing.
    axes: (t) => {
      const d = decodePlaceholderToken(t);
      return d && placeholderRandomizes(placeholders, d.id) ? [PLACEHOLDER_MODE_AXIS] : [];
    },
    selection: (t) => ({ mode: decodePlaceholderToken(t)?.mode === 'unique' ? 'unique' : null }),
    setAxis: (t, axisId, optionId) => {
      const d = decodePlaceholderToken(t);
      if (!d || axisId !== 'mode') return t;
      return encodePlaceholderToken({ ...d, mode: optionId === 'unique' ? 'unique' : 'world' });
    },
    affixes: () => null,
    setAffixes: (t: string) => t,
    placementLabel: (t) => {
      const d = decodePlaceholderToken(t);
      return d?.mode === 'unique' ? d.label ?? '' : null;
    },
    // Written whatever the mode, so a label set while Unique rides through World and back.
    setPlacementLabel: (t, label) => {
      const d = decodePlaceholderToken(t);
      if (!d) return t;
      const { label: _old, ...rest } = d;
      return encodePlaceholderToken(label ? { ...rest, label } : rest);
    },
    // Owned placeholders are private to one placeholder: they are reached by drilling into it, so the strip
    // and an insert menu's root list only what an author actually places in world text. The rows come in
    // sections: the loose shared placeholders first under no heading, then each folder in tree order under
    // its path, then each owner's scoped placeholders under the owner's name. Inside an owner's fields its
    // own section comes first.
    palette: () => {
      const folders = placeholderGroupsInTreeOrder(groups ?? []);
      const folderRank = new Map(folders.map((f, i) => [f.group.id, { rank: i + 1, heading: f.heading }]));
      const ownerRank = new Map<string, number>();
      const rows = topLevelPlaceholders(placeholders).map((p) => {
        const owner = owners?.get(p.id);
        const folder = owner ? undefined : folderRank.get(placeholderGroupOf(groups ?? [], p) ?? '');
        if (owner && !ownerRank.has(owner.id)) ownerRank.set(owner.id, folders.length + 1 + ownerRank.size);
        const heading = owner ? labelPlaceholders(owner.name, placeholders, letters) : folder?.heading;
        const row: ChipRow = {
          token: paletteToken(p),
          label: `${prefixFor(p.id)}${p.name}`,
          color: placeholderAccent(p.id),
          ...(heading ? { heading } : {}),
        };
        return { row, rank: (owner ? ownerRank.get(owner.id) : folder?.rank) ?? 0, mine: !!scope && owner?.id === scope.id };
      });
      // A stable sort: within a section, rows keep the list's own order.
      return rows.sort((a, b) => Number(b.mine) - Number(a.mine) || a.rank - b.rank).map((r) => r.row);
    },
    allRows: () =>
      placeholders.map((p) => ({
        token: paletteToken(p),
        label: `${prefixFor(p.id)}${qualifiedPlaceholderName(placeholders, p.id) ?? p.name}`,
        color: placeholderAccent(p.id),
        owned: isOwnedPlaceholder(placeholders, p.id),
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
        color: placeholderAccent(d.id),
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
      const color = placeholderAccent(d.id);
      return {
        holdsLabel: HOLDS_LABEL[level.kind],
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
      return encodePlaceholderToken({ ...to, mode: from.mode, placementId: from.placementId, label: from.label });
    },
    // Created from inside a placeholder's own value field, a new one is born owned by it: building a
    // character out of parts never has to leave the panel. The owner only sticks once the value holding it
    // is exactly that chip, which is what committing the value makes it. Created inside an entity's or
    // book's fields, it lands in that owner's list.
    create: onCreate && ((name) => {
      const holder = ownerId && byId.has(ownerId) ? ownerId : undefined;
      const made = { ...newPlaceholder(name), ...(holder ? { ownerId: holder } : {}) };
      const home: PlaceholderHome | undefined = !holder && scope ? { kind: scope.kind, ownerId: scope.id } : undefined;
      onCreate(made, home);
      return paletteToken(made);
    }),
    createLabel: (name) => {
      const owner = ownerId && byId.has(ownerId)
        ? byId.get(ownerId)?.name
        : scope && labelPlaceholders(scope.name, placeholders, letters);
      return owner ? `New Placeholder "${name}" in ${owner}` : `New Placeholder "${name}"`;
    },
    promote: onPromote && ((token) => {
      const id = decodePlaceholderToken(token)?.id;
      if (id) onPromote(id);
    }),
  };
}

/** The entity or book `ownerId` names in `lists`, kept by identity while its id and name hold, so a
 *  keystroke elsewhere in the world does not rebuild every chip field's vocabulary. */
export function useOwnerScope(lists: PlaceholderHomesWorld | undefined, ownerId: string | undefined): PlaceholderOwnerRef | undefined {
  const found = lists && ownerId ? placeholderOwnerRef(lists, ownerId) : undefined;
  const kind = found?.kind;
  const id = found?.id;
  const name = found?.name;
  return useMemo(() => (kind && id && name !== undefined ? { kind, id, name } : undefined), [kind, id, name]);
}

/**
 * The placeholder vocabulary for a field, wired to rename through whatever placeholder store is bound.
 *
 * Reading the store here rather than taking it as a prop is what keeps double-click-to-rename working the
 * same in every field without each call site having to thread an updater down to its chips. Outside an
 * editor no store is bound, and the chips are simply not renameable.
 */
export function usePlaceholderChipVocabulary(
  placeholders: Placeholder[],
  /** Whose fields these are — a placeholder's own value list, or an entity's or book's fields — see
   *  `ownerId` on {@link placeholderVocabulary}. */
  ownerId?: string,
): ChipVocabulary {
  const store = usePlaceholderStoreOptional();
  const letters = usePlacementLetters();
  const onRename = store?.updatePlaceholder;
  const onCreate = store?.addPlaceholder;
  const owners = store?.owners;
  const lists = store?.lists;
  const groups = lists?.placeholderGroups;
  const setPlaceholders = store?.setPlaceholders;
  const onPromote = useMemo(
    () => setPlaceholders && ((id: string) => setPlaceholders((prev) => promotePlaceholder(prev, id))),
    [setPlaceholders],
  );
  const scope = useOwnerScope(lists, ownerId);
  return useMemo(
    () => placeholderVocabulary(placeholders, { onRename, onCreate, onPromote, ownerId, owners, scope, groups, letters }),
    [placeholders, onRename, onCreate, onPromote, ownerId, owners, scope, groups, letters],
  );
}

/** The editor reads its vocabulary here. Defaults to the prompt family (empty palette) so existing prompt
 *  chips render unchanged when no provider is present. */
export const ChipVocabularyContext = createContext<ChipVocabulary>(promptVocabulary([]));
