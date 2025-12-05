/**
 * Clipper.js utilities for robust path offsetting and boolean operations.
 *
 * This module handles converting SVG paths to Clipper polygons,
 * offsetting them (to create corridor walls), and unioning overlapping
 * shapes to produce clean, non-overlapping outlines for laser cutting.
 */

import ClipperLib from 'clipper-lib';

// Clipper works with integers, so we scale up coordinates for precision
const CLIPPER_SCALE = 1000;

interface Point {
    X: number;
    Y: number;
}

type Path = Point[];
type Paths = Path[];

/**
 * Approximates an SVG arc as a series of line segments.
 * SVG arc: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
 */
function arcToPoints(
    startX: number,
    startY: number,
    rx: number,
    ry: number,
    xAxisRotation: number,
    largeArcFlag: number,
    sweepFlag: number,
    endX: number,
    endY: number,
    segmentsPerArc: number = 32
): Point[] {
    // Handle degenerate cases
    if ((startX === endX && startY === endY) || rx === 0 || ry === 0) {
        return [{ X: endX * CLIPPER_SCALE, Y: endY * CLIPPER_SCALE }];
    }

    // Convert to center parameterization
    // Based on SVG spec: https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter
    const phi = (xAxisRotation * Math.PI) / 180;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    // Step 1: Compute (x1', y1')
    const dx = (startX - endX) / 2;
    const dy = (startY - endY) / 2;
    const x1p = cosPhi * dx + sinPhi * dy;
    const y1p = -sinPhi * dx + cosPhi * dy;

    // Correct radii if needed
    let rxSq = rx * rx;
    let rySq = ry * ry;
    const x1pSq = x1p * x1p;
    const y1pSq = y1p * y1p;

    const lambda = x1pSq / rxSq + y1pSq / rySq;
    if (lambda > 1) {
        const sqrtLambda = Math.sqrt(lambda);
        rx *= sqrtLambda;
        ry *= sqrtLambda;
        rxSq = rx * rx;
        rySq = ry * ry;
    }

    // Step 2: Compute (cx', cy')
    let sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq));
    sq = Math.sqrt(sq);
    if (largeArcFlag === sweepFlag) {
        sq = -sq;
    }
    const cxp = sq * (rx * y1p) / ry;
    const cyp = sq * -(ry * x1p) / rx;

    // Step 3: Compute (cx, cy) from (cx', cy')
    const cx = cosPhi * cxp - sinPhi * cyp + (startX + endX) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (startY + endY) / 2;

    // Step 4: Compute theta1 and dtheta
    const theta1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
    let dtheta = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx) - theta1;

    if (sweepFlag === 0 && dtheta > 0) {
        dtheta -= 2 * Math.PI;
    } else if (sweepFlag === 1 && dtheta < 0) {
        dtheta += 2 * Math.PI;
    }

    // Generate points along the arc
    const points: Point[] = [];
    const numSegments = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / segmentsPerArc)));

    for (let i = 1; i <= numSegments; i++) {
        const t = theta1 + (i / numSegments) * dtheta;
        const xr = rx * Math.cos(t);
        const yr = ry * Math.sin(t);
        const x = cosPhi * xr - sinPhi * yr + cx;
        const y = sinPhi * xr + cosPhi * yr + cy;
        points.push({ X: Math.round(x * CLIPPER_SCALE), Y: Math.round(y * CLIPPER_SCALE) });
    }

    return points;
}

/**
 * Parses SVG path data and converts it to Clipper-compatible paths (arrays of points).
 * Each sub-path (starting with M) becomes a separate path.
 */
