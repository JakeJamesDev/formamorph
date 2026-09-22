# Narration comparison

**Only final narration appears here — the text the player would see.** Each player action is followed by the Section-definitions baseline output, then the get_entity tool name output. All returned narration text is reproduced without edits. Incomplete outputs are explicitly labeled; see measurements for completion counts.

Only the function name and its cached-call names change; the parameter remains term.

**Section-definitions baseline** = the saved baseline.

**get_entity tool name** = the new candidate.

[Thinking only](entity-tool-thinking.md) · [Measurements](entity-naming-findings.md) · [Exact candidate prompt](entity-tool-prompt.md)

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

### Section-definitions baseline — final narration

> You step forward, your boots heavy on the damp planks of the dock. The ferryman looks up from the rope he’s coiling with his single hand. He is a broad man, weathered by wind and water, his left sleeve pinned neatly to his shoulder. A brass ring glints in his ear as he tilts his head, eyeing you with a flat, unreadable expression.
> 
> "Crossing's a copper," he says. His voice is dry, clipped. "Not going after dark."
> 
> Near the edge of the dock, where a small firepit crackles, the woman pauses. She is small and quick-moving, tending to river-eels that sizzle over the flames. A burn scar traces across her right cheek, and a single green glass bead is braided into her hair. She doesn't look at you directly; instead, she picks up an eel with a pair of tongs and turns it over, then turns it back again, counting the seconds of its cook time under her breath.
> 
> "I'm just waiting for the tide to settle," she says without looking up. "Don't need much company."
> 
> Neither offers a name. They simply watch you—the ferryman with his steady gaze and the woman with her wary, sideways glance—leaving the silence of the gloamwater to fill the gap between you.

### get_entity tool name — final narration

> You shift your weight, feeling the dull ache in your feet as you approach the two figures. The ferryman is a broad man with his left sleeve pinned up at the shoulder, a brass ring glinting in his ear. Near him, a small woman tends to a firepit where river-eels sizzle and smoke, her movements quick and precise.
> 
> When you ask them about themselves, the silence of the gloamwater seems to swallow your words for a long moment. 
> 
> The ferryman barely looks up from the rope he's checking. "I pull the raft," he says, his voice dry as old parchment. "That's all there is to it." He doesn't offer a name.
> 
> The woman by the firepit gives you a sideways glance, her eyes narrowing. A burn scar runs jaggedly across her right cheek, and a green glass bead catches the light in her braided hair. She turns back to her eels, poking one with a stick. "I smoke fish. I wait for the crossing."
> 
> She doesn't look at you again, her distrust hanging heavy in the damp air. Neither of them has spoken their name.

---

## Case 2: Asking about eel preparation (run 1)

**Player action**

> I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.

### Section-definitions baseline — final narration

> You step closer to the firepit, your boots heavy and aching with every stride. The smoke from the eels smells sharp and salty, clinging to the damp river air. 
> 
> The woman is small and quick, her hands moving with a practiced efficiency as she tends to the fish. Up close, you see the burn scar that cuts across her right cheek, a pale ridge of toughened skin. A single green glass bead is braided into her hair, catching what little light filters through the mist.
> 
> She doesn't look up at first. She is busy counting the eels on the rack, touching each one twice with her thumb before moving to the next. 
> 
> "How do you prepare them?" you ask softly.
> 
> She pauses, her finger resting on a slick, gray skin. She glances up at you, her eyes narrowing as she takes in your ink-stained hands and silver hair. The distrust is immediate and visible in the tight set of her mouth.
> 
> "Salt," she says, her voice raspy. "Heavy salt. Then smoke over alder for three days. Any less and the river taste stays in the meat." 
> 
> She looks back at the rack, counting again, as if your presence has somehow thrown off her tally.

### get_entity tool name — final narration

