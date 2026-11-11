const OPEN_DIALOGS = '[role="dialog"]:not([aria-modal="false"]):not([data-state="closed"]), [role="alertdialog"]:not([data-state="closed"])';

/** The modal dialogs open anywhere in the document. Radix gives a popover the dialog role, and it is not one. */
export const openModals = (): Element[] =>
  [...document.querySelectorAll(OPEN_DIALOGS)].filter((dialog) => !dialog.closest('[data-radix-popper-content-wrapper]'));
