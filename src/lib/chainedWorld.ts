import type { SandboxMemory, WorldWrites } from './statCodeExecutor';
import type { SandboxState } from './statCodeTurn';
import { applyEntityCodeWrites } from './entityFollowing';
import { sameCharacterName } from './entityMatch';
import { dayAndHour, daypart, FLAT_HOURS_PER_TURN } from './gameClock';
import { startsMet } from './presence';
import { materializeDiscoveredEntity } from './runtimeCharacters';
import { baseWritesOf } from './worldWrites';
import { isScriptPinOf, pinId } from './scriptPins';

/** The id a turn's own digest row carries when the state names no turn. */
const FALLBACK_TURN_ID = 'turn';

/** `rows` with each verb of `writes` laid on its row, as the Memory Manager's buttons settle it. */
function withMemoryVerbs(rows: readonly SandboxMemory[], writes: NonNullable<WorldWrites['memoryWrites']>): readonly SandboxMemory[] {
  let out = rows;
  for (const write of writes) {
    out = out.flatMap((row): SandboxMemory[] => {
      if (row.id !== write.id) return [row];
      switch (write.kind) {
        case 'remove': return [];
        case 'forget': return [{ ...row, pinned: false, forgotten: true, kept: false }];
        case 'pin': return [{ ...row, pinned: true, forgotten: false, kept: true }];
        case 'edit': return [write.custom ? { ...row, text: write.text } : { ...row, text: write.text, pinned: true, forgotten: false, kept: true }];
      }
    });
  }
  return out;
}

/**
 * `state` as the next script reads it after `writes`. A `memories.add` line joins the turn's digest row and a
 * `memories.pin` line is a Custom row under its commit-time note id, so a later row verb resolves at commit.
 */
export function withWorldWrites(state: SandboxState, writes: WorldWrites | undefined): SandboxState {
  if (!writes) return state;
  let next = state;

  const picks = baseWritesOf(writes);
  if (picks && next.bodies) {
    next = { ...next, bodies: { ...next.bodies, world: { ...next.bodies.world, basePicks: { ...next.bodies.world.basePicks, ...picks } } } };
  }

  const { places } = next;
  const place = writes.location === undefined ? undefined : places?.locations.find((at) => at.id === writes.location);
  if (places && place) next = { ...next, places: { ...places, location: { id: place.id, name: place.name } } };

  // Each advance moves the turn's end and its length together, so `previous` keeps the turn's start.
  if (writes.minutes !== undefined) {
    const { clock } = next;
    const delta = clock.deltaHours ?? FLAT_HOURS_PER_TURN;
    const advanced = (clock.advancedHours ?? 0) + writes.minutes / 60;
    // The advances replace the turn's own duration, as the commit lands them.
    next = { ...next, clock: { ...clock, advancedHours: advanced, deltaHours: advanced, elapsedHours: (clock.elapsedHours ?? delta) - delta + advanced } };
  }

  if (writes.memory?.length || writes.pins?.length || writes.memoryWrites?.length) {
    let rows = next.memories ?? [];
    const turnId = next.turn?.id ?? FALLBACK_TURN_ID;
    const timestamp = next.clock.elapsedHours ?? next.clock.deltaHours ?? FLAT_HOURS_PER_TURN;
    const { day, hour } = dayAndHour(timestamp, next.clock.calendar);
    const row = (id: string, text: string, custom: boolean): SandboxMemory => ({
      id, turn: next.turn?.number ?? 0, timestamp, day, daypart: daypart(hour, next.clock.calendar), text, custom,
      kept: true, inContext: true, pinned: false, forgotten: false,
    });
    if (writes.memory?.length) {
      const lines = writes.memory.join(' ');
      rows = rows.some((held) => held.id === turnId)
        ? rows.map((held) => (held.id === turnId ? { ...held, text: [held.text, lines].filter(Boolean).join(' ') } : held))
        : [...rows, row(turnId, lines, false)];
    }
    const heldPins = rows.filter((held) => isScriptPinOf(held.id, turnId)).length;
    rows = [...rows, ...(writes.pins ?? []).map((line, i) => row(pinId(turnId, heldPins + i), line, true))];
    if (writes.memoryWrites?.length) rows = withMemoryVerbs(rows, writes.memoryWrites);
    next = { ...next, memories: rows };
  }

  // A described discovery is a character at once, named as the diary and the moves name it: by its name.
  const described = (writes.discover ?? []).filter((found) => found.description !== undefined);
  if (described.length) {
    const { ownerTraits } = next;
    const known = [...ownerTraits.entities ?? [], ...ownerTraits.library ?? []];
    let discovered = [...ownerTraits.discovered ?? []];
    for (const { name, description } of described) {
      if (known.some((held) => sameCharacterName(held.name, name))) continue;
      const entity = materializeDiscoveredEntity(name, description ?? '', name.trim());
      const at = discovered.findIndex((held) => sameCharacterName(held.name, name));
      // Only a character an earlier script of the chain made takes a new description.
      if (at < 0) discovered = [...discovered, entity];
      else if (discovered[at].id === entity.id) discovered = discovered.map((held, i) => (i === at ? entity : held));
    }
    next = { ...next, ownerTraits: { ...ownerTraits, discovered } };
  }

  if (writes.entities?.length) {
    const moved = applyEntityCodeWrites(
      { positions: next.positions ?? {}, followers: next.followers ?? [] }, writes.entities, next.places?.location?.id,
    );
    next = { ...next, positions: moved.positions, followers: moved.followers };
    const meets = writes.entities.flatMap((write) => (write.kind === 'meet' ? [write.entity] : []));
    if (meets.length) {
      const { ownerTraits } = next;
      const cast = [...ownerTraits.entities ?? [], ...ownerTraits.library ?? []];
      const met = ownerTraits.metIds ?? cast.filter((entity) => startsMet(entity, null, [])).map((entity) => entity.id);
      next = { ...next, ownerTraits: { ...ownerTraits, metIds: [...new Set([...met, ...meets])] } };
    }
  }
  return next;
}
