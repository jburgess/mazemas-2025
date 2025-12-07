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

/**
 * Creates a pie-slice wedge shape for the entry cutout.
 * The wedge extends from an apex point to outerRadius, centered at entryAngle.
 * The apex (inner point) is positioned so the opening width = corridorWidth for maintenance access.
 * Uses polyline segments (M/L/Z only) for DXF compatibility.
 */
export function createEntryWedge(
    outerRadius: number,
    innerRadius: number,
    corridorWidth: number,
    entryAngle: number, // radians, typically -π/2 for top
    holeRadius: number, // radius of entry hole, for screw positioning
    arcSegments: number = 32
): { wedgePath: string; screwHoleCenter: { x: number; y: number } } {
    // The wedge meets the corridor with a rounded end (semicircle) matching corridor radius
    // The center of this semicircle is at innerRadius (entry point)
    // The semicircle has radius = corridorWidth/2
    const slotRadius = corridorWidth / 2;

    // Calculate the half-angle at the slot center radius
    // The radial lines extend from the slot ends to the outer boundary
    const halfAngle = Math.asin(slotRadius / innerRadius);

    const angle1 = entryAngle - halfAngle;
    const angle2 = entryAngle + halfAngle;

    // Build the wedge path with ears that extend past outer boundary
    // The ears prevent the wedge from falling through - rubber band holds it in place

    const earExtension = 7; // mm - how far ears extend past outer boundary

    // Ear starts halfway between the corridor (innerRadius) and outer boundary, plus 15%
    const halfwayRadius = (innerRadius + outerRadius) / 2;
    const earStartRadius = halfwayRadius + (outerRadius - innerRadius) * 0.15;

    const pathParts: string[] = [];

    // Slot end points - where wedge meets the corridor, at innerRadius
    const slotX1 = innerRadius * Math.cos(angle1);
    const slotY1 = innerRadius * Math.sin(angle1);
    const slotX2 = innerRadius * Math.cos(angle2);
    const slotY2 = innerRadius * Math.sin(angle2);

    // Start at slot end 1
    pathParts.push(`M ${slotX1.toFixed(3)} ${slotY1.toFixed(3)}`);

    // Line up radial edge to where ear starts (halfway to outer boundary)
    const earStart1X = earStartRadius * Math.cos(angle1);
    const earStart1Y = earStartRadius * Math.sin(angle1);
    pathParts.push(`L ${earStart1X.toFixed(3)} ${earStart1Y.toFixed(3)}`);

    // Ear 1 - extends outward perpendicular to radial line
    // Go outward (away from center of wedge)
    const perpAngle1 = angle1 - Math.PI / 2; // perpendicular, pointing away from wedge center
    const ear1OuterX = earStart1X + earExtension * Math.cos(perpAngle1);
    const ear1OuterY = earStart1Y + earExtension * Math.sin(perpAngle1);
    pathParts.push(`L ${ear1OuterX.toFixed(3)} ${ear1OuterY.toFixed(3)}`);

    // Along ear outer edge (parallel to outer boundary arc, but extended)
    const ear1EndX = (outerRadius * Math.cos(angle1)) + earExtension * Math.cos(perpAngle1);
    const ear1EndY = (outerRadius * Math.sin(angle1)) + earExtension * Math.sin(perpAngle1);
    pathParts.push(`L ${ear1EndX.toFixed(3)} ${ear1EndY.toFixed(3)}`);

    // Back to outer boundary
    const outerX1 = outerRadius * Math.cos(angle1);
    const outerY1 = outerRadius * Math.sin(angle1);
    pathParts.push(`L ${outerX1.toFixed(3)} ${outerY1.toFixed(3)}`);

    // Arc along outer edge from angle1 to angle2
    const outerArcAngle = angle2 - angle1;
    const outerSegments = Math.max(8, Math.ceil(Math.abs(outerArcAngle) / (Math.PI / arcSegments)));
    for (let i = 1; i <= outerSegments; i++) {
        const t = angle1 + (i / outerSegments) * outerArcAngle;
        const x = outerRadius * Math.cos(t);
        const y = outerRadius * Math.sin(t);
        pathParts.push(`L ${x.toFixed(3)} ${y.toFixed(3)}`);
    }

    // Ear 2 - on angle2 side
    const perpAngle2 = angle2 + Math.PI / 2; // perpendicular, pointing away from wedge center
    const ear2StartX = outerRadius * Math.cos(angle2);
    const ear2StartY = outerRadius * Math.sin(angle2);

    // Out to ear
    const ear2OuterX = ear2StartX + earExtension * Math.cos(perpAngle2);
    const ear2OuterY = ear2StartY + earExtension * Math.sin(perpAngle2);
    pathParts.push(`L ${ear2OuterX.toFixed(3)} ${ear2OuterY.toFixed(3)}`);

    // Along ear
    const ear2EndX = (earStartRadius * Math.cos(angle2)) + earExtension * Math.cos(perpAngle2);
    const ear2EndY = (earStartRadius * Math.sin(angle2)) + earExtension * Math.sin(perpAngle2);
    pathParts.push(`L ${ear2EndX.toFixed(3)} ${ear2EndY.toFixed(3)}`);

    // Back to radial edge
    const earEnd2X = earStartRadius * Math.cos(angle2);
    const earEnd2Y = earStartRadius * Math.sin(angle2);
    pathParts.push(`L ${earEnd2X.toFixed(3)} ${earEnd2Y.toFixed(3)}`);

    // Line back to slot end 2
    pathParts.push(`L ${slotX2.toFixed(3)} ${slotY2.toFixed(3)}`);

    // Close path
    pathParts.push('Z');

    const wedgePath = pathParts.join(' ');

    // No screw hole needed - ears hold the wedge in place
    const screwHoleCenter = { x: 0, y: 0 }; // Unused but kept for interface compatibility

    return { wedgePath, screwHoleCenter };
}

/**
 * Creates a simple circle path for a screw hole.
 */
export function createScrewHolePath(cx: number, cy: number, diameter: number, segments: number = 32): string {
    const radius = diameter / 2;
    const points: string[] = [];

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * 2 * Math.PI;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (i === 0) {
            points.push(`M ${x.toFixed(3)} ${y.toFixed(3)}`);
        } else {
            points.push(`L ${x.toFixed(3)} ${y.toFixed(3)}`);
        }
    }
    points.push('Z');

    return points.join(' ');
}

/**
 * Data returned by entry wedge generation
 */
export interface EntryWedgeData {
    wedgePath: string;      // SVG path for wedge outline (cut)
    screwHolePath: string;  // SVG path for 3mm screw hole
}

/**
 * Generates entry wedge paths for export.
 */
export function generateEntryWedgePaths(
    entryHoleX: number,
    entryHoleY: number,
    outerRadius: number,
    corridorWidth: number,
    holeRadius: number // radius of entry hole
): EntryWedgeData {
    // Entry angle is the angle from center to entry point
    const entryAngle = Math.atan2(entryHoleY, entryHoleX);

    // Inner radius is the distance from center to entry point
    const innerRadius = Math.sqrt(entryHoleX * entryHoleX + entryHoleY * entryHoleY);

    const { wedgePath } = createEntryWedge(
        outerRadius,
        innerRadius,
        corridorWidth,
        entryAngle,
        holeRadius
    );

    return {
        wedgePath,
        screwHolePath: '' // No screw hole - ears hold wedge in place with rubber band
    };
}

export { CLIPPER_SCALE };
