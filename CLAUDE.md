# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orbital Maze Gen is a React/TypeScript web application that generates circular "puck mazes" - laser-cut ready mazes where a ball/puck navigates from the outer edge to the center. The app uses Gemini AI to generate custom SVG centerpieces and maze lore.

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run preview    # Preview production build
```

## Architecture

### Core Data Flow

1. `MazeConfig` (types.ts) defines maze parameters →
2. `generateMaze()` (lib/mazeGenerator.ts) produces `MazeData` with SVG path strings →
3. `MazeViewer` renders SVG and handles DXF export

### Maze Generation Algorithm

The generator in `lib/mazeGenerator.ts` uses a **Growing Tree algorithm** on a polar coordinate graph:

- Creates concentric rings of nodes, with more nodes on outer rings (proportional to circumference)
- Uses weighted neighbor selection with **inertia** (momentum to continue direction) and **inward bonus** (encourages weaving back toward center)
- Difficulty adjusts `branchProb` (0.1-0.42) and `inertiaWeight` (440-200)
- Outputs SVG path data using Lines (radial moves) and Arcs (circumferential moves)
- Solution path traces parent pointers from the "hardest" outer node (highest score based on path length, radial inflections, and total rotation)

### DXF Export Pipeline

`MazeViewer.tsx:handleExportDXF()` uses CDN-loaded libraries (MakerJS, Bezier.js, Opentype.js):

1. Imports SVG path data via `makerjs.importer.fromSVGPathData()`
2. Expands stroke width using `makerjs.model.expandPaths()` to create corridor walls
3. Iteratively unions all corridor segments (with progress tracking to avoid browser freeze)
4. Adds outer boundary circle and exports to DXF

### Gemini AI Integration

`services/geminiService.ts` uses `@google/genai` with structured JSON output:
- `generateCenterPiece()`: Creates laser-cut-ready SVG path for maze center
- `analyzeMaze()`: Generates mystical name/lore for the maze

### Key Configuration Types

```typescript
interface MazeConfig {
  diameter: number;      // Total size in mm
  wallWidth: number;     // Minimum wall thickness in mm
  corridorWidth: number; // Puck/ball track width in mm (becomes stroke-width)
  difficulty: number;    // 1-5, affects branching and path complexity
  cornerRounding: boolean; // Round vs miter joins
  seed: number;          // PRNG seed for reproducibility
}
```

## External Dependencies (CDN)

The app loads CAD libraries via CDN in `index.html`:
- **MakerJS**: SVG-to-DXF conversion, path operations (expand, union)
- **Bezier.js**: Required by MakerJS for curve operations
- **Opentype.js**: Required by MakerJS (font handling)

A `window.require` shim maps module names to global objects for MakerJS browser compatibility.

## Environment

Set `GEMINI_API_KEY` in `.env.local` for AI features.
