// Windows launcher layout: `<root>/Formamorph.exe` (the Go launcher) starts `<root>/app/Formamorph.exe` with
// FORMAMORPH_ROOT set. A direct start of the inner exe (a taskbar pin, a shortcut into app/) would keep data
// in AppData and cannot apply updates, so the app hands the start back to the launcher.
const path = require('node:path').win32;

const LAUNCHER_NAME = 'Formamorph.exe';

/** The launcher to restart through, or null when this start needs no handoff. */
function launcherToRestartThrough({ platform, isPackaged, env, execPath, exists }) {
  if (platform !== 'win32' || !isPackaged || env.FORMAMORPH_ROOT) return null;
  const appDir = path.dirname(execPath);
  if (path.basename(appDir).toLowerCase() !== 'app') return null;
  const launcher = path.join(path.dirname(appDir), LAUNCHER_NAME);
  return exists(launcher) ? launcher : null;
}

const SHOW_IN_FOLDER = 1;

/** Names the launcher in a blocking box, then restarts through it. A failed box or reveal never stops the restart. */
function handOff({ launcher, argv, dialog, reveal, spawn }) {
  try {
    const choice = dialog.showMessageBoxSync({
      type: 'info',
      title: 'Formamorph',
      message: 'Start Formamorph from the main Formamorph.exe',
      detail: `Pin or open this file instead of the one in the app folder:\n${launcher}\n\nFormamorph opens now.`,
      buttons: ['OK', 'Show in Folder'],
      defaultId: 0,
      cancelId: 0,
    });
    if (choice === SHOW_IN_FOLDER) reveal(launcher);
  } catch (err) {
    console.error('Launcher notice failed:', err);
  }
  spawn(launcher, argv);
}

/** Taskbar details so a pinned window starts the launcher, not the inner exe. Null outside a launcher start. */
function taskbarDetails({ platform, env, appId, execPath }) {
  if (platform !== 'win32' || !env.FORMAMORPH_ROOT) return null;
  return {
    appId,
    appIconPath: execPath,
    relaunchCommand: `"${path.join(env.FORMAMORPH_ROOT, LAUNCHER_NAME)}"`,
    relaunchDisplayName: 'Formamorph',
  };
}

module.exports = { launcherToRestartThrough, handOff, taskbarDetails };