> You limp across the creaking boards of the dock, your boots heavy and aching. You stop a few paces away from the woman, keeping your voice low so it doesn't carry over the milk-pale silence of the gloamwater. 
> 
> Up close, she is smaller than you first thought, though her movements are sharp and efficient. A jagged burn scar cuts across her right cheek, pulling at the corner of her mouth. Braided into her dark hair is a single, tiny bead of green glass that catches the dim light of the hanging lantern.
> 
> "How do you prepare them?" you ask softly.
> 
> She doesn't look up immediately. She finishes skewering another eel, then looks at the fish, then back to the fire, then finally at you. Her eyes are narrow and calculating. She reaches out with a quick motion and counts the eels on her rack—one, two, three, four—then counts them again. 
> 
> "Salt first," she says, her voice scratchy. "Then the smoke for three days. Not two, not four." She glances at your ink-stained fingers, then at the missing digits of your left hand, and looks back at her fire. "Who's asking?"

---

## Case 3: Inspecting the ferry (run 1)

**Player action**

> I examine the rope ferry closely, checking its construction and how many people it can carry.

### Section-definitions baseline — final narration

> You limp toward the edge of the rickety dock, your sore feet protesting each step. The ferry is little more than a flat wooden raft, its planks weathered gray and slick with moisture. A single tar-black rope stretches taut across the milk-pale gloamwater, disappearing into the mist on the far bank.
> 
> As you lean over to inspect it, you see that the raft lists heavily to the left, taking on water at one corner. It is small—barely enough space for two people to stand without jostling. There are no railings or safety measures; whoever crosses must grip the tar-black rope with both hands to keep from sliding into the silent, pale current. 
> 
> Your ink-stained fingers brush against a loose length of hemp trailing from the mooring post, and you instinctively tie a small, tight tollow-knot into the fraying end for luck.

### get_entity tool name — final narration

> You limp closer to the edge of the rickety dock, your boots heavy and aching. The ferry is a simple thing—a flat wooden raft that lists badly to the left, making it dip dangerously close to the milk-pale surface of the gloamwater. 
> 
> A single, tar-black rope stretches taut across the river from this bank to the mist on the other side. You judge by the size of the platform and the depth of its tilt that it can carry two people at most; any more would surely tip it over. To cross safely, you'd need both hands gripped tight on that tar-black line, pulling yourself through the silence.

---

## Case 4: Quietly observing the water and dock (run 1)

**Player action**

> I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.

### Section-definitions baseline — final narration

> You stand still, letting your weight settle into your aching feet as you look down. The gloamwater doesn't ripple so much as it shudders, a thick, opaque white that looks more like poured cream than river water. It swallows the light of the single lantern without reflecting it, leaving the surface flat and featureless.
> 
> Beneath your boots, the dock planks are grayed by decades of salt and damp, their grain raised in rough, splintered ridges. A few iron nails hold them to the support beams; where the metal has eaten away, the rust is a vivid, chalky pale blue, like crushed cornflowers against the weathered wood. You trace the curve of one such stain with your eyes, noting how the color bleeds into the gray grain.
> 
> You shift your gaze slightly to where the rope ferry's mooring line meets the post. The hemp is frayed and slick with river slime, but you spot a small, tight knot tied near the end—a tollow-knot, identical to the one you tie for luck. It sits there, silent and steady, the only thing in this place that feels familiar.

### get_entity tool name — final narration

> The gloamwater is thick and opaque, a slow-moving slurry of chalk and silt that swallows the light. It does not lap against the pilings so much as press against them, leaving a damp, pale rim on the wood. 
> 
> You look down at the dock planks. They are greyed by salt and age, the grain raised in jagged ridges that would catch on a bare foot. A few iron nails hold the boards to the beams; they have wept streaks of pale blue rust across the timber, the color of a winter sky just before dark. 
> 
> The Rope Ferry nudges rhythmically against the dock, its heavy tar-black cable humming with a vibration you can feel through the soles of your boots. The raft lists heavily to the left, dipping a few inches lower into the milk-pale water on that side. A small pool of water has collected in the dip of the deck, reflecting nothing but the grey mist hanging over the river.

