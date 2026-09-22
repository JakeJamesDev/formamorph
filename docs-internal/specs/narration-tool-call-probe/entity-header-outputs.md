# Narration comparison

**Only final narration appears here — the text the player would see.** Each player action is followed by the Section-definitions baseline output, then the Entity header output. All returned narration text is reproduced without edits. Incomplete outputs are explicitly labeled; see measurements for completion counts.

Only the entity-list header changes.

**Section-definitions baseline** = the saved baseline.

**Entity header** = the new candidate.

[Thinking only](entity-header-thinking.md) · [Measurements](entity-naming-findings.md) · [Exact candidate prompt](entity-header-prompt.md)

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

### Entity header — final narration

> You limp toward the small circle of light cast by the firepit, your boots heavy with the day's travel. You offer a soft greeting to the two figures gathered there, asking them who they are.
> 
> The ferryman looks up at you. He is a broad, weathered man with only one arm; his left sleeve is pinned to his shoulder. A brass ring catches the lantern light in his left ear. He gives you a slow, measuring look before turning back to the rope mooring.
> 
> "I run the boat," he says. His voice is dry as old parchment. "And I don't cross after dark."
> 
> Beside him, the woman tending the firepit doesn't look up immediately. She is small and quick-moving, flipping a river-eel over the coals with a wooden fork. A burn scar runs across her right cheek, and a single green glass bead is braided into her hair. She counts the eels as she works—one, two, one, two—before finally glancing at you. Her eyes are narrow and guarded.
> 
> "I smoke the catch," she says shortly. "And I wait for the boat."
> 
> Neither offers a name. They simply stand there in the hushed air of the landing, watching you with the quiet suspicion of people who have learned not to trust a stranger's curiosity.

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

### Entity header — final narration

> You limp closer, each step heavy and slow from the miles you've already walked. Your boots scuff against the damp wood of Sedge Landing as you stop beside the small firepit where the woman works. 
> 
> She is a quick-moving thing, her hands darting over the eels with practiced efficiency. You study her face—a burn scar marks her right cheek, pulling at the corner of her mouth. A single green glass bead is braided into her hair, catching the dim light. She doesn't look up at you at first, but you can tell she knows you're there; she shifts her weight slightly, keeping a distance.
> 
> "How do you prepare them?" you ask softly, your voice barely carrying over the dead silence of the gloamwater.
> 
> The woman pauses, her knife hovering over one of the fish. She glances at you sideways, squinting through the smoke. Her eyes flick to your ink-stained hands, then back to the eels. 
> 
> "I salt them first," she says, her tone clipped and wary. "Three days in a brine cask. Then I hang them here, over the coals." She picks up a small stick and pokes at the fire, sending a flurry of sparks upward. "The smoke keeps them from spoiling. And it gives them a flavor that doesn't taste like river mud."
> 
> She counts out three eels and sets them aside on a clean leaf, her fingers moving in a precise, repetitive rhythm. She hasn't looked you in the eye yet.

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

### Entity header — final narration

> You step closer to the edge of the dock, your boots creaking on the weathered planks. The raft is a simple thing—flat wooden boards lashed together, though the whole craft lists heavily to the left, dipping toward the milk-pale surface of the gloamwater. 
> 
> A single rope, thick and coated in tar-black pitch, stretches taut across the river, disappearing into the mist on the far bank. You run your ink-stained hand along the guide rail; it's clear that anyone crossing will need both hands clamped tight to that rope to keep from sliding off the slanted deck. It is a small vessel, barely wide enough for two people to stand abreast without jostling one another.

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

### Entity header — final narration

> You shift your weight from one foot to the other, the dull ache in your heels reminding you of the miles already walked. You keep your gaze low, avoiding eye contact with the others waiting on the dock, and focus instead on the textures beneath you.
> 
> The wooden planks are weathered and grey, their grain raised in rough ridges that you can trace with the tips of your ink-stained fingers. In some places, the wood is slick with a thin film of algae; in others, it is splintered and bleached pale by the sun. 
> 
> Beyond the edge of the dock, the gloamwater stretches out, milk-pale and eerily still. It doesn't ripple or lap against the posts; it simply sits there, heavy and silent. The color isn't quite white—it's more like old bone or watered-down chalk, swallowing the light without reflecting it. 
> 
> Near the leaning post where the lantern hangs, a heavy iron nail holds up a weather-beaten notice. The nail has corroded over time, but the rust is a pale, powdery blue rather than orange, dusting the grey wood around it like fallen pigment. You watch a single drop of condensation roll down the metal, leaving a faint turquoise streak in its wake.

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

### Entity header — final narration

> You shift your weight, feeling the ache in your heels as you lean against a weathered piling. The milk-pale water of the gloamwater laps soundlessly against the dock. You look toward the ferryman and ask when he stops making crossings for the day.
> 
> As you speak, your eyes drift to his left shoulder. His sleeve is pinned up tight, empty and motionless. A simple brass ring glints in his left ear, catching what little light filters through the mist.
> 
> He doesn't look at you immediately. He keeps his gaze on the rope leading across the river. "When the sun hits the treeline," he says. His voice is dry, like parchment rubbing together. "Not a soul crosses after dark."

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

### Entity header — final narration

