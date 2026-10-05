/**
 * The controls a surface offers as Take Me There targets. A guide route line names one as a fragment
 * (`settings.display#narration-layout`); the control carries the attribute `targetAttribute` returns.
 * Names are kebab-case and name the control, not its label.
 */
import type { SurfaceTargets } from '@/lib/docs/docsChecks';
import type { SurfaceId } from '@/lib/docs/surfaceMap';

export const SURFACE_TARGETS = {
  'settings.display': ['narration-layout', 'narration-font', 'quote-color'],
  'settings.output': ['thinking-mode'],
  'settings.data': ['settings-mode'],
  'settingsEndpoints.text': ['text-preset', 'endpoint-url'],
  mainMenu: ['app-version'],
  'mainMenu.worlds': ['import-world'],
  'mainMenu.entities': ['import-entity'],
  'mainMenu.dictionaries': ['import-dictionary'],
  'mainMenu.models': ['import-avatar'],
  menu: ['import-save'],
  backup: ['start-backup', 'start-restore'],
  avatar: ['finalize-character'],
} as const satisfies Partial<Record<SurfaceId, readonly string[]>>;

export type TargetedSurface = keyof typeof SURFACE_TARGETS;
export type SurfaceTarget<S extends TargetedSurface> = (typeof SURFACE_TARGETS)[S][number];

/** The attribute a target's row carries. Its value is the route text. */
export const TARGET_ATTRIBUTE = 'data-surface-target';

/** The attribute a target's row spreads. */
export type TargetAttribute = Readonly<Record<typeof TARGET_ATTRIBUTE, string>>;

/** Whether a surface registers this target. */
export function isSurfaceTarget(surface: string, target: string): boolean {
  return (SURFACE_TARGETS as SurfaceTargets)[surface]?.includes(target) ?? false;
}

/** A route as the guide writes it: `<surface>#<target>`, or the bare surface id. */
export function routeText(surface: string, target?: string): string {
  return target === undefined ? surface : `${surface}#${target}`;
}

/** The data attribute for a control that is a registered target of its surface. */
export function targetAttribute<S extends TargetedSurface>(surface: S, target: SurfaceTarget<S>): TargetAttribute {
  return { [TARGET_ATTRIBUTE]: routeText(surface, target) };
}
