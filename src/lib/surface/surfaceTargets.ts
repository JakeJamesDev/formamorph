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
  'settings.data': ['settings-mode', 'start-authoring-tour'],
  'settingsEndpoints.text': ['text-preset', 'endpoint-url'],
  mainMenu: ['app-version'],
  'mainMenu.worlds': ['import-world'],
  'mainMenu.entities': ['import-entity'],
  'mainMenu.dictionaries': ['import-dictionary'],
  'mainMenu.models': ['import-avatar'],
  menu: ['import-save'],
  backup: ['start-backup', 'start-restore'],
  avatar: ['finalize-character'],
  'worldEditor':['editor-mode', 'find-button'],
  'worldEditor.overview': ['thumbnail', 'background-music', 'custom-prompts'],
  'worldEditor.stats': ['list-toolbar'],
  'worldEditor.entities': ['list-toolbar'],
  'worldEditor.locations': ['list-toolbar'],
  'worldEditor.traits': ['list-toolbar'],
  'worldEditor.dictionary': ['list-toolbar'],
  'worldEditor.placeholders': ['list-toolbar'],
  'worldEditorBench.triggers': ['scene-text'],
  'worldEditorBench.opening': ['placeholder-rolls'],
  'formaquestion.ask': ['question-field', 'scroll-to-end'],
  'formaquestion.search': ['search-field'],
  'formaquestionSettings.general': [
    'mascot-switch', 'chat-style', 'mascot-position', 'backdrop', 'reasoning', 'keyword-search', 'semantic-search',
  ],
  'formaquestionSettings.endpoint': ['answer-endpoint'],
  'formaquestionSettings.prompts': ['preset'],
  'formaquestionSettings.tools': ['new-tool'],
  'formaquestionSettings.mascot': ['scale', 'mask'],
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

/** The row a route names. Of several, the one on screen wins: a layout can draw a control twice and hide one. */
export function findTargetRow(root: ParentNode, route: string): HTMLElement | null {
  const rows = Array.from(root.querySelectorAll<HTMLElement>(`[${TARGET_ATTRIBUTE}="${route}"]`));
  return rows.find((row) => row.getClientRects().length > 0) ?? rows[0] ?? null;
}

/** The data attribute for a control that is a registered target of its surface. */
export function targetAttribute<S extends TargetedSurface>(surface: S, target: SurfaceTarget<S>): TargetAttribute {
  return { [TARGET_ATTRIBUTE]: routeText(surface, target) };
}