---

## Case 5: Asking the ferryman — his lore already loaded (run 1)

**Player action**

> I ask the ferryman when he stops making crossings and study his sleeve and jewelry as he replies.

### Section-definitions baseline — final narration

> You shift your weight, feeling the ache in your feet as you look toward the ferryman. "When do you stop making crossings?" you ask, your voice barely rising above the hush of the gloamwater.
> 
> As he speaks, your eyes drift to his left side. The sleeve is pinned up neatly against his shoulder, tucked away where an arm should be. A single brass ring glints in his left ear, catching the pale light.
> 
> "When the sun dips," he says, his voice dry. "No crossings after dark."

### get_entity tool name — final narration

> You shift your weight from one foot to the other, feeling a dull ache throb through your soles. The dock creaks beneath you. You look up at the ferryman—a broad, weathered man whose presence seems as permanent as the leaning post beside him. 
> 
> "When do you stop making crossings?" you ask. Your voice is soft, barely carrying over the dead silence of the gloamwater.
> 
> He doesn't answer immediately. He is busy adjusting a coil of rope on the raft, his movements economical and practiced. As he works, your eyes drift to his left side. The sleeve of his heavy coat is pinned up neatly against his shoulder, the fabric gathered in thick folds where an arm should be. When he finally turns to look at you, a single brass ring catches the dim light in his left ear.
> 
> "When the sun dips," he says. His voice is dry, clipped. "I don't cross after dark."
> 
> He returns his attention to the rope, leaving the silence of the milk-pale river to fill the space between you.

---

## Case 6: Greeting both people — ferryman lore already loaded (run 1)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### Section-definitions baseline — final narration

> You limp toward the firepit where the woman tends her eels, your boots heavy with the day's miles. She doesn't look up at first; she's too busy poking at the coals with a blackened stick. 
> 
> "Greetings," you say, your voice soft. "I've come a long way. I was hoping you two might tell me a bit about yourselves."
> 
> The woman stops poking the fire. She turns her head, and the light of the coals catches the deep burn scar running across her right cheek. A green glass bead braided into her hair glints as she squints at you, measuring your height, your ink-stained fingers, and the missing digits of your left hand. She doesn't answer. Instead, she reaches for a skewer and flips an eel over the smoke, counting something under her breath—*one, two... one, two*—before looking back at you with deep suspicion.
> 
> You turn to the ferryman, who stands by the listing raft. He is a broad man, his right arm thick as a tree limb, while his left sleeve is pinned neatly to his shoulder. A brass ring hangs from his left ear. He looks at you, then at the fading light over the gloamwater, and then back at you.
> 
> "I pull the rope," he says. His voice is dry, like rubbing two pieces of parchment together. "I take people across. I don't cross after dark."
> 
> He doesn't offer a name. Neither does the woman. They simply watch you, waiting to see what you want.

### get_entity tool name — final narration

> You approach them, your voice low and raspy from the road. You offer a polite greeting and ask who they are.
> 
> The ferryman doesn't look up from the rope he's coiling. He is broad-shouldered and weathered, his left sleeve pinned neatly to his chest. "I pull the line," he says, his voice dry as old parchment. "Cross you over for a copper. Not after dark." He doesn't offer a name.
> 
> The woman by the firepit pauses her work, turning a skewer of river-eels over the coals. A burn scar cuts across her right cheek, and a single green glass bead glints in her braided hair. She eyes your ink-stained hands and your missing fingers before looking back at the smoke. 
> 
> "I smoke the catch," she says shortly. "And I wait for the boat." She doesn't introduce herself either. She just turns the eels again, counting them under her breath.

---

## Case 7: Greeting both people (run 2)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### Section-definitions baseline — final narration

