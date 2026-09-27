import { useTraitStore } from '@/contexts/TraitStoreContext';
import { CUSTOM_PERSONA_ID, customPersonaEntity, customPersonaFrom } from '@/lib/traitTree';
import type { Entity } from '@/types';

/** Edit a bearer node by id: an entity, or Custom Persona's node, which reads and writes as one. */
export function useEditBearer(): (id: string, edit: (entity: Entity) => Entity) => void {
  const { editEntity, setCustomPersona } = useTraitStore();
  return (id, edit) => {
    if (id !== CUSTOM_PERSONA_ID) editEntity(id, edit);
    else setCustomPersona?.((prev) => prev && customPersonaFrom(edit(customPersonaEntity(prev))));
  };
}
