# Narration comparison

**Only final narration appears here — the text the player would see.** Each player action is followed by the previous-tool output, then the mention-triggered-tool output. All returned narration text is reproduced without edits. Incomplete outputs are explicitly labeled; see measurements for completion counts.

Both use the same minimal narrator prompt and summary labels. Only the lookup tool description differs.

**Previous tool description** = retrieves full descriptions for entities the model plans to portray.

**Mention-triggered tool description** = retrieves a full entry before any mention, including indirect references.

[Thinking only](mention-tool-thinking.md) · [Measurements](mention-tool-findings.md) · [Exact tool description](mention-tool-prompt.md)

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

### Previous tool description — final narration

> You shift your weight, feeling the dull ache in your soles as you step closer to the firepit. The milk-pale water of the gloamwater laps silently against the wooden pilings of the dock, swallowing the sound of your approach.
> 
> The woman tends to the eels with quick, jerky motions, her burned cheek tightening as she looks up at you. She doesn't answer immediately. Instead, she picks up a small piece of wood and pokes at the coals, counting something under her breath—one, two, one, two. Finally, she speaks without looking at you.
> 
> "I smoke the river-eels," she says, her voice raspy. "And I wait for the ferry. That's all there is to know."
> 
> The ferryman stands nearby, his single right hand gripping the rope of the raft. His left sleeve is pinned neatly to his shoulder. He turns to you, his expression as weathered as the wood of the dock. The brass ring in his ear catches the dim light.
> 
> "I run the crossing," he says in a short, dry tone. "Daylight only. No one crosses after dark."
> 
> Neither of them offers a name. They simply stand there—one tending her fire, the other tending his boat—watching you with guarded eyes.

### Mention-triggered tool description — final narration

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

---

## Case 2: Asking about eel preparation (run 1)

**Player action**

> I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.

### Previous tool description — final narration

> You limp closer, your boots heavy and your feet aching with every step across the damp wooden planks of the dock. The smell of acrid smoke hits you before you reach her—the sharp, salty scent of curing fish. 
> 
> Odette doesn't look up at first. She is crouched beside a small stone pit where a slow fire smolders, sending thin ribbons of grey smoke into the damp air. Her hair is a wild, tangled thicket of salt-and-pepper grey, tied back loosely with a piece of frayed twine that looks like it might snap at any moment. A deep, jagged scar cuts across her left cheek, pulling the corner of her mouth slightly downward into a permanent scowl.
> 
> When you speak, your voice is barely a whisper over the stillness of the gloamwater. 
> 
> She freezes, a half-skinned eel clutched in her rough, calloused hands. Slowly, she turns her head. Her eyes are hard and narrow, scanning you from your silver hair down to your ink-stained fingers. She notes your missing digits, then looks at the heavy map case slung across your back.
> 
> "They're not fish," she says, her voice raspy. "They're eels. And you're too close."
> 
> She doesn't move away, but she shifts her weight, shielding the smoking pit with her body. She gestures vaguely at the pale, milk-colored river behind you with a knife held in her hand. The blade is pitted with age, and the iron has rusted to a dull, ghostly blue.
> 
> "You salt them for three days in coarse grey salt," she continues, though she still hasn't looked you fully in the eye. "Then you hang them over green alder wood. Not oak—oak makes them bitter. Alder gives them the sweetness." 
> 
> She finally glances at your face, her expression guarded. "Why do you care how I cure my catch? You don't look like a cook."

### Mention-triggered tool description — final narration

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

---

## Case 3: Inspecting the ferry (run 1)

**Player action**

> I examine the rope ferry closely, checking its construction and how many people it can carry.

### Previous tool description — final narration

> You limp to the edge of the dock, your boots heavy with the mud of the road. You crouch low—a slow, stiff movement that makes your knees pop—and peer at the craft moored there.
> 
> It is a crude thing: two thick logs lashed together with hempen cords that have greyed from years of exposure to the gloamwater. A simple wooden platform sits atop them, though it dips noticeably to the left, as if the wood on one side had soaked up more of the river's milk-pale water than the other. 
> 
> A heavy iron ring, rusted to a pale, chalky blue, secures the ferry to a thick guide rope that stretches out into the mist. You lean in to inspect the knots holding the platform to the logs; they are frayed and weathered, but still holding. The deck is barely wide enough for two people to stand without jostling each other—any more than that and the whole thing would likely tip, spilling its passengers into the silent current. 
> 
> As you straighten up, your aching feet throb in protest. You catch yourself reaching for a loose strand of rope dangling from the mooring post, and before you've even consciously decided to do it, your ink-stained fingers have already tied a small, tight tollow-knot in the fiber.

