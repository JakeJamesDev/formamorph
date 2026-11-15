// The seed play's script per bundled world: actions that draw several cast members into talk, so the narration
// carries dialogue, same-gender pairs, descriptors and pronouns. Actions are in the player voice the app sends.

export interface SeedScript {
  /** Runs per world in a default batch, sized so a batch yields about 100 passages. */
  runs: number;
  actions: string[];
}

export const SEED_SCRIPTS: Record<string, SeedScript> = {
  emberwatch: {
    runs: 4,
    actions: [
      'I read the call for hands on the gate post, then ask the nearest soldier who is in charge here.',
      'I find Captain Blackwell and ask what the job pays and what killed the last people who took it.',
      'I sit down with the other hires by the fire and ask each of them why they signed on.',
      'I ask Sylvie and Sergeant Marr whether they have worked together before, and watch how they answer.',
      'I ask the smith what he makes of the two women arguing by the stables.',
      'I tell the group we leave at dawn and ask who wants to walk at the front.',
    ],
  },
  valentines: {
    runs: 4,
    actions: [
      'I stay in my seat and quietly ask the girl next to me why everyone is staring at the door.',
      'I ask Mei and Rin which of them is giving chocolate to Kenta, and try not to laugh.',
      'I slip out to the hallway and ask the first two boys I see to hide me from Hana.',
      'Ms. Fujimura catches me in the hall. I explain myself while Haruto and Ren watch.',
      'In the courtyard I ask Sora what she thinks Hana will do when she finds me.',
      'I hand my own small box of chocolates to the quietest person in the courtyard and ask their name.',
    ],
  },
  slime: {
    runs: 4,
    actions: [
      'I knock on the nearest neighbor\'s door and ask who else is still living on the street.',
      'I ask the neighbor what the quarantine soldiers said the last time they came through.',
      'I go find the doctor and ask her whether the rash on my arm is the start of it.',
      'I bring the doctor and the sergeant together and ask them to tell me the truth about the checkpoint.',
      'I ask the priest why he stayed behind when everyone else left.',
    ],
  },
  drone: {
    runs: 3,
    actions: [
      'I roll toward the nearest group of people and chirp to get their attention.',
      'I follow the knight and the squire at a distance and record what they say to each other.',
      'I project a small map onto the ground and point at where the stranger and the old man should go.',
      'I nudge the scavenger girl with my turret and beep at the two men arguing behind her.',
    ],
  },
  rampage: {
    runs: 2,
    actions: [
      'I stop at the edge of the harbor and stare down at the general\'s command post until someone answers.',
      'I lower my head toward the scientist and the captain and growl softly, waiting to see what they do.',
      'I step over the stranded commuters and let the news chopper film me carrying the ferry to safety.',
    ],
  },
  veilwood: {
    runs: 1,
    actions: [
      'I call out into the trees to ask if anyone else is lost out here.',
      'I follow the sound of a voice deeper into the wood and ask whoever it is for directions.',
      'I tell the stranger about the mushrooms I ate and ask what they will do to me.',
    ],
  },
  sugarscape: {
    runs: 1,
    actions: [
      'I shout to anyone nearby that I need help with the curse.',
      'I follow the fudge otters along the bank and watch how the bigger one leads the others.',
      'I sit by the gingerbread waypost and talk to myself about the people I left behind.',
    ],
  },
};
