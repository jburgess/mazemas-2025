import React, { useState, useEffect, useCallback } from 'react';
import { MazeConfig } from '../types';
import { Settings, RefreshCw, Circle, Square, Hash, PieChart, ChevronUp, ChevronDown } from 'lucide-react';
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

interface MazeControlsProps {
  config: MazeConfig;
  onChange: (newConfig: MazeConfig) => void;
  onRegenerate: () => void;
  onSheetHeightChange?: (height: number) => void; // Mobile bottom sheet height
}

// Bottom sheet snap points
const COLLAPSED_HEIGHT = 100; // Handle + header + peek preview
const EXPANDED_HEIGHT_PORTRAIT = 65; // 65% in portrait
const EXPANDED_HEIGHT_LANDSCAPE = 50; // 50% in landscape (more maze visible)

const MazeControls: React.FC<MazeControlsProps> = ({
    config,
    onChange,
    onRegenerate,
    onSheetHeightChange,
}) => {
  // Desktop sidebar state
  const [width, setWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);

  // Mobile bottom sheet state
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  // Detect landscape orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Calculate expanded height in pixels (smaller in landscape)
  const getExpandedHeight = () => {
    if (typeof window === 'undefined') return 400;
    const heightPercent = isLandscape ? EXPANDED_HEIGHT_LANDSCAPE : EXPANDED_HEIGHT_PORTRAIT;
    return window.innerHeight * (heightPercent / 100);
  };

  // Spring animation for mobile bottom sheet
  const [sheetStyle, sheetApi] = useSpring(() => ({
    height: COLLAPSED_HEIGHT,
    config: { tension: 300, friction: 30 },
    onChange: ({ value }) => {
      onSheetHeightChange?.(value.height);
    }
  }));

  // Report initial height on mount
  useEffect(() => {
    onSheetHeightChange?.(COLLAPSED_HEIGHT);
  }, [onSheetHeightChange]);

  // Update sheet height when orientation changes (if expanded)
  useEffect(() => {
    if (isExpanded) {
      const newHeight = getExpandedHeight();
      sheetApi.start({ height: newHeight });
    }
  }, [isLandscape, isExpanded, sheetApi]);

  // Drag gesture for mobile bottom sheet
  const bindDrag = useDrag(
    ({ movement: [, my], last, direction: [, dy], velocity: [, vy] }) => {
      const expandedHeight = getExpandedHeight();

      if (last) {
        // On release, snap to closest position
        const currentHeight = sheetStyle.height.get();
        const threshold = (expandedHeight - COLLAPSED_HEIGHT) / 2;

        // Use velocity for quick flicks
        if (Math.abs(vy) > 0.5) {
          const shouldExpand = dy < 0; // Flicking up = expand
          setIsExpanded(shouldExpand);
          sheetApi.start({ height: shouldExpand ? expandedHeight : COLLAPSED_HEIGHT });
        } else {
          // Snap based on position
          const shouldExpand = currentHeight > COLLAPSED_HEIGHT + threshold;
          setIsExpanded(shouldExpand);
          sheetApi.start({ height: shouldExpand ? expandedHeight : COLLAPSED_HEIGHT });
        }
      } else {
        // During drag, update height
        const baseHeight = isExpanded ? expandedHeight : COLLAPSED_HEIGHT;
        const newHeight = Math.max(COLLAPSED_HEIGHT, Math.min(expandedHeight, baseHeight - my));
        sheetApi.start({ height: newHeight, immediate: true });
      }
    },
    { from: () => [0, isExpanded ? -getExpandedHeight() + COLLAPSED_HEIGHT : 0], filterTaps: true }
  );

  // Toggle sheet on handle tap
  const toggleSheet = useCallback(() => {
    const expandedHeight = getExpandedHeight();
    setIsExpanded(!isExpanded);
    sheetApi.start({ height: isExpanded ? COLLAPSED_HEIGHT : expandedHeight });
  }, [isExpanded, sheetApi]);

  // Desktop resize handlers
  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const newWidth = mouseMoveEvent.clientX;
      if (newWidth > 280 && newWidth < 600) {
        setWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const handleChange = (key: keyof MazeConfig, value: number | boolean) => {
    onChange({ ...config, [key]: value });
  };

  // Shared controls content
  const controlsContent = (
    <>
      {/* Diameter */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-gray-300">Total Diameter</label>
          <span className="text-sm font-mono text-emerald-400">{config.diameter}mm</span>
        </div>
        <input
          type="range"
          min="200"
          max="400"
          step="5"
          value={config.diameter}
          onChange={(e) => handleChange('diameter', parseInt(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          style={{ touchAction: 'none' }}
        />
        <div className="flex justify-between text-xs font-mono text-gray-500 px-1">
          <span>200mm</span>
          <span>400mm</span>
        </div>
      </div>

      {/* Track Width */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-gray-300">Track Width</label>
          <span className="text-sm font-mono text-emerald-400">{config.corridorWidth}mm</span>
        </div>
        <input
          type="range"
          min="4"
          max="40"
          step="1"
          value={config.corridorWidth}
          onChange={(e) => handleChange('corridorWidth', parseFloat(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Wall Width */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-gray-300">Min. Wall Thickness</label>
          <span className="text-sm font-mono text-emerald-400">{config.wallWidth}mm</span>
        </div>
        <input
          type="range"
          min="1"
          max="20"
          step="0.5"
          value={config.wallWidth}
          onChange={(e) => handleChange('wallWidth', parseFloat(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Hole Size */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-gray-300">Hole Size</label>
          <span className="text-sm font-mono text-emerald-400">{config.holeRadius}mm</span>
        </div>
        <input
          type="range"
          min="2"
          max="30"
          step="0.5"
          value={config.holeRadius}
          onChange={(e) => handleChange('holeRadius', parseFloat(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          style={{ touchAction: 'none' }}
        />
        <p className="text-xs text-gray-500">
          Size of the center goal hole and entry hole.
        </p>
      </div>

      {/* Difficulty */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-gray-300">Difficulty</label>
          <span className="text-sm font-mono text-emerald-400">{config.difficulty}/5</span>
        </div>
        <div className="flex gap-2">
          {[1,2,3,4,5].map(step => (
            <button
              key={step}
              className={`flex-1 h-10 rounded-lg cursor-pointer transition-colors font-mono font-medium text-sm ${step <= config.difficulty ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              onClick={() => handleChange('difficulty', step)}
            >
              {step}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Higher levels increase branching and create deceptive long paths.
        </p>
      </div>

      {/* Corner Smoothing */}
      <div className="space-y-2 pt-2 border-t border-gray-700/50">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Corner Style</label>
        </div>
        <button
          onClick={() => handleChange('cornerRounding', !config.cornerRounding)}
          className={`flex items-center justify-between w-full p-2 rounded-lg border transition-all ${config.cornerRounding ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-gray-700/50 border-gray-600'}`}
        >
          <div className="flex items-center gap-2">
            {config.cornerRounding ? <Circle className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-gray-400" />}
            <span className={`text-sm ${config.cornerRounding ? 'text-emerald-400' : 'text-gray-300'}`}>
              {config.cornerRounding ? 'Smooth (Round)' : 'Sharp (Miter)'}
            </span>
          </div>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${config.cornerRounding ? 'bg-emerald-500' : 'bg-gray-600'}`}>
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${config.cornerRounding ? 'left-6' : 'left-1'}`} />
          </div>
        </button>
        <p className="text-xs text-gray-500">
          Smooths sharp path intersections for a cleaner look.
        </p>
      </div>

      {/* Access Wedge */}
      <div className="space-y-2 pt-2 border-t border-gray-700/50">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Access Wedge</label>
        </div>
        <button
          onClick={() => handleChange('showEntryWedge', !config.showEntryWedge)}
          className={`flex items-center justify-between w-full p-2 rounded-lg border transition-all ${config.showEntryWedge ? 'bg-red-900/30 border-red-500/50' : 'bg-gray-700/50 border-gray-600'}`}
        >
          <div className="flex items-center gap-2">
            <PieChart className={`w-4 h-4 ${config.showEntryWedge ? 'text-red-400' : 'text-gray-400'}`} />
            <span className={`text-sm ${config.showEntryWedge ? 'text-red-400' : 'text-gray-300'}`}>
              {config.showEntryWedge ? 'Wedge Enabled' : 'Wedge Disabled'}
            </span>
          </div>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${config.showEntryWedge ? 'bg-red-500' : 'bg-gray-600'}`}>
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${config.showEntryWedge ? 'left-6' : 'left-1'}`} />
          </div>
        </button>
        <p className="text-xs text-gray-500">
          Removable wedge piece in middle layer for maintenance access.
        </p>
      </div>

      {/* Seed Input */}
      <div className="space-y-2 pt-2 border-t border-gray-700/50">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Seed</label>
        </div>
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="number"
            value={Math.floor(config.seed)}
            onChange={(e) => handleChange('seed', parseInt(e.target.value) || 0)}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors placeholder-gray-500"
            placeholder="Enter seed"
          />
        </div>
        <p className="text-xs text-gray-500">
          Manually set to reproduce a specific maze.
        </p>
      </div>

      {/* Regenerate Button */}
      <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={onRegenerate}
          className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium border border-emerald-500"
        >
          <RefreshCw className="w-4 h-4" />
          Regenerate
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* DESKTOP: Left Sidebar (hidden on mobile) */}
      <div
        className="hidden md:flex bg-gray-800 flex-col h-full border-r border-gray-700 z-40 flex-shrink-0 group relative"
        style={{ width: `${width}px` }}
      >
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="text-emerald-400 w-6 h-6" />
            <h2 className="text-xl font-bold text-white tracking-wide">Configuration</h2>
          </div>
          {controlsContent}
        </div>

        {/* Desktop Resize Handle */}
        <div
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-emerald-500 transition-colors z-20 flex items-center justify-center"
          onMouseDown={startResizing}
          style={{ backgroundColor: isResizing ? '#10b981' : 'transparent' }}
        >
          <div className={`h-8 w-1 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isResizing ? 'opacity-100' : ''}`} />
        </div>
      </div>

      {/* MOBILE: Bottom Sheet (hidden on desktop) */}
      <animated.div
        className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-40 rounded-t-2xl shadow-2xl"
        style={{ height: sheetStyle.height }}
      >
        {/* Drag Handle Area */}
        <div
          {...bindDrag()}
          onClick={toggleSheet}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          {/* Grab Handle Pill - wider and more prominent */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 bg-gray-500 rounded-full" />
          </div>

          {/* Header with chevron */}
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-gray-300">Settings</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <span className="text-xs">{isExpanded ? 'Collapse' : 'Expand'}</span>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </div>
          </div>

          {/* Peek Preview - shows first control when collapsed */}
          {!isExpanded && (
            <div className="px-4 pb-2 border-t border-gray-700/50 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Diameter</span>
                <span className="font-mono text-emerald-400">{config.diameter}mm</span>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div
          className="overflow-y-auto px-4 pb-4 flex flex-col gap-4"
          style={{ height: isExpanded ? 'calc(100% - 60px)' : 'calc(100% - 100px)', touchAction: 'pan-y' }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {controlsContent}
        </div>
      </animated.div>
    </>
  );
};

export default MazeControls;
