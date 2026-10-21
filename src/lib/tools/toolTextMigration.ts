/** The load-time rewrite of a user Tool script's retired `world` and `scene` reads (spec: Migrations). */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode, Tree } from '@lezer/common';
import { spliced, type CodeSplice } from '@/lib/statCodeRename';
import { children } from '@/lib/statLookupMigration';
import { declaredNames, memberKey } from '@/lib/codeTreeNames';
import { NO_CONTEXT, SCRIPT_TEXT_REWRITES } from '@/lib/scriptTextMigration';

/** The property `node` reads with a plain dot, or null for any other member access. */
function dotStep(node: SyntaxNode, code: string): string | null {
  const [, op, property, ...rest] = children(node);
  return !rest.length && op?.name === '.' && property?.name === 'PropertyName' ? code.slice(property.from, property.to) : null;
}

/** Whether `a` and `b` are the same node. */
const same = (a: SyntaxNode | null | undefined, b: SyntaxNode) => !!a && a.from === b.from && a.to === b.to && a.name === b.name;

/** The member expression that reads a member off `node`, or null. */
const readOff = (node: SyntaxNode): SyntaxNode | null => (node.parent?.name === 'MemberExpression' && same(node.parent.firstChild, node) ? node.parent : null);

/** The call that calls `node`, or null. */
const callOf = (node: SyntaxNode): SyntaxNode | null => (node.parent?.name === 'CallExpression' && same(node.parent.firstChild, node) ? node.parent : null);

/** Each `<global>.<member>` read in the script, the global read by name. */
function memberReads(tree: Tree, code: string, global: string): SyntaxNode[] {
  const reads: SyntaxNode[] = [];
  tree.iterate({
    enter: (ref) => {
      if (ref.name !== 'MemberExpression') return true;
      const object = ref.node.firstChild;
      if (object?.name !== 'VariableName' || code.slice(object.from, object.to) !== global) return true;
      reads.push(ref.node);
      return false;
    },
  });
  return reads;
}

/** One `scene.<member>` read's exact new form, or null to keep it, as also when the script declares the new name. */
function sceneSplice(root: SyntaxNode, code: string, declared: ReadonlySet<string>): CodeSplice | null {
  const outer = readOff(root);
  const step = outer && dotStep(outer, code);
  switch (dotStep(root, code)) {
    case 'notes':
      return declared.has('notes') ? null : { from: root.from, to: root.to, insert: 'notes' };
    case 'time':
      return outer && step === 'elapsed' && !declared.has('clock') ? { from: outer.from, to: outer.to, insert: 'clock.elapsedHours' } : null;
    case 'location':
      return outer && (step === 'id' || step === 'name') && !declared.has('location') ? { from: outer.from, to: outer.to, insert: `location.${step}` } : null;
    case 'stats': {
      if (!outer || callOf(outer) || declared.has('stats')) return null;
      const key = memberKey(outer, code);
      if (!key) return null;
      // A literal key keeps the author's quotes.
      const written = outer.getChild('PropertyName') ? `.${key.name}` : `[${code.slice(key.from, key.to)}]`;
      return { from: outer.from, to: outer.to, insert: `stats${written}.value` };
    }
    default:
      return null;
  }
}

/** Each retired `world` list: its new form, the globals that form reads, and the fields an old item had, `placeholders`
 *  left out since the new entry's differ. */
const WORLD_LISTS: Readonly<Record<string, { insert: string; reads: readonly string[]; fields: ReadonlySet<string> }>> = {
  entities: { insert: 'Object.values(entities)', reads: ['Object', 'entities'], fields: new Set(['id', 'name', 'aliases', 'type', 'pronouns', 'description', 'summary']) },
  locations: { insert: 'Object.values(locations)', reads: ['Object', 'locations'], fields: new Set(['id', 'name', 'description', 'summary']) },
  // `world.dictionary` has none: a book's entry map drops an unnamed entry and all but the last of a shared name (Q55).
};

/** List methods whose result still holds the list's items. */
const KEEPS_ITEMS = new Set(['filter', 'find', 'findLast', 'at', 'slice', 'sort', 'toSorted', 'reverse', 'toReversed', 'concat', 'flat']);
/** List members whose result holds no item. */
const DROPS_ITEMS = new Set(['length', 'some', 'every', 'findIndex', 'findLastIndex', 'indexOf', 'lastIndexOf', 'includes', 'join', 'forEach']);
/** List methods whose result is what their callback returns. */
const MAPS_ITEMS = new Set(['map', 'flatMap']);
/** List methods that pass each item to a callback. */
const TAKES_CALLBACK = new Set(['filter', 'find', 'findLast', 'findIndex', 'findLastIndex', 'some', 'every', 'forEach', 'map', 'flatMap', 'sort', 'toSorted']);

/** Whether no item of the lists at `sources` leaves the script whole, and only an old item's fields are read (Q52).
 *  Any use the walk does not know counts as leaving. */
