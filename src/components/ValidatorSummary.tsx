import React from 'react';
import { useValidatorSummary } from '../hooks/useValidatorSummary';

interface Props {
  theme: 'light' | 'dark';
}

const ValidatorSummary: React.FC<Props> = ({ theme }) => {
  const { data, loading, error, refetch } = useValidatorSummary();

  if (loading) {
    return (
      <div className={`p-6 border-2 rounded-none text-center ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-cream-100'}`}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-current mx-auto mb-3" />
        <div className="font-mono text-xs uppercase tracking-wider">Loading validator summary…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`p-6 border-2 rounded-none text-center ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-cream-100'}`}>
        <div className={`font-mono text-sm uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>Error</div>
        <div className="font-sans text-sm mb-4">{error || 'Failed to load data.'}</div>
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
    );
  }

  const { columns, rows, timestamp, tail } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`p-4 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-cream-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-xl font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              VALIDATOR SUMMARY
            </h2>
            <div className={`text-xs font-mono uppercase tracking-wider mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Tail {tail} • {new Date(timestamp).toLocaleString()}
            </div>
          </div>
          <button
            onClick={refetch}
            className={`px-4 py-2 border-2 font-mono text-xs uppercase tracking-wider transition-colors ${
              theme === 'dark'
                ? 'border-white text-white hover:bg-white hover:text-black'
                : 'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
            }`}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className={`overflow-auto border-2 rounded-none ${theme === 'dark' ? 'border-white' : 'border-gray-300'}`}>
        <table className={`min-w-full ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-gray-900'}`}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className={`px-4 py-2 border-b-2 font-mono text-xs uppercase tracking-wider text-left ${
                    theme === 'dark' ? 'border-white' : 'border-gray-300'
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? (theme === 'dark' ? 'bg-black' : 'bg-white') : (theme === 'dark' ? 'bg-black' : 'bg-cream-50')}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-4 py-2 border-t font-sans text-sm ${
                      theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                    }`}
                  >
                    {cell as any}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ValidatorSummary;

