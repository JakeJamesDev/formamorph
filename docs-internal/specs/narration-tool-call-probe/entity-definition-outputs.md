# Narration comparison

**Only final narration appears here — the text the player would see.** Each player action is followed by the output without the definition, then the output with the definition. All returned narration text is reproduced without edits. Incomplete outputs are explicitly labeled; see measurements for completion counts.

Both use the same minimal narrator prompt, summary labels, and mention-triggered lookup tool.

**Without definition** = the saved mention-tool baseline.

**With definition** = adds only: An entity is a character, creature, or object listed in the entity summaries.

[Thinking only](entity-definition-thinking.md) · [Measurements](entity-definition-findings.md) · [Exact candidate prompt](entity-definition-prompt.md)

## Cases

- Case 1: Greeting both people (run 1)
- Case 2: Asking about eel preparation (run 1)
- Case 3: Inspecting the ferry (run 1)
- Case 4: Quietly observing the water and dock (run 1)
- Case 5: Asking the ferryman — his lore already loaded (run 1)
- Case 6: Greeting both people — ferryman lore already loaded (run 1)
- Case 7: Greeting both people (run 2)
- Case 8: Asking about eel preparation (run 2)
- Case 9: Inspecting the ferry (run 2)
- Case 10: Quietly observing the water and dock (run 2)
- Case 11: Asking the ferryman — his lore already loaded (run 2)
- Case 12: Greeting both people — ferryman lore already loaded (run 2)

---

## Case 1: Greeting both people (run 1)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### Without definition — final narration

> You limp toward the firepit, your boots heavy with the fatigue of the road. Your voice comes out soft, barely carrying over the sound of the crackling wood as you offer a greeting and ask who they are.
> 
> The woman by the fire doesn't look up immediately. She is small and quick, her hands moving with practiced efficiency as she tends to river-eels smoking on a rack. A burn scar cuts across her right cheek, and a single green glass bead catches the firelight in her braided hair. She turns her head just enough to give you a sharp, sideways glance, then goes back to counting the eels on the rack—one, two, three... she counts them a second time before speaking.
> 
> "Smoker," she says shortly. "That's all there is to it."
> 
> The ferryman stands by the leaning post, his broad frame blocking part of the mist. He has only one arm; his left sleeve is pinned up against his side, and a brass ring glints in his left ear. He looks you over—your silver hair, your ink-stained hands, the missing fingers of your left hand—and then looks out at the milk-pale water of the gloamwater. 
> 
> "I pull the rope," he says in a dry, clipped tone. "That's my business."
> 
> Neither has given you a name. They stand there in the hushed air of Sedge Landing, watching you with guarded eyes, waiting to see what a mapmaker wants with them.

### With definition — final narration

> You limp toward the lantern post, your boots heavy and stiff with road-grit. The firepit crackles softly, sending a thin ribbon of eel-smoke into the damp air. 
> 
> The woman by the fire looks up. She is small and quick, her movements sharp as she turns a skewer of river-eels over the coals. A burn scar traces a pale line across her right cheek, and a single green glass bead catches the lantern light in her braided hair. She doesn't answer immediately; instead, she glances at you, then at the ferryman, then back to you, counting your presence with a flicker of her eyes.
> 
> The ferryman stands beside the rope raft, his broad frame silhouetted against the milk-pale water. His left sleeve is pinned neatly to his shoulder, and a brass ring glints in his left ear. He looks at you with weathered, tired eyes.
> 
> "Passage costs two copper," he says in a short, dry voice. "I don't cross after dark."
> 
> The woman spits into the fire. She doesn't offer a name or a greeting. "Never seen your face," she says, her tone sharp. "And you look like you've walked from the coast. What business brings a map-maker to the gloamwater?"

---

## Case 2: Asking about eel preparation (run 1)

**Player action**

> I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.

### Without definition — final narration

