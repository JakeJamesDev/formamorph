/**
 * A Radix `asChild` trigger renders through Slot, which hands its child a ref. A child that doesn't
 * forward one leaves the control half-dead: React logs a ref warning and nothing else, typecheck can't
 * see it because `asChild` puts no constraint on the child, and it can work under a mouse while failing
 * on touch. That shipped once — the main menu's hamburger took a plain-function GradientButton and
 * stopped opening on a phone.
 *
 * Native elements always accept a ref, so only component children are restricted.
 */

/** Components verified to forward their ref. Adding a name here is a promise that it does. */
export const REF_SAFE_ASCHILD_CHILDREN = [
  'Button', // src/components/ui/button.tsx
  'GradientButton',
  'WorldActionButton',
  // lucide-react icons forward refs
  'ChevronDown',
];

export const asChildForwardRefRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require components used under `asChild` to forward their ref.' },
    schema: [],
    messages: {
      unforwarded:
        '<{{name}}> is used under `asChild`, so Radix Slot passes it a ref. Wrap it in React.forwardRef '
        + '(and pass the ref down), then add it to REF_SAFE_ASCHILD_CHILDREN in eslint.aschild-forwardref.js. '
        + 'Without it the trigger can silently stop working — typecheck will not catch it.',
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        const hasAsChild = node.openingElement.attributes.some(
          (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'asChild',
        );
        if (!hasAsChild) return;

        for (const child of node.children) {
          if (child.type !== 'JSXElement') continue;
          const name = child.openingElement.name;
          // Member expressions (`Primitive.Icon`) are namespaced Radix parts, already ref-forwarding.
          if (name.type !== 'JSXIdentifier') continue;
          if (!/^[A-Z]/.test(name.name)) continue;
          if (REF_SAFE_ASCHILD_CHILDREN.includes(name.name)) continue;

          context.report({
            node: child.openingElement,
            messageId: 'unforwarded',
            data: { name: name.name },
          });
        }
      },
    };
  },
};
