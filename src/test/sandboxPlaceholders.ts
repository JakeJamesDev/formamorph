import type { SandboxPlaceholderNode } from '@/lib/statCodeExecutor';

/**
 * One node of a sandbox `placeholders` map as a test writes it. A spec with no `value` is an owner node,
 * which carries no entry at all. Everything else is filled in from `value`, so a flat Wildcard is one word.
 */
export interface PhNodeSpec {
  name: string;
  /** What is in force: one text on a Wildcard or a Variable, a list on an Object. Absent on an owner node. */
  value?: string | string[];
  /** Every authored value. Defaults to `value` as a list. */
  values?: readonly string[];
  /** Defaults to `value`, a list joined with `", "`. */
  text?: string;
  roll?: () => string;
  /** Defaults to `ph:` and the node's path — legible in a write, and deliberately not the name itself, so a
   *  caller that keys the wrong one of the two fails rather than passing by coincidence. */
  id?: string;
  children?: readonly PhNodeSpec[];
}

/** The placeholder id `phMap` mints for one path — for an assertion against a pin a run wrote. */
export const phNodeId = (path: readonly string[]): string => `ph:${path.join('.')}`;

/** A whole map from its specs, with every node's path filled in from the keys walked to reach it. */
export function phMap(specs: readonly PhNodeSpec[], prefix: readonly string[] = []): SandboxPlaceholderNode[] {
  return specs.map((spec) => {
    const path = [...prefix, spec.name];
    const { value } = spec;
    const entry = value === undefined ? undefined : {
      id: spec.id ?? phNodeId(path),
      value,
      values: spec.values ?? (Array.isArray(value) ? value : [value]),
      text: spec.text ?? (Array.isArray(value) ? value.join(', ') : value),
      roll: spec.roll ?? (() => (Array.isArray(value) ? value[0] ?? '' : value)),
    };
    return { name: spec.name, path, ...(entry ? { entry } : {}), children: phMap(spec.children ?? [], path) };
  });
}

/** One top-level Wildcard entry, for a test that needs a map and nothing about its shape. */
export const phNode = (name: string, value: string | string[], roll?: () => string): SandboxPlaceholderNode =>
  phMap([{ name, value, roll }])[0];

const asPath = (at: string | readonly string[]) => (typeof at === 'string' ? [at] : at);

/** The write a run reports for the entry at one path, as `phMap` names it. */
export const phWrite = (at: string | readonly string[], value: string | string[]) =>
  ({ id: phNodeId(asPath(at)), path: asPath(at), value });

/** The release a run reports for the entry at one path. */
export const phUnpin = (at: string | readonly string[]) =>
  ({ id: phNodeId(asPath(at)), path: asPath(at), unpin: true });
