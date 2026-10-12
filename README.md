# Plsworkdumbo

An original real-time territory-conquest game (single player vs bots), written from scratch in plain JS/canvas. No build step, no subscription.

Run: open `index.html` in a browser (or `python3 -m http.server`). Start a new conquest from the opening menu; pause or resume with the HUD button or Escape.

- Click neighboring land to expand/attack; the slider sets the share of troops sent. Ships let you attack distant coastal land.
- Build cities for increased troop growth and gold, ports on the coast for gold, and ships (220 gold) by selecting Ship and clicking one of your ports. Ships carry troops on naval landings; failed landings lose the ship.
- Drag to pan and use the mouse wheel to zoom. The menu includes a quick controls guide.
- Bots expand, weigh their chances before attacking, and make their own peace, alliance, and treaty decisions. They may also send you offers to accept or reject. Right-click a nation to manage diplomacy. Win by owning a set share of land (60% by default) or being last alive.
- Rendering is smoothed (supersampled terrain, blurred territory) so there are no visible tiles.
- Customization: pick your territory colour, difficulty, opponents (2-40), map (or Random for a fresh map style each game), land amount, starting size/troops/gold and the land share needed to win.
- Shop & locker: earn coins from each game (land held + victory bonus) and spend them on country flags/skins, territory patterns, building sets and ship skins, then equip them. Progress is saved in localStorage.
- Defense posts (120g): enemies pay triple to capture them.

Not yet implemented: multiplayer, nukes.
