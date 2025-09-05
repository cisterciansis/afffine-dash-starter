import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchSubnetOverview, type SubnetOverviewRow, fetchLiveEnvLeaderboard, type LiveEnvLeaderboardRow } from '../services/api';
import { useEnvironments } from '../contexts/EnvironmentsContext';
import PaginationControls from '../components/PaginationControls';
import CodeViewer from '../components/CodeViewer';
import { ExternalLink, Code } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import ScoreDistributionHistogram from '../components/ScoreDistributionHistogram';
import LatencyBoxPlot from '../components/LatencyBoxPlot';

const EnvironmentPage: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const { envName: rawEnv } = useParams();
  const { environments, loading: envLoading } = useEnvironments();

  const envName = (rawEnv || '').toUpperCase();
  const envKey = envName.toLowerCase();

  // Table view mode for this environment (Live default for consistency with overview)
  const [viewMode, setViewMode] = useState<'live' | 'historical'>('live');

  const { data, error, isLoading } = useQuery({
    queryKey: ['subnet-overview'],
    queryFn: fetchSubnetOverview,
    enabled: viewMode === 'historical',
    staleTime: 60000,
    refetchOnMount: false,
  });

  // Live environment leaderboard for this specific env
  const { data: liveData, error: liveError, isLoading: isLiveLoading } = useQuery({
    queryKey: ['live-env-leaderboard', envName],
    queryFn: () => fetchLiveEnvLeaderboard(envName),
    enabled: viewMode === 'live',
    staleTime: 5000,
    refetchInterval: viewMode === 'live' ? 6000 : false,
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

  // Live dataset from API
  const liveRows: LiveEnvLeaderboardRow[] = Array.isArray(liveData) ? (liveData as LiveEnvLeaderboardRow[]) : [];

  // Unified table state derived from current mode
  const tableTotal = viewMode === 'historical' ? ranked.length : liveRows.length;
  const tableLoading = viewMode === 'historical' ? isLoading : isLiveLoading;
  const tableError = viewMode === 'historical' ? (error as unknown) : (liveError as unknown);

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const [showCode, setShowCode] = useState(false);

  // Reset to first page when table count or page size changes
  useEffect(() => {
    setPage(1);
  }, [pageSize, tableTotal]);

  const totalPages = Math.max(1, Math.ceil(tableTotal / pageSize));
  // Clamp page if it exceeds totalPages
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = tableTotal === 0 ? 0 : (page - 1) * pageSize;
  const endIndex = Math.min(tableTotal, startIndex + pageSize);
  const pagedHistorical = ranked.slice(startIndex, Math.min(ranked.length, startIndex + pageSize));
  const pagedLive = liveRows.slice(startIndex, Math.min(liveRows.length, startIndex + pageSize));

  // Environment-specific overview stats
  const envTotals = ranked.length;
  const envEligible = ranked.filter(({ row }) => row.eligible).length;
  const envHighest = ranked.length > 0 ? ranked[0].value : null;
  const overviewLoading = viewMode === 'historical' ? isLoading : isLiveLoading;
  const envTotalsDisplay = viewMode === 'historical' ? envTotals : liveRows.length;
  const envEligibleDisplay = viewMode === 'historical' ? envEligible : liveRows.length;
  const envHighestDisplay =
    viewMode === 'historical'
      ? envHighest
      : (liveRows.length > 0
          ? liveRows.reduce<number | null>((max, r) => {
              const val = r.average_score ?? null;
              if (val == null) return max;
              return max == null ? val : Math.max(max, val);
            }, null)
          : null);

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
    repoUrl: `https://github.com/AffineFoundation/affine/blob/main/affine/envs/${envKey}.py`,
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
              {overviewLoading ? '—' : envTotalsDisplay}
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
              {overviewLoading ? '—' : envEligibleDisplay}
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
              {overviewLoading ? '—' : fmt(envHighestDisplay, 1)}
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
          <div className="flex items-center justify-between">
            <div className={`text-lg font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Top Models in {envName}
            </div>
            {/* Live / Historical toggle (match OverviewTable styling) */}
            <div className="inline-flex items-center gap-0">
              <button
                onClick={() => setViewMode('live')}
                className={`h-8 px-3 text-xs font-mono border rounded-l-sm ${viewMode === 'live'
                    ? (theme === 'dark' ? 'bg-white text-black border-white' : 'bg-gray-900 text-white border-gray-900')
                    : (theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100')
                  }`}
                aria-pressed={viewMode === 'live'}
              >
                Live
              </button>
              <button
                onClick={() => setViewMode('historical')}
                className={`h-8 px-3 text-xs font-mono border rounded-r-sm -ml-px ${viewMode === 'historical'
                    ? (theme === 'dark' ? 'bg-white text-black border-white' : 'bg-gray-900 text-white border-gray-900')
                    : (theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100')
                  }`}
                aria-pressed={viewMode === 'historical'}
              >
                Historical
              </button>
            </div>
          </div>
        </div>

        {/* Pagination Controls (consistent with Overview/Leaderboard) */}
        <div className="px-3 pt-3">
          <PaginationControls
            theme={theme}
            total={tableTotal}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
          />
        </div>

        <div className="p-3">
          {tableLoading && (
            <div className="space-y-2">
              {Array.from({ length: Math.min(pageSize, 10) }).map((_, idx) => (
                <div
                  key={idx}
                  className={`p-3 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}
                >
                  <div className={`${gridCols} items-center`}>
                    <Skeleton theme={theme} className="h-4 w-6 mx-auto" />
                    <Skeleton theme={theme} className="h-4 w-16 mx-auto" />
                    <Skeleton theme={theme} className="h-4 w-3/5" />
                    <Skeleton theme={theme} className="h-4 w-10 mx-auto" />
                    <Skeleton theme={theme} className="h-4 w-16 mx-auto" />
                    <Skeleton theme={theme} className="h-4 w-16 mx-auto" />
                    <Skeleton theme={theme} className="h-4 w-16 mx-auto" />
                    <Skeleton theme={theme} className="h-4 w-20 mx-auto" />
                    <Skeleton theme={theme} className="h-4 w-16 mx-auto" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {tableError != null && (
            <div className={`text-sm font-mono ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
              {tableError instanceof Error ? tableError.message : String(tableError)}
            </div>
          )}
          {!tableLoading && !tableError && tableTotal === 0 && (
            <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              No data available for {envName}.
            </div>
          )}

          {!tableLoading && !tableError && tableTotal > 0 && (
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
                {viewMode === 'historical' && pagedHistorical.map(({ row, value }, idx) => (
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
                {viewMode === 'live' && pagedLive.map((lr, idx) => (
                  <div key={`${lr.hotkey}-${lr.model}-${lr.revision ?? ''}`}>
                    <div className={`p-3 hover:bg-opacity-50 transition-colors ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-cream-50'}`}>
                      <div className={`${gridCols} text-center`}>
                        <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {startIndex + idx + 1}
                        </div>
                        <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {lr.last_seen_uid}
                        </div>
                        <div className={`text-sm font-mono truncate whitespace-nowrap text-left ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} title={lr.model}>
                          {midTrunc(lr.model, 48)}
                        </div>
                        <div className={`text-xs font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} title={String(lr.revision ?? '')}>
                          {midTrunc(String(lr.revision ?? ''), 10)}
                        </div>
                        <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {fmt(lr.average_score, 1)}
                        </div>
                        <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {dash}
                        </div>
                        <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {lr.success_rate_percent == null ? '—' : `${lr.success_rate_percent.toFixed(1)}%`}
                        </div>
                        <div className={`text-sm font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                          {lr.avg_latency == null ? dash : lr.avg_latency.toFixed(2)}
                        </div>
                        <div className={`text-sm font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                          {lr.total_rollouts.toLocaleString()}
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
      {!tableLoading && (
        <>
          <ScoreDistributionHistogram env={envName} theme={theme} />
          <LatencyBoxPlot env={envName} theme={theme} />
        </>
      )}
    </div>
  );
};

export default EnvironmentPage;
