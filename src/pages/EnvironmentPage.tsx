import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchSubnetOverview, type SubnetOverviewRow } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { useEnvironments } from '../contexts/EnvironmentsContext';

const EnvironmentPage: React.FC = () => {
  const { envName: rawEnv } = useParams();
  const { theme } = useTheme();
  const { environments, loading: envLoading } = useEnvironments();

  const envName = (rawEnv || '').toUpperCase();
  const envKey = envName.toLowerCase();

  const { data, error, isLoading } = useQuery({
    queryKey: ['subnet-overview'],
    queryFn: fetchSubnetOverview,
    staleTime: 60000,
    refetchInterval: 6000,
    refetchOnMount: false,
  });

  if (!envLoading) {
    // Validate the env from URL against the dynamic list
    if (!environments.includes(envName)) {
      return <Navigate to="/" replace />;
    }
  }

  const rows = Array.isArray(data) ? data : [];

  // Build a per-environment ranking from subnet overview by looking up the dynamic property
  const ranked = rows
    .map((r) => {
      const value = (r as any)[envKey] as number | null | undefined;
      return { row: r, value: value == null ? null : value };
    })
    .filter((x) => x.value != null)
    .sort((a, b) => (b.value! - a.value!));

  const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(1));
  const dash = '—';

  return (
    <div className={`space-y-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
      {/* Header / Summary */}
      <div className={`p-4 border-2 rounded-none ${
        theme === 'dark'
          ? 'border-white bg-black'
          : 'border-gray-300 bg-white'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-xl font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {envName} Environment
            </h2>
            <p className={`text-xs font-mono uppercase tracking-wider mt-1 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Dynamic view powered by live environments registry
            </p>
          </div>
        </div>
      </div>

      {/* Top Models Table for this Environment */}
      <div className={`border-2 rounded-none overflow-x-auto ${
        theme === 'dark'
          ? 'border-white bg-black'
          : 'border-gray-300 bg-white'
      }`}>
        <div className={`p-3 border-b-2 ${
          theme === 'dark' ? 'border-white bg-gray-900' : 'border-gray-300 bg-cream-50'
        }`}>
          <div className={`text-lg font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Top Models in {envName}
          </div>
        </div>

        <div className="p-3">
          {isLoading && (
            <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Loading…
            </div>
          )}
          {error && (
            <div className={`text-sm font-mono ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
              {error instanceof Error ? error.message : String(error)}
            </div>
          )}
          {!isLoading && !error && ranked.length === 0 && (
            <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              No data available for {envName}.
            </div>
          )}
          {!isLoading && !error && ranked.length > 0 && (
            <table className="w-full table-fixed">
              <thead>
                <tr className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  <th className="px-2 py-2 text-left text-xs font-mono uppercase tracking-wider">#</th>
                  <th className="px-2 py-2 text-left text-xs font-mono uppercase tracking-wider">UID</th>
                  <th className="px-2 py-2 text-left text-xs font-mono uppercase tracking-wider">Model</th>
                  <th className="px-2 py-2 text-left text-xs font-mono uppercase tracking-wider">Rev</th>
                  <th className="px-2 py-2 text-right text-xs font-mono uppercase tracking-wider">{envName} Score</th>
                  <th className="px-2 py-2 text-right text-xs font-mono uppercase tracking-wider">Overall Avg</th>
                  <th className="px-2 py-2 text-right text-xs font-mono uppercase tracking-wider">Success %</th>
                  <th className="px-2 py-2 text-right text-xs font-mono uppercase tracking-wider">Avg Latency (s)</th>
                  <th className="px-2 py-2 text-right text-xs font-mono uppercase tracking-wider">Rollouts</th>
                </tr>
              </thead>
              <tbody className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {ranked.map(({ row, value }, idx) => (
                  <tr key={`${row.uid}-${row.model}-${row.rev}`} className="border-t border-dashed border-gray-300">
                    <td className="px-2 py-2 text-xs font-mono">{idx + 1}</td>
                    <td className="px-2 py-2 text-xs font-mono tabular-nums">{row.uid}</td>
                    <td className="px-2 py-2 text-xs font-mono break-all">{row.model}</td>
                    <td className="px-2 py-2 text-xs font-mono">{String(row.rev)}</td>
                    <td className="px-2 py-2 text-xs font-mono text-right">{fmt(value)}</td>
                    <td className="px-2 py-2 text-xs font-mono text-right">{fmt(row.overall_avg_score)}</td>
                    <td className="px-2 py-2 text-xs font-mono text-right">{row.success_rate_percent.toFixed(1)}%</td>
                    <td className="px-2 py-2 text-xs font-mono text-right">{row.avg_latency == null ? dash : row.avg_latency.toFixed(2)}</td>
                    <td className="px-2 py-2 text-xs font-mono text-right">{row.total_rollouts.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnvironmentPage;