function itemsStayInside(sources: readonly SyntaxNode[], tree: Tree, code: string, fields: ReadonlySet<string>): boolean {
  const names = new Set<string>();
  const pending = [...sources];
  const holdName = (definition: SyntaxNode | null | undefined): boolean => {
    if (definition?.name !== 'VariableDefinition') return false;
    const name = code.slice(definition.from, definition.to);
    if (names.has(name)) return true;
    names.add(name);
    // A name is held by text everywhere, which is stricter than its scope.
    tree.iterate({ enter: (ref) => { if (ref.name === 'VariableName' && code.slice(ref.from, ref.to) === name) pending.push(ref.node); } });
    return true;
  };
  const callbackHolds = (call: SyntaxNode): boolean => {
    const [fn] = children(call.getChild('ArgList')!).filter((node) => !['(', ')', ','].includes(node.name));
    // No callback, as in `sort()`, passes no item anywhere; a named function has no parameter list here, so it fails.
    if (!fn) return true;
    const params = fn.name === 'ArrowFunction' || fn.name === 'FunctionExpression' ? fn.getChild('ParamList') : null;
    return !!params && children(params).filter((node) => !['(', ')', ','].includes(node.name)).every(holdName);
  };
  /** Whether the value at `node`, which may hold an item, goes nowhere it could leave from. */
  const staysAt = (node: SyntaxNode): boolean => {
    const parent = node.parent;
    if (!parent) return true;
    switch (parent.name) {
      case 'ParenthesizedExpression':
        return staysAt(parent);
      case 'MemberExpression': {
        if (!same(parent.firstChild, node)) return false;
        const key = memberKey(parent, code);
        // A key only a run knows, as in `list[i]`, picks an item.
        if (!key) return staysAt(parent);
        if (!parent.getChild('PropertyName')) return fields.has(key.name);
        const step = key.name;
        if (fields.has(step) || step === 'length') return true;
        const call = callOf(parent);
        if (!call) return false;
        if (TAKES_CALLBACK.has(step) && !callbackHolds(call)) return false;
        if (KEEPS_ITEMS.has(step)) return staysAt(call);
        return DROPS_ITEMS.has(step) || MAPS_ITEMS.has(step);
      }
      case 'ArrowFunction': {
        // An arrow's expression body: what a callback returns.
        if (!same(parent.lastChild, node)) return false;
        const call = parent.parent?.parent;
        if (call?.name !== 'CallExpression' || call.firstChild?.name !== 'MemberExpression') return false;
        const method = memberKey(call.firstChild, code)?.name;
        if (method === undefined || !TAKES_CALLBACK.has(method)) return false;
        return MAPS_ITEMS.has(method) ? staysAt(call) : true;
      }
      case 'BinaryExpression':
        // `a || b` can be an item and `in` reads its keys; any other operator reads it as a string or a number, alike.
        if (parent.getChild('in') || parent.getChild('instanceof')) return false;
        return parent.getChild('LogicOp') ? staysAt(parent) : true;
      case 'ConditionalExpression':
        return same(parent.firstChild, node) || staysAt(parent);
      case 'UnaryExpression': case 'Interpolation': case 'ExpressionStatement':
      case 'IfStatement': case 'WhileStatement': case 'DoStatement':
        return true;
      case 'VariableDeclaration':
        return node.prevSibling?.name === 'Equals' && holdName(node.prevSibling.prevSibling);
      case 'ForOfSpec':
        return node.prevSibling?.name === 'of' && holdName(parent.getChild('VariableDefinition'));
      default:
        return false;
    }
  };
  for (let node = pending.pop(); node; node = pending.pop()) if (!staysAt(node)) return false;
  return true;
}

/** The splices for every `world.<list>` read, each list rewritten only where its items stay inside (Q52). */
function worldSplices(tree: Tree, code: string, declared: ReadonlySet<string>): CodeSplice[] {
  const reads = memberReads(tree, code, 'world');
  return Object.entries(WORLD_LISTS).flatMap(([list, { insert, reads: uses, fields }]) => {
    const sources = reads.filter((read) => dotStep(read, code) === list);
    if (!sources.length || uses.some((name) => declared.has(name)) || !itemsStayInside(sources, tree, code, fields)) return [];
    return sources.map((read) => ({ from: read.from, to: read.to, insert }));
  });
}

/** Rewrite a user Tool script's retired `world` and `scene` reads where the new form reads exactly the same (Q28). */
export function migrateToolSurfaceReads(code: string): string {
  if (!code.includes('scene') && !code.includes('world')) return code;
  const tree = javascriptLanguage.parser.parse(code);
  const declared = declaredNames(code, tree);
  const edits: CodeSplice[] = [
    ...(declared.has('scene') ? [] : memberReads(tree, code, 'scene').flatMap((read) => sceneSplice(read, code, declared) ?? [])),
    ...(declared.has('world') ? [] : worldSplices(tree, code, declared)),
  ];
  return edits.length ? spliced(code, edits) : code;
}

/** A user Tool script's text with the world scripts' rewrites and its own applied. Settings load and every Tool import
 *  pass through it. */
export const migrateUserToolScript = (code: string): string =>
  // Read at the call: the world pass's module is still loading when an import cycle reaches this one.
  migrateToolSurfaceReads(SCRIPT_TEXT_REWRITES.reduce((out, rewrite) => rewrite(out, NO_CONTEXT), code));
