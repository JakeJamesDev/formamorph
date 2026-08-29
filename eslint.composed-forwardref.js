/**
 * Two composition props hand a child element the ref for the control they replace: Radix's `asChild`,
 * which renders through Slot, and Base UI's `render`, which clones the element it is given. A child that
 * doesn't forward that ref leaves the control half-dead: React logs a ref warning and nothing else,
 * typecheck can't see it because neither prop puts a constraint on the child, and it can work under a
 * mouse while failing on touch. That shipped once — the main menu's hamburger took a plain-function
 * GradientButton and stopped opening on a phone.
 *
 * Native elements always accept a ref, so only component children are restricted.
 */

/** Components verified to forward their ref. Adding a name here is a promise that it does. */
export const REF_SAFE_COMPOSED_CHILDREN = [
  'Button', // src/components/ui/button.tsx
  'GradientButton',
  'WorldActionButton',
  'TokenChip', // src/components/prompt/TokenChip.tsx
  'ToggleGroupItem', // src/components/ui/toggle-group.tsx
  'TabsTrigger', // src/components/ui/tabs.tsx
  'Checkbox', // src/components/ui/checkbox.tsx
  // Radix triggers forward their ref, and pass anything else they are handed down through their own
  // `asChild` — which is how a tip and a popover share one button.
  'PopoverTrigger',
  // lucide-react icons forward refs
  'ChevronDown',
  // Radix's own Slot — merging the ref it is handed into its child is the whole job.
  'Slot',
];

/** Components that pass their single child straight to a composition prop, so the child is the trigger. */
const RENDER_CHILD_COMPONENTS = ['Tip']; // src/components/ui/tooltip.tsx

/** Every component child of `node` that isn't known to forward its ref. */
function unsafeChildElements(node) {
  return node.children.filter((child) => {
    if (child.type !== 'JSXElement') return false;
    const name = child.openingElement.name;
    // Member expressions (`Primitive.Icon`) are namespaced library parts, already ref-forwarding.
    if (name.type !== 'JSXIdentifier') return false;
    if (!/^[A-Z]/.test(name.name)) return false;
    return !REF_SAFE_COMPOSED_CHILDREN.includes(name.name);
  });
}

export const composedForwardRefRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require components composed through `asChild` or `render` to forward their ref.' },
    schema: [],
    messages: {
      unforwarded:
        '<{{name}}> is composed through `{{prop}}`, so it is handed a ref. Wrap it in React.forwardRef '
        + '(and pass the ref down), then add it to REF_SAFE_COMPOSED_CHILDREN in eslint.composed-forwardref.js. '
        + 'Without it the control can silently stop working — typecheck will not catch it.',
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        const name = node.openingElement.name;
        const isRenderChildComponent =
          name.type === 'JSXIdentifier' && RENDER_CHILD_COMPONENTS.includes(name.name);
        const hasAsChild = node.openingElement.attributes.some(
          (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'asChild',
        );
        if (!isRenderChildComponent && !hasAsChild) return;

        for (const child of unsafeChildElements(node)) {
          context.report({
            node: child.openingElement,
            messageId: 'unforwarded',
            data: { name: child.openingElement.name.name, prop: hasAsChild ? 'asChild' : 'render' },
          });
        }
      },
      // Base UI: `render={<Foo />}` replaces the part's own element with Foo.
      JSXAttribute(node) {
        if (!node.name || node.name.name !== 'render') return;
        const value = node.value;
        if (!value || value.type !== 'JSXExpressionContainer') return;
        const element = value.expression;
        if (element.type !== 'JSXElement') return;
        const name = element.openingElement.name;
        if (name.type !== 'JSXIdentifier') return;
        if (!/^[A-Z]/.test(name.name)) return;
        if (REF_SAFE_COMPOSED_CHILDREN.includes(name.name)) return;
        context.report({
          node: element.openingElement,
          messageId: 'unforwarded',
          data: { name: name.name, prop: 'render' },
        });
      },
    };
  },
};
