# Plsworkdumbo

An original real-time territory-conquest game (single player vs bots), written from scratch in plain JS/canvas. No build step, no subscription.

Run: open `index.html` in a browser (or `python3 -m http.server`). Start a new conquest from the opening menu; pause or resume with the HUD button or Escape.

- Click neighboring land to expand/attack; the slider sets the share of troops sent. Ships let you attack distant coastal land.
- Build cities for increased troop growth and gold, ports on the coast for gold, and ships by selecting Ship and clicking one of your ports. Ships carry troops on naval landings; failed landings lose the ship. Buildings and ships feature progressive costs based on existing counts.
- **Smart Sea Navigation**: Ships no longer sail straight through islands or land masses. Naval fleets use 8-directional water pathfinding with corner clearance to navigate naturally around coastlines, archipelagos, and peninsulas.
- **Trade Agreements**: When at peace or allied with a nation, you can propose a trade route through right-click diplomacy or accept their trade offers to boost gold income.
  - **Railroads & Trains**: If your nations are connected by land, iron railroads are laid across the territories with rolling locomotives and cargo cars puffing steam.
  - **Maritime Trade Fleets**: If separated by sea and both nations own ports, tiny sailing merchant ships traverse maritime routes between your harbors.
  - **Naval Interception & Sinking**: If enemy warships come near trading vessels, they fire cannons and sink them! Sunk ships tilt and slip underwater with ripple animations before recovering.
- **Naval Combat & Cannons**: Opposing warships crossing paths at sea exchange cannon fire with tracer arcs, water splashes, and troop damage.
- **Sound Effects Engine**: Pure Web Audio synthesizer with sound effects for cannon barrages, naval splashes, trade chimes, peace treaties, and war horns. A sound toggle (`🔊 Sound: ON/OFF`) is available in the top bar.
- Drag to pan and use the mouse wheel to zoom. The menu includes a quick controls guide.
- Bots expand, build fleets to sail and invade across oceans, weigh their chances before attacking, place buildings strategically, and make their own peace, alliance, and treaty decisions. They may also send you offers to accept or reject. Right-click a nation to manage diplomacy. Win by owning a set share of land (60% by default) or being last alive.
- Rendering is smoothed (supersampled terrain, blurred territory) so there are no visible tiles.
- Customization: pick your territory colour, difficulty, opponents (2-40), map (or Random for a fresh map style each game), land amount, starting size/troops/gold and the land share needed to win.
- Shop & locker: earn coins from each game (land held + victory bonus) and spend them on country flags/skins, territory patterns, building sets and ship skins, then equip them. Progress is saved in localStorage.
- Defense posts: enemies pay triple to capture them (both by land and sea).

Not yet implemented: multiplayer, nukes.
