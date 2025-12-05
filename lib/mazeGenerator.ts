import { MazeConfig, MazeData, MazeNode, Point } from '../types';

export const generateMaze = (config: MazeConfig): MazeData => {
  const { diameter, wallWidth, corridorWidth, difficulty, seed } = config;

  // PRNG
  let seedValue = seed;
  const random = () => {
    const x = Math.sin(seedValue++) * 10000;
    return x - Math.floor(x);
  };

  const radius = diameter / 2;
  const stepSize = corridorWidth + wallWidth;
  
  // Calculate rings
  const margin = wallWidth;
  const usableRadius = radius - margin - (corridorWidth / 2);
  const numRings = Math.floor(usableRadius / stepSize);

  const nodes: MazeNode[] = [];
  const nodesMap = new Map<string, MazeNode>();

  // 1. Create Grid (Polar Graph)
  const centerNode: MazeNode = {
    id: "0,0",
    r: 0,
    theta: 0,
    x: 0,
    y: 0,
    visited: false,
    parent: null
  };
  nodes.push(centerNode);
  nodesMap.set(centerNode.id, centerNode);

  const ringNodes: MazeNode[][] = [[centerNode]];

  for (let r = 1; r <= numRings; r++) {
    const currentRadius = r * stepSize;
    const circumference = 2 * Math.PI * currentRadius;
    const numCells = Math.round(circumference / stepSize);
    
    const ringRow: MazeNode[] = [];
    for (let c = 0; c < numCells; c++) {
      const theta = (c / numCells) * 2 * Math.PI;
      const x = currentRadius * Math.cos(theta);
      const y = currentRadius * Math.sin(theta);
      
      const node: MazeNode = {
        id: `${r},${c}`,
        r,
        theta,
        x,
        y,
        visited: false,
        parent: null
      };
      
      nodes.push(node);
      nodesMap.set(node.id, node);
      ringRow.push(node);
    }
    ringNodes.push(ringRow);
  }

  // Helper: Get strictly adjacent neighbors
  const getNeighbors = (node: MazeNode): MazeNode[] => {
    const n: MazeNode[] = [];
    
    if (node.r === 0) {
      if (ringNodes[1]) return [...ringNodes[1]];
      return [];
    }

    const myRing = ringNodes[node.r];
    const myIndex = parseInt(node.id.split(',')[1]);
    const myCount = myRing.length;

    // 1. Sideways (CW/CCW)
    const cwIndex = (myIndex + 1) % myCount;
    const ccwIndex = (myIndex - 1 + myCount) % myCount;
    n.push(myRing[cwIndex]);
    n.push(myRing[ccwIndex]);

    // 2. Inward
    if (node.r === 1) {
      n.push(centerNode);
    } else {
      const innerRing = ringNodes[node.r - 1];
      const innerCount = innerRing.length;
      const ratio = innerCount / myCount;
      const innerIndex = Math.round(myIndex * ratio) % innerCount;
      n.push(innerRing[innerIndex]);
    }

    // 3. Outward
    if (node.r < numRings) {
      const outerRing = ringNodes[node.r + 1];
      const outerCount = outerRing.length;
      const ratio = outerCount / myCount;
      const outerIndex = Math.round(myIndex * ratio) % outerCount;
      n.push(outerRing[outerIndex]);
    }

    return n;
  };

  // 2. Generate Maze: Growing Tree Algorithm
  
  const active: MazeNode[] = [];
  centerNode.visited = true;
  active.push(centerNode);

  const edges: {p1: MazeNode, p2: MazeNode}[] = [];
  const entryDirMap = new Map<string, string>();
  
  // --- DIFFICULTY PARAMETERS ---
  
  // Branch Probability:
  // Low Diff: Very low branch prob (0.02) -> Long single snake.
  // High Diff: High branch prob (0.40) -> Many starts to create deep confusion.
  const branchProb = 0.02 + (config.difficulty * 0.08); // Range: 0.1 to 0.42

  // Inertia (Momentum):
  // High Inertia = Smooth curves.
  // We reduce inertia on high difficulty to allow more "random" turns,
  // preventing the spiral trap.
  const inertiaWeight = 500 - (config.difficulty * 60); // Range: 440 down to 200

  // Inward Bonus:
  // Encourages weaving back towards center (hooks/loops).
  const inwardBonus = 1200;

  while (active.length > 0) {
    let currentIndex: number;

    // Selection Strategy (Growing Tree):
    // "Newest" = Recursive Backtracker = Long Paths.
    // "Random" = Prim's = Branching.
    if (random() < branchProb) {
       currentIndex = Math.floor(random() * active.length);
    } else {
       currentIndex = active.length - 1;
    }

    const current = active[currentIndex];
    const neighbors = getNeighbors(current).filter(n => !n.visited);

    if (neighbors.length > 0) {
      // Weighted Random Selection
      const weightedNeighbors = neighbors.map(n => {
        let weight = 100.0;
        
        // Determine direction relative to Current
        let dir = "";
        if (n.r > current.r) dir = "OUT";
        else if (n.r < current.r) dir = "IN";
        else dir = "SIDE";

        const prevDir = entryDirMap.get(current.id);

        if (prevDir) {
            if (prevDir === dir) {
                // INERTIA BONUS: Massive reward for staying the course.
                weight += inertiaWeight;
            } else {
                // CHANGE PENALTY: Slight resistance to changing direction 
                weight -= 50; 
            }
        }

        // SPECIAL MOVE: INWARD HOOK
        if (dir === "IN") {
            weight += inwardBonus;
        }

        // High Difficulty: Punish rushing "OUT" too fast.
        // We want to force it to wind around rings more.
        if (config.difficulty > 3 && dir === "OUT") {
             weight -= 40; // Less penalty than before to allow SOME branches to escape
        }

        // Random jitter
        weight += random() * 50.0;

        // Ensure positive
        return { node: n, dir, weight: Math.max(1, weight) };
      });

      // Sort by weight desc
      weightedNeighbors.sort((a, b) => b.weight - a.weight);
      
      // Pick best
      const chosen = weightedNeighbors[0];
      const neighbor = chosen.node;

      neighbor.visited = true;
      neighbor.parent = current;
      edges.push({ p1: current, p2: neighbor });
      entryDirMap.set(neighbor.id, chosen.dir);

      active.push(neighbor);

    } else {
      active.splice(currentIndex, 1);
    }
  }

  // 3. Find Hardest Start Point and Rotate Maze to Put Entry at Top
  const outerNodes = ringNodes[numRings];
  let startNode = outerNodes[0];
  let maxScore = -Infinity;

  for (const node of outerNodes) {
      let score = 0;
      let curr: MazeNode | null = node;

      let prevRadialDir = 0;
      let inflections = 0;
      let length = 0;
      let totalRotation = 0;

      while (curr.parent) {
          length++;
          const next = curr.parent;

          // Radial Inflections
          let currentRadialDir = 0;
          if (next.r < curr.r) currentRadialDir = 1;
          else if (next.r > curr.r) currentRadialDir = -1;

          if (currentRadialDir !== 0) {
              if (prevRadialDir !== 0 && currentRadialDir !== prevRadialDir) {
                  inflections++;
              }
              prevRadialDir = currentRadialDir;
          }

          // Rotation
          let dTheta = next.theta - curr.theta;
          while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
          while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
          totalRotation += Math.abs(dTheta);

          curr = next;
      }

      // Difficulty Score:
      // High Difficulty = Long paths AND Many switches.
      score = (length * 1) + (inflections * 200) + (totalRotation * 10);

      if (score > maxScore) {
          maxScore = score;
          startNode = node;
      }
  }

  // Rotate entire maze to put the entry point at top (theta = -π/2 in SVG coords)
  const targetTheta = -Math.PI / 2;
  const rotationAngle = targetTheta - startNode.theta;
  const cosR = Math.cos(rotationAngle);
  const sinR = Math.sin(rotationAngle);

  for (const node of nodes) {
      if (node.r === 0) continue; // Center stays at origin

      // Rotate coordinates
      const newX = node.x * cosR - node.y * sinR;
      const newY = node.x * sinR + node.y * cosR;
      node.x = newX;
      node.y = newY;

      // Update theta (normalize to [-π, π])
      node.theta = node.theta + rotationAngle;
      while (node.theta > Math.PI) node.theta -= 2 * Math.PI;
      while (node.theta < -Math.PI) node.theta += 2 * Math.PI;
  }

  // 4. Generate SVG Paths (Stitched for Smoothness)
  // Instead of drawing individual segments, we build a graph and trace continuous lines.
  
  // Build adjacency graph for the MST
  const adjacency = new Map<string, MazeNode[]>();
  edges.forEach(e => {
      if (!adjacency.has(e.p1.id)) adjacency.set(e.p1.id, []);
      if (!adjacency.has(e.p2.id)) adjacency.set(e.p2.id, []);
      adjacency.get(e.p1.id)!.push(e.p2);
      adjacency.get(e.p2.id)!.push(e.p1);
  });

  const pathCommands: string[] = [];
  const processedEdges = new Set<string>();

  // Helper to make edge key
  const getEdgeKey = (n1: MazeNode, n2: MazeNode) => {
      return [n1.id, n2.id].sort().join('-');
  };

  // Traverse graph to find continuous strokes
  // Prefer continuing straight if possible to minimize command count
  const visitedForPath = new Set<string>(); // Visited nodes in path generation context? 
  // Actually, we visit edges.
  
  // Find all leaves (degree 1) to start paths, then junctions (degree > 2)
  const allNodeIds = Array.from(adjacency.keys());
  
  // We will simply do a DFS traversal of the tree.
  // When we hit a branch, we end the current path and start new ones.
  // This stitches segments together allowing stroke-linejoin to work.
  
  const tracePath = (startNode: MazeNode) => {
      const stack = [startNode];
      const seen = new Set<string>();
      seen.add(startNode.id);

      // We need a more robust way to decompose a tree into paths.
      // Simple approach: Start at center. Recurse.
      // If a node has multiple children, start new paths for children.
      // If a node has 1 child, append to current path.
  };

  // Re-approach: Just basic DFS from center.
  // The path string will be a collection of "Move To... Line... Arc...".
  // To make it "Continuous" for stroke-linejoin, we need to minimize "Move To".
  // Ideally, we draw a long line, then backtrack. SVG paths don't support backtracking without lifting pen usually.
  // BUT, we can just draw the longest chains possible.
  
  // Let's find all "Segments". A segment is a path between two junctions (or leaf/root).
  // 1. Identify Junctions (degree != 2)
  const junctions: MazeNode[] = [];
  adjacency.forEach((neighbors, id) => {
      if (neighbors.length !== 2) {
          junctions.push(nodesMap.get(id)!);
      }
  });

  // 2. For each junction, trace outwards to neighbors until another junction is hit.
  const drawnEdges = new Set<string>();

  junctions.forEach(j => {
      const neighbors = adjacency.get(j.id)!;
      neighbors.forEach(n => {
          const edgeKey = getEdgeKey(j, n);
          if (drawnEdges.has(edgeKey)) return;

          // Start a new path segment
          let segmentD = `M ${j.x.toFixed(2)} ${j.y.toFixed(2)}`;
          let curr = j;
          let next = n;
          
          while (true) {
              drawnEdges.add(getEdgeKey(curr, next));
              
              // Draw curr -> next
              if (curr.r !== next.r) {
                  // Line
                  segmentD += ` L ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
              } else {
                  // Arc
                  let dTheta = next.theta - curr.theta;
                  while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
                  while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
                  const sweep = dTheta > 0 ? 1 : 0;
                  const r = curr.r * stepSize;
                  segmentD += ` A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
              }

              // Check if next is a junction or leaf
              const nextNeighbors = adjacency.get(next.id)!;
              if (nextNeighbors.length !== 2) {
                  // It's a junction or leaf (degree 1 or >2). Stop.
                  break;
              }

              // It's a degree 2 node (corridor). Continue to the other neighbor.
              const other = nextNeighbors.find(x => x.id !== curr.id)!;
              curr = next;
              next = other;
          }
          pathCommands.push(segmentD);
      });
  });

  const pathD = pathCommands.join(" ");

  // 5. Solution Path
  const solutionCommands: string[] = [];
  let curr: MazeNode | null = startNode;
  
  if (curr) {
      solutionCommands.push(`M ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`);
      while (curr.parent) {
        const next = curr.parent;
        if (curr.r !== next.r) {
            solutionCommands.push(`L ${next.x.toFixed(2)} ${next.y.toFixed(2)}`);
        } else {
            let dTheta = next.theta - curr.theta;
            while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
            while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
            const sweep = dTheta > 0 ? 1 : 0;
            const r = curr.r * stepSize;
            solutionCommands.push(`A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`);
        }
        curr = next;
      }
  }
  const solutionD = solutionCommands.join(" ");

  return {
    config,
    pathD,
    solutionD,
    startPoint: { x: startNode.x, y: startNode.y },
    endPoint: { x: 0, y: 0 },
    nodes
  };
};