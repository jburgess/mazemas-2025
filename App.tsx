import React, { useState, useEffect, useCallback } from 'react';
import { MazeConfig, MazeData } from './types';
import { generateMaze } from './lib/mazeGenerator';
import MazeControls from './components/MazeControls';
import MazeViewer from './components/MazeViewer';
import { generateCenterPiece, analyzeMaze } from './services/geminiService';
import { X } from 'lucide-react';

const DEFAULT_CONFIG: MazeConfig = {
  diameter: 290,
  wallWidth: 11,
  corridorWidth: 14,
  difficulty: 5,
  cornerRounding: true,
  seed: Math.floor(Math.random() * 100000),
  holeRadius: 12, // radius of entry and center holes in mm
};

function App() {
  const [config, setConfig] = useState<MazeConfig>(DEFAULT_CONFIG);
  const [mazeData, setMazeData] = useState<MazeData | null>(null);
  const [centerPiece, setCenterPiece] = useState<{ path: string; viewBox: string } | null>(null);
  const [lore, setLore] = useState<string>("Orbital Void");
  const [showSolution, setShowSolution] = useState(false);
  
  // AI State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  const regenerate = useCallback(() => {
    // Update seed to ensure new generation
    const newConfig = { ...config, seed: Math.floor(Math.random() * 100000) };
    setConfig(newConfig);
    const data = generateMaze(newConfig);
    setMazeData(data);
    
    // Quick AI lore refresh (fire and forget)
    analyzeMaze(`Type: Subtractive Puck Maze. Difficulty: ${config.difficulty}`).then(setLore);
  }, [config]);

  // Initial load
  useEffect(() => {
    const data = generateMaze(config);
    setMazeData(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfigChange = (newConfig: MazeConfig) => {
    setConfig(newConfig);
    // If difficulty changed, strictly regenerate because the algo branches differently
    // Actually, for React state consistency, we just update config and data.
    const data = generateMaze(newConfig);
    setMazeData(data);
  };

  const handleAiGeneration = async () => {
    if (!prompt.trim()) return;
    setIsModalOpen(false);
    setIsAiLoading(true);
    try {
        const result = await generateCenterPiece(prompt);
        setCenterPiece({ path: result.svgPath, viewBox: result.viewBox });
    } catch (e) {
        alert("Failed to generate centerpiece. Please check API Key or try again.");
    } finally {
        setIsAiLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-900 text-white overflow-hidden font-sans">
      <MazeControls
        config={config}
        onChange={handleConfigChange}
        onRegenerate={regenerate}
        onAiAction={() => setIsModalOpen(true)}
        isAiLoading={isAiLoading}
        showSolution={showSolution}
        onToggleSolution={() => setShowSolution(!showSolution)}
      />
      
      <main className="flex-1 relative">
        {mazeData && (
            <MazeViewer 
                data={mazeData} 
                centerPiece={centerPiece}
                lore={lore}
                showSolution={showSolution}
                onToggleSolution={() => setShowSolution(!showSolution)}
            />
        )}
      </main>

      {/* AI Prompt Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl p-6 w-full max-w-md relative animate-in fade-in zoom-in duration-200">
                <button 
                    onClick={() => setIsModalOpen(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-bold text-white mb-2">AI Centerpiece</h3>
                <p className="text-gray-400 text-sm mb-4">
                    Describe a symbol or icon to place in the center of your maze. Gemini will generate a laser-cut ready vector path.
                </p>
                <textarea 
                    autoFocus
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A dragon head, a snowflake, a skull, a geometric flower..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 h-32 resize-none mb-4"
                />
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleAiGeneration}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                    >
                        Generate
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;