# QuantaRoute — Full Build Prompt
# Quantum-Inspired Traffic Route Optimization Web App
# SIH 2025 · PS #26137 · Egreen Quanta

---

## PROJECT BRIEF

Build a single-page, fully client-side web application called **QuantaRoute** that
implements a Quantum Particle Swarm Optimization (QPSO) algorithm for solving the
Vehicle Routing Problem (VRP) on an interactive graph. No backend. No auth. No
unnecessary pages. One screen, one purpose.

This is a technical tool for engineers and hackathon judges — it should feel like
precision software built by a domain expert, not a dashboard template.

---

## STACK

- React 18 + Vite
- Antigravity (layout primitives ONLY: Box, Stack, Grid, Text)
- D3.js v7 (graph canvas — node/edge rendering, route drawing)
- Recharts (convergence line chart — one chart only)
- Google Fonts (Syne, DM Sans, IBM Plex Mono)
- Web Worker (QPSO computation — keeps UI non-blocking)
- No other UI libraries. No Tailwind. No MUI. No Chakra.

---

## DESIGN TOKENS
### Apply these as CSS custom properties on :root before anything else.
### Override ALL Antigravity default tokens with these values.

```css
:root {
  --bg:       #0F0F0F;
  --surface:  #1A1A1A;
  --border:   #2E2E2E;
  --text:     #EDEDED;
  --muted:    #757575;
  --accent:   #C8F04A;
  --alert:    #E85D3A;
  --success:  #3ABA7A;

  --font-heading: 'Syne', sans-serif;
  --font-body:    'DM Sans', sans-serif;
  --font-mono:    'IBM Plex Mono', monospace;

  --radius:   3px;
  --radius-sm: 2px;
}
```

### Typography rules
- Headings: Syne, weight 700, letter-spacing -0.02em
- Body / labels: DM Sans, weight 400, size 14px
- Data values (fitness score, β, iteration count): IBM Plex Mono only
- 3 font sizes maximum: 28px (heading), 14px (body), 11px (label)
- No all-caps labels. No tracked-out letter-spacing on body text.

