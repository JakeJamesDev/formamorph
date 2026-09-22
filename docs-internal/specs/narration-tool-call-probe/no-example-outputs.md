# Narration comparison

**Only final narration appears here — the text the player would see.** Each player action is followed by the output with the fixture example, then the output without it. All returned narration text is reproduced without edits. Incomplete outputs are explicitly labeled; see measurements for completion counts.

Both use the same minimal narrator prompt, entity definition, and summary labels. Only one phrase in the tool description differs.

**With fixture example** = the saved baseline, whose tool description uses the ferryman as an example.

**Without fixture example** = replaces that example with: whether by name or indirect reference.

[Thinking only](no-example-thinking.md) · [Measurements](no-example-findings.md) · [Exact candidate prompt](no-example-prompt.md)

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

### With fixture example — final narration

> You limp toward the lantern post, your boots heavy and stiff with road-grit. The firepit crackles softly, sending a thin ribbon of eel-smoke into the damp air. 
> 
> The woman by the fire looks up. She is small and quick, her movements sharp as she turns a skewer of river-eels over the coals. A burn scar traces a pale line across her right cheek, and a single green glass bead catches the lantern light in her braided hair. She doesn't answer immediately; instead, she glances at you, then at the ferryman, then back to you, counting your presence with a flicker of her eyes.
> 
> The ferryman stands beside the rope raft, his broad frame silhouetted against the milk-pale water. His left sleeve is pinned neatly to his shoulder, and a brass ring glints in his left ear. He looks at you with weathered, tired eyes.
> 
> "Passage costs two copper," he says in a short, dry voice. "I don't cross after dark."
> 
> The woman spits into the fire. She doesn't offer a name or a greeting. "Never seen your face," she says, her tone sharp. "And you look like you've walked from the coast. What business brings a map-maker to the gloamwater?"

### Without fixture example — final narration

> You limp across the creaking planks of the dock, your boots heavy with the fatigue of the road. The milk-pale water of the gloamwater laps silently against the pilings below, swallowed by a fog that tastes of wet slate.
> 
> The ferryman is a broad man with weathered skin and a brass ring glinting in his left ear. His left sleeve is pinned up where his arm should be. He doesn't look up from the rope he's checking, but his voice comes out dry and clipped.
> 
> "I pull the raft," he says. "One person at a time. No crossings after dark."
> 
> A few paces away, a small woman crouches by a firepit, turning skewered river-eels over the embers. A burn scar cuts across her right cheek, and a single green glass bead is braided into her hair. She doesn't offer a greeting. Instead, she glances at you once, then looks back at her eels, counting them under her breath in a rapid, quiet mumble.
> 
> "Two," she whispers to herself, "two... three... four..."
> 
> Neither of them offers a name. They simply watch you with the wary, measuring eyes of people who have learned that names are things given only after trust has been earned.

---

## Case 2: Asking about eel preparation (run 1)

**Player action**

> I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.

### With fixture example — final narration

> Your boots drag heavily across the damp planks, each step a chore for your aching feet. You stop beside the woman at the small firepit, keeping a respectful distance as you watch her work.
> 
> She is small and moves with a sharp, nervous efficiency, flipping the river-eels over the smoke. A jagged burn scar cuts across her right cheek, pulling slightly at the corner of her mouth. Braided into her dark hair is a single bead of green glass that catches the pale light of the lantern. 
> 
> As you ask about her process, she doesn't look up immediately. She finishes counting the eels on the rack—one, two, three... then starts again: one, two, three. Only after the second count does she cast a sideways glance at you, her eyes narrowing with deep suspicion.
> 
> "Salt first," she says, her voice dry as tinder. "Then smoke for three days. Any less and the rot finds them before the hunger does." 
> 
> She doesn't offer more than that, returning her attention to the fire as if your presence is a problem she hasn't quite decided how to solve. Behind you, the milk-pale gloamwater laps against the pilings in absolute silence.

### Without fixture example — final narration