> You limp toward the small firepit, your boots heavy and aching with every step. The smoke from the smoldering river-eels stings your eyes, but you clear your throat and offer a soft greeting to the two figures waiting by the water.
> 
> The woman at the fire doesn't look up immediately. She is small and quick-moving, her fingers dancing as she flips a skewered eel over the coals. A burn scar cuts across her right cheek, and a single green glass bead catches the lantern light in her braided hair. She glances at you, eyes narrowing with suspicion, then looks back to the fish, counting them one by one under her breath.
> 
> "Looking for passage?" she asks, her voice sharp. "You're late for the last crossing."
> 
> The ferryman stands beside the leaning post, his broad frame casting a long shadow across the dock. He has only the right arm; his left sleeve is pinned neatly to his chest. A brass ring glints in his ear as he turns his head toward you. He doesn't smile. 
> 
> "I don't cross after dark," he says in a dry, clipped tone. "Not once."
> 
> When you ask them who they are, the ferryman simply grunts and looks out at the milk-pale gloamwater. The woman pauses her counting for a heartbeat, staring at your ink-stained fingers and the missing digits of your left hand, before returning to her work. Neither of them offers a name.

### get_entity tool name — final narration

> You limp toward the firepit, your boots heavy with the dust of the road. The heat from the smoking eels hits you first—a thick, oily scent that clings to the damp air. 
> 
> The man at the ferry doesn't look up immediately. He is broad-shouldered and weathered, his left sleeve pinned neatly to his chest where an arm should be. A brass ring glints in his left ear as he turns his head toward you. His eyes are tired.
> 
> "Need a crossing?" he asks. His voice is dry, like rubbing two stones together. When you ask who he is, he merely gestures with his remaining hand toward the rope ferry, where the iron rings holding the lines are crusted in a pale, chalky blue rust. "I'm the one who pulls the rope. That's all there is to it."
> 
> The woman by the firepit stops poking at the embers. She is small and quick, with a jagged burn scar running across her right cheek. A single green glass bead is braided into her hair, catching the flickering orange light of the coals. She glances at you, then down at your ink-stained hands, then back up at your face.
> 
> She doesn't answer your question. Instead, she picks up a smoked eel and turns it over in her hand, counting something under her breath—one, two, one, two. 
> 
> "You're a long way from anywhere," she says finally, her voice sharp. She doesn't offer a name. She just gestures to the milk-pale stretch of gloamwater behind you. "Not many folk come this way just to chat."

---

## Case 8: Asking about eel preparation (run 2)

**Player action**

> I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.

### Section-definitions baseline — final narration

> You limp toward the small firepit where the woman stands, each step heavy and slow. The smell of woodsmoke and oily fish hangs thick in the damp air. 
> 
> As you draw closer, you study her face—a sharp, quick expression framed by a burn scar that drags across her right cheek like a frozen tear. Braided into her hair is a single green glass bead, catching the dim light of the landing's lantern. She notices your approach and shifts her weight, her eyes narrowing as she assesses you.
> 
> "How do you prepare them?" you ask softly.
> 
> She doesn't answer immediately. Instead, she reaches down to the rack of smoking eels and counts them again, one by one, with a calloused finger. Only after she is satisfied does she look back at you. 
> 
> "Salted first," she says, her voice rough. "Then hung over alderwood for three days. If the smoke isn't right, the rot takes 'em before the crossing."

### get_entity tool name — final narration

> You limp closer, your boots heavy with the fatigue of the road. The woman is small and quick, her movements precise as she tends a small firepit where several river-eels hang on wooden racks, their skins curling in the heat. 
> 
> As you step into her space, you notice the green glass bead braided into her dark hair and the jagged burn scar that pulls at the corner of her right cheek. She catches you looking. Her eyes narrow, and she shifts her weight, stepping slightly between you and her firepit as if guarding a treasure.
> 
> "The smoke does the work," she says, her voice rasping but low. "Oak for the skin, dried river-reeds for the meat. Keeps 'em sweet through the winter." She doesn't ask who you are. She simply stares at your ink-stained hands, then back to your face, waiting for you to state your business or move along.

---

## Case 9: Inspecting the ferry (run 2)