> You step toward the small firepit, your boots heavy and your feet aching with every movement. The smoke from the river-eels smells sharp and salty in the damp air.
> 
> The man with the brass ring looks up at you. He doesn't smile; he just nods once, his single arm resting on a wooden post. "Running the ferry," he says shortly. "Until dark." 
> 
> The woman by the fire doesn't look up from her work. She is busy turning an eel with a blackened stick, her movements quick and precise. She glances at you sideways, the green glass bead in her hair catching the dim light of the lantern. "Smoke eels," she says, her voice tight. "Sell them across the water." 
> 
> Neither of them offers a name. They watch you with quiet, guarded eyes, waiting to see if you are just passing through or if you intend to stay long enough to matter.

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

### Entity header — final narration

> You step toward the firepit, your boots heavy and aching as you approach. The smoke from the eels smells sharp and salty in the damp air.
> 
> The woman looks up at you, her eyes narrowing. She doesn't speak; she simply reaches out with a scarred hand and shifts one of the drying eels to a different rack, then shifts it back again, counting them under her breath. She gives you a sideways glance—evaluating your ink-stained fingers and your silver hair—but says nothing about who she is.
> 
> The ferryman grunts. He's leaning against the post, his empty left sleeve pinned neatly to his shoulder. He doesn't offer a name. Instead, he gestures with his remaining hand toward the milk-pale river and the rope raft listing beside the dock.
> 
> "Crossings cost," he says, his voice dry as old parchment. "One copper. Only if it's still light."

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

### Entity header — final narration

> You limp toward the firepit, each step a dull ache in your heels. The smell of singed fat and river-mud hangs heavy in the damp air. 
> 
> The woman is small and moves with a quick, nervous energy, her hands darting between the smoking eels. As you draw closer, you see a burn scar cutting across her right cheek—old tissue, pale and puckered. A single green glass bead catches the dim light, braided tightly into the coarse strands of her hair.
> 
> You keep your voice low, barely above a murmur. "How do you prepare them?"
> 
> She doesn't look up immediately. She finishes poking an eel with a blackened stick, counting it under her breath—*one, two*—before sliding it onto a rack. Only then does she glance at you, her eyes narrowed and wary.
> 
> "Wood-smoke and patience," she says curtly. "And not talking to strangers while the fish are on the fire."

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

### Entity header — final narration

> You limp closer to the edge of the rickety dock, your boots heavy and your feet aching with every step. The raft sits low in the milk-pale water, a simple flat wooden platform that lists heavily to the left. 
> 
> You lean over to inspect its construction, noticing how the wood is weathered and grey. A single tar-black rope is strung across the gloamwater, the ferry attached to it by a series of worn rings. It's clear from the size of the raft and the tension of the rope that it can carry two people at most—any more would likely swamp the listing craft. You notice a loose end of hemp trailing from the mooring post; without thinking, your ink-stained fingers reach out to tie a neat, small tollow-knot in the fibers for luck.

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

### Entity header — final narration

> The milk-pale water of the gloamwater stretches out before you, thick and unnervingly still. It doesn't ripple or lap against the shore; it simply sits there, a heavy, silent expanse that seems to swallow any sound before it can travel. 
> 
> Beneath your boots, the dock planks are greyed and weathered, their grain raised and splintering from years of exposure. Where iron nails hold the wood together, the rust is a pale, ghostly blue—not the orange you've seen elsewhere, but a cold, muted shade that matches the dim light of the mist. 
> 
> Your attention lingers on the way the water meets the wood, a seamless, silent transition. The silence of the gloamwater is absolute, pressing in around you, making the world feel smaller and more intimate. You remain still, observing the textures and colors, your ink-stained hands resting at your sides, as the mist continues to swirl around the moored ferry.

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

### Entity header — final narration

> You shift your weight from one aching foot to the other, the damp chill of the landing seeping through your boots. You look up at the ferryman and ask when he stops making crossings.
> 
> The man does not answer immediately. He is broad and weathered, his face etched with lines like a map of old roads. Your eyes drift to his left shoulder—the sleeve is empty, pinned up neatly against his side. A single brass ring glints in his left earlobe. 
> 
> He finally grunts, the sound dry as parchment. "When the sun hits the ridge," he says. "I don't cross after dark."
> 
> Behind him, the rope ferry lists slightly to the left on the milk-pale water. The iron rings securing the raft to the dock have rusted to a pale, ghostly blue. Beyond the dock, the gloamwater stretches out, dead silent and thick as cream, swallowing all sound before it can reach the far bank.

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

### Entity header — final narration

> You step onto the creaking planks of the dock, your feet aching with every movement. You offer a quiet greeting to the ferryman and the woman hunched over the firepit, asking them what brings them here.
> 
> The man doesn't look up from his work. He is broad and weathered, with only his right arm moving as he adjusts a rope on the raft. A brass ring glints in his left ear. "Ferrying," he says dryly. "Been ferrying since before you could walk."
> 
> The woman at the firepit shifts, her small frame tensing. She has a burn scar across her right cheek and a green glass bead braided into her hair. She is busy turning river-eels over the heat, counting them twice as she moves them to a basket. She glances at you with narrowed eyes but doesn't offer a word in response, her silence as thick as the milk-pale water lapping against the posts.
> 
> Neither of them tells you who they are. Over the gloamwater, where sound seems to flatten and die, their anonymity feels like a heavy weight.