> You limp toward the woman, each step a heavy effort that makes your calves ache. The smoke from her small firepit smells of salt and char, stinging your nose. 
> 
> She is smaller than you expected, quick-fingered as she turns an eel over the embers. A jagged burn scar cuts across her right cheek, pulling the corner of her mouth slightly tight. Braided into a thick plait of dark hair is a single green glass bead that catches the dim light. 
> 
> When you ask about her preparation, she doesn't look up immediately. She finishes turning the eel, then looks at you with narrow eyes, weighing your presence. 
> 
> "Salted first," she says, her voice raspy. "Then hung in the smoke for three days. No more, no less." 
> 
> She glances at your ink-stained hands and your missing fingers, her gaze lingering a moment too long before returning to her fish. She doesn't offer her name.

---

## Case 3: Inspecting the ferry (run 1)

**Player action**

> I examine the rope ferry closely, checking its construction and how many people it can carry.

### With fixture example — final narration

> You limp closer to the edge of the dock, your boots heavy with travel-dust. The rope ferry bobbing in the milk-pale water is little more than a flat wooden raft, its planks weathered gray and slick with river-mist. A single tar-black rope stretches taut across the gloamwater, disappearing into the fog on the far bank.
> 
> The craft lists badly to the left, taking on water that doesn't splash so much as slide over the wood. It's small—barely wide enough for two people to stand without bumping shoulders. You reach out with your ink-stained hand, tracing the rough grain of the guide-rope. To cross this silence, you'll need both hands gripped tight on that black line, or the current will pull you under.

### Without fixture example — final narration

> You limp toward the edge of the dock, your boots heavy and aching. The rope ferry bobbing in the milk-pale water lists noticeably to the left, its wooden planks weathered gray by years of river spray. 
> 
> It is a simple thing: four thick cedar logs lashed together with coarse hemp rope that has been worn smooth by countless hands. A single, wide platform of rough-hewn boards sits atop the logs, just large enough to accommodate two people standing side-by-side without crowding. A heavy iron ring is bolted to the center board, and where the metal meets the wood, a crust of pale blue rust has bloomed across the grain. 
> 
> The thick guide rope that stretches across the gloamwater to the far bank is taut, disappearing into the mist like a frayed thread. You lean over the edge, peering at the knots securing the raft to the dock; they are functional and crude. Without thinking, your ink-stained fingers reach out to tighten one loose strand, habitually twisting it into a small, tight tollow-knot for luck.

---

## Case 4: Quietly observing the water and dock (run 1)

**Player action**

> I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.

### With fixture example — final narration

> You stand still, shifting your weight slightly to ease the ache in your feet. Your gaze drops from the mist-shrouded river to the planks beneath your boots. The wood is old, silvered by weather and worn smooth in patches where countless feet have trodden. It smells of wet pine and old rot. A few iron nails poke through the grain, their heads rusted to a pale, chalky blue that looks more like frost than corrosion. 
> 
> Beyond the edge of the dock, the gloamwater laps at the pilings with a heavy, viscous sound. The water is milk-pale, opaque enough that you can see nothing beneath the surface—no pebbles, no darting fish, no shifting sand. It moves with a sluggish, unnatural quality, stalling in eddies that look like poured cream. The silence of the river is absolute; the usual gurgle and rush of a waterway are entirely absent here, leaving only the hollow creak of the mooring ropes and the distant, muffled thud of your own heartbeat in your ears.

### Without fixture example — final narration

> You stand at the edge of the rickety dock, your weight shifted carefully to avoid putting pressure on your aching feet. You keep your gaze lowered, letting your mapmaker's eye take in the scene without engaging with the ferryman or the woman waiting nearby.
> 
> The planks beneath you are bleached grey by salt and sun, their grain raised and splintered. Where iron nails hold them to the beams, the rust isn't the usual orange-brown; it is a pale, powdery blue that has bled into the surrounding wood like a bruise. 
> 
> Beyond the dock, the gloamwater stretches out in a flat, unsettling expanse of milk-pale grey. It doesn't ripple or lap against the pilings; it simply sits there, thick and opaque. The silence over the water is heavy, an absolute void that seems to swallow the distant sounds of the shore. Not a single fish breaks the surface, nor does any insect skitter across the still, pale mirror. 
> 
> You notice how the rope ferry's mooring line vanishes into the water without a splash, disappearing into the white depths like a needle pushed into cream. The mist on the far bank clings to the river's edge, blurring the line where the water ends and the grey shore begins.

