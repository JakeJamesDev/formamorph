// Lazily loads the shipped Danbooru tag list for Image-Tags autocomplete. The JSON is a popularity-ordered
// string[] (array order = ranking); Vite code-splits it into its own chunk, fetched only on first use.
//
// The build-time flag VITE_SFW_TAGS swaps to a separate SFW source (empty for now). Because the check is a
// static env replacement, the unused branch — and the full explicit JSON chunk — is dead-code-eliminated
// from a VITE_SFW_TAGS=true build (e.g. the public Pages demo), not merely hidden.

let promise: Promise<string[]> | null = null;

export const loadDanbooruTags = (): Promise<string[]> => (promise ??= (
  import.meta.env.VITE_SFW_TAGS === 'true'
    ? import('@/data/danbooruTagsSfw.json')
    : import('@/data/danbooruTags.json')
).then((m) => m.default as string[]));