export function svgPathToClipperPaths(pathD: string): Paths {
    const paths: Paths = [];
    let currentPath: Path = [];
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;

    // Regex to match SVG path commands
    const commandRegex = /([MmLlHhVvAaZz])([^MmLlHhVvAaZz]*)/g;
    let match;

    while ((match = commandRegex.exec(pathD)) !== null) {
        const cmd = match[1];
        const argsStr = match[2].trim();
        const args = argsStr ? argsStr.split(/[\s,]+/).map(Number) : [];

        switch (cmd) {
            case 'M': // Absolute moveto
                if (currentPath.length > 0) {
                    paths.push(currentPath);
                }
                currentPath = [];
                currentX = args[0];
                currentY = args[1];
                startX = currentX;
                startY = currentY;
                currentPath.push({ X: Math.round(currentX * CLIPPER_SCALE), Y: Math.round(currentY * CLIPPER_SCALE) });
                // Implicit lineto for additional coordinate pairs
                for (let i = 2; i < args.length; i += 2) {
                    currentX = args[i];
                    currentY = args[i + 1];
                    currentPath.push({ X: Math.round(currentX * CLIPPER_SCALE), Y: Math.round(currentY * CLIPPER_SCALE) });
                }
                break;

            case 'm': // Relative moveto
                if (currentPath.length > 0) {
                    paths.push(currentPath);
                }
                currentPath = [];
                currentX += args[0];
                currentY += args[1];
                startX = currentX;
                startY = currentY;
                currentPath.push({ X: Math.round(currentX * CLIPPER_SCALE), Y: Math.round(currentY * CLIPPER_SCALE) });
                for (let i = 2; i < args.length; i += 2) {
                    currentX += args[i];
                    currentY += args[i + 1];
                    currentPath.push({ X: Math.round(currentX * CLIPPER_SCALE), Y: Math.round(currentY * CLIPPER_SCALE) });
                }
                break;

            case 'L': // Absolute lineto
                for (let i = 0; i < args.length; i += 2) {
                    currentX = args[i];
                    currentY = args[i + 1];
                    currentPath.push({ X: Math.round(currentX * CLIPPER_SCALE), Y: Math.round(currentY * CLIPPER_SCALE) });
                }
                break;

            case 'l': // Relative lineto
                for (let i = 0; i < args.length; i += 2) {
                    currentX += args[i];
                    currentY += args[i + 1];
                    currentPath.push({ X: Math.round(currentX * CLIPPER_SCALE), Y: Math.round(currentY * CLIPPER_SCALE) });
                }
                break;

            case 'H': // Absolute horizontal lineto
                for (const x of args) {
                    currentX = x;
                    currentPath.push({ X: Math.round(currentX * CLIPPER_SCALE), Y: Math.round(currentY * CLIPPER_SCALE) });
                }
                break;

            case 'h': // Relative horizontal lineto
                for (const dx of args) {
                    currentX += dx;
                    currentPath.push({ X: Math.round(currentX * CLIPPER_SCALE), Y: Math.round(currentY * CLIPPER_SCALE) });
                }
                break;

            case 'V': // Absolute vertical lineto
                for (const y of args) {
                    currentY = y;
                    currentPath.push({ X: Math.round(currentX * CLIPPER_SCALE), Y: Math.round(currentY * CLIPPER_SCALE) });
                }
                break;

            case 'v': // Relative vertical lineto
                for (const dy of args) {
                    currentY += dy;
                    currentPath.push({ X: Math.round(currentX * CLIPPER_SCALE), Y: Math.round(currentY * CLIPPER_SCALE) });
                }
                break;

            case 'A': // Absolute arc
                for (let i = 0; i < args.length; i += 7) {
                    const arcPoints = arcToPoints(
                        currentX, currentY,
                        args[i], args[i + 1],      // rx, ry
                        args[i + 2],                // x-axis-rotation
                        args[i + 3], args[i + 4],  // large-arc, sweep
                        args[i + 5], args[i + 6]   // end x, y
                    );
                    currentPath.push(...arcPoints);
                    currentX = args[i + 5];
                    currentY = args[i + 6];
                }
                break;

            case 'a': // Relative arc
                for (let i = 0; i < args.length; i += 7) {
                    const endX = currentX + args[i + 5];
                    const endY = currentY + args[i + 6];
                    const arcPoints = arcToPoints(
                        currentX, currentY,
                        args[i], args[i + 1],
                        args[i + 2],
                        args[i + 3], args[i + 4],
                        endX, endY
                    );
                    currentPath.push(...arcPoints);
                    currentX = endX;
                    currentY = endY;
                }
                break;

            case 'Z':
            case 'z': // Closepath
                if (currentPath.length > 0) {
                    currentPath.push({ X: Math.round(startX * CLIPPER_SCALE), Y: Math.round(startY * CLIPPER_SCALE) });
                }
                currentX = startX;
                currentY = startY;
                break;
        }
    }

    if (currentPath.length > 0) {
        paths.push(currentPath);
    }

    return paths;
}

/**
 * Offsets open paths (polylines) by a given distance, creating the corridor walls.
 * Returns closed polygons representing the outlined shape.
 */