### Colour rules
- No gradients anywhere — not on buttons, not on panels, not on the canvas
- No box-shadow — use 1px solid var(--border) instead
- --accent (#C8F04A) is used for: optimal route path, Run button, active
  slider thumb, focused input border. Nothing else.
- --alert (#E85D3A) is used for: constraint violations, error states only
- --success (#3ABA7A) is used for: satisfied constraints, convergence indicator
- Background panels: --surface. Nested panels: #212121 (one step lighter only)

### Shape rules
- border-radius max 3px on every element including inputs and buttons
- No pill-shaped buttons
- No rounded cards

---

## LAYOUT

Fixed viewport layout. No page scroll. No sidebar collapse animations.

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER  52px                                                    │
├────────────────┬────────────────────────────┬────────────────────┤
│                │                            │                    │
│  LEFT PANEL    │   CENTRE — D3 CANVAS       │   RIGHT PANEL      │
│  260px fixed   │   fills remaining width    │   300px fixed      │
│                │                            │                    │
│  Config only   │   Interactive graph        │   Output only      │
│                │   Nodes, edges, routes     │                    │
│                │                            │                    │
├────────────────┴────────────────────────────┴────────────────────┤
│  STATUS BAR  36px                                                │
└──────────────────────────────────────────────────────────────────┘
```

- Header: app name left, three plain-text meta labels right (PS #26137 · SIH 2025 · Transportation)
- Left and right panels: overflow-y auto if content overflows, no visible scrollbar
- Centre canvas: D3 SVG, fills 100% of available width and height
- Status bar: fixed to bottom, 1px border-top only

---

## HEADER (52px)

Left side:
- App name "QuantaRoute" in Syne 700 18px, color --text
- A single dot separator (·) in --muted
- Subtitle "VRP Optimizer" in DM Sans 13px --muted

Right side (plain text row, no buttons):
- "PS #26137" in IBM Plex Mono 11px --muted
- "·" separator
- "SIH 2025" in IBM Plex Mono 11px --muted
- "·" separator
- "Egreen Quanta" in DM Sans 11px --muted

No logo. No icon. No navigation links. No theme toggle.

---

## LEFT PANEL — CONFIG (260px)

Section label style: DM Sans 11px --muted, margin-bottom 8px.
Input style: full width, background --surface, border 1px solid --border,
color --text, font DM Sans 14px, padding 6px 10px, border-radius var(--radius).
On focus: border-color --accent, no box-shadow, no glow.

### Network section
- "Network" label
- Nodes in graph: read-only counter (IBM Plex Mono 14px --text) — updates as user adds nodes
- Edges in graph: read-only counter same style
- [ Load Sample Network ] — plain text button, no background, color --accent,
  font DM Sans 13px, cursor pointer, underline on hover only. Loads a
  preset 12-node weighted graph.
- [ Clear Canvas ] — same style, color --muted

### Vehicles section
- "Vehicles" label
- Number of vehicles: number input, min 1 max 10, default 3
- Vehicle capacity: number input, default 60
- (no other vehicle fields)

### Algorithm section
- "Algorithm" label
- Swarm size: range slider, min 10 max 200, default 50, step 10
  Show current value in IBM Plex Mono 12px to the right of slider
- Max iterations: range slider, min 50 max 500, default 300, step 50
  Show current value same style
- Beta start: range slider 0.5–1.5, step 0.1, default 1.0
- Beta end: range slider 0.1–0.9, step 0.1, default 0.5

Slider style: track background --border, filled portion --accent,
thumb: 12px circle, background --accent, no box-shadow, border none.

### Objective weights section
- "Objective Weights" label
- Alpha (distance): number input, default 1.0, step 0.1
- Beta-w (time): number input, default 1.0, step 0.1
- Gamma (congestion): number input, default 0.5, step 0.1

### Run controls
- [ Run QPSO ] button: full width, background --accent, color #0F0F0F,
  font Syne 700 14px, padding 10px, border-radius var(--radius),
  border none, cursor pointer.
  On hover: background #b8dc3a (slightly darker). No transform. No shadow.
  Disabled state while running: background --border, color --muted, cursor not-allowed.
- Below button: "Running..." plain text in DM Sans 13px --muted, visible only while running.

### DO NOT ADD to left panel:
- No accordions or collapsible sections
- No tooltips on every label
- No info icons
- No preset buttons row

---

## CENTRE PANEL — D3 GRAPH CANVAS

This is the primary view. It gets maximum space. Keep it clean.

### Canvas background
- Fill: #0F0F0F (matches --bg)
- Very subtle noise texture via SVG feTurbulence filter (opacity 0.03) —
  gives it a paper feel without being visible as texture
- No grid lines. No axis labels. No watermark.

### Node rendering
- Regular node: circle r=10, fill --surface, stroke --border, stroke-width 1.5
- Depot node: rect 20×20 (square), fill --surface, stroke --accent, stroke-width 2
- Destination node: circle r=12, fill --surface, stroke --accent, stroke-width 2
- Node label: node ID in IBM Plex Mono 10px --muted, centered
- Demand label: small number below node in IBM Plex Mono 9px --muted
- Selected node (during edge creation): stroke --text, stroke-width 2

### Edge rendering
- Regular edge: line, stroke #2E2E2E, stroke-width 1
- Edge weight label: IBM Plex Mono 9px --muted at midpoint of edge
- Arrowhead: small marker, color --border
- No curved edges — straight lines only

### Route rendering (post-optimization)
- Vehicle 1 optimal route: stroke --accent (#C8F04A), stroke-width 2.5
- Vehicle 2 route: stroke #3ABA7A, stroke-width 2
- Vehicle 3+ routes: stroke #757575, stroke-width 1.5
- Route direction shown by arrowhead at destination end only
- Route animates draw-on progressively using stroke-dashoffset over 800ms

### Interactions
- Click empty canvas area: place new node at cursor position
- Click node, then click another node: creates a directed edge between them,
  prompts for weight via a plain inline input that appears near the edge midpoint
  (not a modal — an absolutely positioned input element)
- Right-click node: shows a minimal context menu (plain div, --surface background,
  --border border, no shadow) with three text options:
    "Set as depot"  /  "Set as destination"  /  "Delete node"
- Drag node: repositions it, edges follow
- No zoom. No pan. Fit-to-canvas on load.

### While QPSO is running
- Every 20 iterations: redraw the current best route on the canvas
- Particles are NOT visualised (too noisy) — only the current best path updates
- A thin horizontal progress bar appears at the very top of the canvas (2px height),
  filling left to right in --accent colour as iterations progress
  Disappears on completion.

---

## RIGHT PANEL — OUTPUT (300px)

Show only after Run is clicked. Before first run: plain text
"Configure the network and run the optimizer." in DM Sans 14px --muted, centered vertically.

### Best solution block
- Label "Best fitness" in DM Sans 11px --muted
- Value: large IBM Plex Mono 32px --text
- Below: "↓ X.X% vs baseline Dijkstra" in DM Sans 12px --success if improvement,
  --alert if worse. No icon — plain text arrow character only.

### Convergence chart
- Recharts LineChart, height 160px
- Two lines: QPSO (--accent, strokeWidth 2), PSO baseline (--muted, strokeWidth 1, dashed)
- No fill under lines (type="monotone", dot={false})
- X axis: "Iteration" label, --muted color, no grid lines
- Y axis: "Fitness" label, --muted color, no grid lines
- No Recharts default card shadow or background
- Tooltip: plain, --surface background, --border border, IBM Plex Mono 11px

### Route breakdown
- Label "Routes" in DM Sans 11px --muted
- One row per vehicle:
    "V1  depot → 3 → 7 → 1 → depot   18.4 km"
  In IBM Plex Mono 11px --text
  Row has padding-bottom 6px, border-bottom 1px solid --border
  No alternating row colors

### Constraint status
- Label "Constraints" in DM Sans 11px --muted
- Three rows, each: indicator dot (6px circle) + label + status text
    ● Capacity        Satisfied   (dot --success, status DM Sans 12px --success)
    ● Time windows    2 violated  (dot --alert, status --alert)
    ● All nodes visited  Yes      (dot --success)
- No badge pills. No icon. Just a colored dot and plain text.

### DO NOT ADD to right panel:
- No summary "cards" with big emoji
- No export button (not needed for hackathon demo)
- No share button
- No animation on metric values

---

## STATUS BAR (36px)

Single row, border-top 1px solid --border, background --bg, padding 0 16px.
Three sections: left / centre / right, space-between.

Left:
- While idle: "Ready" in DM Sans 13px --muted
- While running: "Iteration 47 / 300" in IBM Plex Mono 12px --text (live update)
- On complete: "Converged at iteration 183" in DM Sans 13px --success

Centre:
- "β  0.823" in IBM Plex Mono 12px --muted (updates live while running)
- Hidden while idle

Right:
- Elapsed time: "0.0s" counting up in IBM Plex Mono 12px --muted while running
- On complete: shows final time, stops counting

---

## QPSO LOGIC (Web Worker)

File: `src/workers/qpso.worker.js`

Implement the full QPSO algorithm in JavaScript. The worker receives a config
message and posts progress messages back every 20 iterations.

### Message protocol

```js
// Main → Worker (start)
worker.postMessage({
  type: 'RUN',
  config: {
    nodes: [...],         // array of { id, x, y, demand, timeWindow, serviceTime }
    edges: [...],         // array of { from, to, distance, travelTime }
    numVehicles: 3,
    vehicleCapacity: 60,
    swarmSize: 50,
    maxIterations: 300,
    betaStart: 1.0,
    betaEnd: 0.5,
    alpha: 1.0,
    betaW: 1.0,
    gamma: 0.5,
  }
})

// Worker → Main (progress, every 20 iterations)
self.postMessage({
  type: 'PROGRESS',
  iteration: 40,
  bestFitness: 142.3,
  bestRoutes: [[0,3,7,1,0], [0,2,5,0]],
  beta: 0.91,
  diversity: 0.34,
})

// Worker → Main (complete)
self.postMessage({
  type: 'COMPLETE',
  bestFitness: 118.7,
  bestRoutes: [[0,3,7,1,0], [0,2,5,0]],
  convergenceHistory: [310.2, 290.1, ..., 118.7],
  totalIterations: 183,
  elapsedMs: 2140,
})
```

### Core QPSO equations to implement in JS

```
// 1. Mean best position
mbest = mean of all particles' personal best positions

// 2. Local attractor per particle per dimension
phi = random(0, 1)
p[d] = phi * pbest[d] + (1 - phi) * gbest[d]

// 3. Characteristic length
L[d] = 2 * beta * abs(mbest[d] - position[d])

// 4. Position update
u = random(0, 1)
sign = random() > 0.5 ? 1 : -1
newPosition[d] = p[d] + sign * (L[d] / 2) * Math.log(1 / (u + 1e-10))
newPosition[d] = clamp(newPosition[d], 0, 1)

// 5. Beta linear decay each iteration
beta = betaStart - (betaStart - betaEnd) * (iteration / maxIterations)
```

### Solution encoding
- Each particle is a Float64Array of length = num_customers
- Values in [0, 1] represent customer priority
- Decode by sorting customers by priority value, then greedily assigning
  to vehicles respecting capacity constraint

### Fitness function
```
F = alpha * totalDistance
  + betaW * totalTravelTime
  + gamma * congestionPenalty
  + 1000 * capacityViolation^2
  + 500  * timeWindowViolation^2
  + 1000 * unvisitedNodes^2
```

---

## SAMPLE NETWORK (Load Sample Network button)

Hard-code this 12-node instance in `src/data/sampleNetwork.js`:

```js
export const sampleNetwork = {
  nodes: [
    { id: 0, x: 300, y: 250, demand: 0,  label: 'Depot',   isDepot: true },
    { id: 1, x: 120, y: 100, demand: 12, label: 'N1',      timeWindow: [0, 80] },
    { id: 2, x: 200, y: 60,  demand: 8,  label: 'N2',      timeWindow: [10, 90] },
    { id: 3, x: 420, y: 80,  demand: 15, label: 'N3',      timeWindow: [0, 70] },
    { id: 4, x: 500, y: 150, demand: 10, label: 'N4',      timeWindow: [20, 100] },
    { id: 5, x: 480, y: 320, demand: 18, label: 'N5',      timeWindow: [0, 60] },
    { id: 6, x: 380, y: 400, demand: 7,  label: 'N6',      timeWindow: [30, 110] },
    { id: 7, x: 200, y: 380, demand: 14, label: 'N7',      timeWindow: [0, 80] },
    { id: 8, x: 100, y: 300, demand: 9,  label: 'N8',      timeWindow: [15, 95] },
    { id: 9, x: 160, y: 200, demand: 11, label: 'N9',      timeWindow: [0, 75] },
    { id: 10, x: 340, y: 180, demand: 6, label: 'N10',     timeWindow: [10, 85] },
    { id: 11, x: 420, y: 280, demand: 13, label: 'N11',    timeWindow: [5, 90] },
  ],
  // fully connected — distances computed from coordinates
}
```

---

## FILE STRUCTURE

```
quantaroute/
├── index.html
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── theme.css                  ← CSS custom properties, global resets
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── LeftPanel/
│   │   │   ├── LeftPanel.jsx
│   │   │   ├── NetworkSection.jsx
│   │   │   ├── VehicleSection.jsx
│   │   │   ├── AlgorithmSection.jsx
│   │   │   └── RunControls.jsx
│   │   ├── GraphCanvas/
│   │   │   ├── GraphCanvas.jsx    ← D3 lives entirely inside here
│   │   │   ├── useD3Graph.js      ← custom hook for D3 logic
│   │   │   └── RouteLayer.js      ← draws routes on the SVG
│   │   ├── RightPanel/
│   │   │   ├── RightPanel.jsx
│   │   │   ├── FitnessDisplay.jsx
│   │   │   ├── ConvergenceChart.jsx
│   │   │   ├── RouteBreakdown.jsx
│   │   │   └── ConstraintStatus.jsx
│   │   └── StatusBar.jsx
│   ├── workers/
│   │   └── qpso.worker.js
│   ├── data/
│   │   └── sampleNetwork.js
│   └── utils/
│       ├── graphUtils.js          ← distance calc, edge weight helpers
│       └── vrpCodec.js            ← encode/decode solution vectors
```

---

## GLOBAL CSS RESETS (theme.css)

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.5;
  height: 100vh;
  overflow: hidden;
}

/* Override Antigravity layout tokens only */
[data-ag-box], [data-ag-stack], [data-ag-grid] {
  --ag-radius: var(--radius);
  --ag-shadow: none;
  --ag-border-color: var(--border);
}

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}

input[type="number"],
input[type="text"] {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 14px;
  padding: 6px 10px;
  border-radius: var(--radius);
  width: 100%;
  outline: none;
}
input:focus {
  border-color: var(--accent);
}

/* No Antigravity card shadows */
.ag-card, [class*="ag-card"] {
  box-shadow: none !important;
  border: 1px solid var(--border) !important;
}
```

---

## WHAT NOT TO BUILD — STRICT LIST

Do not add any of these. If a library adds them automatically, remove them:

- Landing page or splash screen
- Navigation tabs or route-based pages
- Modal dialogs (use inline interactions instead)
- Tooltip on every label
- Icon for every item (no icon libraries)
- Skeleton loaders
- Toast / snackbar notifications
- Animated background (no particles, no moving grid)
- Gradient on any element
- Box shadow on any element
- Glassmorphism / backdrop-filter
- Zebra striping on tables/lists
- Emoji in UI labels
- Random symbols filling empty space
- Export / download buttons
- Share buttons
- Dark/light mode toggle
- Responsive mobile layout (this is a desktop tool)
- Collapsible sidebar with animation
- Four or more charts in the right panel
- Per-particle animation in the canvas

---

## DEFINITION OF DONE

The app is complete when:

1. User can load the sample network and see 12 nodes on the canvas
2. User can manually add nodes by clicking and connect them with weighted edges
3. User can configure all QPSO parameters in the left panel
4. Clicking Run QPSO starts the Web Worker, status bar updates live every 20 iterations
5. The canvas redraws the current best route every 20 iterations
6. On completion: right panel shows best fitness, convergence chart, route breakdown,
   and constraint status
7. The convergence chart shows QPSO line vs a simulated PSO baseline
8. No layout breaks, no console errors, no frozen UI during optimization
9. The entire app looks like it was built for this specific problem —
   not assembled from a component kit