---

## Case 5: Asking the ferryman — his lore already loaded (run 1)

**Player action**

> I ask the ferryman when he stops making crossings and study his sleeve and jewelry as he replies.

### With fixture example — final narration

> You shift your weight on the creaking boards of the dock, the soreness in your feet a dull throb that makes every movement feel heavy. You look up at the ferryman, your voice soft and barely carrying over the oppressive silence of the gloamwater.
> 
> "When do you stop making crossings for the day?"
> 
> He doesn't answer immediately. As he speaks, you focus on his left side. The sleeve of his heavy coat is pinned up neatly against his chest, empty where an arm should be. A single brass ring glints in his left earlobe, catching the dim light of the leaning lantern.
> 
> "When the sun dips," he says. His voice is dry, stripped of any unnecessary emotion. "I don't cross after dark."
> 
> He looks past you toward the mist-shrouded far bank, then back at the milk-pale water lapping against the rickety raft. The silence of the river seems to swallow his words almost as soon as he speaks them.

### Without fixture example — final narration

> You shift your weight on the dock, the ache in your feet a dull throb through your boots. Your ink-stained fingers curl around the strap of your map case as you look up at the broad man tending the mooring line. 
> 
> "When do you stop making crossings?" you ask, your voice soft.
> 
> The ferryman doesn't look at you immediately. He is working the rope with his right hand, his movements practiced and slow. You study him—the heavy wool of his coat, the left sleeve pinned up neatly against his side where an arm should be. A single brass ring catches the dim light in his left earlobe, unscratched and dull.
> 
> He stops pulling the rope and turns his head toward you. His face is weathered, lined like a map of a place you've never been.
> 
> "When the sun dips," he says. "No crossings after dark."
> 
> He looks past you toward the milk-pale stretch of gloamwater, where the current has stalled into a heavy, silent mirror. 
> 
> "Mist comes early this time of year. Dangerous to push off once the light goes."

---

## Case 6: Greeting both people — ferryman lore already loaded (run 1)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### With fixture example — final narration

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

### Without fixture example — final narration

> You lean your weight against a weathered piling to steady your aching legs as you approach. The ferryman stands by the rope, his single arm gripping the guide line with calloused fingers. The woman crouches by the firepit, poking at several skewered eels that sizzle and pop over the coals.
> 
> "Good evening," you say softly. "I'm a mapmaker, just passing through. Would you mind telling me a bit about yourselves?"
> 
> The man doesn't turn his head, though the brass ring in his ear glints as he shifts his stance. "I pull the rope," he says, his voice dry and clipped. "Crossing starts at dawn. Ends when the sun dips." 
> 
> He doesn't offer a name.
> 
> The woman by the firepit gives you a sharp, sidelong glance. A green glass bead braided into her hair catches the light as she tilts her head. She doesn't stop tending to her eels, but her voice is tight with suspicion. "I smoke what the river gives up," she says, counting the skewered fish for the second time in a row. 
> 
> She, too, remains nameless.
> 
> Between you and the milk-pale water of the gloamwater, a heavy silence settles, broken only by the crackle of burning wood.

---

## Case 7: Greeting both people (run 2)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### With fixture example — final narration

> You step toward the firepit, your boots heavy and aching with every stride. The smell of smoking river-eels hangs thick in the damp air, clinging to the mist that rolls off the pale, silent water.
> 
> The woman by the fire doesn't look up immediately. She is small and quick, her hands moving with practiced efficiency as she tends the eels. A burn scar cuts a jagged line across her right cheek, and a single green glass bead catches the flickering light, braided into her dark hair. When you speak, she pauses, her gaze flicking to you and then back to her work. She doesn't answer. Instead, she picks up one of the smoking eels and moves it to a different rack, then immediately moves it back, counting under her breath.
> 
> The ferryman stands nearby, his broad frame casting a long shadow across the rickety planks of the dock. His left sleeve is pinned neatly to his side, and a brass ring glints in his left ear. He watches you with weathered eyes, his expression flat and unreadable.
> 
> "Mapmaker," he says, his voice dry and short. He doesn't offer a name. "The ferry lists to the left. Don't lean too far."
> 
> The woman finally glances at you again, her eyes narrowing. She says nothing more, returning her attention to the eels, counting them once more in a low murmur.

