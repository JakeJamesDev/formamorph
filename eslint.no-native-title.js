/**
 * A `title` attribute on a DOM element is the browser's own tooltip: it waits about a second, paints in
 * the operating system's colors rather than the app's, and in most browsers never opens for a keyboard
 * user at all. `Tip` (src/components/ui/tooltip.tsx) replaces it — themed, focus-aware, and it applies
 * its text as the control's accessible name, which is the one thing `title` did give for free.
 *
 * Only DOM elements are restricted. A component prop named `title` is that component's own API.
 */

/** Elements where `title` is a documented accessible name, not a hover hint. */
const TITLE_IS_A_NAME = ['iframe', 'svg', 'g', 'path', 'circle', 'rect'];

/**
 * Components that spread their unknown props onto a DOM element, so a `title` handed to one is still the
 * browser tooltip — the capital letter hides it. A component with a `title` prop of its own (a heading,
 * a dialog name) is not in this list and stays allowed.
 */
const DOM_PASSTHROUGH_COMPONENTS = [
  'Button', // src/components/ui/button.tsx — spreads onto <button>, or onto its asChild slot
  'ToggleGroupItem', // src/components/ui/toggle-group.tsx — spreads onto the Radix item
  'Checkbox', // src/components/ui/checkbox.tsx — spreads onto the Radix root
  'RemoteImg', // src/lib/useRemoteImage.tsx — spreads onto <img>
  'Handle', // @xyflow/react
  'ControlButton', // @xyflow/react
];

export const noNativeTitleRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid the native `title` tooltip on DOM elements; use <Tip> instead.' },
    schema: [],
    messages: {
      nativeTitle:
        '`title` on <{{name}}> is the browser tooltip: unthemed, slow, and invisible to keyboard users. '
        + 'Wrap the element in <Tip tip="…"> from @/components/ui/tooltip. If the string was only ever an '
        + 'accessible name, use `aria-label` instead.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!node.name || node.name.type !== 'JSXIdentifier' || node.name.name !== 'title') return;
        const element = node.parent;
        if (!element || element.type !== 'JSXOpeningElement') return;
        const name = element.name;
        if (name.type !== 'JSXIdentifier') return;
        const isDom = /^[a-z]/.test(name.name);
        if (isDom && TITLE_IS_A_NAME.includes(name.name)) return;
        if (!isDom && !DOM_PASSTHROUGH_COMPONENTS.includes(name.name)) return;
        context.report({ node, messageId: 'nativeTitle', data: { name: name.name } });
      },
    };
  },
};
