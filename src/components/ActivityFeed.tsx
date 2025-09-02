import React, { useState } from 'react';
import { fetchActivity, type ActivityRow } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Skeleton, SkeletonText } from './Skeleton';

type Theme = 'light' | 'dark';

interface ActivityFeedProps {
  theme: Theme;
  limit?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ theme, limit = 10 }) => {
  const { data, error: queryError, isLoading, refetch } = useQuery({
    queryKey: ['activity', limit],
    queryFn: fetchActivity,
    staleTime: 60000, // show cached activity on revisit; no immediate remount refetch
    refetchOnMount: false,
    refetchInterval: 1000, // auto-refresh every second seamlessly
  });
  const rows: ActivityRow[] = Array.isArray(data) ? data.slice(0, limit) : [];
  const [manualRefreshing, setManualRefreshing] = useState(false);


  return (
    <div className={`mb-6 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <div className={`p-4 border-b-2 ${theme === 'dark' ? 'border-white bg-gray-900' : 'border-gray-300 bg-cream-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-lg font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              ACTIVITY FEED (Live)
            </h3>
            <p className={`mt-1 text-xs font-mono uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Latest rollouts across environments
            </p>
          </div>
          <button
            onClick={async () => {
              setManualRefreshing(true);
              try {
                await refetch();
              } finally {
                setManualRefreshing(false);
              }
            }}
            disabled={manualRefreshing}
            className={`flex items-center gap-2 px-3 h-9 border-2 font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-60 ${
              theme === 'dark'
                ? 'border-white text-white hover:bg-gray-800'
                : 'border-gray-400 text-gray-700 hover:bg-gray-100'
            }`}
            aria-label="Refresh activity feed"
            title="Refresh activity feed"
          >
            <RefreshCw size={14} className={manualRefreshing ? 'animate-spin' : ''} />
            {manualRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="p-4">
        {isLoading && (
          <div className="divide-y divide-gray-300">
            {Array.from({ length: Math.min(limit, 8) }).map((_, i) => (
              <div
                key={i}
                className={`py-3 grid grid-cols-12 gap-2 items-center ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}
              >
                <div className="col-span-3">
                  <SkeletonText theme={theme} className="h-3 w-24 mb-1" />
                  <SkeletonText theme={theme} className="h-2 w-16" />
                </div>
                <div className="col-span-3">
                  <SkeletonText theme={theme} className="h-3 w-28 mb-1" />
                  <SkeletonText theme={theme} className="h-2 w-24" />
                </div>
                <div className="col-span-2">
                  <SkeletonText theme={theme} className="h-3 w-16" />
                </div>
                <div className="col-span-2 text-right">
                  <SkeletonText theme={theme} className="h-3 w-12 ml-auto mb-1" />
                  <SkeletonText theme={theme} className="h-2 w-10 ml-auto" />
                </div>
                <div className="col-span-2 text-right">
                  <Skeleton theme={theme} className="h-2 w-2 rounded-full ml-auto" />
                </div>
              </div>
            ))}
          </div>
        )}

        {queryError && (
          <div className={`text-sm font-mono ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
            {queryError instanceof Error ? queryError.message : String(queryError)}
          </div>
        )}

        {!isLoading && !queryError && rows.length === 0 && (
          <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            No recent activity available.
          </div>
        )}

        {!isLoading && !queryError && rows.length > 0 && (
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
