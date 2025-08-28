import React from 'react';

interface Environment {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  models: any[];
}

interface EnvironmentTabsProps {
  environments: Environment[];
  activeEnvironment: string;
  setActiveEnvironment: (id: string) => void;
  theme: 'light' | 'dark';
}

const EnvironmentTabs: React.FC<EnvironmentTabsProps> = ({
  environments,
  activeEnvironment,
  setActiveEnvironment,
  theme
}) => {
  return (
    <div className="mb-6">
      <div className="flex gap-0 border-2 border-b-0 rounded-none overflow-hidden">
        {environments.map((env) => (
          <button
            key={env.id}
            onClick={() => setActiveEnvironment(env.id)}
            className={`px-6 py-3 font-mono text-xs uppercase tracking-wider border-r-2 last:border-r-0 transition-colors ${
              activeEnvironment === env.id
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
    </div>
  );
};

export default EnvironmentTabs;