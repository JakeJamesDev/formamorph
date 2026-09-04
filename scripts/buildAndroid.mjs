// Builds dist/ with the android build class baked in, for the `android:*` scripts.
//
// The class decides two things the APK cannot work out at runtime: the footer's build tag, and the
// platform the client header reports, since the desktop bridge is absent inside the WebView. The release
// workflow sets FORMAMORPH_BUILD for the other targets; this is the local equivalent, and it has to be a
// script rather than a shell one-liner because npm scripts run under cmd.exe on Windows.

process.env.FORMAMORPH_BUILD = 'android';

const { build } = await import('vite');
await build();
