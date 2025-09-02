import React from 'react';
import { X, ExternalLink, Code } from 'lucide-react';

interface Environment {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  models: any[];
}

interface CodeViewerProps {
  environment: Environment;
  theme: 'light' | 'dark';
  onClose: () => void;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ environment, theme, onClose }) => {
  // Mock code content - will be replaced with actual repo fetching
  const mockCode = `# ${environment.name} Environment
# Bittensor Affine Subnet Implementation

import gym
import numpy as np
from typing import Dict, Any, Tuple

class ${environment.name.replace('-', '')}Environment:
    """
    ${environment.description}
    
    This environment is part of the Bittensor Affine subnet
    for reinforcement learning model evaluation.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.env = gym.make('${environment.name}')
        self.config = config
        self.episode_count = 0
        
    def reset(self) -> np.ndarray:
        """Reset environment to initial state"""
        self.episode_count += 1
        return self.env.reset()
        
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict]:
        """Execute action and return observation, reward, done, info"""
        observation, reward, done, info = self.env.step(action)
        
        # Add subnet-specific metrics
        info['subnet_metrics'] = {
            'episode': self.episode_count,
            'action_taken': action,
            'reward_normalized': reward / 200.0  # Normalize for subnet
        }
        
        return observation, reward, done, info
        
    def get_performance_metrics(self) -> Dict[str, float]:
        """Return performance metrics for subnet evaluation"""
        return {
            'mean_episode_reward': self.calculate_mean_reward(),
            'episode_count': self.episode_count,
            'stability_score': self.calculate_stability()
        }
        
    def calculate_mean_reward(self) -> float:
        """Calculate mean reward over recent episodes"""
        # Implementation specific to environment
        pass
        
    def calculate_stability(self) -> float:
        """Calculate model stability metric"""
        # Implementation specific to environment  
        pass

# Export for subnet integration
__all__ = ['${environment.name.replace('-', '')}Environment']`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-4xl max-h-[90vh] border-2 ${
        theme === 'dark'
          ? 'border-white bg-black'
          : 'border-gray-300 bg-white'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b-2 flex items-center justify-between ${
          theme === 'dark' ? 'border-white' : 'border-gray-300'
        }`}>
          <div>
            <h3 className={`font-mono text-lg font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {environment.name} - CODE VIEW
            </h3>
            <p className={`font-sans text-sm mt-1 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {environment.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={environment.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-3 py-2 border-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                theme === 'dark'
                  ? 'border-white text-white hover:bg-gray-800'
                  : 'border-gray-400 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ExternalLink size={12} />
              REPO
            </a>
            <button
              onClick={onClose}
              className={`p-2 border-2 transition-colors ${
                theme === 'dark'
                  ? 'border-white text-white hover:bg-gray-800'
                  : 'border-gray-400 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-4 overflow-auto max-h-[70vh]">
          <pre className={`font-mono text-sm leading-relaxed ${
            theme === 'dark' ? 'text-white' : 'text-gray-800'
          }`}>
            <code>{mockCode}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t-2 ${
          theme === 'dark' ? 'border-white' : 'border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className={`font-mono text-xs uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-500'
            }`}>
              Environment loaded • {environment.models.length} active models
            </div>
            <div className="flex items-center gap-2">
              <Code size={12} className={theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} />
              <span className={`font-mono text-xs ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Python 3.9+ • Affine Gym
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeViewer;