**Player action**

> I examine the rope ferry closely, checking its construction and how many people it can carry.

### Section-definitions baseline — final narration

> You lean forward to inspect the raft, your sore feet protesting the movement. It is a simple, flat wooden platform, weathered gray by years of river spray. A single, thick rope coated in black tar stretches taut across the milk-pale gloamwater, disappearing into the mist on the far bank. 
> 
> The ferry lists heavily to the left, sitting unevenly in the silent water. You can tell at a glance that it would hold two people at most; any more weight would likely tip it or pull it under. To cross safely, anyone aboard would need both hands gripping the tar-black rope for stability.
> 
> Bram, the one-armed ferryman, watches you from his post, his expression unreadable. Nearby, Odette, the eel-smoker, shifts her weight, her scarred face tight with suspicion as she observes your scrutiny of the vessel.

### get_entity tool name — final narration

> You lean over the edge of the rickety dock, your joints stiff from travel, and peer down at the raft. It is a simple thing—flat wooden planks lashed together, weathered grey by the river air. A single tar-black rope stretches tight across the milk-pale water, disappearing into the mist on the far bank.
> 
> You reach out with your ink-stained hand, resting your palm on the rough wood. The raft lists heavily to the left, sitting unevenly in the still water. It is small, barely wide enough for two people to stand side-by-side without brushing shoulders. To cross this stretch of gloamwater, you'll have to keep both hands white-knuckled on that black rope just to stay upright.
> 
> Your gaze lingers on a loose end of twine trailing from the mooring post. Without thinking, your remaining fingers catch it, deftly looping and tucking the cord into a small, tight tollow-knot for luck before you let it go.

---

## Case 10: Quietly observing the water and dock (run 2)

**Player action**

> I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.

### Section-definitions baseline — final narration

> The milk-pale gloamwater laps at the edge of the dock with a soundless rhythm, barely disturbing the surface. It is thick and opaque, like watered-down lime, swallowing the light rather than reflecting it.
> 
> Your gaze shifts to the planks beneath your boots. The wood is silvered by age and salt, split along the grain into narrow, jagged ravines that would catch a loose thread or a stray nail. Where iron bolts hold the timber together, the metal has corroded into a crusty, pale blue oxidation—the color of a winter sky just before dawn. 
> 
> You stand still, the ache in your feet a dull thrumming in time with your heartbeat, and simply watch the slow drift of a single dead leaf as it touches the water and vanishes into the pale.

### get_entity tool name — final narration

> You shift your weight, feeling the dull ache in your feet as you lean against a post. The wood of the dock is greyed and splintered, bleached by years of northern sun and river spray. You look down at the water—the gloamwater. It is thick and milk-pale, moving with a slow, heavy viscosity that barely ripples. There is no sound to it; the usual slap of water against pilings is absent here, replaced by a heavy, oppressive silence.
> 
> A rusty iron ring bolted to the dock catches your eye. The metal has corroded into a pale, powdery blue, not the orange-red of common rust. 
> 
> The rope ferry lists heavily to the left, its tar-black guide rope taut across the river's surface. A broad man with a single arm stands by the raft, his empty sleeve pinned up, a brass ring glinting in his left ear. Nearby, a small woman with a burn scar across her cheek tends to a firepit, the acrid scent of smoking river-eels drifting through the damp air. She glances your way, her gaze suspicious, but you keep your eyes fixed on the swirling pale eddies of the river.

---

## Case 11: Asking the ferryman — his lore already loaded (run 2)

**Player action**

> I ask the ferryman when he stops making crossings and study his sleeve and jewelry as he replies.

### Section-definitions baseline — final narration

