import { type ComponentProps, type CSSProperties } from "react";
import { ToastContainer } from "react-toastify";
import { useTheme } from "./theme-provider";

// Point react-toastify's per-type accent (icon + progress bar) at our design tokens, so toast colors are
// theme-driven. The icon/progress vars derive from these four base vars, so overriding them is enough. Set
// inline on the container (rather than in a stylesheet) so they beat react-toastify's `:root` defaults
// regardless of CSS import order, and cascade to the toasts inside. Each token flips per light/dark itself.
const TOAST_TOKEN_VARS = {
  "--toastify-color-success": "hsl(var(--success))",
  "--toastify-color-warning": "hsl(var(--warning))",
  "--toastify-color-info": "hsl(var(--info))",
  "--toastify-color-error": "hsl(var(--destructive))",
} as CSSProperties;

/**
 * A `ToastContainer` whose theme tracks the app's resolved light/dark theme (so toasts don't stay dark on a
 * light app) and whose per-type accents come from our design tokens. Forwards any other props.
 */
export function ThemedToastContainer(props: ComponentProps<typeof ToastContainer>) {
  const { resolvedTheme } = useTheme();
  return <ToastContainer {...props} theme={resolvedTheme} style={{ ...props.style, ...TOAST_TOKEN_VARS }} />;
}
