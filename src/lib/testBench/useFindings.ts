import { useEffect, useState } from 'react';
import { runRules, type Finding, type RuleWorld } from './rules';

/** How still the world has to go before the rules run again. Long enough that typing a name never
 *  triggers a pass per keystroke, short enough that the badge answers while the edit is still fresh. */
const RULE_DEBOUNCE_MS = 400;

/**
 * The findings for `world`, recomputed once the author stops editing. Pass a value whose identity changes
 * only when the world data does — the editor's memoized payload — because that identity is what schedules
 * the pass. The first pass is synchronous, so the badge is right the moment the editor opens.
 */
export function useDebouncedFindings(world: RuleWorld, delayMs = RULE_DEBOUNCE_MS): Finding[] {
  const [computed, setComputed] = useState(() => ({ world, findings: runRules(world) }));
  useEffect(() => {
    if (computed.world === world) return;
    const timer = setTimeout(() => setComputed({ world, findings: runRules(world) }), delayMs);
    return () => clearTimeout(timer);
  }, [world, delayMs, computed.world]);
  return computed.findings;
}
