import React, { useRef, useState } from 'react';
import { MazeData } from '../types';
import { Download, ZoomIn, ZoomOut, Eye, EyeOff, FileCog, Loader2, FileDown } from 'lucide-react';
import { createMazeOutline, generateEntryWedgePaths, EntryWedgeData } from '../lib/clipperUtils';

interface MazeViewerProps {
  data: MazeData;
  centerPiece?: { path: string; viewBox: string } | null;
  lore: string;
  showSolution: boolean;
  onToggleSolution: () => void;
}

const MazeViewer: React.FC<MazeViewerProps> = ({ 
    data, 
    centerPiece, 
    lore,
    showSolution,
    onToggleSolution 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const { config, pathD, solutionD } = data;
  
  const padding = 20;
  const viewBoxSize = config.diameter + padding * 2;
  const radius = config.diameter / 2;
  const halfView = viewBoxSize / 2;

  // Calculate entry hole position - on the outer ring, not protruding past the maze boundary
  // The entry hole center should be at the start point (which is on the outermost corridor ring)
  const entryHoleX = data.startPoint.x;
  const entryHoleY = data.startPoint.y;

  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orbital_maze_${config.diameter}mm_seed${config.seed}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSVGOutlined = async () => {
    setIsExporting(true);
    setExportProgress(0);

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        setExportProgress(20);

        // Use Clipper.js for robust path offsetting and boolean union
        // No entrance path - maze is closed, entry is via hole
        const joinType = config.cornerRounding ? 'round' : 'miter';
        const outlines = createMazeOutline(
            pathD,
            '', // No entrance path extending to edge
            config.corridorWidth,
            radius,
            config.holeRadius,
            joinType,
            { x: entryHoleX, y: entryHoleY } // Entry hole position
        );

        setExportProgress(70);

        // Generate wedge data if enabled
        let wedgeData: EntryWedgeData | null = null;
        if (config.showEntryWedge) {
            wedgeData = generateEntryWedgePaths(
                entryHoleX,
                entryHoleY,
                radius,
                config.corridorWidth,
                config.holeRadius
            );
        }

        setExportProgress(80);

        // Generate SVG with outlined paths
        const wedgeSections = wedgeData ? `
  <!-- ENTRY WEDGE (cut from middle layer) -->
  <path d="${wedgeData.wedgePath}" fill="none" stroke="#FF0000" stroke-width="0.1"/>

  <!-- WEDGE SCREW HOLE (3mm) -->
  <path d="${wedgeData.screwHolePath}" fill="none" stroke="#FF0000" stroke-width="0.1"/>
` : '';

        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${config.diameter}mm"
     height="${config.diameter}mm"
     viewBox="${-halfView} ${-halfView} ${viewBoxSize} ${viewBoxSize}">

  <!-- MAZE LAYER -->
  <!-- Corridor outlines (merged, no overlaps) -->
  <path d="${outlines.corridors}" fill="none" stroke="#000000" stroke-width="0.1"/>

  <!-- Outer boundary -->
  <path d="${outlines.boundary}" fill="none" stroke="#000000" stroke-width="0.1"/>

  <!-- Center hole -->
  <path d="${outlines.centerHole}" fill="none" stroke="#000000" stroke-width="0.1"/>

  <!-- Entry hole -->
  <path d="${outlines.entryHole}" fill="none" stroke="#000000" stroke-width="0.1"/>
${wedgeSections}
</svg>`;

        setExportProgress(95);

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `orbital_maze_${config.diameter}mm_seed${config.seed}_outlined.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setExportProgress(100);

    } catch (error: any) {
        console.error("SVG Outlined Export Error:", error);
        alert(`Export failed: ${error.message || "Unknown error"}.`);
    } finally {
        setIsExporting(false);
        setExportProgress(0);
    }
  };

  const handleExportDXF = async () => {
    setIsExporting(true);
    setExportProgress(0);

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        setExportProgress(20);

        // Use Clipper.js for robust path offsetting and boolean union
        // No entrance path - maze is closed, entry is via hole
        const joinType = config.cornerRounding ? 'round' : 'miter';
        const outlines = createMazeOutline(
            pathD,
            '', // No entrance path extending to edge
            config.corridorWidth,
            radius,
            config.holeRadius,
            joinType,
            { x: entryHoleX, y: entryHoleY } // Entry hole position
        );

        setExportProgress(50);

        // Generate wedge data if enabled
        let wedgeData: EntryWedgeData | null = null;
        if (config.showEntryWedge) {
            wedgeData = generateEntryWedgePaths(
                entryHoleX,
                entryHoleY,
                radius,
                config.corridorWidth,
                config.holeRadius
            );
        }

        setExportProgress(60);

        // Generate DXF manually from the SVG paths
        // DXF format: https://www.autodesk.com/techpubs/autocad/acad2000/dxf/
        const dxfContent = generateDXF(outlines, config.diameter, wedgeData);

        setExportProgress(90);

        console.log("DXF length:", dxfContent.length);

        // Download
        const blob = new Blob([dxfContent], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `orbital_maze_${config.diameter}mm_seed${config.seed}_cut.dxf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setExportProgress(100);

    } catch (error: any) {
        console.error("DXF Export Error:", error);
        alert(`Export failed: ${error.message || "Unknown error"}.`);
    } finally {
        setIsExporting(false);
        setExportProgress(0);
    }
  };

  // Generate DXF file from SVG path data (R12 format for maximum compatibility)
  const generateDXF = (
    outlines: { corridors: string; boundary: string; centerHole: string; entryHole: string },
    diameter: number,
    wedgeData: EntryWedgeData | null = null
  ): string => {
    let dxf = '';

    // Helper to add a line to DXF
    const add = (code: number | string, value: string | number) => {
      dxf += `  ${code}\n${value}\n`;
    };

    // HEADER section
    add(0, 'SECTION');
    add(2, 'HEADER');
    add(9, '$ACADVER');
    add(1, 'AC1009'); // AutoCAD R12 format
    add(9, '$INSUNITS');
    add(70, 4); // Millimeters
    add(9, '$EXTMIN');
    add(10, -diameter / 2);
    add(20, -diameter / 2);
    add(9, '$EXTMAX');
    add(10, diameter / 2);
    add(20, diameter / 2);
    add(0, 'ENDSEC');

    // TABLES section
    add(0, 'SECTION');
    add(2, 'TABLES');

    // LTYPE table
    add(0, 'TABLE');
    add(2, 'LTYPE');
    add(70, 1);
    add(0, 'LTYPE');
    add(2, 'CONTINUOUS');
    add(70, 0);
    add(3, 'Solid line');
    add(72, 65);
    add(73, 0);
    add(40, 0.0);
    add(0, 'ENDTAB');

    // LAYER table - count depends on whether wedge is included
    const layerCount = wedgeData ? 5 : 3;
    add(0, 'TABLE');
    add(2, 'LAYER');
    add(70, layerCount);
    // Layer 0
    add(0, 'LAYER');
    add(2, '0');
    add(70, 0);
    add(62, 7); // White
    add(6, 'CONTINUOUS');
    // Corridors layer
    add(0, 'LAYER');
    add(2, 'CORRIDORS');
    add(70, 0);
    add(62, 1); // Red
    add(6, 'CONTINUOUS');
    // Boundary layer
    add(0, 'LAYER');
    add(2, 'BOUNDARY');
    add(70, 0);
    add(62, 3); // Green
    add(6, 'CONTINUOUS');

    // Wedge layers (if enabled)
    if (wedgeData) {
      // Wedge cut layer (red)
      add(0, 'LAYER');
      add(2, 'WEDGE_CUT');
      add(70, 0);
      add(62, 1); // Red
      add(6, 'CONTINUOUS');
      // Wedge screw hole layer (yellow)
      add(0, 'LAYER');
      add(2, 'WEDGE_HOLE');
      add(70, 0);
      add(62, 2); // Yellow
      add(6, 'CONTINUOUS');
    }

    add(0, 'ENDTAB');

    add(0, 'ENDSEC');

    // ENTITIES section
    add(0, 'SECTION');
    add(2, 'ENTITIES');

    // Helper to parse SVG path and add polylines to DXF
    const addPathToDXF = (pathD: string, layer: string) => {
      if (!pathD || pathD.trim() === '') return;

      const commands = pathD.match(/[MLZ][^MLZ]*/gi) || [];
      let points: { x: number; y: number }[] = [];

      for (const cmd of commands) {
        const type = cmd[0].toUpperCase();
        const coords = cmd.slice(1).trim();

        if (type === 'M' || type === 'L') {
          const nums = coords.split(/[\s,]+/).filter(s => s.length > 0).map(Number);
          for (let i = 0; i < nums.length; i += 2) {
            if (!isNaN(nums[i]) && !isNaN(nums[i + 1])) {
              points.push({ x: nums[i], y: nums[i + 1] });
            }
          }
        } else if (type === 'Z') {
          // Close and output the polyline
          if (points.length >= 2) {
            add(0, 'POLYLINE');
            add(8, layer);
            add(66, 1); // Vertices follow
            add(70, 1); // Closed polyline

            for (const pt of points) {
              add(0, 'VERTEX');
              add(8, layer);
              add(10, pt.x.toFixed(6));
              add(20, pt.y.toFixed(6));
              add(30, 0);
            }

            add(0, 'SEQEND');
            add(8, layer);
          }
          points = [];
        }
      }

      // Handle any remaining unclosed path
      if (points.length >= 2) {
        add(0, 'POLYLINE');
        add(8, layer);
        add(66, 1);
        add(70, 0); // Open polyline

        for (const pt of points) {
          add(0, 'VERTEX');
          add(8, layer);
          add(10, pt.x.toFixed(6));
          add(20, pt.y.toFixed(6));
          add(30, 0);
        }

        add(0, 'SEQEND');
        add(8, layer);
      }
    };

    addPathToDXF(outlines.corridors, 'CORRIDORS');
    addPathToDXF(outlines.boundary, 'BOUNDARY');
    addPathToDXF(outlines.centerHole, 'BOUNDARY');
    addPathToDXF(outlines.entryHole, 'BOUNDARY');

    // Add wedge entities if enabled
    if (wedgeData) {
      addPathToDXF(wedgeData.wedgePath, 'WEDGE_CUT');
      addPathToDXF(wedgeData.screwHolePath, 'WEDGE_HOLE');
    }

    add(0, 'ENDSEC');

    // EOF
    add(0, 'EOF');

    return dxf;
  };

  return (
    <div className="flex-1 h-full relative bg-gray-950 flex flex-col">
       <div className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur-sm p-4 rounded-xl border border-gray-700 max-w-md pointer-events-none select-none">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                {lore}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
                Organic Tree Gen • {config.diameter}mm Ø • Diff {config.difficulty}
            </p>
       </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden p-8">
        <div 
            className="relative transition-transform duration-200 ease-out shadow-2xl rounded-full"
            style={{ 
                transform: `scale(${zoom})`,
                width: `${config.diameter}mm`,
                height: `${config.diameter}mm`,
            }}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`${-halfView} ${-halfView} ${viewBoxSize} ${viewBoxSize}`}
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-2xl"
          >
            {/* 1. Base Disk (The Material) */}
            <circle 
                cx="0" 
                cy="0" 
                r={radius} 
                fill="#1f2937" 
                stroke="none"
            />

            {/* 2. Corridors (The Cut Paths) */}
            <path
              d={pathD}
              fill="none"
              stroke="#f3f4f6" 
              strokeWidth={config.corridorWidth}
              strokeLinecap="round"
              strokeLinejoin={config.cornerRounding ? "round" : "miter"}
            />

            {/* 3. Entry Hole (same size as center hole) */}
            <circle
                cx={entryHoleX}
                cy={entryHoleY}
                r={config.holeRadius}
                fill="#f3f4f6"
            />

            {/* 4. Center Hole / Goal */}
            <circle
                cx="0"
                cy="0"
                r={config.holeRadius}
                fill="#f3f4f6"
            />

            {/* 5. Entry Wedge Preview (when enabled) */}
            {config.showEntryWedge && (() => {
                const wedgeData = generateEntryWedgePaths(
                    entryHoleX,
                    entryHoleY,
                    radius,
                    config.corridorWidth,
                    config.holeRadius
                );
                return (
                    <g className="wedge-preview">
                        {/* Wedge Outline */}
                        <path
                            d={wedgeData.wedgePath}
                            fill="rgba(239, 68, 68, 0.2)"
                            stroke="#ef4444"
                            strokeWidth="0.5"
                            strokeDasharray="3,2"
                        />
                        {/* Screw Hole */}
                        <path
                            d={wedgeData.screwHolePath}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="0.3"
                        />
                    </g>
                );
            })()}

            {/* 6. Solution Overlay */}
            {showSolution && (
                <path
                    d={solutionD}
                    fill="none"
                    stroke="#ef4444" 
                    strokeWidth={config.corridorWidth * 0.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                />
            )}
            
            {/* 6. AI Centerpiece (Engraved) */}
            {centerPiece && (
                <g transform={`translate(-${config.holeRadius}, -${config.holeRadius})`}>
                     <svg
                        x="0"
                        y="0"
                        width={config.holeRadius * 2}
                        height={config.holeRadius * 2}
                        viewBox={centerPiece.viewBox}
                     >
                        <path d={centerPiece.path} fill="#1f2937" />
                     </svg>
                </g>
            )}
            
          </svg>
        </div>
      </div>

      {/* Toolbar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-800/90 backdrop-blur border border-gray-700 p-2 rounded-2xl shadow-xl z-20">
        <button 
            onClick={() => setZoom(z => Math.max(0.2, z - 0.2))}
            className="p-3 hover:bg-gray-700 rounded-xl text-gray-300 transition-colors"
            title="Zoom Out"
        >
            <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-sm font-mono text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button 
            onClick={() => setZoom(z => Math.min(3, z + 0.2))}
            className="p-3 hover:bg-gray-700 rounded-xl text-gray-300 transition-colors"
            title="Zoom In"
        >
            <ZoomIn className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-gray-700 mx-2" />
        <button 
            onClick={onToggleSolution}
            className={`p-3 rounded-xl transition-colors ${showSolution ? 'bg-red-900/50 text-red-400' : 'hover:bg-gray-700 text-gray-300'}`}
            title="Toggle Solution"
        >
            {showSolution ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
        <div className="w-px h-6 bg-gray-700 mx-2" />
        <button
            onClick={handleDownloadSVG}
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-all flex items-center gap-2"
            title="Download SVG with strokes (for viewing)"
        >
            <Download className="w-4 h-4" />
            SVG
        </button>
        <button
            onClick={handleDownloadSVGOutlined}
            disabled={isExporting}
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-xl font-medium transition-all flex items-center gap-2"
            title="Download SVG with outlined paths (for laser cutting)"
        >
            <FileDown className="w-4 h-4" />
            SVG Cut
        </button>
        <button
            onClick={handleExportDXF}
            disabled={isExporting}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2 min-w-[100px] justify-center"
            title="Download DXF for CAD software"
        >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCog className="w-4 h-4" />}
            {isExporting ? `${exportProgress}%` : 'DXF'}
        </button>
      </div>
    </div>
  );
};

export default MazeViewer;