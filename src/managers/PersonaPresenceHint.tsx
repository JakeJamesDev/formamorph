import { Hint } from '@/components/ui/typography';

/** Why a Persona-Only entity and the Custom Persona have no Placement or Known In. */
export default function PersonaPresenceHint() {
  return <Hint>Plays as the player, so <b>Placement</b> and <b>Known In</b> don’t apply</Hint>;
}
