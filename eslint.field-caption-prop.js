/**
 * A multi-line field draws its own caption into the row it shares with undo and redo. A sibling `<Label>` puts the
 * caption on its own line and leaves that row holding only the two history buttons.
 */
const MULTI_LINE_FIELDS = ['PlaceholderField', 'PromptField'];

const isWhitespace = (node) => node.type === 'JSXText' && node.value.trim() === '';

export const fieldCaptionPropRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Caption a multi-line field with its label prop, not a sibling Label.' },
    schema: [],
    messages: { siblingLabel: 'Caption <{{name}}> with its label prop, not a sibling <Label>.' },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (node.openingElement.name.name !== 'Label' || !node.parent.children) return;
        const siblings = node.parent.children;
        const next = siblings.slice(siblings.indexOf(node) + 1).find((sibling) => !isWhitespace(sibling));
        const name = next?.type === 'JSXElement' ? next.openingElement.name.name : undefined;
        if (MULTI_LINE_FIELDS.includes(name)) context.report({ node, messageId: 'siblingLabel', data: { name } });
      },
    };
  },
};
