# Maze MAS 2025

A React/TypeScript web application that generates circular "puck mazes" - laser-cut ready mazes where a ball navigates from the outer edge to the center.

**[Live Demo](https://jburgess.github.io/mazemas-2025/)**

## Features

- **Procedural Maze Generation**: Uses a Growing Tree algorithm on polar coordinates
- **Laser-Cut Ready Export**: Generates DXF files ready for laser cutting
- **Reproducible Designs**: Seed-based generation for consistent results
- **Configurable Difficulty**: Adjustable complexity from beginner to expert

## How It Works

The generator creates concentric rings of nodes with more nodes on outer rings (proportional to circumference). A weighted neighbor selection algorithm with **inertia** (momentum to continue direction) and **inward bonus** (encourages weaving toward center) creates engaging, solvable mazes.

The solution path is calculated by finding the "hardest" entry point on the outer edge based on path length, radial inflections, and total rotation.

## Installation

**Prerequisites:** Node.js

```bash
npm install
```

## Usage

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Configuration

| Parameter | Description |
|-----------|-------------|
| `diameter` | Total maze size in mm |
| `wallWidth` | Minimum wall thickness in mm |
| `corridorWidth` | Ball track width in mm |
| `difficulty` | 1-5, affects branching and path complexity |
| `cornerRounding` | Round vs miter joins |
| `seed` | PRNG seed for reproducibility |

## DXF Export

The app exports laser-cut ready DXF files using MakerJS:
1. SVG paths are imported and expanded to create corridor walls
2. All segments are unioned into a single cut path
3. Outer boundary circle is added
4. Exported as DXF compatible with most laser cutters

## Tech Stack

- React 19 + TypeScript
- Vite
- MakerJS (CAD operations)
- Lucide React (icons)

## License

Private project.
