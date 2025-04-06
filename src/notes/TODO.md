(d) allow users to upload and edit worlds without having to download everytime
(d) fix bug: Location tab Desc showing prompt instead of in-game desc
(d) allow 3d model to exceed 100% (compare against base 100, not current max value)
(d) remove audio size limit
(d) load menu: move download save button to front, move upload save button outside scroll


check Trap quest

add warning to prompts missing tags



import character cards



add module to query appearance change

add endpoint params

add name feature

add <Player Notes>


add world author and version

Linked stats



JSExecutor: simple logic run after AI stat update, input/output stat values only
- input: dict of stats
- outputL ditct of stats

simple fastapi server:
- cache the metadata of each world created, use static links for all uploaded assets
- only auth is password (store hash)

-------------------------------

(opt) move GameViewer stats to usecontext

Modules
- Choices
- Status Updates
- Trait Updates

Debug info:
- print total prompt characters
- console log network errors + toast error.message

Add surface desc to entities and location
- current desc only used if present
- surface available always

World Info: key value

allow delete stat changes from traits.

fix slime stat update typo