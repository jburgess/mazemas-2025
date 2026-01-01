import React, { useState, useEffect, useCallback } from 'react';
import { MazeConfig, MazeData } from './types';
import { generateMaze } from './lib/mazeGenerator';
import MazeControls from './components/MazeControls';
import MazeViewer from './components/MazeViewer';

const DEFAULT_CONFIG: MazeConfig = {
  diameter: 290,
  wallWidth: 11,
  corridorWidth: 14,
  difficulty: 5,
  cornerRounding: true,
  seed: Math.floor(Math.random() * 100000),
  holeRadius: 12,
  showEntryWedge: false,
};

function App() {
  const [config, setConfig] = useState<MazeConfig>(DEFAULT_CONFIG);
  const [mazeData, setMazeData] = useState<MazeData | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  const regenerate = useCallback(() => {
    const newConfig = { ...config, seed: Math.floor(Math.random() * 100000) };
    setConfig(newConfig);
    const data = generateMaze(newConfig);
    setMazeData(data);
  }, [config]);

  useEffect(() => {
    const data = generateMaze(config);
    setMazeData(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfigChange = (newConfig: MazeConfig) => {
    setConfig(newConfig);
    const data = generateMaze(newConfig);
    setMazeData(data);
  };

  return (
    <div className="flex h-screen w-full bg-gray-900 text-white overflow-hidden font-sans">
      <MazeControls
        config={config}
        onChange={handleConfigChange}
        onRegenerate={regenerate}
        showSolution={showSolution}
        onToggleSolution={() => setShowSolution(!showSolution)}
      />

      <main className="flex-1 relative">
        {mazeData && (
            <MazeViewer
                data={mazeData}
                showSolution={showSolution}
                onToggleSolution={() => setShowSolution(!showSolution)}
            />
        )}
      </main>
    </div>
  );
}

export default App;
