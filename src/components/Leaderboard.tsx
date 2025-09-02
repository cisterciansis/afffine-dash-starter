import React, { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardRow } from '../services/api';
import PaginationControls from './PaginationControls';

type Theme = 'light' | 'dark';

interface LeaderboardProps {
  theme: Theme;
  // Interpreted as "maximum items considered" (we still paginate within this cap)
  limit?: number;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ theme, limit = 0 }) => {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchLeaderboard();
        if (!mounted) return;
        const list = Array.isArray(data) ? data : [];
        setRows(limit && limit > 0 ? list.slice(0, limit) : list);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load leaderboard');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [limit]);

  // Reset to first page when rows count or page size changes
  useEffect(() => {
    setPage(1);
  }, [pageSize, rows.length]);

  // Clamp page if it exceeds totalPages
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Grid columns to match OverviewTable's compact, aligned layout
  // Columns: Rank | Hotkey | Model | Rollouts | Avg Score | Success % | Avg Latency | Last UID
  const gridCols =
    'grid grid-cols-[56px_minmax(0,1.1fr)_minmax(0,1.1fr)_104px_96px_96px_128px_88px] gap-2 items-center';

  const dash = '—';
  const fmt = (n: number | null | undefined, digits = 2) => (n == null ? dash : n.toFixed(digits));
  const midTrunc = (s: string, max = 42) => {
    if (!s) return s as unknown as string;
    if (s.length <= max) return s;
    const half = Math.floor((max - 1) / 2);
    return s.slice(0, half) + '…' + s.slice(s.length - half);
  };

  const startIndex = rows.length === 0 ? 0 : (page - 1) * pageSize;
  const endIndex = Math.min(rows.length, startIndex + pageSize);
  const pagedRows = rows.slice(startIndex, startIndex + pageSize);

  return (
    <div className={`mb-6 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      {/* Header */}
      <div className={`p-4 border-b-2 ${theme === 'dark' ? 'border-white bg-gray-900' : 'border-gray-300 bg-cream-50'}`}>
        <h3 className={`text-lg font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          LEADERBOARD (Live)
        </h3>
        <p className={`mt-1 text-xs font-mono uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Top miners by average score
        </p>
      </div>

      {/* Pagination summary + controls */}
      <div className="px-4 pt-4">
        <PaginationControls
          theme={theme}
          total={rows.length}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      </div>

      {/* Table Shell */}
      <div className="p-4">
        {loading && (
          <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Loading leaderboard…
          </div>
        )}

        {error && (
          <div className={`text-sm font-mono ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            No leaderboard data available.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className={`border-2 rounded-none overflow-x-auto ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
            {/* Header Row */}
            <div className={`p-3 border-b-2 ${theme === 'dark' ? 'border-white bg-gray-900' : 'border-gray-300 bg-cream-50'}`}>
              <div className={`${gridCols} text-center`}>
                <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>#</div>
                <div className={`text-xs font-mono uppercase tracking-wider font-bold text-left ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Hotkey</div>
                <div className={`text-xs font-mono uppercase tracking-wider font-bold text-left ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Model</div>
                <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Rollouts</div>
                <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Avg Score</div>
                <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Success %</div>
                <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Avg Latency (s)</div>
                <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Last UID</div>
              </div>
            </div>

            {/* Body */}
            <div className="divide-y-2 divide-gray-300">
              {pagedRows.map((r, idx) => (
                <div key={`${r.hotkey}-${r.last_seen_uid}-${startIndex + idx}`}>
                  <div className={`p-3 hover:bg-opacity-50 transition-colors ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-cream-50'}`}>
                    <div className={`${gridCols} text-center`}>
                      <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {startIndex + idx + 1}
                      </div>
                      <div className={`text-sm font-mono truncate whitespace-nowrap text-left ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} title={r.hotkey}>
                        {midTrunc(r.hotkey, 48)}
                      </div>
                      <div className={`text-sm font-mono truncate whitespace-nowrap text-left ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} title={r.model}>
                        {midTrunc(r.model, 48)}
                      </div>
                      <div className={`text-sm font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {r.total_rollouts.toLocaleString()}
                      </div>
                      <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {fmt(r.average_score)}
                      </div>
                      <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {r.success_rate_percent.toFixed(1)}%
                      </div>
                      <div className={`text-sm font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {r.avg_latency == null ? dash : r.avg_latency.toFixed(2)}
                      </div>
                      <div className={`text-sm font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {r.last_seen_uid}
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
  );
};

export default Leaderboard;
