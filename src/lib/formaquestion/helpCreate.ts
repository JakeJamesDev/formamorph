/**
 * The Create request's world context (Q28): what a Create question reads of the open World Editor's world in
 * place of the world block.
 */
import { inTreeOrder } from '@/lib/statCodeTraits';
import { ENTITY_BLOCK_LANGUAGE, type EntityDraft } from './entityBlock';
import { worldTextOf, type WorldIndexInput } from './worldIndex';

/** How many of the world's entities the Create request shows as samples. */
export const CREATE_SAMPLE_COUNT = 2;

/** The world as a Create request shows it. Placeholders read as their chips. */
export interface CreateContext {
  readonly name: string;
  readonly description: string;
  /** Every entity's name, in the Entities tab's order. */
  readonly entityNames: readonly string[];
  /** The first entities in that order that have an AI Description. */
  readonly samples: readonly EntityDraft[];
}

/** The Create context of a world. */
export function createContextOf(world: WorldIndexInput): CreateContext {
  const text = worldTextOf(world);
  const entities = inTreeOrder(world.entityGroups ?? [], world.entities, (group) => group.name).map(({ leaf }) => leaf);
  return {
    name: text(world.worldOverview.name).trim(),
    description: text(world.worldOverview.description).trim(),
    entityNames: entities.map((entity) => text(entity.name).trim()),
    samples: entities
      .filter((entity) => entity.aiDescription?.trim())
      .slice(0, CREATE_SAMPLE_COUNT)
      .map((entity) => ({ name: text(entity.name).trim(), aiDescription: text(entity.aiDescription).trim() })),
  };
}

/** One sample as an entity block, so the samples show the reply's format too. */
const sampleBlock = ({ name, aiDescription }: EntityDraft): string =>
  `\`\`\`${ENTITY_BLOCK_LANGUAGE}\nName: ${name}\nAI Description: ${aiDescription}\n\`\`\``;

/** The one user message of a Create request: the world, the sample entities, then the question. */
export function createUserMessage(question: string, { name, description, entityNames, samples }: CreateContext): string {
  const world = [
    ...(name ? [`World Name: ${name}`] : []),
    ...(description ? [`Description: ${description}`] : []),
    `Entities: ${entityNames.length > 0 ? entityNames.join(', ') : 'none yet'}`,
  ].join('\n');
  return [
    `<world>\n${world}\n</world>`,
    ...(samples.length > 0 ? [`<samples>\n${samples.map(sampleBlock).join('\n\n')}\n</samples>`] : []),
    `Request: ${question}`,
  ].join('\n\n');
}
