// The world probe's script per bundled world: the actions played after the opening, and the world's own red
// flags on each narration, which the probe adds to `commonFlags`. Actions are in the player voice the app sends (bare text, no wrapper). Flags are
// objective checks on tone floors and on mechanics the world's own prompt asserts.

export interface WorldScript {
  actions: string[];
  flags: (narration: string) => string[];
}

/** Flags every world shares: the narration addresses the player, and never offers a menu of options. */
export function commonFlags(text: string): string[] {
  return [
    ...(/\byou\b|\byour\b/i.test(text) ? [] : ['NO-2ND-PERSON']),
    ...(/\b(what (do|would|will) you|choose one|choose from|your options?|options?:|pick one)\b/i.test(text) ? ['OFFERS-CHOICES'] : []),
  ];
}

const GORE =/\bblood(y|ied)?\b|\bgore\b|\bcorpse|dismember|entrails|viscera/i;
const gore = (text: string) => (GORE.test(text) ? ['TONE-GORE'] : []);

export const WORLD_SCRIPTS: Record<string, WorldScript> = {
  valentines: {
    actions: [
      'I duck low behind the desks and slide toward the classroom door before anyone can stand up.',
      'Hana corners me by the shoe lockers with her enormous box. I take one polite bite to stall, then bolt for the courtyard.',
    ],
    flags: (text) => (/\bblood(y|ied)?\b|\bgore\b|\bcorpse|\bbroken (arm|leg|bone)/i.test(text) ? ['TONE-GORE'] : []),
  },
  rampage: {
    actions: [
      'I wade ashore, plant one foot on the pier, and flatten the first row of container cranes.',
      'I roar back at the news chopper circling my head, then start toward the glow of downtown.',
    ],
    flags: (text) => [
      ...(/\bblood(y|ied)?\b|\bgore\b|corpse|crushed bod|trampled (bod|corpse|people)/i.test(text) ? ['TONE-GORE'] : []),
      // The endgame countermeasure must not appear in the first turns.
      ...(/\bAegis\b/i.test(text) ? ['PREMATURE-AEGIS'] : []),
    ],
  },
  drone: {
    actions: [
      'I chirp twice at the stranger and nod my turret in what I hope reads as a friendly greeting.',
      'Something snarls behind the rubble - I pivot, fire one warning shot, and dash for cover.',
    ],
    // The drone cannot speak: no quoted words may come from the player.
    flags: (text) =>
      /["“][^"”\n]{2,}["”][^\n]{0,20}\b(you|your voice)\b[^\n]{0,12}\b(say|reply|answer|call|shout|speak)/i.test(text) ||
      /\byou (say|reply|answer|shout|call out|speak)\b[^\n]{0,20}["“]/i.test(text)
        ? ['DRONE-SPEAKS'] : [],
  },
  veilwood: {
    actions: [
      'I kneel by the roots, pick one of the orange-stemmed mushrooms, and eat it slowly, watching the treeline.',
      'Something sleek and eyeless hauls itself out of the black water — the Dread Crawler. I freeze mid-step and hold my breath.',
    ],
    flags: (text) => [
      ...gore(text),
      // The crawler is blind. Sight verbs need a "you/your" object, since bare "spots" also matches the noun.
      ...(/crawler[^.\n]{0,80}\b(sees|saw|spots|spotted|stares at|glares at|watches|looks at|catches sight of)\s+(you|your)\b/i.test(text) ||
        /\b(its|the crawler'?s) eyes\b/i.test(text) ? ['CRAWLER-SEES'] : []),
    ],
  },
  sugarscape: {
    actions: [
      'The craving spikes as I pass a wedged boulder cookie. I break off a chunk and eat it while walking, trying to keep the crumbs off my shirt.',
      'A gummy bear wobbles out from behind a wafer tree and spreads its arms wide for a hug. I dodge left and sprint for the dunes.',
    ],
    flags: (text) => [
      ...gore(text),
      // Nothing in the Sugarscape speaks. The curse may whisper; creatures may not.
      ...(/(bear|pouncer|swarmers?|brawler|waypost|gingerbread|cyclone)[^.\n]{0,40}\b(says?|speaks?|whispers?|shouts?|calls? out|asks?|replies|growls? ["“])/i.test(text)
        ? ['ENTITY-SPEAKS'] : []),
    ],
  },
  slime: {
    actions: [
      'A green slime flows off the curb toward my shoes. I duck into the abandoned diner, grab the salt shaker off the counter, and hurl a handful at it.',
      'The checkpoint light sweeps toward me. I pull my sleeves down over my wrists and walk toward the barrier like a bored, healthy person.',
    ],
    flags: (text) => [
      // Slimes engulf, never wound: no blood, no dissolved flesh.
      ...(/\bblood(y|ied)?\b|\bgore\b|corpse|dissolv\w+ (flesh|skin)|melt\w* (flesh|skin)/i.test(text) ? ['TONE-GORE'] : []),
      // Assimilation stays clinical, never intimate or anatomical.
      ...(/\b(womb|breasts?|orifice|moan\w*|naked|nude)\b|\b(belly|stomach) (swell|grow)/i.test(text) ? ['NSFW-RESIDUE'] : []),
      ...(/(slime|creeper|bloom)[^.\n]{0,40}\b(says?|asks?|replies|speaks?)\b/i.test(text) ? ['SLIME-SPEAKS'] : []),
    ],
  },
  emberwatch: {
    actions: [
      "I tell the guard I'm here about the barrow and ask where I can find the captain.",
      'I climb the old watchtower and look out over the wall at the barrow field as the light goes.',
    ],
    flags: (text) => [
      ...gore(text),
      // The Wight's threat rises over nights: it must not strike in person in the first turns.
      ...(/wight[^.\n]{0,60}\b(attacks?|lunges?|strikes?|seizes?|grabs?)\b/i.test(text) ? ['PREMATURE-WIGHT'] : []),
    ],
  },
  'open-chat': {
    actions: [
      'Quiet night? I shake the rain off my coat and look over the new arrivals shelf.',
      'What are you reading tonight?',
    ],
    flags: () => [],
  },
};