### Without fixture example — final narration

> The ferryman does not look up from the rope he is coiling. He works with his one good arm, his movements economical and practiced. His left sleeve is pinned neatly to his shoulder.
> 
> "I pull the raft," he says. His voice is dry, like parchment rubbing together. "That's all there is to it."
> 
> Beside the firepit, the woman stirs her eels. The smoke smells of salt and char. She has a burn scar that tracks across her right cheek, disappearing into the line of her jaw. A single green glass bead glints in her braided hair. 
> 
> She doesn't look at you either. Instead, she reaches into her basket, pulls out three smoked eels, sets them on a flat stone, and counts them again. One. Two. Three.
> 
> "I smoke the catch," she says. "And I wait for the ferry."
> 
> Neither of them offers a name. The gloamwater laps at the dock, milk-pale and utterly silent.

---

## Case 8: Asking about eel preparation (run 2)

**Player action**

> I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.

### With fixture example — final narration

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

### Without fixture example — final narration

> You limp across the wooden planks of the dock, each step a heavy effort for your aching feet. The milk-pale water of the gloamwater laps silently beneath you, swallowing the sound of your approach.
> 
> The woman is small and quick, her movements sharp as she tends to the firepit. You pause a few paces away, keeping your distance, and let your eyes wander over her. A jagged burn scar cuts across her right cheek, pulling the skin tight. Braided into her hair, nestled among grey-streaked strands, is a single green glass bead that catches the lantern light.
> 
> "How do you prepare them?" you ask softly, gesturing to the eels hanging over the smoke.
> 
> She doesn't look up immediately. She finishes arranging three eels on the rack, then moves them again, counting them once, then twice, before finally glancing at you. Her eyes are narrow and suspicious. 
> 
> "Salted first," she says, her voice raspy. "Then smoked over alder wood for two days. Keeps them through the winter." She shifts her weight, moving slightly to keep the firepit between you and her. "Who's asking?"

---

## Case 9: Inspecting the ferry (run 2)

**Player action**

> I examine the rope ferry closely, checking its construction and how many people it can carry.

### With fixture example — final narration

> You limp toward the edge of the dock, each step heavy with the ache in your feet. The ferry sits low in the milk-pale water—a simple flat raft of weathered planks that lists heavily to the left. 
> 
> Your ink-stained hands trace the thick, tar-black rope strung taut across the gloamwater, disappearing into the mist on the far bank. It’s a crude thing, designed for no more than two souls at once. Looking down at the silent, pale water, you feel a cold prickle of unease; you cannot swim, and this river offers no current to carry a body back to shore. 
> 
> You spot a frayed length of twine trailing from the mooring post. Without thinking, your thumb and forefinger loop it into a tight tollow-knot for luck.

### Without fixture example — final narration

> You limp toward the edge of the dock, your boots heavy and your feet aching with every step. The ferry is a simple thing: a flat wooden raft tethered to a single tar-black rope that stretches across the milk-pale water. It lists heavily to the left, riding low in the gloamwater as if it's tired of floating. 
> 
> You lean over the edge and gauge the space. There's barely enough room for two people to stand without brushing shoulders, and only if they keep their weight centered. To cross this river, you'll have to grip that black rope with both hands and pull your own way across.

---

## Case 10: Quietly observing the water and dock (run 2)

**Player action**

> I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.

### With fixture example — final narration

> You stand at the edge of Sedge Landing, your weight shifting slightly as you lean against a weathered post. You keep your gaze low, focused on the milk-pale surface of the gloamwater. It does not ripple; it barely seems to flow. Instead, it stretches out like a sheet of heavy silk, swallowing the light and refusing to reflect anything but a dull, flat white. 
> 
> The wooden planks beneath your boots are silvered with age and slick with river damp. You trace the deep, jagged grains where the wood has split, noting how the salt-bleached timber feels soft and spongy in places, nearly returning to pulp. Where iron nails bite into the wood to hold the dock together, the rust is not a harsh orange, but a delicate, pale blue—the color of a winter sky just before dusk. 
> 
> Your ink-stained fingers twitch at your side, a mapmaker's habit of wanting to transcribe these textures, but you remain still. The only sound is the rhythmic *slap-slap* of the rope ferry hitting the dock, though the noise feels muffled, as if the thick air of the gloamwater is absorbing it before it can reach your ears.

