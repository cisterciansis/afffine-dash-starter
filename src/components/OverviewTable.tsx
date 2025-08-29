import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Download, ExternalLink, Rocket } from 'lucide-react';

interface Model {
  uid: string;
  hotkey: string;
  model: string;
  revision: string;
  total_rollouts: number;
  success_rate: number;
  avg_latency: number;
  miner_block: number;
  recent_activity: number;
  epochs: number;
  last_updated: string;
  daily_rollouts: number;
  environment: string;
  rank: number;
  scores: {
    SAT: number;
    ABD: number;
    DED: number;
    ELR: number;
  };
  levels: {
    L1: number;
    L2: number;
    L3: number;
    L4: number;
  };
  points: number;
  eligibility: boolean;
  weight: number;
}

interface OverviewTableProps {
  environments: any[];
  theme: 'light' | 'dark';
}

const OverviewTable: React.FC<OverviewTableProps> = ({ environments, theme }) => {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  // Flatten all models from all environments with enhanced data
  const allModels: Model[] = environments.flatMap(env => 
    env.models.map((model: any, index: number) => ({
      ...model,
      model: `Model-${model.uid.slice(-3)}`,
      revision: `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}`,
      environment: env.name,
      rank: index + 1,
      uniqueId: `${model.uid}-${env.name}` // Create unique identifier
    }))
  ).sort((a, b) => b.points - a.points); // Sort by points descending

  // Add global rankings
  const rankedModels = allModels.map((model, index) => ({
    ...model,
    globalRank: index + 1
  }));

  // Generate stable mock data based on UID to prevent refreshing
  const generateStableData = (uid: string) => {
    // Use UID as seed for consistent random values
    const seed = uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = (multiplier: number = 1) => ((seed * 9301 + 49297) % 233280) / 233280 * multiplier;
    
    return {
      scores: {
        SAT: random(100),
        ABD: random(100),
        DED: random(100),
        ELR: random(100),
      },
      levels: {
        L1: Math.floor(random(10)),
        L2: Math.floor(random(10)),
        L3: Math.floor(random(10)),
        L4: Math.floor(random(10)),
      },
      points: Math.floor(random(1000)),
      eligibility: random() > 0.3,
      weight: random(10),
    };
  };

  // Apply stable data to models
  const stableModels = rankedModels.map(model => ({
    ...model,
    ...generateStableData(model.uid)
  }));

  const handleExport = (uid: string, environment: string, rollouts: number) => {
    console.log(`Exporting model ${uid} from ${environment} with ${rollouts} rollouts`);
    alert(`Exporting model ${uid} from ${environment} - ${rollouts} daily rollouts available`);
  };

  const toggleExpanded = (uniqueId: string) => {
    setExpandedModel(expandedModel === uniqueId ? null : uniqueId);
  };

  return (
    <div className={`space-y-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
      {/* Overview Stats */}
      <div className={`p-4 border-2 rounded-none ${
        theme === 'dark'
          ? 'border-white bg-black'
          : 'border-gray-300 bg-cream-100'
      }`}>
        <h3 className={`text-lg font-mono font-bold mb-3 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          SUBNET OVERVIEW
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {stableModels.length}
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
              {stableModels.filter(m => m.eligibility).length}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Eligible
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {environments.length}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Environments
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {stableModels.length > 0 ? stableModels[0].points : '0'}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Top Points
            </div>
          </div>
        </div>
      </div>

      {/* Models Table */}
      <div className={`border-2 rounded-none overflow-hidden ${
        theme === 'dark'
          ? 'border-white bg-black'
          : 'border-gray-300 bg-white'
      }`}>
        {/* Table Header */}
        <div className={`p-4 border-b-2 ${
          theme === 'dark' ? 'border-white bg-gray-900' : 'border-gray-300 bg-cream-50'
        }`}>
          <div className="grid grid-cols-12 gap-2 items-center text-center">
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              UID
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Model
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Rev
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              SAT
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              ABD
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              DED
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              ELR
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              L1-L4
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Points
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Eligible
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Weight
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Actions
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y-2 divide-gray-300">
          {stableModels.map((model) => (
            <div key={model.uniqueId}>
              {/* Main Row */}
              <div className={`p-4 hover:bg-opacity-50 transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-cream-50'
              }`}>
                <div className="grid grid-cols-12 gap-2 items-center text-center">
                  <div className={`text-lg font-mono font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {model.uid}
                  </div>
                  <div className={`text-sm font-mono ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {model.model}
                  </div>
                  <div className={`text-sm font-mono ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {model.revision}
                  </div>
                  <div className={`text-lg font-mono font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {model.scores.SAT.toFixed(1)}
                  </div>
                  <div className={`text-lg font-mono font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {model.scores.ABD.toFixed(1)}
                  </div>
                  <div className={`text-lg font-mono font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {model.scores.DED.toFixed(1)}
                  </div>
                  <div className={`text-lg font-mono font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {model.scores.ELR.toFixed(1)}
                  </div>
                  <div className={`text-sm font-mono ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {model.levels.L1}/{model.levels.L2}/{model.levels.L3}/{model.levels.L4}
                  </div>
                  <div className={`text-lg font-mono font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {model.points}
                  </div>
                  <div className="flex items-center justify-center">
                    <div className={`w-3 h-3 rounded-full ${
                      model.eligibility 
                        ? 'bg-green-500' 
                        : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-400'
                    }`}></div>
                  </div>
                  <div className={`text-sm font-mono ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {model.weight.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpanded(model.uniqueId)}
                      className={`p-2 border transition-colors ${
                        theme === 'dark'
                          ? 'border-white text-white hover:bg-gray-800'
                          : 'border-gray-400 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {expandedModel === model.uniqueId ? 
                        <ChevronDown size={14} /> : 
                        <ChevronRight size={14} />
                      }
                    </button>
                    <a
                      href={`https://huggingface.co/affine-subnet/model-${model.uid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-1 border transition-colors ${
                        theme === 'dark'
                          ? 'border-white text-white hover:bg-gray-800'
                          : 'border-gray-400 text-gray-700 hover:bg-gray-100'
                      }`}
                      title="View on Hugging Face"
                    >
                      <img src="/hf-logo-pirate.png" alt="HF" className="w-35 h-35 min-w-[16px] min-h-[16px]" />
                    </a>
                    <a
                      href={`https://chutes.ai/deploy/${model.uid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-1 border transition-colors ${
                        theme === 'dark'
                          ? 'border-white text-white hover:bg-gray-800'
                          : 'border-gray-400 text-gray-700 hover:bg-gray-100'
                      }`}
                      title="View Chutes Deployment"
                    >
                      <img 
                        src={theme === 'dark' ? "/chutes_logo.png" : "/chutes_logo_black.png"} 
                        alt="Chutes" 
                        className="w-6 h-6 min-w-[20px] min-h-[20px]" 
                      />
                    </a>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedModel === model.uniqueId && (
                <div className={`p-4 border-t ${
                  theme === 'dark' 
                    ? 'border-white bg-gray-900' 
                    : 'border-gray-300 bg-cream-50'
                }`}>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Model Details */}
                    <div>
                      <h4 className={`text-sm font-mono uppercase tracking-wider font-bold mb-3 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        Model Details
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className={`text-xs font-mono ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            Last Updated:
                          </span>
                          <span className={`text-xs font-mono ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {new Date(model.last_updated).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-xs font-mono ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            Global Rank:
                          </span>
                          <span className={`text-xs font-mono font-bold ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            #{model.globalRank}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-xs font-mono ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            Environment:
                          </span>
                          <span className={`text-xs font-mono font-bold ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {model.environment}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-xs font-mono ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            Epochs:
                          </span>
                          <span className={`text-xs font-mono font-bold ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {model.epochs.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-xs font-mono ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            Daily Rollouts:
                          </span>
                          <span className={`text-xs font-mono font-bold ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {model.daily_rollouts}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Export Actions */}
                    <div>
                      <h4 className={`text-sm font-mono uppercase tracking-wider font-bold mb-3 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        Export Options
                      </h4>
                      <div className="space-y-3">
                        <button
                          onClick={() => handleExport(model.uid, model.environment, model.daily_rollouts)}
                          disabled={model.daily_rollouts === 0}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider border transition-colors ${
                            model.daily_rollouts === 0
                              ? theme === 'dark'
                                ? 'border-gray-600 text-gray-600 cursor-not-allowed'
                                : 'border-gray-300 text-gray-400 cursor-not-allowed'
                              : theme === 'dark'
                                ? 'border-white text-white hover:bg-white hover:text-black'
                                : 'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                          }`}
                        >
                          <Download size={12} />
                          Export Rollouts ({model.daily_rollouts})
                        </button>
                        <div className={`text-xs font-mono text-center ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Export rollout data for all environments
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OverviewTable;