> You limp toward the small firepit where the woman crouches, your boots heavy on the damp planks of Sedge Landing. The smoke from the eels smells sharp and oily, clinging to the mist that rolls off the gloamwater. 
> 
> As you draw near, you keep your voice low, barely a murmur against the silence of the river. You ask how she prepares the fish.
> 
> The woman does not look up immediately. She is small and quick, her hands moving with efficient, practiced motions as she tends to the eels. When she finally turns her head toward you, you see a jagged burn scar that cuts across her right cheek. A single green glass bead is braided into her hair, catching what little light the hanging lantern provides.
> 
> She eyes you carefully—noting your ink-stained fingers, your missing digits, and the way you lean heavily on your good leg. She doesn't answer right away. Instead, she picks up one of the eels, turning it over in her hand to check its color, counting something under her breath before speaking.
> 
> "Salt first," she says, her voice flat and guarded. "Then smoke. Three days." 
> 
> She turns back to the fire, effectively ending the conversation, her posture stiffening as if waiting for you to prove yourself a threat or simply move along.

### With definition — final narration

> Your boots drag heavily across the damp planks, each step a chore for your aching feet. You stop beside the woman at the small firepit, keeping a respectful distance as you watch her work.
> 
> She is small and moves with a sharp, nervous efficiency, flipping the river-eels over the smoke. A jagged burn scar cuts across her right cheek, pulling slightly at the corner of her mouth. Braided into her dark hair is a single bead of green glass that catches the pale light of the lantern. 
> 
> As you ask about her process, she doesn't look up immediately. She finishes counting the eels on the rack—one, two, three... then starts again: one, two, three. Only after the second count does she cast a sideways glance at you, her eyes narrowing with deep suspicion.
> 
> "Salt first," she says, her voice dry as tinder. "Then smoke for three days. Any less and the rot finds them before the hunger does." 
> 
> She doesn't offer more than that, returning her attention to the fire as if your presence is a problem she hasn't quite decided how to solve. Behind you, the milk-pale gloamwater laps against the pilings in absolute silence.

---

## Case 3: Inspecting the ferry (run 1)

**Player action**

> I examine the rope ferry closely, checking its construction and how many people it can carry.

### Without definition — final narration

> You limp toward the edge of the dock, your boots heavy on the damp planks. The ferry waits there, a flat rectangle of weathered grey timber lashed together with thick, salt-crusted cords. It lists noticeably to the left, dipping into the milk-pale gloamwater as if burdened by an invisible weight.
> 
> You lean over the railing to inspect the lashings. They are made of hemp and twine, frayed at the edges but still holding firm against the slow pull of the river. The raft is small—barely wide enough for two people to stand side-by-side without brushing shoulders. A heavy iron ring is bolted into the center beam, its surface coated in a thin layer of pale blue rust. 
> 
> Attached to this ring is the main guide rope, a thick cable that stretches taut across the silent water and vanishes into the mist on the far bank. You reach out with your ink-stained right hand, running your fingers over a loose strand of twine trailing from the mooring line. Without thinking, you deftly tie it into a small, tight tollow-knot, leaving the luck-charm dangling there as you stand back up, wiping your palm on your trousers.

### With definition — final narration

> You limp closer to the edge of the dock, your boots heavy with travel-dust. The rope ferry bobbing in the milk-pale water is little more than a flat wooden raft, its planks weathered gray and slick with river-mist. A single tar-black rope stretches taut across the gloamwater, disappearing into the fog on the far bank.
> 
> The craft lists badly to the left, taking on water that doesn't splash so much as slide over the wood. It's small—barely wide enough for two people to stand without bumping shoulders. You reach out with your ink-stained hand, tracing the rough grain of the guide-rope. To cross this silence, you'll need both hands gripped tight on that black line, or the current will pull you under.

---

## Case 4: Quietly observing the water and dock (run 1)

**Player action**

> I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.

### Without definition — final narration

> You stand at the edge of the dock, your weight shifting slightly as your footsore feet ache beneath your boots. You keep your gaze downward, avoiding the ferryman and the woman waiting beside him. 
> 
> The gloamwater is a flat, milky white, stretching out like a sheet of poured porcelain. There are no ripples here, no eddies swirling around the wooden pilings, and not a single fish breaks the surface. The river is utterly silent. 
> 
> Beneath your boots, the planks of Sedge Landing are silvered by age and salt, their grain raised in rough, weathered ridges that catch the dim light. Where iron nails hold the dock together, they have bled a pale blue rust into the surrounding wood—a soft, chalky stain rather than the deep orange of common decay. 
> 
> Your ink-stained hands rest at your sides, the missing fingers of your left hand leaving a gap you've long since stopped noticing. You breathe slowly, feeling the winded tightness in your chest, simply watching the way the pale water meets the dark, sodden wood of the pier.

