/**
 * The files whose classes belong in the account pages' stylesheet.
 *
 * Both directions of getting this wrong are quiet. Scanning all of `src/` puts every class the game
 * uses into a login page's CSS. Scanning too little leaves a reused control unstyled with nothing
 * failing — an avatar's circle simply comes out an oval, because `h-16` was never emitted.
 *
 * It sits apart from `tailwind.site.config.js` so a test can read it: the configs are CommonJS inside
 * an ESM package, which Vitest cannot import, and this one file can be.
 *
 * `site/bundleBoundary.test.ts` walks the site's imports and fails when a file it reaches is in
 * neither list below. The two are kept as plain paths rather than globs so that check is a string
 * comparison — matching globs would mean either a glob library or `fs.globSync`, which does not exist
 * on the Node 20.19 this repo still supports.
 */

/** Scanned whole, every file under them. */
const DIRECTORIES = [
  'site/',
  'src/components/ui/',
]

/**
 * Scanned one by one: the app files the site entry reaches.
 *
 * Listed whole rather than filtered to the ones that look like they hold classes. Scanning a file with
 * none in it costs nothing, and deciding which those are is the guess that goes wrong.
 */
const FILES = [
  'src/components/RoleBadge.tsx',
  'src/components/UserAvatar.tsx',
  'src/components/community/AgeGateDialog.tsx',
  'src/components/community/LikeButton.tsx',
  'src/components/community/ProfileStats.tsx',
  'src/components/community/UserCreationsTab.tsx',
  'src/components/menu/AvatarCropDialog.tsx',
  'src/components/menu/DeleteAccountDialog.tsx',
  'src/components/menu/ProfileAvatarEditor.tsx',
  'src/lib/ageGate.ts',
  'src/lib/apiBase.ts',
  'src/lib/avatar.ts',
  'src/lib/avatarCrop.ts',
  'src/lib/catalogKinds.ts',
  'src/lib/numberInputWheel.ts',
  'src/lib/roles.ts',
  'src/lib/serverAssets.ts',
  'src/lib/serverDate.ts',
  'src/lib/thumbAspect.ts',
  'src/lib/useCachedThumbnail.tsx',
  'src/lib/useResetOnOpen.ts',
  'src/lib/utils.ts',
  'src/services/AuthService.ts',
  'src/services/PolicyService.ts',
  'src/services/UserService.ts',
  'src/types/index.ts',
]

module.exports = {
  DIRECTORIES,
  FILES,
  /** The two lists as Tailwind wants them. */
  content: [
    ...DIRECTORIES.map((directory) => `./${directory}**/*.{js,jsx,ts,tsx}`),
    ...FILES.map((file) => `./${file}`),
  ],
}