### Without fixture example — final narration

> You stand still on the rickety dock, shifting your weight slightly to ease the ache in your feet. Below you, the gloamwater stretches out, flat and milk-pale, as if someone stirred a bucket of chalk into the river. There are no ripples here, no eddies around the wooden pilings—just a heavy, dead stillness that seems to swallow the sound of your own breathing.
> 
> You look down at the planks beneath your boots. The wood is greyed by years of damp and salt, split in places where the grain has given way. A few rusted nails hold the boards to the beams; the rust on them is a pale, dusty blue, like powdered lapis, crumbling away into the cracks.
> 
> A few paces away, Bram stands by the rope ferry, his single arm resting on the leaning post. He watches you out of the corner of his eye but says nothing. Odette sits on a crate further down the dock, the scent of smoked eel clinging to her heavy coat. She is staring at the far bank, lost in the mist. Neither of them speaks. The only sound is the distant, wet slap of water against the ferry's hull, muffled and small.
> 
> You rub your ink-stained fingers together, feeling the rough texture of the wood under your boots through the leather. The world feels hushed, held in a fragile balance.

---

## Case 11: Asking the ferryman — his lore already loaded (run 2)

**Player action**

> I ask the ferryman when he stops making crossings and study his sleeve and jewelry as he replies.

### With fixture example — final narration

> You ask the ferryman when he stops making crossings for the night. He does not look at you; instead, his gaze stays fixed on the milk-pale water of the gloamwater. 
> 
> "When the sun dips," he says, his voice short and dry.
> 
> As he speaks, you study him. His left sleeve is pinned up, empty. A single brass ring catches the dim light in his left ear. Your own ink-stained hands shift as you wait for more, your sore feet aching beneath you. Beside the dock, the rope ferry lists slightly to the left. Odette stands a few paces away, waiting in silence.

### Without fixture example — final narration

> You ask when he stops making crossings. 
> 
> He doesn't look at you. His gaze stays on the milk-pale water of the gloamwater, where the current has stalled into a dead, silent thing. "At dark," he says. His voice is dry, like rubbing two pieces of parchment together. "Not a minute after."
> 
> While he speaks, you study him. His left sleeve is pinned up tight against his shoulder, the heavy wool bunched and motionless. A single brass ring glints in his left ear, catching the weak light from the leaning lantern post. The metal isn't polished; it has the dull, flat patina of something worn for a very long time.
> 
> He finally turns to you, his one good arm resting on the railing of the listing rope ferry. He doesn't offer his name. He just waits for you to decide if you're getting on.

---

## Case 12: Greeting both people — ferryman lore already loaded (run 2)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### With fixture example — final narration

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

### Without fixture example — final narration

> You step forward, your boots heavy on the damp planks of Sedge Landing. The milk-pale gloamwater laps silently against the pilings, and the air smells of wet wood and salt-smoke. 
> 
> The man by the rope ferry is broad and weathered, his left sleeve pinned up to a shoulder that ends abruptly. A brass ring glints in his left ear as he looks you over with a tired squint. He doesn't smile.
> 
> Nearby, a small woman crouches over a stone firepit, turning skewered river-eels on a spit. A burn scar cuts across her right cheek, and a single green glass bead is braided into her hair. She stops turning the eels and looks at you, her eyes narrow and calculating.
> 
> "Good evening," you say softly. "I'm a mapmaker. I've come to cross the river." You offer a small nod toward each of them. "Could you tell me a bit about yourselves?"
> 
> The woman by the firepit doesn't answer immediately. She reaches out with a quick, calloused hand and adjusts the spit, turning it once, then twice, before looking back at you.
> 
> "I smoke eels," she says, her voice sharp. "And I'm waiting for the ferry."
> 
> The ferryman grunts. He leans against the leaning post, his remaining arm crossing his chest. "I pull the rope," he says dryly. "Crossings cost two copper. No crossing after dark."
> 
> Neither of them offers a name. The silence settles back over the landing, thick as the mist swallowing the far end of the rope ferry.
