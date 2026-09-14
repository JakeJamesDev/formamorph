/**
 * The Bench's missing-source check: what this world's copies follow, what the last check said, and the one
 * action that asks again.
 *
 * The check never runs on its own. A world stays playable offline, so a source is reported gone only
 * because the author asked and the server gave a definite answer. The answer outlives the session in the
 * world's own record, which is also what the main menu gates a new game and a publish on.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WorldStorageService from '@/services/WorldStorageService';
import { runSourceCheck, type SourceCheckPorts } from '@/lib/sourceCheckRun';
import { readSourceCheck, writeSourceCheck, type SourceCheckRecord } from '@/lib/sourceCheckStore';
import {
  linkedSourceCopies, missingSources,
  type MissingSource, type SourceCheckWorld, type SourceCopy,
} from '@/lib/sourceChecks';
import { checkMissingSources } from './missingSources';
import type { CodeCheckStatus } from './benchProps';
import type { Finding } from './rules';

const PORTS: SourceCheckPorts = {
  dependencies: (worldSourceId) => WorldStorageService.fetchDependencies(worldSourceId),
  source: (listingId) => WorldStorageService.checkSource(listingId),
};

export interface SourceChecks {
  /** How far the on-demand check has got. */
  status: CodeCheckStatus;
  /** Every copy in the world that follows a published source — what a check would ask about. */
  copies: SourceCopy[];
  /** The copies the last check could not confirm, each with its answer. */
  missing: MissingSource[];
  /** Those copies as Issues rows. */
  findings: Finding[];
  /** When the last check ran, or '' when none has. */
  checkedAt: string;
  /** Ask again about every source. */
  run: () => void;
}

/**
 * @param world - The world as the editor holds it
 * @param worldId - The local world's id, which the record is kept under
 * @param worldSourceId - The listing this world was published or downloaded as, where it has one
 */
export function useSourceChecks(
  world: SourceCheckWorld, worldId: string | null | undefined, worldSourceId: string | undefined,
  ports: SourceCheckPorts = PORTS,
): SourceChecks {
  const [record, setRecord] = useState<SourceCheckRecord>(() => readSourceCheck(worldId));
  const [status, setStatus] = useState<CodeCheckStatus>(() => (readSourceCheck(worldId).checkedAt ? 'done' : 'idle'));
  useEffect(() => {
    const stored = readSourceCheck(worldId);
    setRecord(stored);
    setStatus(stored.checkedAt ? 'done' : 'idle');
  }, [worldId]);

  // Only the newest run may land: an author who asks twice must not have the first answer overwrite the
  // second when it finally arrives.
  const newest = useRef(0);
  useEffect(() => () => { newest.current += 1; }, []);

  const copies = useMemo(
    () => linkedSourceCopies(world, record.required),
    [world, record.required],
  );
  const missing = useMemo(() => missingSources(copies, record.results), [copies, record.results]);
  const findings = useMemo(() => checkMissingSources(copies, record.results), [copies, record.results]);

  const run = useCallback(() => {
    const ticket = ++newest.current;
    setStatus('running');
    void runSourceCheck(linkedSourceCopies(world, record.required), worldSourceId, ports, record.required)
      .then((next) => {
        if (ticket !== newest.current) return;
        writeSourceCheck(worldId, next);
        setRecord(next);
        setStatus('done');
      })
      // `runSourceCheck` answers its own failures, so reaching here means the run itself broke. Leaving the
      // button spinning would strand the author with no way to try again.
      .catch(() => { if (ticket === newest.current) setStatus('idle'); });
  }, [world, worldId, worldSourceId, record.required, ports]);

  return { status, copies, missing, findings, checkedAt: record.checkedAt, run };
}
