import React from 'react';
import { Monitor, Moon, Sun, ExternalLink } from 'lucide-react';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme }) => {
  return (
    <header className={`border-b-2 ${
      theme === 'dark' 
        ? 'border-white bg-black' 
        : 'border-gray-300 bg-cream-100'
    }`}>
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-sans font-bold mb-1 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            AFFINE DASHBOARD
          </h1>
          <p className={`text-sm font-sans ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Real-time monitoring and performance metrics for Affine RL environments
          </p>
        </div>
        
        <nav className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <a
              href="https://taostats.io/subnets/120/metagraph"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-3 py-2 border-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                theme === 'dark'
                  ? 'border-white text-white hover:bg-white hover:text-black'
                  : 'border-gray-400 text-gray-700 hover:bg-gray-900 hover:text-white'
              }`}
            >
              <ExternalLink size={12} />
              METAGRAPH
            </a>
          </div>
          
          <button
            onClick={toggleTheme}
            className={`p-2 border-2 transition-colors ${
              theme === 'dark'
                ? 'border-white text-white hover:bg-gray-800'
                : 'border-gray-400 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;