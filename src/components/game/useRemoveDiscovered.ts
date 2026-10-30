import { useGameplay } from '@/contexts/GameplayContext';

/** Takes an invented character out of the game by name. */
export function useRemoveDiscovered() {
  const { setDiscoveredEntities, setSuppressedCharacterNames, setVisibleEntities } = useGameplay();
  return (name: string) => {
    // Suppression is what makes the deletion stick: without it the next turn naming them promotes
    // them straight back.
    setDiscoveredEntities((prev) => prev.filter((d) => d.entity.name !== name));
    setSuppressedCharacterNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
    // Also drop them from the live scene list, or the row lingers as a dead, unopenable entry that
    // no longer resolves to any entity.
    setVisibleEntities((prev) => prev.filter((se) => se.name !== name));
  };
}