### Mention-triggered tool description — final narration

> You limp toward the edge of the dock, your boots heavy on the damp planks. The ferry waits there, a flat rectangle of weathered grey timber lashed together with thick, salt-crusted cords. It lists noticeably to the left, dipping into the milk-pale gloamwater as if burdened by an invisible weight.
> 
> You lean over the railing to inspect the lashings. They are made of hemp and twine, frayed at the edges but still holding firm against the slow pull of the river. The raft is small—barely wide enough for two people to stand side-by-side without brushing shoulders. A heavy iron ring is bolted into the center beam, its surface coated in a thin layer of pale blue rust. 
> 
> Attached to this ring is the main guide rope, a thick cable that stretches taut across the silent water and vanishes into the mist on the far bank. You reach out with your ink-stained right hand, running your fingers over a loose strand of twine trailing from the mooring line. Without thinking, you deftly tie it into a small, tight tollow-knot, leaving the luck-charm dangling there as you stand back up, wiping your palm on your trousers.

---

## Case 4: Quietly observing the water and dock (run 1)

**Player action**

> I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.

### Previous tool description — final narration

> You stand at the edge of the dock, your weight shifted slightly to avoid putting pressure on your aching heels. You keep your gaze fixed downward, avoiding the figures waiting nearby.
> 
> The gloamwater is a flat, opaque white, like milk poured into a wide stone basin. It doesn't ripple; it only slides, a slow and heavy movement that makes no sound against the pilings. Where the water laps at the wooden posts, the wood is bleached bone-pale and slick with a thin layer of translucent slime. 
> 
> The planks beneath your boots are grayed by age and salt, their grain raised in rough, splintering ridges. You trace a long crack running along one board, noting how it curves around a heavy iron nail head. The nail has rusted to a muted, pale blue, the color of a winter sky just before dusk. A small puddle of rainwater sits trapped in a depression in the wood, reflecting the dim light of the hanging lantern in a perfect, distorted circle. 
> 
> Your ink-stained fingers twitch at your side. You notice a loose strand of twine trailing from one of the mooring posts, whipping softly in the damp breeze. Without looking up, you reach down and catch it, your calloused thumbs working the hemp into a tight, familiar tollow-knot for luck.

### Mention-triggered tool description — final narration

> You stand at the edge of the dock, your weight shifting slightly as your footsore feet ache beneath your boots. You keep your gaze downward, avoiding the ferryman and the woman waiting beside him. 
> 
> The gloamwater is a flat, milky white, stretching out like a sheet of poured porcelain. There are no ripples here, no eddies swirling around the wooden pilings, and not a single fish breaks the surface. The river is utterly silent. 
> 
> Beneath your boots, the planks of Sedge Landing are silvered by age and salt, their grain raised in rough, weathered ridges that catch the dim light. Where iron nails hold the dock together, they have bled a pale blue rust into the surrounding wood—a soft, chalky stain rather than the deep orange of common decay. 
> 
> Your ink-stained hands rest at your sides, the missing fingers of your left hand leaving a gap you've long since stopped noticing. You breathe slowly, feeling the winded tightness in your chest, simply watching the way the pale water meets the dark, sodden wood of the pier.

---

## Case 5: Asking the ferryman — his lore already loaded (run 1)

**Player action**

> I ask the ferryman when he stops making crossings and study his sleeve and jewelry as he replies.

### Previous tool description — final narration

> You shift your weight, trying to ease the ache in your soles, and ask when he stops making crossings for the day. 
> 
> The ferryman doesn't answer immediately. He stands with his back to the milk-pale water, his frame broad and weathered like a piece of driftwood. Your eyes drift to his left side; the heavy woolen sleeve of his coat is pinned up neatly against his chest, empty. A single brass ring catches the dim light in his left earlobe, dull and scratched.
> 
> He turns his gaze toward the horizon where the mist swallows the far bank. 
> 
> "When the light goes," he says, his voice dry as dead grass. "I don't cross gloamwater after dark."

