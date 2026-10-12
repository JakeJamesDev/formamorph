import { ALL_PROMPT_VARIABLES, ALL_VARIANT_IDS, variableForToken, variableVariantIds, withVariant } from '@/lib/promptVariables';

/** Every token the parser accepts on `base`: the bare base and the base with each variant id it knows. */
const parsedTokens = (base: string): { token: string; own: boolean }[] => {
  const own = new Set(variableVariantIds(variableForToken(base)!));
  return [
    { token: base, own: true },
    ...ALL_VARIANT_IDS.map((id) => ({ token: withVariant(base, id), own: own.has(id) })),
  ];
};

/** The tokens a prompt can spell on `base` from that chip's own axes, in any combination of its options. */
export const spelledTokens = (base: string): string[] =>
  parsedTokens(base).filter((t) => t.own).map((t) => t.token);

/** Every token a prompt can spell from a chip's own axes, over every registered chip. */
export const allSpelledTokens = (): string[] => ALL_PROMPT_VARIABLES.flatMap((v) => spelledTokens(v.token));

/** The tokens the parser accepts on `base` whose id belongs to another chip, which render as typed text. */
export const foreignTokens = (base: string): string[] =>
  parsedTokens(base).filter((t) => !t.own).map((t) => t.token);
