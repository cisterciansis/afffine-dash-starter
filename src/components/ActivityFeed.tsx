import React, { useEffect, useState } from 'react';
import { fetchActivity, type ActivityRow } from '../services/api';

type Theme = 'light' | 'dark';

interface ActivityFeedProps {
  theme: Theme;
  limit?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ theme, limit = 10 }) => {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchActivity();
        if (!mounted) return;
        setRows(Array.isArray(data) ? data.slice(0, limit) : []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load activity');
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
          ACTIVITY FEED (Live)
        </h3>
        <p className={`mt-1 text-xs font-mono uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Latest rollouts across environments
        </p>
      </div>

      <div className="p-4">
        {loading && (
          <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Loading activity…
          </div>
        )}

        {error && (
          <div className={`text-sm font-mono ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            No recent activity available.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="divide-y divide-gray-300">
            {rows.map((r, idx) => {
              const ts = new Date(r.ingested_at);
              return (
                <div
                  key={`${r.uid}-${r.hotkey}-${idx}`}
                  className={`py-3 grid grid-cols-12 gap-2 items-center ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}
                >
                  <div className="col-span-3">
                    <div className="text-xs font-mono">{ts.toLocaleString()}</div>
                    <div className={`text-[10px] font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      UID: {r.uid}
                    </div>
                  </div>
                  <div className="col-span-3">
                    <div className="text-xs font-mono break-all">{r.hotkey}</div>
                    <div className={`text-[10px] font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {r.model}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs font-mono uppercase tracking-wider">{r.env_name}</div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="text-xs font-mono">
                      {r.score.toFixed(3)}
                    </div>
                    <div className={`text-[10px] font-mono ${r.success ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : (theme === 'dark' ? 'text-red-400' : 'text-red-600')}`}>
                      {r.success ? 'success' : 'fail'}
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={`inline-block w-2 h-2 rounded-full ${r.success ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
