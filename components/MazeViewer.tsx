import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MazeData } from '../types';
import { Download, ZoomIn, ZoomOut, Eye, EyeOff, FileCog, Loader2, FileDown, X, AlertTriangle, RotateCcw } from 'lucide-react';
import { createMazeOutline, generateEntryWedgePaths, EntryWedgeData } from '../lib/clipperUtils';
import { useSpring, animated } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';

interface MazeViewerProps {
  data: MazeData;
  showSolution: boolean;
  onToggleSolution: () => void;
  mobileBottomOffset?: number; // Height of mobile bottom sheet
}

const MazeViewer: React.FC<MazeViewerProps> = ({
    data,
    showSolution,
    onToggleSolution,
    mobileBottomOffset = 0
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mazeSize, setMazeSize] = useState(300); // Size in pixels
  const [isMobile, setIsMobile] = useState(false);
  const { config, pathD, solutionD } = data;

  // Detect mobile breakpoint
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Spring animation for smooth zoom/pan
  const [style, api] = useSpring(() => ({
    scale: 1,
    x: 0,
    y: 0,
    config: { tension: 300, friction: 30 }
  }));

  // Calculate maze size to fit container on load and resize
  useEffect(() => {
    const calculateFitSize = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      // Account for mobile bottom sheet offset
      const containerHeight = container.clientHeight - (isMobile ? mobileBottomOffset : 0);

      // Calculate size to fit with padding (85% of available space)
      const availableSize = Math.min(containerWidth, Math.max(100, containerHeight)) * 0.85;
      setMazeSize(Math.max(200, availableSize));

      // Reset position when resizing
      api.start({ scale: 1, x: 0, y: 0, immediate: true });
    };

    // Use ResizeObserver for more reliable container size detection
    const resizeObserver = new ResizeObserver(calculateFitSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Initial calculation
    calculateFitSize();

    return () => resizeObserver.disconnect();
  }, [api, mobileBottomOffset, isMobile]);

  // Reset view when maze data changes
  useEffect(() => {
    api.start({ scale: 1, x: 0, y: 0 });
  }, [data, api]);

  // Gesture handling
  useGesture(
    {
      onDrag: ({ offset: [x, y], memo }) => {
        api.start({ x, y });
        return memo;
      },
      onPinch: ({ offset: [scale], memo }) => {
        const clampedScale = Math.min(5, Math.max(0.2, scale));
        api.start({ scale: clampedScale });
        return memo;
      },
      onWheel: ({ delta: [, dy], event }) => {
        event.preventDefault();
        const currentScale = style.scale.get();
        const newScale = Math.min(5, Math.max(0.2, currentScale - dy * 0.001));
        api.start({ scale: newScale });
      },
    },
    {
      target: containerRef,
      drag: { from: () => [style.x.get(), style.y.get()] },
      pinch: { scaleBounds: { min: 0.2, max: 5 }, from: () => [style.scale.get(), 0] },
      wheel: { eventOptions: { passive: false } },
    }
  );

  // Zoom button handlers
  const handleZoomIn = useCallback(() => {
    const currentScale = style.scale.get();
    api.start({ scale: Math.min(5, currentScale + 0.3) });
  }, [api, style.scale]);

  const handleZoomOut = useCallback(() => {
    const currentScale = style.scale.get();
    api.start({ scale: Math.max(0.2, currentScale - 0.3) });
  }, [api, style.scale]);

  const handleResetView = useCallback(() => {
    api.start({ scale: 1, x: 0, y: 0 });
  }, [api]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);
  
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
    link.download = `mazemas_${config.diameter}mm_seed${config.seed}.svg`;
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
        link.download = `mazemas_${config.diameter}mm_seed${config.seed}_outlined.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setExportProgress(100);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage(`SVG export failed: ${message}`);
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

        // Download
        const blob = new Blob([dxfContent], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mazemas_${config.diameter}mm_seed${config.seed}_cut.dxf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setExportProgress(100);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage(`DXF export failed: ${message}`);
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
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 hidden md:block">
                Maze MAS 2025
            </h1>
            {/* Desktop: compact info */}
            <p className="text-gray-400 text-sm mt-1 hidden md:block">
                <span className="font-mono">{config.diameter}mm</span> Ø • Difficulty <span className="font-mono">{config.difficulty}</span> • Seed <span className="font-mono">{config.seed}</span>
            </p>
            {/* Mobile: show key values prominently */}
            <div className="md:hidden grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="text-gray-400">Diameter</div>
                <div className="font-mono text-emerald-400 text-right">{config.diameter}mm</div>
                <div className="text-gray-400">Track</div>
                <div className="font-mono text-emerald-400 text-right">{config.corridorWidth}mm</div>
                <div className="text-gray-400">Wall</div>
                <div className="font-mono text-emerald-400 text-right">{config.wallWidth}mm</div>
                <div className="text-gray-400">Hole</div>
                <div className="font-mono text-emerald-400 text-right">{config.holeRadius}mm</div>
                <div className="text-gray-400">Difficulty</div>
                <div className="font-mono text-emerald-400 text-right">{config.difficulty}/5</div>
            </div>
       </div>

       {/* Error Toast */}
       {errorMessage && (
         <div className="absolute top-4 right-4 z-30 max-w-sm">
           <div className="bg-red-900/90 backdrop-blur border border-red-700 rounded-xl p-4 flex items-start gap-3">
             <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
             <div className="flex-1">
               <p className="text-red-200 text-sm">{errorMessage}</p>
             </div>
             <button
               onClick={() => setErrorMessage(null)}
               className="text-red-400 hover:text-red-300 transition-colors"
               aria-label="Dismiss error"
             >
               <X className="w-4 h-4" />
             </button>
           </div>
         </div>
       )}

      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden p-8 touch-none"
        style={{ paddingBottom: isMobile ? mobileBottomOffset + 32 : undefined }}
      >
        <animated.div
            className="relative rounded-full cursor-grab active:cursor-grabbing"
            style={{
                scale: style.scale,
                x: style.x,
                y: style.y,
                width: mazeSize,
                height: mazeSize,
            }}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`${-halfView} ${-halfView} ${viewBoxSize} ${viewBoxSize}`}
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
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
          </svg>
        </animated.div>
      </div>

      {/* Toolbar */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 bg-gray-800/90 backdrop-blur border border-gray-700 p-2 rounded-2xl z-20 max-w-[95vw]"
        style={{ bottom: isMobile ? mobileBottomOffset + 16 : 32 }}
      >
        <button
            onClick={handleZoomOut}
            className="p-3 hover:bg-gray-700 rounded-xl text-gray-300 transition-colors"
            aria-label="Zoom out"
        >
            <ZoomOut className="w-5 h-5" />
        </button>
        <button
            onClick={handleResetView}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"
            aria-label="Reset view"
            title="Reset to fit"
        >
            <RotateCcw className="w-4 h-4" />
        </button>
        <button
            onClick={handleZoomIn}
            className="p-3 hover:bg-gray-700 rounded-xl text-gray-300 transition-colors"
            aria-label="Zoom in"
        >
            <ZoomIn className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-gray-700 mx-1 hidden sm:block" />
        <button
            onClick={onToggleSolution}
            className={`p-3 rounded-xl transition-colors ${showSolution ? 'bg-red-900/50 text-red-400' : 'hover:bg-gray-700 text-gray-300'}`}
            aria-label={showSolution ? "Hide solution" : "Show solution"}
            aria-pressed={showSolution}
        >
            {showSolution ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
        <div className="w-px h-6 bg-gray-700 mx-1 hidden sm:block" />
        <button
            onClick={handleDownloadSVG}
            className="px-3 py-2 sm:px-4 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-all flex items-center gap-2 text-sm"
            aria-label="Download SVG for viewing"
            title="For viewing and sharing"
        >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
        </button>
        <button
            onClick={handleDownloadSVGOutlined}
            disabled={isExporting}
            className="px-3 py-2 sm:px-4 sm:py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-xl font-medium transition-all flex items-center gap-2 text-sm"
            aria-label="Download outlined SVG for laser cutting"
            title="Outlined paths for laser cutting"
        >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">Laser</span>
        </button>
        <button
            onClick={handleExportDXF}
            disabled={isExporting}
            className="px-3 py-2 sm:px-4 sm:py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-xl font-medium transition-all flex items-center gap-2 text-sm min-w-[80px] justify-center"
            aria-label="Download DXF for CAD software"
            title="For CAD software (AutoCAD, Fusion 360)"
        >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCog className="w-4 h-4" />}
            {isExporting ? <span className="font-mono">{exportProgress}%</span> : 'DXF'}
        </button>
      </div>
    </div>
  );
};

export default MazeViewer;