import type { ToolParam } from '@/types';
import type { ChipRow, ChipVocabulary } from '@/lib/chipVocabulary';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { chipValues } from '@/lib/chipValues/chipValues';
import { sampleChipScene } from '@/lib/chipValues/sampleScene';
import { HIGHLIGHT_PALETTE } from '@/lib/highlightUtils';
import { ALL_PROMPT_VARIABLES } from '@/lib/promptVariables';
import { argChipName, argChipToken, parseToolTemplate } from './argChips';

/** The prompt chips a Template can place: the scene chips a Tool Snapshot carries values for. */
export const TEMPLATE_SCENE_VARIABLES = (() => {
  const sceneTokens = new Set(Object.keys(chipValues(sampleChipScene())));
  return ALL_PROMPT_VARIABLES.filter((v) => sceneTokens.has(v.token));
})();

const ARG_COLOR = HIGHLIGHT_PALETTE[16];

/**
 * The chip family of a Template body: one chip per named parameter, beside the scene chips. An arg chip
 * whose parameter is gone reads as text, as it renders.
 */
export function toolTemplateVocabulary(params: readonly ToolParam[]): ChipVocabulary {
  const scene = promptVocabulary(TEMPLATE_SCENE_VARIABLES);
  const byName = new Map(params.filter((p) => p.name.trim()).map((p) => [p.name, p]));
  const argOf = (token: string) => {
    const name = argChipName(token);
    return name === null ? undefined : byName.get(name);
  };
  const argRows: ChipRow[] = [...byName.keys()].map((name) => ({ token: argChipToken(name), label: name, color: ARG_COLOR }));
  return {
    ...scene,
    parse: parseToolTemplate,
    isKnown: (t) => !!argOf(t) || scene.isKnown(t),
    label: (t) => argOf(t)?.name ?? scene.label(t),
    hint: (t) => {
      const param = argOf(t);
      return param ? param.description.trim() || 'What the AI passed' : undefined;
    },
    variantLabel: (t) => (argOf(t) ? null : scene.variantLabel(t)),
    color: (t) => (argOf(t) ? ARG_COLOR : scene.color(t)),
    axes: (t) => (argOf(t) ? [] : scene.axes(t)),
    selection: (t) => (argOf(t) ? {} : scene.selection(t)),
    setAxis: (t, axisId, optionId) => (argOf(t) ? t : scene.setAxis(t, axisId, optionId)),
    affixes: (t) => (argOf(t) ? null : scene.affixes(t)),
    setAffixes: (t, pre, post) => (argOf(t) ? t : scene.setAffixes(t, pre, post)),
    header: (t) => (argOf(t) ? null : scene.header?.(t) ?? null),
    setHeader: (t, header) => (argOf(t) ? t : scene.setHeader?.(t, header) ?? t),
    headerBoundaries: (t) => (argOf(t) ? null : scene.headerBoundaries?.(t) ?? null),
    palette: () => [...argRows, ...scene.palette()],
    acceptsPaletteToken: (t) => !!argOf(t) || (scene.acceptsPaletteToken?.(t) ?? false),
  };
}
