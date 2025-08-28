import React, { useState } from 'react';
import { Monitor, Moon, Sun, Code, ExternalLink, Activity } from 'lucide-react';
import Header from './components/Header';
import OverviewTable from './components/OverviewTable';
import ModelGrid from './components/ModelGrid';
import CodeViewer from './components/CodeViewer';
import { useTheme } from './hooks/useTheme';
import { useModelsData } from './hooks/useModelsData';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { environments, models, loading, error, refetch } = useModelsData();
  const [activeTab, setActiveTab] = useState('overview');
  const [showCodeViewer, setShowCodeViewer] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState(environments[0]);

  const currentEnvironment = environments.find(env => env.id === activeTab) || environments[0];

  const handleViewCode = (environment: typeof environments[0]) => {
    setSelectedEnvironment(environment);
    setShowCodeViewer(true);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        theme === 'dark' ? 'bg-black text-white' : 'bg-cream-50 text-gray-800'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-current mx-auto mb-4"></div>
          <p className="font-mono text-sm uppercase tracking-wider">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        theme === 'dark' ? 'bg-black text-white' : 'bg-cream-50 text-gray-800'
      }`}>
        <div className="text-center">
          <p className="font-mono text-sm uppercase tracking-wider mb-4 text-red-500">Error loading data</p>
          <p className="font-sans text-sm mb-4">{error}</p>
          <button
            onClick={refetch}
            className={`px-4 py-2 border-2 font-mono text-xs uppercase tracking-wider transition-colors ${
              theme === 'dark'
                ? 'border-white text-white hover:bg-white hover:text-black'
                : 'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
            }`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
            {environments.map((env) => (
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
            environments={environments}
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
              models={currentEnvironment?.models || []}
              environmentId={currentEnvironment.id}
              theme={theme}
            />
          </>
        )}

        {/* Code Viewer Modal */}
        {showCodeViewer && (
          <CodeViewer 
            environment={selectedEnvironment || environments[0]}
            theme={theme}
            onClose={() => setShowCodeViewer(false)}
          />
        )}
      </main>
    </div>
  );
}

export default App;