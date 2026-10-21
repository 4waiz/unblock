# UNBLOCK brag video plan (voiceover cut)

**What it is:** a planner that shows which barriers stop wheelchair users reaching hospitals, schools and shops, and which repairs give back the most access for the money.
**For:** city planners and accessibility teams. **Sets it apart:** it decides *what to repair* under a budget and measures the gain on the real street network.
**Hook:** "Al Ahalia Hospital is six hundred metres away. Unless you use a wheelchair."
**Tone:** polished civic launch. Landscape 1920×1080, 30 fps, 37.6 s (longer than the usual 20 s to fit narration and a full simulation run).
**Voice:** Kokoro `af_heart`, generated locally (`npx hyperframes tts`), one clip per line, music ducked under the voice.

Footage is one continuous screen recording of the real app (`/#app`, dev build) driven through the story: travellers on the routes, the stairs repair, the crossing ripple, and the optimizer's simulation run (16 repairs applied one by one with pulse rings and the street network redrawing). All numbers on screen and in the voiceover come from that run: 62% → 73% for one crossing; 62% → 80% and +53 homes for the AED 500K plan; 2.2× the access gain of cheapest-first. Barriers and costs are made-up pilot data; the outro says so.

## Script and storyboard

| Time | Scene | Voiceover | On screen |
|---|---|---|---|
| 0.0–5.0 | Hook | "Al Ahalia Hospital is six hundred metres away." / "Unless you use a wheelchair." | Blurred journey footage; the two lines, second in red |
| 5.0–7.0 | Reveal | "This is Unblock." | Logo pop, UNBLOCK, tagline |
| 7.0–12.4 | Stairs | "One flight of stairs turns that short trip into a one point seven kilometre detour." | Walker stops at the stairs in a red pulse; wheelchair takes the long amber route. Caption: "One flight of stairs. A 1.7 km detour." |
| 12.6–16.2 | Repair | "So we fix it on the map first. Six hundred metres again." | Repair ripple; the wheelchair now takes the short green route. Caption: "Fix it on the map first. 600 m again." |
| 16.4–22.4 | Crossing | "One repaired crossing takes hospital access from sixty-two to seventy-three percent of homes." | Planner; B-28 repaired with pulse ring, streets turn cyan. Caption: "One crossing. Hospital access 62% → 73%" |
| 22.6–33.0 | Simulation | "Now give it a budget, and Unblock simulates the plan, repair by repair." / "Fifty-three more homes can reach a hospital. Twice the access of fixing the cheapest first." | Optimizer bars, then the simulation run with the progress card; push-in on the card. Top captions. A soft tick per repair. |
| 33.0–37.6 | Outro | "Unblock. Fix one sidewalk. Unlock a neighbourhood." | Logo, UNBLOCK, unblock.kanbanstudios.ae, data note |

Music: Happy Beats vol. 10 (110 BPM), sidechain-ducked under the voice, fade out over the last 1.4 s.
