<video src="public/doppelganger-readme.mp4" autoplay loop muted playsinline width="100%"></video>

# 👥 Doppelgänger

[![React](https://img.shields.io/badge/React-19.0-blue.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![D3.js](https://img.shields.io/badge/D3.js-7.9-F9A03F.svg?logo=d3.js)](https://d3js.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg?logo=docker)](https://www.docker.com/)

An AI-native knowledge replication and cognitive twin platform. Doppelgänger compiles human memory fragments (Owner Journal Entries) and explorer prompts (Visitor Queries) into structured, interactive knowledge graphs using stream compaction, context-secure query grounding, and high-fidelity graph visualization.

---

## 🌌 Core Features

*   **Brain Swapping & Profile Navigation**: Securely isolate or hot-swap cognitive profiles (`@chris.adkins`, `@jordan.lee`, `@alex.morgan`) dynamically.
*   **V2 Guided Exploration Flow**: Sleek thread timeline cards layered directly over the background graph simulation, facilitating fluid follow-up exploration.
*   **Stable D3.js Data Joins**: Optimized SVG rendering pattern preserving DOM elements and drag transitions across state renders, preventing gesture breakages.
*   **Context-Aware Autocomplete**: Triggering floating tag suggestions (`#`) and profile references (`@`) inside both search and refinement inputs.
*   **Passphrase-Locked Nodes**: Dynamic encryption mapping. Certain database nodes remain greyed-out and encrypted (`isolated_passphrase`) until their matching key token hashes are unlocked.
*   **Multi-Perspective Answering**: Synthesized response engine displaying citations and attribution timelines from multiple involved doppelgängers.

---

## 🎨 Immersive Design & UI/UX Mechanics

Doppelgänger utilizes a premium, high-contrast dark space UI with glassmorphic depth layers, tailored color families, and pointer-event mechanics.

### 1. Layers & Z-Index Stratification
To optimize spatial layout and screen real estate, interactive panels are placed directly on top of the interactive D3 graph canvas:
*   **Interactive Node Map**: Rendered at the absolute background layer (`z-index: 1`) using SVG.
*   **Scrollable Message Stack**: Positioned in the foreground (`z-index: 2`).
*   **Input Dock Panel**: Floats above the graph canvas at the bottom (`z-index: 3`).
*   **AI Answer Card**: Nested inside the message stack (`z-index: 4`), using `backdrop-filter: blur(16px)` to let underlying nodes bleed through softly.
*   **Ask Question Card**: Anchored at `z-index: 5` to capture structural focus.

### 2. Pointer Event Click-Through Security
To prevent invisible layout wrappers from blocking node click/hover/drag interactions:
*   **Thread Containers**: `.thread-turn-container` uses `pointer-events: none !important` to act as a click-through layer.
*   **Interactive Cards**: Individual question/answer decks explicitly override this with `pointer-events: auto !important` to keep inputs, buttons, and scrolling functional.
*   **Map Nodes**: Circle hitboxes maintain `pointer-events: auto` while labels/text are set to `pointer-events: none` to avoid transparent boundaries overlapping neighbor nodes.

### 3. Dynamic Color Families & Edge Focus
Nodes inherit custom project families recursively matching their Level 1 parents:
*   **Project 1 (Mobile App Redesign)**: Cyan theme (`#22d3ee` / `#155e75`)
*   **Project 2 (Kinetic Type Prototype)**: Red/Pink theme (`#f43f5e` / `#881337`)
*   **Project 3 (Design Sprint Planning)**: Emerald theme (`#34d399` / `#064e3b`)
*   **Project 4 (Branding Framework)**: Amber theme (`#fbbf24` / `#78350f`)
*   **Active vs. Inactive Links**: Connection lines connecting two active (cited) nodes are drawn in the project's brand color, while links connected to inactive (uncited) nodes render in muted grey (`#52525b`).

---

## ⚙️ Architecture

```
                 ┌────────────────────────────────┐
                 │    OWNER NARRATIVE JOURNAL     │
                 └────────────────┬───────────────┘
                                  │
                                  ▼
                 ┌────────────────────────────────┐
                 │     Stream Compaction Engine   │
                 └────────────────┬───────────────┘
                                  │ (Compacts and maps)
                                  ▼
                 ┌────────────────────────────────┐
                 │      9-Node Isolated Matrix    │
                 └────────────────────────────────┘
                                  ▲
                                  │ (Context-secure sweeper)
                 ┌────────────────┴────────────────┐
                 │      VISITOR QUERY SELECTION    │
                 └─────────────────────────────────┘
```

The system operates across two core pipelines:
*   **Narrative Compaction**: Organic text entries are parsed by the AI backend to compile new semantic nodes, archive outdated memories, set encryption status, and build the 9-node structural dependency network.
*   **Visitor Retrieval & Grounding**: Queries extract `@handles` and `#tags` to scope context. Memory records matching `#tags` receive score boosts, and the query returns first-person answers, attribution lists, and cited graph coordinates.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v20+ recommended)
*   Docker & Docker Compose (optional, for containerized run)

### Running Locally (Development)

1.  Clone the repository and navigate to the project root.
2.  Install development dependencies:
    ```bash
    npm install
    ```
3.  Set up environment configuration:
    ```bash
    cp .env.example .env
    # Configure your provider in the .env file:
    # Option A (Gemini): Add your GEMINI_API_KEY
    # Option B (LM Studio): Set endpoint configuration (e.g. http://localhost:1234)
    ```
4.  Launch the development server:
    ```bash
    npm run dev
    ```
    This launches the backend engine on port `3000` (which serves the Vite bundle in development mode).

### Running in Production with Docker (Recommended)

The easiest way to run the fully optimized production builds is via Docker Compose:

1.  Build and launch the containerized application:
    ```bash
    docker compose up -d --build
    ```
2.  Access the application at **`http://localhost:3001`**.
3.  Monitor server logs:
    ```bash
    docker compose logs -f
    ```
4.  Stop the application container:
    ```bash
    docker compose down
    ```

---

## 🧪 Verification & Manual Testing

1.  **Tag Suggestions**: Type `#` in the search or refinement boxes to trigger the floating autocomplete tag list.
2.  **Handle Suggestions**: Type `@` to select between available doppelgänger profiles.
3.  **Active Graph Interactivity**: Enter `"Show all notes for the Mobile App Redesign project"`. Verify that:
    *   Cited nodes appear colored in **Cyan** (including the external node **Offline Sync**).
    *   Uncited background nodes are rendered in grey.
    *   Active links are Cyan, while inactive links are grey.
    *   All nodes (active and inactive) can be clicked to open sidebar drawers and dragged smoothly.
    *   Double-clicking or dragging the background canvas pans and zooms the graph seamlessly.
