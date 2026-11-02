/**
 * States what one file must and must not name, for a contract no type can carry.
 * `renders` names JSX tags the file must render, `requires` names it must hold, and `forbids` names it must not.
 */
export const sourceContractRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require or forbid a name in a file.' },
    schema: [
      {
        type: 'object',
        properties: {
          renders: { type: 'array', items: { type: 'string' } },
          requires: { type: 'array', items: { type: 'string' } },
          forbids: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
        required: ['reason'],
        additionalProperties: false,
      },
    ],
    messages: {
      missing: 'This file must use {{name}}: {{reason}}',
      forbidden: 'This file must not use {{name}}: {{reason}}',
    },
  },
  create(context) {
    const { renders = [], requires = [], forbids = [], reason } = context.options[0];
    const rendered = new Set();
    const seen = new Set();
    const visit = (node) => {
      seen.add(node.name);
      if (forbids.includes(node.name)) context.report({ node, messageId: 'forbidden', data: { name: node.name, reason } });
    };
    return {
      Identifier: visit,
      JSXIdentifier: visit,
      JSXOpeningElement: (node) => rendered.add(node.name.name),
      'Program:exit': (program) => {
        for (const name of renders) {
          if (!rendered.has(name)) context.report({ node: program, messageId: 'missing', data: { name: `<${name}>`, reason } });
        }
        for (const name of requires) {
          if (!seen.has(name)) context.report({ node: program, messageId: 'missing', data: { name, reason } });
        }
      },
    };
  },
};
