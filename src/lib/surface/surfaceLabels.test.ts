import { describe, expect, it } from 'vitest';
import { SURFACE_EXCLUSIONS, SURFACE_IDS } from '@/lib/docs/surfaceMap';
import { UNREPORTED_SURFACES } from './surfaceReportChecks';
import { SURFACE_LABELS, surfaceLabel } from './surfaceLabels';

/** The ids that can reach a help request: players see them, and a component reports them. */
const REPORTING_IDS = SURFACE_IDS.filter((id) => SURFACE_EXCLUSIONS[id] === undefined && UNREPORTED_SURFACES[id] === undefined);

describe('surface labels', () => {
  it('labels every surface id that can report', () => {
    expect(REPORTING_IDS.filter((id) => !SURFACE_LABELS[id])).toEqual([]);
  });

  it('labels only ids that exist', () => {
    expect(Object.keys(SURFACE_LABELS).filter((id) => !(SURFACE_IDS as readonly string[]).includes(id))).toEqual([]);
  });

  it('reads the label as the tab shows it, not from the id', () => {
    expect(surfaceLabel('settings.display')).toBe('Display');
    expect(surfaceLabel('settingsEndpoints.tagPrompt')).toBe('Tag Prompt');
    expect(surfaceLabel('designSystemGroupPicker.picker')).toBe('Add To Group');
    expect(surfaceLabel('settingsPrompts.statupdates')).toBe('Stat Updates');
  });
});
