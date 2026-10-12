# Plsworkdumbo

An original real-time territory-conquest game (single player vs bots), written from scratch in plain JS/canvas. No build step, no subscription.

Run: open `index.html` in a browser (or `python3 -m http.server`).

- Click land to expand/attack; the slider sets the share of troops sent.
- Economy: troops and gold grow with territory; build cities (more troops/gold) and ports (coast only, gold).
- 14 bots expand and attack the weakest neighbour. Win by owning 70% of land or being last alive.
- Rendering is smoothed (supersampled terrain, blurred territory) so there are no visible tiles.

Not yet implemented: multiplayer, naval units, nukes, alliances.
