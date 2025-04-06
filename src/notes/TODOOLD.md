add stat value to AI call

pass statupdates obj to panel to display +5 next to stat name

switch to 3 calls
- game text (stream)
- choices (stream)
- stat updates
optionals:
- traits update
- inventory
- equipment
- images

yaml format
-----
switch to completion endpoint

language box + prompt

reorganize setting into tabs:
- gameplay
- ai endpoint
- ai settings
- (opt)storage: download/upload all/clear all saves, space used

Number/Category stat
- Expression default 3d model

Allow edit

Image panels based on stat
- layered checkbox?
------

TTS:
- either Piper or https://www.npmjs.com/package/kokoro-js
- Show tts button next to edit
 - open modal with initialize settings if not initialized
 - otherwise show voice settings and generate
 - generated audio stored in message history, shown on top of the pagination

Add surface desc to entities and location
- current desc only used if present
- surface available always


World Info: key value