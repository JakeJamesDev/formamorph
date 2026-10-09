/** Watches the page for two open alert dialogs at once, at every DOM change, not only after a render settles. */
export function watchStackedAlerts() {
  let stacked = false;
  const observer = new MutationObserver(() => {
    if (document.querySelectorAll('[role="alertdialog"][data-state="open"]').length > 1) stacked = true;
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
  return {
    /** Stops watching and says whether two were ever open together. */
    stop: () => {
      observer.disconnect();
      return stacked;
    },
  };
}