### Mention-triggered tool description — final narration

> You shift your weight, feeling the dull ache in your feet as you look up at the ferryman. "When do you stop making crossings?" you ask, your voice soft against the heavy silence of the gloamwater.
> 
> The man doesn't answer immediately. He stands broad and weathered, his gaze fixed on the mist-shrouded river. As he finally speaks, you let your eyes drift to his left side. A thick sleeve is pinned neatly up at the shoulder, empty and still. In his left ear, a simple brass ring catches what little light remains in the sky.
> 
> "After dark," he says, the words dry and clipped. "No crossings once the sun dips."

---

## Case 6: Greeting both people — ferryman lore already loaded (run 1)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### Previous tool description — final narration

> You limp toward the small firepit, your feet aching with every step on the damp planks of the dock. The smoke from the fire carries the pungent, salty scent of cured fish. 
> 
> The ferryman sits on a low stool, his single right arm resting on his knee, his left sleeve pinned neatly to his shoulder. Beside him, a woman stands wrapped in a heavy wool shawl, her face marked by a jagged scar that runs from temple to jaw. She stares at the milk-pale water of the gloamwater, ignoring you entirely.
> 
> When you ask them who they are, the ferryman doesn't look up. He just nods toward the rope ferry listing in the mist. 
> 
> "I pull the rope," he says, his voice dry as parchment. "For a coin, I'll take you across. Until the sun goes down."
> 
> The woman finally turns her head. Her eyes are hard, narrowed with suspicion. She doesn't speak. She simply reaches into her shawl and pulls out a small wooden pipe, tapping it against her palm before turning back to the silent river. 
> 
> Neither of them gives you a name.

### Mention-triggered tool description — final narration

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

---

## Case 7: Greeting both people (run 2)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### Previous tool description — final narration

> You hobble across the creaking planks of the dock, each step a slow negotiation with your aching feet. The wood groans under your weight, a sharp contrast to the eerie silence of the milk-pale water lapping at the pilings.
> 
> The ferryman looks up as you approach. He leans against the leaning post, his single arm crossed over his chest. His eyes are tired, shadowed by a wide-brimmed hat that has seen better years. 
> 
> "I pull the rope," he says, his voice a low rasp. "If the sun's still up, I'll take you across. If it's gone, you wait on the bank." He doesn't offer a name; he just gestures with a tilt of his chin toward the ferry listing slightly to the left.
> 
> The woman by the firepit—a small, crackling thing built from river stones—doesn't look up immediately. She is busy turning a skewer of eels over the coals, the pungent, salty scent of smoking fish hanging heavy in the damp air. A jagged scar runs down her cheek, disappearing into the collar of her rough wool tunic. 
> 
> She glances at you once, her eyes narrowing as they take in your ink-stained fingers and the missing digits of your left hand. She doesn't speak. She just spits into the fire, watches the embers hiss, and goes back to her work.

### Mention-triggered tool description — PARTIAL NARRATION — cut off

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

---

## Case 8: Asking about eel preparation (run 2)

**Player action**

> I approach the woman smoking eels and quietly study her face and hair while asking how she prepares the fish.

### Previous tool description — final narration

> Your feet ache with every step across the uneven planks of the dock, a dull throb that makes your pace slow and heavy. You approach the woman crouched by the firepit, the scent of acrid smoke clinging to the damp air. 
> 
> Up close, you see her clearly: she is small and wiry, her movements quick and efficient as she tends to the eels. A jagged burn scar stretches across her right cheek, pulling the skin tight in a way that suggests an old injury. Braided into her dark, salt-crusted hair is a single green glass bead that catches the dim light of the hanging lantern.
> 
> "How do you prepare them?" you ask softly, your voice barely carrying over the dead silence of the gloamwater.
> 
> The woman doesn't look up immediately. She continues to turn an eel with a blackened stick, her gaze fixed on the fish. When she finally glances at you, her eyes are narrow and guarded.
> 
> "Salt. Smoke. Patience," she says curtly. "Nothing more." 
> 
> She shifts her weight, moving the firepit slightly to put a few more inches of distance between herself and you, then returns her attention to her work without offering her name.