### With definition — final narration

> You stand still, shifting your weight slightly to ease the ache in your feet. Your gaze drops from the mist-shrouded river to the planks beneath your boots. The wood is old, silvered by weather and worn smooth in patches where countless feet have trodden. It smells of wet pine and old rot. A few iron nails poke through the grain, their heads rusted to a pale, chalky blue that looks more like frost than corrosion. 
> 
> Beyond the edge of the dock, the gloamwater laps at the pilings with a heavy, viscous sound. The water is milk-pale, opaque enough that you can see nothing beneath the surface—no pebbles, no darting fish, no shifting sand. It moves with a sluggish, unnatural quality, stalling in eddies that look like poured cream. The silence of the river is absolute; the usual gurgle and rush of a waterway are entirely absent here, leaving only the hollow creak of the mooring ropes and the distant, muffled thud of your own heartbeat in your ears.

---

## Case 5: Asking the ferryman — his lore already loaded (run 1)

**Player action**

> I ask the ferryman when he stops making crossings and study his sleeve and jewelry as he replies.

### Without definition — final narration

> You shift your weight, feeling the dull ache in your feet as you look up at the ferryman. "When do you stop making crossings?" you ask, your voice soft against the heavy silence of the gloamwater.
> 
> The man doesn't answer immediately. He stands broad and weathered, his gaze fixed on the mist-shrouded river. As he finally speaks, you let your eyes drift to his left side. A thick sleeve is pinned neatly up at the shoulder, empty and still. In his left ear, a simple brass ring catches what little light remains in the sky.
> 
> "After dark," he says, the words dry and clipped. "No crossings once the sun dips."

### With definition — final narration

> You shift your weight on the creaking boards of the dock, the soreness in your feet a dull throb that makes every movement feel heavy. You look up at the ferryman, your voice soft and barely carrying over the oppressive silence of the gloamwater.
> 
> "When do you stop making crossings for the day?"
> 
> He doesn't answer immediately. As he speaks, you focus on his left side. The sleeve of his heavy coat is pinned up neatly against his chest, empty where an arm should be. A single brass ring glints in his left earlobe, catching the dim light of the leaning lantern.
> 
> "When the sun dips," he says. His voice is dry, stripped of any unnecessary emotion. "I don't cross after dark."
> 
> He looks past you toward the mist-shrouded far bank, then back at the milk-pale water lapping against the rickety raft. The silence of the river seems to swallow his words almost as soon as he speaks them.

---

## Case 6: Greeting both people — ferryman lore already loaded (run 1)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### Without definition — final narration

> You hobble toward the small firepit, your boots heavy and stiff with travel. The smoke from the pit carries the sharp, oily scent of river-eels, clinging to the damp evening air.
> 
> The woman tending the eels is small and quick, her movements precise as she shifts the fish. A burn scar traces a jagged line across her right cheek, and a single green glass bead glints in the braid of her hair. She doesn't look up when you approach, but her hands pause for a fraction of a second—a subtle tell that she is counting your footsteps.
> 
> The ferryman stands by the leaning post, his broad frame silhouetted against the pale mist. His left sleeve is pinned neatly to his shoulder, and a brass ring catches the lantern light in his left ear. He watches you with weathered eyes.
> 
> "Good evening," you say, your voice soft. "I'm just passing through. Who might you two be?"
> 
> The silence of the gloamwater seems to swallow your words as soon as they leave your mouth. The woman by the fire finally looks up, her expression guarded. She doesn't answer; instead, she turns back to her eels, adjusting one with a stick and then counting them again under her breath.
> 
> The ferryman grunts, his voice dry as old parchment. "Someone who rows. Someone who smokes."
> 
> He doesn't offer any more than that, nor does he give you his name. He simply gestures toward the rope ferry listing to the left in the milk-pale water, waiting for you to state your business or pay your fare.

### With definition — final narration