export function offsetPaths(paths: Paths, distance: number, joinType: 'round' | 'square' | 'miter' = 'round'): Paths {
    const co = new ClipperLib.ClipperOffset();

    const jt = joinType === 'round' ? ClipperLib.JoinType.jtRound :
               joinType === 'square' ? ClipperLib.JoinType.jtSquare :
               ClipperLib.JoinType.jtMiter;

    // Add each path as an open polyline
    for (const path of paths) {
        if (path.length >= 2) {
            co.AddPath(path, jt, ClipperLib.EndType.etOpenRound);
        }
    }

    const result = new ClipperLib.Paths();
    co.Execute(result, distance * CLIPPER_SCALE);

    return result;
}

/**
 * Creates a circle as a Clipper polygon.
 */
export function createCircle(cx: number, cy: number, radius: number, segments: number = 64): Path {
    const points: Path = [];
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * 2 * Math.PI;
        points.push({
            X: Math.round((cx + radius * Math.cos(angle)) * CLIPPER_SCALE),
            Y: Math.round((cy + radius * Math.sin(angle)) * CLIPPER_SCALE)
        });
    }
    return points;
}

/**
 * Unions multiple polygons together, removing overlaps.
 */
export function unionPolygons(polygons: Paths): Paths {
    if (polygons.length === 0) return [];
    if (polygons.length === 1) return polygons;

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(polygons, ClipperLib.PolyType.ptSubject, true);

    const result = new ClipperLib.Paths();
    clipper.Execute(
        ClipperLib.ClipType.ctUnion,
        result,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
    );

    return result;
}

/**
 * Converts Clipper paths back to SVG path data string.
 */
export function clipperPathsToSvgPath(paths: Paths): string {
    let d = '';
    for (const path of paths) {
        if (path.length === 0) continue;

        d += `M ${(path[0].X / CLIPPER_SCALE).toFixed(3)} ${(path[0].Y / CLIPPER_SCALE).toFixed(3)} `;
        for (let i = 1; i < path.length; i++) {
            d += `L ${(path[i].X / CLIPPER_SCALE).toFixed(3)} ${(path[i].Y / CLIPPER_SCALE).toFixed(3)} `;
        }
        d += 'Z ';
    }
    return d.trim();
}

/**
 * Main function: Takes SVG path data and corridor width, returns outlined SVG path.
 * This handles the full pipeline: parse -> offset -> union -> convert back.
 */
export function createOutlinedPaths(
    pathD: string,
    corridorWidth: number,
    joinType: 'round' | 'square' | 'miter' = 'round'
): string {
    // Parse SVG path to Clipper paths
    const paths = svgPathToClipperPaths(pathD);

    // Offset paths by half the corridor width (creates the outline)
    const offsetDistance = corridorWidth / 2;
    const offsetted = offsetPaths(paths, offsetDistance, joinType);

    // Union all offsetted polygons to remove overlaps
    const unioned = unionPolygons(offsetted);

    // Convert back to SVG path
    return clipperPathsToSvgPath(unioned);
}

/**
 * Creates a complete maze outline including corridors, boundary, center hole, and entry hole.
 */
export function createMazeOutline(
    mazePathD: string,
    entrancePathD: string,
    corridorWidth: number,
    outerRadius: number,
    holeRadius: number,
    joinType: 'round' | 'square' | 'miter' = 'round',
    entryHolePosition?: { x: number; y: number }
): { corridors: string; boundary: string; centerHole: string; entryHole: string } {
    // Parse and offset maze paths
    const mazePaths = svgPathToClipperPaths(mazePathD);
    const entrancePaths = entrancePathD ? svgPathToClipperPaths(entrancePathD) : [];
    const allPaths = [...mazePaths, ...entrancePaths];

    const offsetDistance = corridorWidth / 2;
    const offsetted = offsetPaths(allPaths, offsetDistance, joinType);

    // Union all corridor polygons
    const corridorPolygons = unionPolygons(offsetted);

    // Create boundary circle
    const boundaryCircle = createCircle(0, 0, outerRadius, 128);

    // Create center hole
    const centerHole = createCircle(0, 0, holeRadius, 64);

    // Create entry hole at the specified position
    const entryHole = entryHolePosition
        ? createCircle(entryHolePosition.x, entryHolePosition.y, holeRadius, 64)
        : [];

    return {
        corridors: clipperPathsToSvgPath(corridorPolygons),
        boundary: clipperPathsToSvgPath([boundaryCircle]),
        centerHole: clipperPathsToSvgPath([centerHole]),
        entryHole: entryHole.length > 0 ? clipperPathsToSvgPath([entryHole]) : ''
    };
}

export { CLIPPER_SCALE };
