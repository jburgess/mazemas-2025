export interface MazeConfig {
  diameter: number; // in mm
  wallWidth: number; // in mm
  corridorWidth: number; // in mm
  difficulty: number; // 1-5
  cornerRounding: boolean; // boolean
  seed: number;
  holeRadius: number; // radius of center hole and entry hole in mm
}

export interface Point {
  x: number;
  y: number;
}

// Simplified node for the graph-based generator
export interface MazeNode {
  id: string;
  r: number;
  theta: number;
  x: number;
  y: number;
  visited: boolean;
  parent: MazeNode | null;
}

export interface MazeData {
  config: MazeConfig;
  // A string containing the SVG path data for all the corridors (the "puck" tracks)
  pathD: string;
  // A string containing the SVG path data for the solution line
  solutionD: string;
  startPoint: Point;
  endPoint: Point;
  // We keep the raw nodes just in case, but mostly we consume the pre-calculated paths
  nodes: MazeNode[]; 
}

// Minimal type definition for the global makerjs object loaded via CDN
declare global {
    interface Window {
        makerjs: any;
        Bezier: any;
        bezier: any;
        opentype: any;
    }
}