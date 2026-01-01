# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maze MAS 2025 is a React/TypeScript web application that generates circular "puck mazes" - laser-cut ready mazes where a ball/puck navigates from the outer edge to the center.

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run preview    # Preview production build
```

## Architecture

### Core Data Flow

1. `MazeConfig` (types.ts) defines maze parameters
2. `generateMaze()` (lib/mazeGenerator.ts) produces `MazeData` with SVG path strings
3. `MazeViewer` renders SVG and handles DXF export

### Maze Generation Algorithm

The generator in `lib/mazeGenerator.ts` uses a **Growing Tree algorithm** on a polar coordinate graph:

- Creates concentric rings of nodes, with more nodes on outer rings (proportional to circumference)
- Uses weighted neighbor selection with **inertia** (momentum to continue direction) and **inward bonus** (encourages weaving back toward center)
- Difficulty adjusts `branchProb` (0.1-0.42) and `inertiaWeight` (440-200)
- Outputs SVG path data using Lines (radial moves) and Arcs (circumferential moves)
- Solution path traces parent pointers from the "hardest" outer node (highest score based on path length, radial inflections, and total rotation)

### DXF Export Pipeline

`MazeViewer.tsx:handleExportDXF()` uses Clipper.js for path operations:

1. Parses SVG path data
2. Expands stroke width to create corridor walls
3. Unions all corridor segments
4. Adds outer boundary circle and exports to DXF

### Key Configuration Types

```typescript
interface MazeConfig {
  diameter: number;      // Total size in mm
  wallWidth: number;     // Minimum wall thickness in mm
  corridorWidth: number; // Puck/ball track width in mm (becomes stroke-width)
  difficulty: number;    // 1-5, affects branching and path complexity
  cornerRounding: boolean; // Round vs miter joins
  seed: number;          // PRNG seed for reproducibility
  holeRadius: number;    // Entry and center hole radius in mm
  showEntryWedge: boolean; // Removable wedge cutout for middle layer
}
```

## Dependencies

- **React 19** + TypeScript
- **Vite** - Build tool
- **clipper-lib** - Path offsetting and boolean operations
- **makerjs** - CAD operations
- **lucide-react** - Icons
- **Tailwind CSS** (CDN) - Styling
