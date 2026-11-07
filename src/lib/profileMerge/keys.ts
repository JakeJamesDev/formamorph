/** Every merge category's key, as the done marker and the desktop bridge name it. */
export const MERGE_KEYS = {
  settings: 'settings',
  modelFolder: 'modelFolder',
  statTemplates: 'statTemplates',
  dictionaries: 'dictionaries',
  entities: 'entities',
  mascotImages: 'mascotImages',
  avatars: 'avatars',
  worlds: 'worlds',
  saves: 'saves',
  models: 'models',
} as const;

export type MergeKey = (typeof MERGE_KEYS)[keyof typeof MERGE_KEYS];