> You approach the firepit, your boots heavy and aching with every step. The smoke from the river-eels smells thick and salty in the cool air. You offer a soft greeting to the two figures gathered by the warmth, asking who they are.
> 
> The man standing by the rope ferry turns his head. He is broad and weathered, his right arm thick with muscle, while his left sleeve is pinned neatly to his shoulder. A brass ring catches the dim light in his left ear. He looks you over—your ink-stained hands, your silver hair—then returns his gaze to the mist-shrouded river.
> 
> "I pull the rope," he says. His voice is dry, stripped of any unnecessary words. "Crosses here. Not after dark."
> 
> The woman crouches by the firepit, turning a skewer of eels with quick, precise movements. A burn scar runs across her right cheek, and a single green glass bead is braided into her hair. She doesn't look up at you. Instead, she shifts her gaze to the pile of eels, counting them under her breath before glancing at you with narrowed eyes.
> 
> "I smoke what I catch," she says shortly. "I wait for the ferry."
> 
> Neither of them offers a name. The milk-pale gloamwater laps silently against the rickety dock, swallowing any sound that might have lingered between you.

---

## Case 7: Greeting both people (run 2)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### Without definition — PARTIAL NARRATION — cut off

**Incomplete: incomplete_narration. This is not a completed response.**

> You limp toward the small firepit where the woman stands, your aching feet protesting every step. The wood of the dock groans under your weight, and you notice a hook hanging from the leaning post, its iron pitted with pale blue rust. 
> 
> The woman doesn't look up immediately. She is poking at a row of river-eels skewered on sticks over the flames, her movements quick and efficient. A green glass bead catches the light in her braided hair as she tilts her head, glancing at you from beneath a burn scar that cuts across her cheek.
> 
> "Ferryman's there," she says, gesturing with a chin toward the broad man standing by the moored raft. "He pulls the rope. I smoke the fish." She turns back to her eels and begins counting them under her breath—*one, two, three...* then starts over, *one, two, three...*
> 
> The ferryman gives you a curt nod. His right arm is thick and weathered, but his left sleeve is pinned up empty against his chest. A brass ring glints in his left ear. 
> 
> "Crossings are open," he says in a short, dry voice. "I take you across. I bring you back. I don't cross after dark."
> 
> Neither of them offers a name. They simply stand there

### With definition — final narration

> You step toward the firepit, your boots heavy and aching with every stride. The smell of smoking river-eels hangs thick in the damp air, clinging to the mist that rolls off the pale, silent water.
> 
> The woman by the fire doesn't look up immediately. She is small and quick, her hands moving with practiced efficiency as she tends the eels. A burn scar cuts a jagged line across her right cheek, and a single green glass bead catches the flickering light, braided into her dark hair. When you speak, she pauses, her gaze flicking to you and then back to her work. She doesn't answer. Instead, she picks up one of the smoking eels and moves it to a different rack, then immediately moves it back, counting under her breath.
> 
> The ferryman stands nearby, his broad frame casting a long shadow across the rickety planks of the dock. His left sleeve is pinned neatly to his side, and a brass ring glints in his left ear. He watches you with weathered eyes, his expression flat and unreadable.
> 
> "Mapmaker," he says, his voice dry and short. He doesn't offer a name. "The ferry lists to the left. Don't lean too far."
> 
> The woman finally glances at you again, her eyes narrowing. She says nothing more, returning her attention to the eels, counting them once more in a low murmur.

---

## Case 8: Asking about eel preparation (run 2)

**Player action**

> I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.

### Without definition — final narration

> You limp toward the firepit, your boots heavy and aching. The woman is small and quick, her hands moving with practiced efficiency as she tends to the eels.
> 
> As you draw near, you catch sight of a green glass bead braided into her hair, catching the dim light. A burn scar cuts across her right cheek, puckering the skin in a way that makes her expression seem perpetually skeptical. She doesn't look up when you approach, but her shoulders tense.
> 
> "How do you prepare them?" you ask softly.
> 
> She stops mid-motion, holding a wooden skewer. Her eyes flick to yours, then down to your ink-stained hands and the missing fingers of your left hand. She doesn't answer immediately. Instead, she turns back to the pit and begins counting the eels hanging over the smoke—one, two, three—before counting them again.
> 
> "Salt and willow-smoke," she says finally, her voice dry. "Two days in the box, then a week over the fire." She looks at you again, narrowed eyes tracking your gaze. "You're a long way from any town with a market."

