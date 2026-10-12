# Plsworkdumbo

An original real-time territory-conquest game (single player vs bots), written from scratch in plain JS/canvas. No build step, no subscription.

Run: open `index.html` in a browser (or `python3 -m http.server`). Start a new conquest from the opening menu; pause or resume with the HUD button or Escape.

- Click neighboring land to expand/attack; the slider sets the share of troops sent. Ships let you attack distant coastal land.
- Build cities for increased troop growth and gold, ports on the coast for gold, and ships (220 gold) by selecting Ship and clicking one of your ports. Ships carry troops on naval landings; failed landings lose the ship.
- Drag to pan and use the mouse wheel to zoom. The menu includes a quick controls guide.
- 14 bots expand and attack the weakest neighbour. Win by owning 70% of land or being last alive.
- Rendering is smoothed (supersampled terrain, blurred territory) so there are no visible tiles.
- Customization: pick your territory colour, plus difficulty, opponent count and 7 maps in the menu.
- Shop & locker: earn coins from each game (land held + victory bonus) and spend them on country flags/skins, territory patterns, building sets and ship skins, then equip them. Progress is saved in localStorage.
- Defense posts (120g): enemies pay triple to capture them.

Not yet implemented: multiplayer, nukes, alliances.
