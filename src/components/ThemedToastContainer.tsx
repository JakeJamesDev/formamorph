import { type ComponentProps, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ToastContainer, type ToastClassName } from "react-toastify";
import { useTheme } from "./theme-provider";

// Point react-toastify's colors at our design tokens, so toasts are theme-driven. Set inline on the
// container (rather than in a stylesheet) so they beat react-toastify's `:root` defaults regardless of CSS
// import order, and cascade to the toasts inside. Each token flips per light/dark itself.
const TOAST_TOKEN_VARS = {
  // Per-type accent (icon + progress bar); the icon/progress vars derive from these four.
  "--toastify-color-success": "hsl(var(--success))",
  "--toastify-color-warning": "hsl(var(--warning))",
  "--toastify-color-info": "hsl(var(--info))",
  "--toastify-color-error": "hsl(var(--destructive))",
  // A default-type toast's progress bar has its own vars (library defaults: purple in dark, a rainbow
  // gradient in light) that don't derive from the four above.
  "--toastify-color-progress-dark": "hsl(var(--primary))",
  "--toastify-color-progress-light": "hsl(var(--primary))",
  // The panel itself, so a toast reads as one of our floating surfaces rather than a flat neutral.
  "--toastify-color-dark": "hsl(var(--popover))",
  "--toastify-color-light": "hsl(var(--popover))",
  "--toastify-text-color-dark": "hsl(var(--popover-foreground))",
  "--toastify-text-color-light": "hsl(var(--popover-foreground))",
} as CSSProperties;

// react-toastify gives the panel a shadow but no border, where our popovers carry one. A raw string is
// cx'ed onto the library's own classes, so this adds to them rather than replacing them.
const TOAST_BORDER = "border border-border";

/** Merge our border onto a caller's `toastClassName`, which may itself be a string or a builder function. */
const withBorder = (caller?: ToastClassName): ToastClassName =>
  typeof caller === "function"
    ? (context) => `${caller(context)} ${TOAST_BORDER}`
    : [caller, TOAST_BORDER].filter(Boolean).join(" ");

/**
 * A `ToastContainer` whose theme tracks the app's resolved light/dark theme (so toasts don't stay dark on a
 * light app) and whose panel and accents come from our design tokens. Forwards any other props.
 *
 * Portaled to `body` so it shares the root stacking context with Radix's dialog portals — rendered inside a
 * view's own tree, its z-index is trapped below them and toasts hide behind full-screen dialogs.
 */
export function ThemedToastContainer(props: ComponentProps<typeof ToastContainer>) {
  const { resolvedTheme } = useTheme();
  return createPortal(
    <ToastContainer
      {...props}
      theme={resolvedTheme}
      style={{ ...props.style, ...TOAST_TOKEN_VARS }}
      toastClassName={withBorder(props.toastClassName)}
    />,
    document.body,
  );
}
