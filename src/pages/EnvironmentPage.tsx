import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchSubnetOverview, type SubnetOverviewRow } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { useEnvironments } from '../contexts/EnvironmentsContext';
import PaginationControls from '../components/PaginationControls';
import CodeViewer from '../components/CodeViewer';
import { ExternalLink, Code } from 'lucide-react';
import TopMinersTrendChart from '../components/TopMinersTrendChart';
import ScoreDistributionHistogram from '../components/ScoreDistributionHistogram';
import LatencyBoxPlot from '../components/LatencyBoxPlot';

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

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const [showCode, setShowCode] = useState(false);

  // Reset to first page when ranked count or page size changes
  useEffect(() => {
    setPage(1);
  }, [pageSize, ranked.length]);

  const totalPages = Math.max(1, Math.ceil(ranked.length / pageSize));
  // Clamp page if it exceeds totalPages
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = ranked.length === 0 ? 0 : (page - 1) * pageSize;
  const endIndex = Math.min(ranked.length, startIndex + pageSize);
  const paged = ranked.slice(startIndex, startIndex + pageSize);

  // Environment-specific overview stats
  const envTotals = ranked.length;
  const envEligible = ranked.filter(({ row }) => row.eligible).length;
  const envHighest = ranked.length > 0 ? ranked[0].value : null;

  // Environment metadata and repo mapping (fallbacks; replace with real mappings when available)
  const repoMap: Record<string, string> = {
    abd: 'https://github.com/cisterciansis/afffine-dash-starter',
    ded: 'https://github.com/cisterciansis/afffine-dash-starter',
    elr: 'https://github.com/cisterciansis/afffine-dash-starter',
    hvm: 'https://github.com/cisterciansis/afffine-dash-starter',
    mth: 'https://github.com/cisterciansis/afffine-dash-starter',
    sat: 'https://github.com/cisterciansis/afffine-dash-starter',
  };

  const descriptionMap: Record<string, string> = {
    abd: 'ABD environment code and evaluation hooks.',
    ded: 'DED environment code and evaluation hooks.',
    elr: 'ELR environment code and evaluation hooks.',
    hvm: 'HVM environment code and evaluation hooks.',
    mth: 'MTH environment code and evaluation hooks.',
    sat: 'SAT environment code and evaluation hooks.',
  };

  const activeEnvMeta = {
    id: envKey,
    name: envName,
    description: descriptionMap[envKey] || `${envName} environment`,
    repoUrl: repoMap[envKey] || 'https://github.com/cisterciansis/afffine-dash-starter',
    models: Array.from({ length: envTotals }),
  };

  // Formatting helpers aligned with OverviewTable
  const fmt = (n: number | null | undefined, digits = 1) => (n == null ? '—' : n.toFixed(digits));
  const dash = '—';
  const midTrunc = (s: string, max = 48) => {
    if (!s) return s as unknown as string;
    if (s.length <= max) return s;
    const half = Math.floor((max - 1) / 2);
    return s.slice(0, half) + '…' + s.slice(s.length - half);
  };

  // Grid columns: Rank | UID | Model | Rev | Env Score | Overall Avg | Success % | Avg Latency | Rollouts
  const gridCols =
    'grid grid-cols-[56px_72px_minmax(0,1.1fr)_88px_112px_96px_96px_128px_104px] gap-2 items-center';

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
          <div className="flex items-center gap-3">
            <a
              href={activeEnvMeta.repoUrl}
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
              onClick={() => setShowCode(true)}
              className={`flex items-center gap-2 px-3 py-2 border-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                theme === 'dark'
                  ? 'border-white text-white hover:bg-gray-800'
                  : 'border-gray-400 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Code size={12} />
              VIEW CODE
            </button>
          </div>
        </div>
      </div>

      {showCode && (
        <CodeViewer
          environment={activeEnvMeta}
          theme={theme}
          onClose={() => setShowCode(false)}
        />
      )}

      {/* Environment Overview Stats (mirrors subnet overview styling) */}
      <div className={`p-4 border-2 rounded-none ${
        theme === 'dark'
          ? 'border-white bg-black'
          : 'border-gray-300 bg-cream-100'
      }`}>
        <h3 className={`text-lg font-mono font-bold mb-3 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {envName} OVERVIEW
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {isLoading ? '—' : envTotals}
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
              {isLoading ? '—' : envEligible}
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
              {isLoading ? '—' : fmt(envHighest, 1)}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Highest Score
            </div>
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

        {/* Pagination Controls (consistent with Overview/Leaderboard) */}
        <div className="px-3 pt-3">
          <PaginationControls
            theme={theme}
            total={ranked.length}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
          />
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
            <div className={`border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
              {/* Header Row */}
              <div className={`p-3 border-b-2 ${theme === 'dark' ? 'border-white bg-gray-900' : 'border-gray-300 bg-cream-50'}`}>
                <div className={`${gridCols} text-center`}>
                  <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>#</div>
                  <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>UID</div>
                  <div className={`text-xs font-mono uppercase tracking-wider font-bold text-left ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Model</div>
                  <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Rev</div>
                  <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{envName} Score</div>
                  <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Overall Avg</div>
                  <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Success %</div>
                  <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Avg Latency (s)</div>
                  <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Rollouts</div>
                </div>
              </div>

              {/* Body */}
              <div className="divide-y-2 divide-gray-300">
                {paged.map(({ row, value }, idx) => (
                  <div key={`${row.uid}-${row.model}-${row.rev}`}>
                    <div className={`p-3 hover:bg-opacity-50 transition-colors ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-cream-50'}`}>
                      <div className={`${gridCols} text-center`}>
                        <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {startIndex + idx + 1}
                        </div>
                        <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {row.uid}
                        </div>
                        <div className={`text-sm font-mono truncate whitespace-nowrap text-left ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} title={row.model}>
                          {midTrunc(row.model, 48)}
                        </div>
                        <div className={`text-xs font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} title={String(row.rev)}>
                          {midTrunc(String(row.rev), 10)}
                        </div>
                        <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {fmt(value, 1)}
                        </div>
                        <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {fmt(row.overall_avg_score, 1)}
                        </div>
                        <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {row.success_rate_percent.toFixed(1)}%
                        </div>
                        <div className={`text-sm font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                          {row.avg_latency == null ? dash : row.avg_latency.toFixed(2)}
                        </div>
                        <div className={`text-sm font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                          {row.total_rollouts.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <TopMinersTrendChart env={envName} theme={theme} />
      <ScoreDistributionHistogram env={envName} theme={theme} />
      <LatencyBoxPlot env={envName} theme={theme} />
    </div>
  );
};

export default EnvironmentPage;
