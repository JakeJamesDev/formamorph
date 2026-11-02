/**
 * Keeps a module behind its one way in. Each option is a boundary:
 * `module` is the file's base name, `names` limits the ban to those exports, `except` lists the paths under `src/`
 * it does not apply to, and `dynamicOnly` lists the paths that must name the module, through `import()` alone.
 */

/** A linted file's path under `src/`. */
export const srcPath = (filename) => `/${filename.replaceAll('\\', '/')}`.split('/src/').pop();

const namesModule = (source, module) => typeof source === 'string' && (source === module || source.endsWith(`/${module}`));

/** Whether a dynamic import's result can reach one of `names`: only a plain destructure of other names proves it can't. */
const dynamicReaches = (node, names) => {
  const declarator = node.parent.type === 'AwaitExpression' ? node.parent.parent : null;
  if (declarator?.type !== 'VariableDeclarator' || declarator.id.type !== 'ObjectPattern') return true;
  return declarator.id.properties.some((property) => property.type !== 'Property' || names.includes(property.key.name));
};

export const moduleBoundaryRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid reaching a module from outside its one way in.' },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          module: { type: 'string' },
          names: { type: 'array', items: { type: 'string' } },
          except: { type: 'array', items: { type: 'string' } },
          dynamicOnly: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
        required: ['module', 'reason'],
        additionalProperties: false,
      },
    },
    messages: {
      boundary: '{{module}}: {{reason}}',
      noLoad: 'This file must load {{module}} through import(): {{reason}}',
    },
  },
  create(context) {
    const path = srcPath(context.filename);
    const boundaries = context.options.filter(({ except = [] }) => !except.some((prefix) => path.startsWith(prefix)));
    const report = (node, { module, reason }) => context.report({ node, messageId: 'boundary', data: { module, reason } });
    const isLoader = (boundary) => boundary.dynamicOnly?.includes(path) ?? false;
    const loaded = new Set();

    /** A static form; `exported` is the name each specifier takes from the module, or null for the whole module. */
    const checkStatic = (node, exported) => {
      for (const boundary of boundaries) {
        if (!namesModule(node.source?.value, boundary.module)) continue;
        if (!boundary.names || exported === null || exported.some((name) => boundary.names.includes(name))) report(node, boundary);
      }
    };
    const specifierName = (specifier) => {
      if (specifier.type === 'ImportNamespaceSpecifier') return null;
      if (specifier.type === 'ImportDefaultSpecifier') return 'default';
      return specifier.imported?.name ?? specifier.local.name;
    };

    return {
      ImportDeclaration(node) {
        const names = node.specifiers.map(specifierName);
        checkStatic(node, names.includes(null) ? null : names);
      },
      ExportNamedDeclaration(node) {
        if (node.source) checkStatic(node, node.specifiers.map((specifier) => specifier.local.name));
      },
      ExportAllDeclaration: (node) => checkStatic(node, null),
      ImportExpression(node) {
        for (const boundary of boundaries) {
          if (!namesModule(node.source.value, boundary.module)) continue;
          if (isLoader(boundary)) loaded.add(boundary);
          else if (!boundary.names || dynamicReaches(node, boundary.names)) report(node, boundary);
        }
      },
      'Program:exit': (program) => {
        for (const boundary of boundaries) {
          if (!isLoader(boundary) || loaded.has(boundary)) continue;
          context.report({ node: program, messageId: 'noLoad', data: { module: boundary.module, reason: boundary.reason } });
        }
      },
    };
  },
};
