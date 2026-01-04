import React, { useState, useEffect, useCallback } from 'react';
import { MazeConfig } from '../types';
import { Settings, RefreshCw, Circle, Square, Hash, PieChart, Menu, X } from 'lucide-react';

interface MazeControlsProps {
  config: MazeConfig;
  onChange: (newConfig: MazeConfig) => void;
  onRegenerate: () => void;
  isOpen: boolean;
  onToggleMenu: () => void;
}

const MazeControls: React.FC<MazeControlsProps> = ({
    config,
    onChange,
    onRegenerate,
    isOpen,
    onToggleMenu
}) => {
  const [width, setWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);

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

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={onToggleMenu}
        className="md:hidden fixed top-4 left-4 z-50 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white shadow-lg"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={onToggleMenu}
        />
      )}

      <div
        className={`bg-gray-800 flex flex-col h-full border-r border-gray-700 shadow-2xl z-40 flex-shrink-0 group
          fixed md:relative
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ width: `${width}px`, maxWidth: '100vw' }}
      >
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="text-emerald-400 w-6 h-6" />
            <h2 className="text-xl font-bold text-white tracking-wide">Configuration</h2>
          </div>

          {/* Diameter */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-300">Total Diameter</label>
              <span className="text-sm text-emerald-400">{config.diameter}mm</span>
            </div>
            <input
              type="range"
              min="200"
              max="400"
              step="5"
              value={config.diameter}
              onChange={(e) => handleChange('diameter', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-gray-500 px-1">
                <span>200mm</span>
                <span>400mm</span>
            </div>
          </div>

          {/* Track Width */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-300">Track Width</label>
              <span className="text-sm text-emerald-400">{config.corridorWidth}mm</span>
            </div>
            <input
              type="range"
              min="4"
              max="40"
              step="1"
              value={config.corridorWidth}
              onChange={(e) => handleChange('corridorWidth', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Wall Width */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-300">Min. Wall Thickness</label>
              <span className="text-sm text-emerald-400">{config.wallWidth}mm</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={config.wallWidth}
              onChange={(e) => handleChange('wallWidth', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Hole Size */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-300">Hole Size</label>
              <span className="text-sm text-emerald-400">{config.holeRadius}mm</span>
            </div>
            <input
              type="range"
              min="2"
              max="30"
              step="0.5"
              value={config.holeRadius}
              onChange={(e) => handleChange('holeRadius', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <p className="text-xs text-gray-500">
                Size of the center goal hole and entry hole.
            </p>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-300">Difficulty</label>
              <span className="text-sm text-emerald-400">{config.difficulty}/5</span>
            </div>
            <div className="flex gap-2">
                {[1,2,3,4,5].map(step => (
                    <button
                        key={step}
                        className={`flex-1 h-10 rounded-lg cursor-pointer transition-colors font-medium text-sm ${step <= config.difficulty ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
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
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors placeholder-gray-500"
                    placeholder="Enter seed"
                />
             </div>
             <p className="text-xs text-gray-500">
                Manually set to reproduce a specific maze.
            </p>
          </div>


          <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-gray-700">
            <button
              onClick={onRegenerate}
              className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium border border-emerald-500 shadow-lg shadow-emerald-900/20"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
          </div>
      </div>

        {/* Resize Handle - hidden on mobile */}
        <div
          className={`hidden md:flex absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-emerald-500 transition-colors z-20 items-center justify-center ${isResizing ? 'bg-emerald-500' : 'bg-transparent'}`}
          onMouseDown={startResizing}
        >
          {/* Visual grip indicator that appears on hover/resize */}
          <div className={`h-8 w-1 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isResizing ? 'opacity-100' : ''}`} />
        </div>
      </div>
    </>
  );
};

export default MazeControls;
