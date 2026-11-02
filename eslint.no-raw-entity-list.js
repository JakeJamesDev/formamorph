/**
 * In play, entities come from `useResolvedWorld`, which owns the placed and resolved cast. The authored list in
 * GameData skips that, so a reader of it shows the world as written rather than as played.
 */
const isUseGameData = (node) => node?.type === 'CallExpression' && node.callee.name === 'useGameData';

export const noRawEntityListRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid reading the authored entity list in play.' },
    schema: [],
    messages: {
      rawEntities: 'In play, read entities from useResolvedWorld, never the authored list.',
    },
  },
  create(context) {
    // `gameData` is the name the code gives the hook's result; a handle may be declared below its read.
    const handles = new Set(['gameData']);
    const reads = [];
    const report = (node) => context.report({ node, messageId: 'rawEntities' });
    return {
      VariableDeclarator(node) {
        if (!isUseGameData(node.init)) return;
        if (node.id.type === 'Identifier') handles.add(node.id.name);
        if (node.id.type !== 'ObjectPattern') return;
        for (const property of node.id.properties) {
          if (property.type === 'Property' && property.key.name === 'entities') report(property);
        }
      },
      MemberExpression(node) {
        if (node.property.name !== 'entities') return;
        if (isUseGameData(node.object)) report(node);
        else reads.push(node);
      },
      CallExpression(node) {
        if (node.callee.name === 'useResolvedAuthoredWorld') report(node);
      },
      'Program:exit': () => {
        for (const node of reads) {
          if (handles.has(node.object.property?.name ?? node.object.name)) report(node);
        }
      },
    };
  },
};