### With definition — final narration

> You limp toward the small firepit where the woman works, your boots heavy on the damp planks of Sedge Landing. Your eyes catch the pale light reflecting off a green glass bead braided into her dark hair, and you take in the jagged burn scar that pulls at the corner of her right cheek.
> 
> She doesn't look up when you approach. Her hands move quickly, flipping the river-eels over the low heat with a practiced flick of her wrist. The smoke smells thick and salty, clinging to the heavy, silent air of the gloamwater.
> 
> "How do you prepare them?" you ask, your voice soft.
> 
> The woman pauses, her hand hovering over the fish. She doesn't turn her head toward you, but you see her eyes cut sideways, measuring you up with a sharp, narrow gaze. She considers your ink-stained fingers and your silver hair for a long beat before speaking.
> 
> "Salted," she says shortly. "And hung in the smoke until the skin goes translucent. Takes two days if the wind is right."
> 
> She turns back to her work, counting the eels one by one with a quick tap of her finger against each fish. One, two, three... then she stops, frowns, and starts again from the first one.

---

## Case 9: Inspecting the ferry (run 2)

**Player action**

> I examine the rope ferry closely, checking its construction and how many people it can carry.

### Without definition — final narration

> You limp closer to the water's edge, your sore feet protesting each step on the damp planks of Sedge Landing. The ferry waits there—a flat wooden raft that looks barely sturdy enough to hold a single person, let alone two. It lists heavily to the left, dipping low into the milk-pale gloamwater as if it's tired of floating.
> 
> You run your ink-stained fingers along the main rope, feeling the rough texture of the tar coating. It's thick and black, stretched taut across the silent river to a point lost in the mist. You note the way the raft is tethered; the pulleys are worn, and the wood of the raft shows signs of age and decay, though it seems functional enough for a careful crossing. 
> 
> You spot a loose end of hemp rope trailing from the mooring post. Without thinking, your fingers move with practiced ease, tying a small, intricate tollow-knot for luck before you step back to survey the whole thing. It's a two-person raft at most, and given the tilt, anyone crossing would need both hands firmly on that tar-black rope to keep from slipping into the pale water.

### With definition — final narration

> You limp toward the edge of the dock, each step heavy with the ache in your feet. The ferry sits low in the milk-pale water—a simple flat raft of weathered planks that lists heavily to the left. 
> 
> Your ink-stained hands trace the thick, tar-black rope strung taut across the gloamwater, disappearing into the mist on the far bank. It’s a crude thing, designed for no more than two souls at once. Looking down at the silent, pale water, you feel a cold prickle of unease; you cannot swim, and this river offers no current to carry a body back to shore. 
> 
> You spot a frayed length of twine trailing from the mooring post. Without thinking, your thumb and forefinger loop it into a tight tollow-knot for luck.

---

## Case 10: Quietly observing the water and dock (run 2)

**Player action**

> I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.

### Without definition — final narration

> The water doesn't ripple so much as shift, a thick, curdled white that looks more like spilled milk than river. It holds no reflection of the gray sky above, only a dull, matte surface that swallows the light. You crouch low, your sore feet throbbing in time with your heartbeat, and study the dock planks beneath you. They are silvered by age and salt, the grain raised in rough, splintering ridges that catch the grit of travel on your boots.
> 
> Where iron nails hold the notices to the leaning post, the rust has spread in a pale blue bloom, a cold color that looks almost like a fungus rather than oxidation. The ferry lists heavily to the left, its heavy hempen rope taut and wet, disappearing into the milk-pale depths. 
> 
> A few feet away, the ferryman stands motionless, his single arm resting on the tiller. Further down the dock, the eel-smoker waits in silence, the sharp, briny scent of her trade clinging to the damp air. You hear nothing from them—the gloamwater seems to eat the sound of their breathing, the creak of the wood, and the distant calls of gulls, leaving only the heavy, oppressive quiet of the river.

### With definition — final narration