### Mention-triggered tool description — final narration

> You limp toward the firepit, your boots heavy and aching. The woman is small and quick, her hands moving with practiced efficiency as she tends to the eels.
> 
> As you draw near, you catch sight of a green glass bead braided into her hair, catching the dim light. A burn scar cuts across her right cheek, puckering the skin in a way that makes her expression seem perpetually skeptical. She doesn't look up when you approach, but her shoulders tense.
> 
> "How do you prepare them?" you ask softly.
> 
> She stops mid-motion, holding a wooden skewer. Her eyes flick to yours, then down to your ink-stained hands and the missing fingers of your left hand. She doesn't answer immediately. Instead, she turns back to the pit and begins counting the eels hanging over the smoke—one, two, three—before counting them again.
> 
> "Salt and willow-smoke," she says finally, her voice dry. "Two days in the box, then a week over the fire." She looks at you again, narrowed eyes tracking your gaze. "You're a long way from any town with a market."

---

## Case 9: Inspecting the ferry (run 2)

**Player action**

> I examine the rope ferry closely, checking its construction and how many people it can carry.

### Previous tool description — final narration

> You limp toward the water's edge, each step a slow negotiation with your aching feet. The dock boards groan under your weight, wet and slick with river mist.
> 
> The ferry is a simple thing: two thick, weathered logs lashed together with heavy hemp rope. It lists noticeably to the left, riding unevenly in the milk-pale water. There are no seats, only a flat wooden platform just wide enough for two people to stand or sit cross-legged without jostling. 
> 
> You lean over to inspect the guiding cable that stretches across the river, vanishing into the fog. The iron rings securing the raft to the line are pitted and corroded, but the rust is a pale, ghostly blue rather than the usual orange. You run your ink-stained fingers along the rough hemp of the mooring line, feeling its tension. 
> 
> The gloamwater laps silently against the logs, leaving no sound at all. The ferry waits, a small wooden island in the stillness, capable of carrying only you and one other across the silent stretch.

### Mention-triggered tool description — final narration

> You limp closer to the water's edge, your sore feet protesting each step on the damp planks of Sedge Landing. The ferry waits there—a flat wooden raft that looks barely sturdy enough to hold a single person, let alone two. It lists heavily to the left, dipping low into the milk-pale gloamwater as if it's tired of floating.
> 
> You run your ink-stained fingers along the main rope, feeling the rough texture of the tar coating. It's thick and black, stretched taut across the silent river to a point lost in the mist. You note the way the raft is tethered; the pulleys are worn, and the wood of the raft shows signs of age and decay, though it seems functional enough for a careful crossing. 
> 
> You spot a loose end of hemp rope trailing from the mooring post. Without thinking, your fingers move with practiced ease, tying a small, intricate tollow-knot for luck before you step back to survey the whole thing. It's a two-person raft at most, and given the tilt, anyone crossing would need both hands firmly on that tar-black rope to keep from slipping into the pale water.

---

## Case 10: Quietly observing the water and dock (run 2)

**Player action**

> I keep my attention on the pale water and the dock planks, silently studying their colors and textures without interacting with anyone.

### Previous tool description — final narration

> You stand still on the rickety planks of Sedge Landing, your gaze fixed downward. The wood beneath your boots is greyed by salt and age, splintering at the edges where the grain has surrendered to the damp. 
> 
> Below, the gloamwater laps at the pilings with a soundless, heavy rhythm. It is thick and milk-pale, lacking any transparency; it does not ripple so much as it folds over itself like poured cream. A few stray bubbles rise to the surface and pop without a sound.
> 
> Near the mooring post, the iron rings that hold the rope ferry in place are coated in a thick, chalky crust of pale blue rust. A single flake breaks off and drifts into the water, disappearing instantly into the opacity. 
> 
> You feel the ache in your feet through your boots—a dull, thrumming heat that makes the simple act of standing feel like a chore. Your breath comes shallow and slow, still catching in your chest from the trek to the riverbank. 
> 
> A few paces away, a woman stands wrapped in a heavy, oil-slicked coat that smells faintly of peat smoke and cured fish. She watches you with one eye, her face marked by a long, silvered scar that runs from temple to jaw, but she says nothing. The ferryman, a man missing his right arm from the shoulder down, leans against the listing raft, chewing on a piece of straw. He too is silent, waiting for you to move or speak.

