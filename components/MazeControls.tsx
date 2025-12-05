import React, { useState, useEffect, useCallback } from 'react';
import { MazeConfig } from '../types';
import { Settings, RefreshCw, Sparkles, Eye, EyeOff, Circle, Square, Hash } from 'lucide-react';

interface MazeControlsProps {
  config: MazeConfig;
  onChange: (newConfig: MazeConfig) => void;
  onRegenerate: () => void;
  onAiAction: () => void;
  isAiLoading: boolean;
  showSolution: boolean;
  onToggleSolution: () => void;
}

const MazeControls: React.FC<MazeControlsProps> = ({ 
    config, 
    onChange, 
    onRegenerate, 
    onAiAction, 
    isAiLoading,
    showSolution,
    onToggleSolution
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
    <div 
        className="bg-gray-800 flex flex-col h-full border-r border-gray-700 shadow-2xl z-10 relative flex-shrink-0 group"
        style={{ width: `${width}px` }}
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

          {/* Puck Size / Corridor Width */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-300">Puck Size (Corridor)</label>
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

          {/* Hole Radius */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-300">Hole Radius (Entry & Center)</label>
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
            <div className="flex gap-1 h-2">
                {[1,2,3,4,5].map(step => (
                    <div 
                        key={step} 
                        className={`flex-1 rounded-sm cursor-pointer transition-colors ${step <= config.difficulty ? 'bg-emerald-500' : 'bg-gray-700'}`}
                        onClick={() => handleChange('difficulty', step)}
                    />
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
                onClick={onToggleSolution}
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg transition-colors font-medium border ${showSolution ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-400' : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
            >
                {showSolution ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showSolution ? 'Hide Solution' : 'Show Solution'}
            </button>

            <button
              onClick={onRegenerate}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium border border-gray-600 hover:border-gray-500"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
            
            <button
                onClick={onAiAction}
                disabled={isAiLoading}
                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-lg hover:shadow-emerald-500/20 font-medium group"
            >
                <Sparkles className={`w-4 h-4 ${isAiLoading ? 'animate-spin' : 'group-hover:animate-pulse'}`} />
                {isAiLoading ? 'Dreaming...' : 'AI Centerpiece'}
            </button>
          </div>
      </div>

      {/* Resize Handle */}
      <div 
        className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-emerald-500 transition-colors z-20 flex items-center justify-center ${isResizing ? 'bg-emerald-500' : 'bg-transparent'}`}
        onMouseDown={startResizing}
      >
         {/* Visual grip indicator that appears on hover/resize */}
         <div className={`h-8 w-1 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isResizing ? 'opacity-100' : ''}`} />
      </div>
    </div>
  );
};

export default MazeControls;