import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android app is the web build in a WebView. The id is permanent: Android keys installs and
 * updates on it, so changing it orphans every install.
 */
const config: CapacitorConfig = {
  appId: 'ai.formamorph.app',
  appName: 'Formamorph',
  webDir: 'dist',
  android: {
    // Behind the WebView while the bundle parses. Matches the web manifest's background color.
    backgroundColor: '#16181D',
    // The app is served from https://localhost, so a player's own http endpoint on the LAN counts as
    // mixed content and the WebView blocks it. The network security config is what bounds cleartext.
    allowMixedContent: true,
  },
};

export default config;
