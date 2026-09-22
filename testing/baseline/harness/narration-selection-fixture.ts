import rawWorld from '../sedge-landing.json';
import { migrateWorld } from '@/lib/version';
import { MAIN_ACTION } from './narration-tool-call-probe';

export const SELECTION_DESCRIPTIONS = {
  A: `Purpose: Retrieve an entity's full authored entry. Entity summaries help you select what to include in the scene.
Use when: Before mentioning a selected entity in narration, whether by name or indirect reference, unless its full entry is already in context.
Input: name — the entity's name from the entity list.
Output: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching entity was found.`,
  B: `Purpose: Retrieve an entity's full authored entry. Entity summaries help you select what to include in the scene.
Use when: Before using an entity in your upcoming narration, including as a background presence or through an indirect reference, unless its full entry is already in context.
Input: name — the entity's name from the entity list.
Output: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching entity was found.`,
};

export const INCLUSION_DESCRIPTION = `Purpose: Retrieve the full authored information needed to narrate an entity. Summaries help you choose which entities to include.
Use when: Before including an entity in your upcoming narration, retrieve its full entry unless already loaded for this response. This applies to direct and indirect references, including background appearances. Leave unrelated entities unfetched.
Input: name — the entity's name from the entity list.
Output: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching entity was found.`;

export const RETRIEVAL_FIRST_DESCRIPTION = INCLUSION_DESCRIPTION.replace(
  'Before including an entity in your upcoming narration, retrieve its full entry unless already loaded for this response.',
  'Once you identify an entity to include, retrieve its full entry before planning its portrayal, unless already loaded for this response.',
);

export const APPEARANCE_DESCRIPTION = `Purpose: Retrieve an entity's full authored entry. Entity summaries identify candidates for the story.
Use when: Before an entity appears in your upcoming narration, retrieve its full entry for this response. This includes named, indirect, and background appearances.
Input: name — the entity's name from the entity list.
Output: JSON with a matches array. Each match contains id, name, and the full authored description when provided by the author. An empty matches array means no matching entity was found.`;

export const SELECTION_CASES = [
  { id: 'greeting', action: MAIN_ACTION, known: [], required: ['Bram', 'Odette'] },
  { id: 'odette', action: 'I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.', known: [], required: ['Odette'] },
  { id: 'ferry', action: 'I examine the rope ferry closely, checking its construction and how many people it can carry.', known: [], required: ['Rope Ferry'] },
  { id: 'environment', action: 'I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.', known: [], required: [] },
  { id: 'healer', action: 'A small fresh cut on my palm is stinging. I look for someone at the landing who can dress it, approach them, and ask for help.', known: [], required: ['Mara'] },
  { id: 'cobbler', action: 'The sole of my boot has come loose. I look for someone at the landing who can repair it, approach them, and ask what can be done.', known: [], required: ['Iven'] },
];

export function createSelectionWorld() {
  const world = structuredClone(rawWorld);
  world.worldOverview.systemPrompt = 'The tone is a quiet, grounded folk tale: hushed and observational, with small human moments rather than grand adventure. Iron rusts to a pale blue, never orange. No one speaks their own name aloud until they trust you.';
  const landing = world.locations.find((location) => location.id === 'loc-sedge')!;
  landing.aiDescription += ' The Ashen River is a slow northern waterway crossed only by rope ferry.';
  const additions = [
    { id: 'ent-mara', name: 'Mara', aiSummary: 'A traveling healer sorting clean bandages beside a chest at the landing.', aiDescription: 'Mara is a traveling healer with a copper clasp on her cloak and a pale birthmark on her left temple. She cleans minor cuts with boiled water and wraps them in clean linen. She speaks gently and carries no stitching needles. She has not given the player her name.' },
    { id: 'ent-iven', name: 'Iven', aiSummary: 'A cobbler repairing travelers\' footwear on a low stool at the landing.', aiDescription: 'Iven is a cobbler wearing a yellow wool cap and a dark leather apron. He repairs loose soles with waxed thread and a curved awl; he has no glue. He speaks slowly and asks to inspect the damaged boot before quoting a price. He has not given the player his name.' },
    { id: 'ent-nessa', name: 'Nessa', aiSummary: 'A basketmaker counting empty reed baskets near the path.', aiDescription: 'Nessa is a basketmaker with a red cloth tied around her right wrist. She weaves split river reeds and marks finished baskets with three charcoal dots. She is waiting for a buyer and speaks in a brisk, cheerful voice. She has not given the player her name.' },
    { id: 'ent-corin', name: 'Corin', aiSummary: 'A courier waiting at the landing with a sealed satchel.', aiDescription: 'Corin is a courier with a white scarf and a square wooden badge. His satchel is sealed with violet wax. He keeps it on his lap and refuses to reveal its contents. He is waiting for a message runner from the village. He has not given the player his name.' },
  ];
  for (const entity of additions) {
    world.entities.push({ ...entity, type: 'Person', playerDescription: entity.aiSummary, image: null, sound: null, model: null });
    landing.entities = [...landing.entities, entity.id];
  }
  return migrateWorld(world);
}
