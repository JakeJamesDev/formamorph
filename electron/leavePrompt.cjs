// Window close with unsaved world edits. The page cancels the unload with a beforeunload handler. A browser
// shows its own prompt for that; Electron shows nothing, and with no listener the window silently refuses to
// close. This handler asks, and lets the unload through when the author confirms.

/**
 * `will-prevent-unload` listener. The event needs a synchronous answer, so the dialog is the sync form.
 * `preventDefault` ignores the page's cancel and lets the window close; Stay leaves it alone.
 */
function confirmLeave(win, dialog) {
  return (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      title: 'Unsaved Changes',
      message: 'Leave without saving?',
      detail: 'Your world has changes that are not saved. If you leave, you lose them.',
      buttons: ['Leave', 'Stay'],
      defaultId: 1,
      cancelId: 1,
    });
    if (choice === 0) event.preventDefault();
  };
}

module.exports = { confirmLeave };
