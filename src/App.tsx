import React, { useState } from 'react';
import { Monitor, Moon, Sun, Code, ExternalLink, Activity } from 'lucide-react';
import Header from './components/Header';
import OverviewTable from './components/OverviewTable';
import EnvironmentTabs from './components/EnvironmentTabs';
import ModelGrid from './components/ModelGrid';
import CodeViewer from './components/CodeViewer';
import { useTheme } from './hooks/useTheme';

// Mock data - will be replaced with AWS R2/Postgres connection
const mockEnvironments = [
  {
    id: 'sat',
    name: 'SAT',
    description: 'Satellite tracking and control environment',
    repoUrl: 'https://github.com/affine-subnet/sat-env',
    models: [
      { uid: 'uid_001', score: 195.6, epochs: 1200, last_updated: '2025-01-12T10:30:00Z', status: 'training', daily_rollouts: 24 },
      { uid: 'uid_002', score: 187.3, epochs: 1100, last_updated: '2025-01-12T10:25:00Z', status: 'evaluating', daily_rollouts: 18 },
      { uid: 'uid_003', score: 172.8, epochs: 950, last_updated: '2025-01-12T10:20:00Z', status: 'idle', daily_rollouts: 12 },
    ]
  },
  {
    id: 'abd',
    name: 'ABD',
    description: 'Autonomous behavior detection system',
    repoUrl: 'https://github.com/affine-subnet/abd-env',
    models: [
      { uid: 'uid_004', score: 234.7, epochs: 1800, last_updated: '2025-01-12T10:35:00Z', status: 'training', daily_rollouts: 32 },
      { uid: 'uid_005', score: 201.2, epochs: 1650, last_updated: '2025-01-12T10:30:00Z', status: 'training', daily_rollouts: 28 },
      { uid: 'uid_006', score: 189.5, epochs: 1400, last_updated: '2025-01-12T10:25:00Z', status: 'evaluating', daily_rollouts: 15 },
    ]
  },
  {
    id: 'ded',
    name: 'DED',
    description: 'Dynamic environment detection',
    repoUrl: 'https://github.com/affine-subnet/ded-env',
    models: [
      { uid: 'uid_007', score: -98.2, epochs: 2100, last_updated: '2025-01-12T10:40:00Z', status: 'training', daily_rollouts: 36 },
      { uid: 'uid_008', score: -102.7, epochs: 1950, last_updated: '2025-01-12T10:35:00Z', status: 'idle', daily_rollouts: 22 },
      { uid: 'uid_009', score: -115.4, epochs: 1700, last_updated: '2025-01-12T10:30:00Z', status: 'evaluating', daily_rollouts: 19 },
    ]
  },
  {
    id: 'elr',
    name: 'ELR',
    description: 'Enhanced learning and reasoning',
    repoUrl: 'https://github.com/affine-subnet/elr-env',
    models: [
      { uid: 'uid_007', score: -98.2, epochs: 2100, last_updated: '2025-01-12T10:40:00Z', status: 'training', daily_rollouts: 36 },
      { uid: 'uid_008', score: -102.7, epochs: 1950, last_updated: '2025-01-12T10:35:00Z', status: 'idle', daily_rollouts: 22 },
      { uid: 'uid_009', score: -115.4, epochs: 1700, last_updated: '2025-01-12T10:30:00Z', status: 'evaluating', daily_rollouts: 19 },
    ]
  }
];

function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [showCodeViewer, setShowCodeViewer] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState(mockEnvironments[0]);

  const currentEnvironment = mockEnvironments.find(env => env.id === activeTab) || mockEnvironments[0];

  const handleViewCode = (environment: typeof mockEnvironments[0]) => {
    setSelectedEnvironment(environment);
    setShowCodeViewer(true);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-black text-white' 
        : 'bg-cream-50 text-gray-800'
    }`}>
      <Header theme={theme} toggleTheme={toggleTheme} />
      
      <main className="container mx-auto px-6 py-8">
        {/* Tab Navigation */}
          <div className="flex gap-0 border-2 border-b-0 rounded-none overflow-hidden">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 font-mono text-xs uppercase tracking-wider border-r-2 transition-colors ${
                activeTab === 'overview'
                  ? theme === 'dark'
                    ? 'bg-gray-800 text-white border-white'
                    : 'bg-white text-gray-900 border-gray-300'
                  : theme === 'dark'
                    ? 'bg-black text-gray-300 border-white hover:bg-gray-800 hover:text-white'
                    : 'bg-cream-100 text-gray-600 border-gray-300 hover:bg-white hover:text-gray-800'
              }`}
            >
              Overview
              <div className={`text-xs mt-1 font-mono ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                ALL MODELS
              </div>
            </button>
            {mockEnvironments.map((env) => (
              <button
                key={env.id}
                onClick={() => setActiveTab(env.id)}
                className={`px-6 py-3 font-mono text-xs uppercase tracking-wider border-r-2 last:border-r-0 transition-colors ${
                  activeTab === env.id
                    ? theme === 'dark'
                      ? 'bg-gray-800 text-white border-white'
                      : 'bg-white text-gray-900 border-gray-300'
                    : theme === 'dark'
                      ? 'bg-black text-gray-300 border-white hover:bg-gray-800 hover:text-white'
                      : 'bg-cream-100 text-gray-600 border-gray-300 hover:bg-white hover:text-gray-800'
                }`}
              >
                {env.name}
                <div className={`text-xs mt-1 font-mono ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {env.models.length} MODELS
                </div>
              </button>
            ))}
          </div>

        {/* Tab Content */}
        {activeTab === 'overview' ? (
          <OverviewTable 
            environments={mockEnvironments}
            theme={theme}
          />
        ) : (
          <>
            {/* Current Environment Info */}
            <div className={`mb-6 p-4 border-2 rounded-none ${
              theme === 'dark' 
                ? 'border-white bg-black' 
                : 'border-gray-300 bg-white'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-xl font-mono font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {currentEnvironment.name}
                  </h2>
                  <p className={`text-sm font-sans mt-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {currentEnvironment.description}
                  </p>
                </div>
                <button
                  onClick={() => handleViewCode(currentEnvironment)}
                  className={`flex items-center gap-2 px-4 py-2 border-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                    theme === 'dark'
                      ? 'border-white text-white hover:bg-gray-800 hover:text-gray-200'
                      : 'border-gray-400 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Code size={14} />
                  VIEW CODE
                </button>
              </div>
            </div>

            {/* Model Performance Grid */}
            <ModelGrid 
              models={currentEnvironment.models}
              environmentId={currentEnvironment.id}
              theme={theme}
            />
          </>
        )}

        {/* Code Viewer Modal */}
        {showCodeViewer && (
          <CodeViewer 
            environment={selectedEnvironment}
            theme={theme}
            onClose={() => setShowCodeViewer(false)}
          />
        )}
      </main>
    </div>
  );
}

export default App;