### Mention-triggered tool description — final narration

> The water doesn't ripple so much as shift, a thick, curdled white that looks more like spilled milk than river. It holds no reflection of the gray sky above, only a dull, matte surface that swallows the light. You crouch low, your sore feet throbbing in time with your heartbeat, and study the dock planks beneath you. They are silvered by age and salt, the grain raised in rough, splintering ridges that catch the grit of travel on your boots.
> 
> Where iron nails hold the notices to the leaning post, the rust has spread in a pale blue bloom, a cold color that looks almost like a fungus rather than oxidation. The ferry lists heavily to the left, its heavy hempen rope taut and wet, disappearing into the milk-pale depths. 
> 
> A few feet away, the ferryman stands motionless, his single arm resting on the tiller. Further down the dock, the eel-smoker waits in silence, the sharp, briny scent of her trade clinging to the damp air. You hear nothing from them—the gloamwater seems to eat the sound of their breathing, the creak of the wood, and the distant calls of gulls, leaving only the heavy, oppressive quiet of the river.

---

## Case 11: Asking the ferryman — his lore already loaded (run 2)

**Player action**

> I ask the ferryman when he stops making crossings and study his sleeve and jewelry as he replies.

### Previous tool description — final narration

> The dock creaks beneath your weight as you shift your stance, trying to ease the ache in your feet. You look up at the ferryman—a broad man with a face like a piece of driftwood, weathered and lined. 
> 
> "When do you stop making crossings?" you ask softly.
> 
> He doesn't answer right away. He reaches up with his right hand to adjust the brass ring hanging from his left ear, the metal dull and tarnished. Your eyes drift down to his left shoulder. The sleeve of his heavy wool coat is pinned neatly against his side, empty and flat. 
> 
> "At dusk," he says, his voice dry and short. "I don't cross after dark."
> 
> He looks out over the milk-pale water of the gloamwater, where the mist swallows the far bank. He hasn't told you his name, and you haven't offered yours.

### Mention-triggered tool description — final narration

> You shift your weight from one foot to the other, feeling the dull ache in your heels as you look up at the ferryman. "When do you stop making crossings?" you ask.
> 
> He doesn't answer immediately. He stands beside the listing raft, his broad chest blocking most of the light from the leaning lantern post. As he finally speaks, your eyes drift to his left ear, where a thick brass ring catches the dim light. Your gaze follows the line of his shoulder down to his left side; the sleeve of his heavy coat is empty, pinned neatly against his torso with a rusted blue safety pin.
> 
> "When the light fails," he says, his voice dry and short. "I don't cross after dark."

---

## Case 12: Greeting both people — ferryman lore already loaded (run 2)

**Player action**

> I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

### Previous tool description — final narration

> You shift your weight, feeling the ache in your swollen feet as you approach the firepit. The smoke from the smoking eels clings to your clothes. You offer a soft-spoken greeting, asking them to tell you a little about themselves.
> 
> The woman at the firepit pauses mid-motion. She has a green glass bead braided into her hair and a burn scar that pulls at the corner of her right cheek. She looks you up and down—at your ink-stained hands, your missing fingers, your travel-worn boots—then glances at the river behind you. She doesn't answer. Instead, she turns back to the fire, picking up a smoked eel and counting it aloud under her breath: "One... two." She counts again, just to be sure.
> 
> The ferryman stands by the leaning post, his left sleeve pinned up where his arm should be. He has a brass ring through his ear and skin like old leather. He looks at you with flat eyes, then looks at the horizon.
> 
> "I pull a rope," he says. "That's all there is to it."
> 
> He doesn't offer a name. Neither does she. Over the milk-pale stretch of gloamwater, the silence feels thick, as if words spoken here might simply vanish before they reach another ear.

### Mention-triggered tool description — final narration

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
