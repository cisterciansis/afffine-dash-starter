import React, { useState } from 'react';
import { Download, Activity, Eye, Code } from 'lucide-react';

interface Model {
  uid: string;
  hotkey: string;
  model: string;
  revision: string;
  total_rollouts: number;
  success_rate: number;
  avg_latency: number;
  score: number;
  epochs: number;
  last_updated: string;
  status: string;
  daily_rollouts: number;
  miner_block: number;
  recent_activity: number;
  environment: string;
  live_metrics?: {
    current_loss: number;
    learning_rate: number;
    batch_processed: number;
  };
}

interface ModelGridProps {
  models: Model[];
  environmentId: string;
  theme: 'light' | 'dark';
}

const ModelGrid: React.FC<ModelGridProps> = ({ models, environmentId, theme }) => {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'training':
        return theme === 'dark' ? 'text-green-400' : 'text-green-600';
      case 'evaluating':
        return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600';
      case 'idle':
        return theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
      default:
        return theme === 'dark' ? 'text-white' : 'text-gray-900';
    }
  };

  const getStatusDot = (status: string) => {
    const baseClasses = "w-2 h-2 rounded-full inline-block mr-2";
    switch (status) {
      case 'training':
        return `${baseClasses} bg-green-500 animate-pulse`;
      case 'evaluating':
        return `${baseClasses} bg-yellow-500 animate-pulse`;
      case 'idle':
        return `${baseClasses} bg-gray-400`;
      default:
        return `${baseClasses} bg-gray-400`;
    }
  };

  const handleExport = (uid: string, rollouts: number) => {
    // Mock export functionality - will be replaced with actual API call
    console.log(`Exporting model ${uid} with ${rollouts} rollouts`);
    alert(`Exporting model ${uid} - ${rollouts} daily rollouts available`);
  };

  const toggleExpanded = (uid: string) => {
    setExpandedModel(expandedModel === uid ? null : uid);
  };

  // Environment summary stats
  const totalModels = models.length;
  const activeTraining = models.filter(m => m.status === 'training').length;
  const bestScore = models.length > 0 ? Math.max(...models.map(m => m.score)) : 0;

  return (
    <div className={`space-y-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
      {/* Environment Summary */}
      <div className={`p-4 border-2 rounded-none ${
        theme === 'dark'
          ? 'border-white bg-black'
          : 'border-gray-300 bg-cream'
      }`}>
        <h3 className={`text-lg font-mono font-bold mb-3 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {environmentId.toUpperCase()} ENVIRONMENT OVERVIEW
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {totalModels}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Total Models
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-green-400' : 'text-green-600'
            }`}>
              {activeTraining}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Active Training
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {bestScore.toFixed(2)}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Best Score
            </div>
          </div>
        </div>
      </div>

      {/* Models Grid */}
      {models.length === 0 ? (
        <div className={`p-8 text-center border-2 rounded-none ${
          theme === 'dark'
            ? 'border-white bg-black text-gray-300'
            : 'border-gray-300 bg-white text-gray-600'
        }`}>
          <p className="font-mono text-sm uppercase tracking-wider">
            No models available for this environment
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {models.map((model, index) => (
            <div
              key={model.uid}
              className={`border-2 rounded-none ${
                theme === 'dark'
                  ? 'border-white bg-black'
                  : 'border-gray-300 bg-white'
              }`}
            >
              {/* Model Header */}
              <div className={`p-4 border-b ${
                theme === 'dark' ? 'border-white' : 'border-gray-300'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className={`text-lg font-mono font-bold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Model-{model.uid.slice(-3)}
                    </span>
                    <span className={`ml-3 text-sm font-mono ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      #{index + 1} • UID: {model.uid}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className={getStatusDot(model.status)}></span>
                    <span className={`text-xs font-mono uppercase tracking-wider ${getStatusColor(model.status)}`}>
                      {model.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Model Metrics */}
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className={`text-xl font-mono font-bold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {model.score.toFixed(3)}
                    </div>
                    <div className={`text-xs font-mono uppercase tracking-wider ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Score
                    </div>
                  </div>
                  <div>
                    <div className={`text-xl font-mono font-bold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {model.epochs}
                    </div>
                    <div className={`text-xs font-mono uppercase tracking-wider ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Epochs
                    </div>
                  </div>
                </div>

                <div className={`text-xs font-mono ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Last Updated: {new Date(model.last_updated).toLocaleString()}
                </div>
              </div>

              {/* Live Feed Section */}
              <div className={`p-4 border-t ${
                theme === 'dark' ? 'border-white' : 'border-gray-300'
              }`}>
                <button
                  onClick={() => toggleExpanded(model.uid)}
                  className={`flex items-center text-sm font-mono uppercase tracking-wider mb-3 hover:opacity-70 transition-opacity ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  <span className={`ml-3 text-sm font-mono font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Model-{model.uid.slice(-3)}
                  </span>
                  Live Feed
                  <Eye className={`w-3 h-3 ml-2 transition-transform ${
                    expandedModel === model.uid ? 'rotate-180' : ''
                  }`} />
                </button>

                {expandedModel === model.uid && model.live_metrics && (
                  <div className={`space-y-2 text-xs font-mono ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    <div className="flex justify-between">
                      <span>Current Loss:</span>
                      <span className="font-bold">{model.live_metrics.current_loss.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Learning Rate:</span>
                      <span className="font-bold">{model.live_metrics.learning_rate.toFixed(8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Batches Processed:</span>
                      <span className="font-bold">{model.live_metrics.batch_processed.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Export Section */}
              <div className={`p-4 border-t ${
                theme === 'dark' ? 'border-white' : 'border-gray-300'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-sm font-mono uppercase tracking-wider ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Daily Rollouts
                    </div>
                    <div className={`text-xs font-mono ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {model.daily_rollouts} available
                    </div>
                  </div>
                  <button
                    onClick={() => handleExport(model.uid, model.daily_rollouts)}
                    disabled={model.daily_rollouts === 0}
                    className={`flex items-center px-3 py-2 text-xs font-mono uppercase tracking-wider border transition-colors ${
                      model.daily_rollouts === 0
                        ? theme === 'dark'
                          ? 'border-gray-600 text-gray-600 cursor-not-allowed'
                          : 'border-gray-300 text-gray-400 cursor-not-allowed'
                        : theme === 'dark'
                          ? 'border-white text-white hover:bg-white hover:text-black'
                          : 'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                    }`}
                  >
                    <Download className="w-3 h-3 mr-2" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelGrid;
