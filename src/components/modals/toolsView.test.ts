import { describe, it, expect } from 'vitest';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import { toolSummary } from './toolsView';

describe('toolSummary', () => {
  it('reads the recall Tool as a search that returns a few matches, not a full description', () => {
    const recall = TOOL_CATALOG.find((t) => t.id === 'recall')!;
    expect(toolSummary(recall)).toBe(
      'Searches past turns and diaries by query and returns up to 5 matches',
    );
  });
});
