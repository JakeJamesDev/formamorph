import {
  ALL_PROMPT_VARIABLES, encodeVariant, variableAxes, variableForToken, variableOptionIds, withVariant,
  type PromptVariable,
} from '@/lib/promptVariables';

// Toggle pieces set together per token; enough for every interaction the renderers have between pieces.
const MAX_TOGGLES = 3;

/** The canonical variant ids that span `variable`: each single-select combination with up to three toggles set. */
export function variantSpan(variable: PromptVariable): string[] {
  const axes = variableAxes(variable);
  let picks: Record<string, string | null>[] = [{}];
  for (const axis of axes.filter((a) => !a.toggle)) {
    picks = picks.flatMap((pick) => axis.options.map((o) => ({ ...pick, [axis.id]: o.id })));
  }
  let toggles: Record<string, string | null>[] = [{}];
  for (const axis of axes.filter((a) => a.toggle)) {
    toggles = toggles.flatMap((set) => [
      set,
      ...(Object.keys(set).length < MAX_TOGGLES ? axis.options.filter((o) => o.id).map((o) => ({ ...set, [axis.id]: o.id })) : []),
    ]);
  }
  const ids = picks.flatMap((pick) => toggles.map((set) => encodeVariant(variable, { ...pick, ...set })));
  return ids.filter((id): id is string => id != null);
}

/** The tokens a prompt can spell on `base` from that chip's own axes: the bare base and its variant span. */
export const spelledTokens = (base: string): string[] => {
  const variable = variableForToken(base)!;
  return [base, ...variantSpan(variable).map((id) => withVariant(base, id))];
};

/** Every token a prompt can spell from a chip's own axes, over every registered chip. */
export const allSpelledTokens = (): string[] => ALL_PROMPT_VARIABLES.flatMap((v) => spelledTokens(v.token));

/** `base` with each option id that only another chip knows. The parser leaves each one as typed text. */
export const foreignTokens = (base: string): string[] => {
  const own = new Set(variableOptionIds(variableForToken(base)!));
  const foreign = new Set(ALL_PROMPT_VARIABLES.flatMap(variableOptionIds).filter((id) => !own.has(id)));
  return [...foreign].map((id) => withVariant(base, id));
};