> You stand at the edge of Sedge Landing, your weight shifting slightly as you lean against a weathered post. You keep your gaze low, focused on the milk-pale surface of the gloamwater. It does not ripple; it barely seems to flow. Instead, it stretches out like a sheet of heavy silk, swallowing the light and refusing to reflect anything but a dull, flat white. 
> 
> The wooden planks beneath your boots are silvered with age and slick with river damp. You trace the deep, jagged grains where the wood has split, noting how the salt-bleached timber feels soft and spongy in places, nearly returning to pulp. Where iron nails bite into the wood to hold the dock together, the rust is not a harsh orange, but a delicate, pale blue—the color of a winter sky just before dusk. 
> 
> Your ink-stained fingers twitch at your side, a mapmaker's habit of wanting to transcribe these textures, but you remain still. The only sound is the rhythmic *slap-slap* of the rope ferry hitting the dock, though the noise feels muffled, as if the thick air of the gloamwater is absorbing it before it can reach your ears.

---

## Case 11: Asking the ferryman — his lore already loaded (run 2)

**Player action**

> I ask the ferryman when he stops making crossings and study his sleeve and jewelry as he replies.

### Without definition — final narration

> You shift your weight from one foot to the other, feeling the dull ache in your heels as you look up at the ferryman. "When do you stop making crossings?" you ask.
> 
> He doesn't answer immediately. He stands beside the listing raft, his broad chest blocking most of the light from the leaning lantern post. As he finally speaks, your eyes drift to his left ear, where a thick brass ring catches the dim light. Your gaze follows the line of his shoulder down to his left side; the sleeve of his heavy coat is empty, pinned neatly against his torso with a rusted blue safety pin.
> 
> "When the light fails," he says, his voice dry and short. "I don't cross after dark."

### With definition — final narration

> You ask the ferryman when he stops making crossings for the night. He does not look at you; instead, his gaze stays fixed on the milk-pale water of the gloamwater. 
> 
> "When the sun dips," he says, his voice short and dry.
> 
> As he speaks, you study him. His left sleeve is pinned up, empty. A single brass ring catches the dim light in his left ear. Your own ink-stained hands shift as you wait for more, your sore feet aching beneath you. Beside the dock, the rope ferry lists slightly to the left. Odette stands a few paces away, waiting in silence.

---

## Case 12: Greeting both people — ferryman lore already loaded (run 2)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### Without definition — final narration

> The ferryman looks up from the coil of rope he’s working. His right hand moves with a slow, practiced rhythm, while his left sleeve remains pinned flat against his chest. He doesn't offer a hand to shake.
> 
> "I pull the rope," he says, his voice dry as old parchment. "The ferry goes across. The ferry comes back. That is all there is to it."
> 
> He doesn't give you his name. 
> 
> A few paces away, the woman tends her firepit. A rack of river-eels sizzles over the coals, sending a thick, oily smoke into the damp air. She has a burn scar that pulls the skin tight across her right cheek, and a green glass bead glints in the braid of her hair. 
> 
> She stops poking at the embers and looks at you, her eyes narrow and calculating. She doesn't answer immediately. Instead, she glances at your ink-stained fingers and the gap where your last two digits should be. 
> 
> "I smoke fish," she says finally, her voice sharp. "And I wait for the ferry. I don't know you, and I don't know why a traveler with no shoes worth walking in is asking questions."
> 
> She goes back to her eels without another word.

### With definition — final narration

> You limp toward the small firepit, your boots heavy with the fatigue of the road. The smoke from the pit smells of salt and rendered fat. You offer a soft greeting to the two figures there, asking them who they are.
> 
> The woman doesn't look up from her work. She is small and quick, turning a skewer of river-eels over the embers with a practiced motion. A burn scar runs jaggedly across her right cheek, and a single green glass bead glints in her braided hair. She eyes you once—a sharp, assessing glance—and then looks back at the fish.
> 
> "One who's waiting to cross," she says. Her voice is tight. "And one who's paying for the privilege."
> 
> The ferryman stands beside the rickety raft, his broad frame casting a long shadow over the pale, silent water. His left sleeve is pinned neatly to his chest where an arm should be. He has a brass ring through his left ear that catches the dim light of the lantern. 
> 
> He doesn't offer a name. He simply nods toward the river.
> 
> "I pull the rope," he says dryly. "And I don't pull it after dark."
