# Coffee Grinder Dialer

Hosted Version: https://itstongy.github.io/CoffeeGrindDialer/

Retro starfighter inspired helper for tracking espresso shots, nudging grinder settings, and keeping a vibe-heavy log that survives refreshes thanks to `localStorage`.

## Features

- Grinder setup inputs with bounded slider for current step.
- Shot logging form covering dose, ratio, brew time, pressure, temperature, channeling, taste, and a granular puck moisture slider (1–10).
- Gauge cluster that visualizes the overall sweetness score plus sub-dials for brew pressure and puck rating.
- Automatically generated dial-in guidance text with grind step suggestions.
- Local shot history (latest 12 entries) persisted between sessions.

## Getting Started

1. Open `index.html` in your browser (double-click or serve the folder with any static server).
2. Fill out your grinder details and shot data, then click **Evaluate Shot**.
3. The gauges, recommendations, and shot log update instantly; the log sticks around via `localStorage`.

No build step or backend needed—just static HTML/CSS/JS.
