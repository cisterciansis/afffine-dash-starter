import React, { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardRow } from '../services/api';

type Theme = 'light' | 'dark';

interface LeaderboardProps {
  theme: Theme;
  limit?: number;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ theme, limit = 20 }) => {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchLeaderboard();
        if (!mounted) return;
        setRows(Array.isArray(data) ? data.slice(0, limit) : []);
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

  return (
    <div className={`mb-6 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <div className={`p-4 border-b-2 ${theme === 'dark' ? 'border-white bg-gray-900' : 'border-gray-300 bg-cream-50'}`}>
        <h3 className={`text-lg font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          LEADERBOARD (Live)
        </h3>
        <p className={`mt-1 text-xs font-mono uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Top miners by average score
        </p>
      </div>

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
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  <th className="px-2 py-2 text-left text-xs font-mono uppercase tracking-wider">#</th>
                  <th className="px-2 py-2 text-left text-xs font-mono uppercase tracking-wider">Hotkey</th>
                  <th className="px-2 py-2 text-left text-xs font-mono uppercase tracking-wider">Model</th>
                  <th className="px-2 py-2 text-right text-xs font-mono uppercase tracking-wider">Rollouts</th>
                  <th className="px-2 py-2 text-right text-xs font-mono uppercase tracking-wider">Avg Score</th>
                  <th className="px-2 py-2 text-right text-xs font-mono uppercase tracking-wider">Success %</th>
                  <th className="px-2 py-2 text-right text-xs font-mono uppercase tracking-wider">Avg Latency (s)</th>
                  <th className="px-2 py-2 text-right text-xs font-mono uppercase tracking-wider">Last UID</th>
                </tr>
              </thead>
              <tbody className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {rows.map((r, idx) => (
                  <tr key={`${r.hotkey}-${r.last_seen_uid}-${idx}`} className="border-t border-dashed border-gray-300">
                    <td className="px-2 py-2 text-xs font-mono">{idx + 1}</td>
                    <td className="px-2 py-2 text-xs font-mono break-all">{r.hotkey}</td>
                    <td className="px-2 py-2 text-xs font-mono break-all">{r.model}</td>
                    <td className="px-2 py-2 text-xs font-mono text-right">{r.total_rollouts.toLocaleString()}</td>
                    <td className="px-2 py-2 text-xs font-mono text-right">{r.average_score.toFixed(2)}</td>
                    <td className="px-2 py-2 text-xs font-mono text-right">{r.success_rate_percent.toFixed(1)}%</td>
                    <td className="px-2 py-2 text-xs font-mono text-right">{r.avg_latency == null ? '—' : r.avg_latency.toFixed(2)}</td>
                    <td className="px-2 py-2 text-xs font-mono text-right">{r.last_seen_uid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
