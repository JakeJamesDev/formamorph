import type { ToolParam } from '@/types';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { plainVocabulary, promptVocabulary } from '@/lib/chipVocabulary';
import { chipValues } from '@/lib/chipValues/chipValues';
import { sampleChipScene } from '@/lib/chipValues/sampleScene';
import { HIGHLIGHT_PALETTE } from '@/lib/highlightUtils';
import { ALL_PROMPT_VARIABLES } from '@/lib/promptVariables';
import { argChipName, argChipToken, parseToolTemplate } from './argChips';
import { namedParams } from './toolDraft';

/** The prompt chips a Template can place: the scene chips a Tool Snapshot carries values for. */
export const TEMPLATE_SCENE_VARIABLES = (() => {
  const sceneTokens = new Set(Object.keys(chipValues(sampleChipScene())));
  return ALL_PROMPT_VARIABLES.filter((v) => sceneTokens.has(v.token));
})();

// The one palette entry no prompt chip wears, so a parameter never reads as a scene chip.
const ARG_COLOR = HIGHLIGHT_PALETTE[16];

/** One chip per named parameter: a plain chip with no axes, affixes or header. */
function argVocabulary(params: readonly ToolParam[]): ChipVocabulary {
  const byName = new Map(namedParams(params).map((p) => [p.name, p]));
  const argOf = (token: string) => {
    const name = argChipName(token);
    return name === null ? undefined : byName.get(name);
  };
  return {
    ...plainVocabulary(),
    isKnown: (t) => !!argOf(t),
    label: (t) => argOf(t)?.name ?? t,
    hint: (t) => {
      const param = argOf(t);
      return param ? param.description.trim() || 'What the AI passed' : undefined;
    },
    color: () => ARG_COLOR,
    palette: () => [...byName.keys()].map((name) => ({ token: argChipToken(name), label: name, color: ARG_COLOR })),
  };
}

/**
 * The chip family of a Template body: the parameters, then the scene chips. Each token goes to the family
 * that knows it, and an arg chip whose parameter is gone reads as text, as it renders.
 */
export function toolTemplateVocabulary(params: readonly ToolParam[]): ChipVocabulary {
  const scene = promptVocabulary(TEMPLATE_SCENE_VARIABLES);
  const args = argVocabulary(params);
  const familyOf = (token: string) => (args.isKnown(token) ? args : scene);
  return {
    parse: parseToolTemplate,
    isKnown: (t) => familyOf(t).isKnown(t),
    label: (t) => familyOf(t).label(t),
    hint: (t) => familyOf(t).hint?.(t),
    variantLabel: (t) => familyOf(t).variantLabel(t),
    color: (t) => familyOf(t).color(t),
    axes: (t) => familyOf(t).axes(t),
    selection: (t) => familyOf(t).selection(t),
    setAxis: (t, axisId, optionId) => familyOf(t).setAxis(t, axisId, optionId),
    affixes: (t) => familyOf(t).affixes(t),
    setAffixes: (t, pre, post) => familyOf(t).setAffixes(t, pre, post),
    header: (t) => familyOf(t).header?.(t) ?? null,
    setHeader: (t, header) => familyOf(t).setHeader?.(t, header) ?? t,
    headerBoundaries: (t) => familyOf(t).headerBoundaries?.(t) ?? null,
    palette: () => [...args.palette(), ...scene.palette()],
    freshInsertToken: (t) => t,
    acceptsPaletteToken: (t) => args.isKnown(t) || (scene.acceptsPaletteToken?.(t) ?? false),
  };
}