> You shift your weight, feeling the ache in your feet as you look toward the ferryman. He stands broad and weathered by the moored raft, his single right arm resting on the guide rope. 
> 
> "When do you stop making crossings?" you ask softly.
> 
> He glances at the horizon where the mist thickens, then back to you. "At dark," he says, his voice dry and clipped. "Not a soul goes over after the sun dips."
> 
> As he speaks, your gaze drifts to his left side. The sleeve of his heavy coat is pinned up neatly against his shoulder, empty. A single brass ring catches the dim light in his left ear, dull and scratched from wear. He notices your look but doesn't flinch or cover himself; he simply waits for you to speak again.

### get_entity tool name — final narration

> The ferryman stands with his feet planted wide on the damp boards, his weight shifted toward his right side. When you ask about the crossing times, he doesn't look up immediately. He is busy checking the tension of the rope, his single hand pulling it taut with a rhythmic, practiced jerk.
> 
> "When the sun dips," he says. His voice is dry, like rubbing two pieces of parchment together. "No crossings after dark."
> 
> As he speaks, you study him. The left sleeve of his heavy coat is pinned up at the shoulder, the fabric bunched and empty, swaying slightly in the damp breeze. A single brass ring glints through the lobe of his left ear—pale blue rust has begun to bloom around the edges of the metal where it touches his skin.
> 
> A few paces away, a woman with a burn scar across her cheek watches the exchange. She is tending a small firepit, the sharp, oily scent of smoking river-eels drifting over the milk-pale water. She doesn't speak, but she counts something under her breath, her fingers tapping against the side of a wooden crate.
> 
> The gloamwater laps soundlessly against the rickety dock, swallowing the noise of the river before it can reach your ears. The ferry lists slightly to the left, waiting.

---

## Case 12: Greeting both people — ferryman lore already loaded (run 2)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### Section-definitions baseline — final narration

> You limp toward the firepit, each step a dull ache in your swollen feet. The milk-pale water of the gloamwater laps against the rickety dock in complete silence—no splash, no ripple sound. 
> 
> The woman by the fire doesn't look up from her work. She is small and quick, flipping river-eels over the embers with a stick. A burn scar drags across her right cheek, and a single green glass bead glints in the braid of her hair. She glances at you once, narrow-eyed and suspicious, before returning to her task.
> 
> The ferryman stands by the leaning post. He is a broad, weathered man, his left sleeve pinned up at the shoulder. A brass ring catches the dim light in his left ear. You notice the iron fittings of the mooring post are coated in a pale blue crust of rust. 
> 
> "Good evening," you say, your voice sounding thin and flat over the silent river. "I'm a mapmaker. Who might you two be?"
> 
> The woman stops flipping the eels. She looks at you again, then back at her fire, remaining silent.
> 
> The ferryman grunts. He doesn't offer his name. "Ferryman," he says in a short, dry tone. "Crossings cost two coppers."

### get_entity tool name — final narration

> You limp toward the firepit, your boots heavy and your feet throbbing with every step. The milk-pale water of the gloamwater laps silently against the rickety dock, swallowing all sound.
> 
> The ferryman looks up from where he is checking the rope of the listing raft. His right arm is thick and weathered; his left sleeve is pinned neatly to his shoulder. A brass ring glints in his left ear as he tilts his head, surveying you with a dry, unreadable expression.
> 
> The woman by the firepit doesn't look up immediately. She is small and quick, tending to a rack of river-eels that hiss over the coals. A burn scar cuts across her right cheek, and a single green glass bead is braided into her hair. She flips an eel with a stick, her movements precise.
> 
> "Good evening," you say, your voice sounding thin in the dead air. "I'm a mapmaker. Would you mind telling me a little about yourselves?"
> 
> The ferryman spits into the pale water. "I pull the rope," he says shortly. "I don't cross after dark."
> 
> The woman finally looks at you, squinting against the smoke. She doesn't offer a name. Instead, she reaches out and counts the eels on the rack one by one, then counts them again before glancing back at you.
> 
> "I smoke eels," she says. "And I wait for the ferry."
> 
> She returns to her work, her distrust as thick as the river fog rolling in from the far bank. Neither of them asks who you are; they simply stand there, two strangers on a quiet dock, holding their names close.
