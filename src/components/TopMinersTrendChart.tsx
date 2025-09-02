import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTopMinersByEnv, TopMinersByEnvRow } from '../services/api';
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  Tooltip,
  Legend,
} from 'recharts';

interface Props {
  env: string; // e.g., 'SAT'
  theme: 'light' | 'dark';
}

const formatDate = (isoOrDate: string) => {
  try {
    const d = new Date(isoOrDate);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return String(isoOrDate);
  }
};

const colorPalette = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#ca8a04', // yellow-600
  '#0891b2', // cyan-700
  '#e11d48', // rose-600
  '#0ea5e9', // sky-500
];

const truncLegend = (s: string, max = 16) =>
  (s.length <= max ? s : `${s.slice(0, 8)}…${s.slice(-7)}`);

const TopMinersTrendChart: React.FC<Props> = ({ env, theme }) => {
  const { data, isLoading, error } = useQuery<TopMinersByEnvRow[]>({
    queryKey: ['top-miners-by-env', env],
    queryFn: () => fetchTopMinersByEnv(env),
    enabled: Boolean(env),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: false,
  });

  // Transform: rows -> [{ period, [hotkey1]: score, [hotkey2]: score, ... }]
  const { mergedData, hotkeys } = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const hotkeySet = new Set<string>();
    const byDate = new Map<string, Record<string, any>>();

    for (const r of rows) {
      const periodISO = typeof r.period === 'string' ? r.period : String(r.period);
      hotkeySet.add(r.hotkey);
      if (!byDate.has(periodISO)) {
        byDate.set(periodISO, { period: periodISO });
      }
      const entry = byDate.get(periodISO)!;
      entry[r.hotkey] = r.average_score;
    }

    const merged = Array.from(byDate.values()).sort((a, b) => {
      return new Date(a.period).getTime() - new Date(b.period).getTime();
    });

    return {
      mergedData: merged,
      hotkeys: Array.from(hotkeySet),
    };
  }, [data]);

  return (
    <div className={`p-4 border-2 rounded-none overflow-hidden ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <h3 className={`text-lg font-mono font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Top 5 Miners Performance Over Time — {env}
      </h3>

      {error && (
        <div className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>
          {(error as Error).message}
        </div>
      )}
      {isLoading && !error && (
        <div style={{ width: '100%', height: 360 }}>
          <div className={`h-full w-full animate-pulse ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`} />
        </div>
      )}

      {!isLoading && !error && (
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <LineChart data={mergedData} margin={{ top: 12, right: 56, left: 56, bottom: 36 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#ddd'} />
              <XAxis
                dataKey="period"
                tickFormatter={formatDate}
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                tickMargin={8}
              />
              <YAxis
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                domain={[0, 1]}
                tickFormatter={(v: number) => v.toFixed(2)}
                tickMargin={8}
                label={{ value: 'Average Score', angle: -90, position: 'left', offset: 0, fill: theme === 'dark' ? '#ddd' : '#333' }}
              />
              <Tooltip
                contentStyle={{ background: theme === 'dark' ? '#111' : '#fff', border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}
                labelFormatter={(label) => `Date: ${formatDate(String(label))}`}
                formatter={(value: any, name: any) => [Number(value).toFixed(3), name]}
              />
              <Legend
                verticalAlign="bottom"
                align="left"
                wrapperStyle={{ paddingTop: 8 }}
                formatter={(value: any) => (typeof value === 'string' ? truncLegend(value) : value)}
              />
              {hotkeys.map((hk, idx) => (
                <Line
                  key={hk}
                  type="monotone"
                  dataKey={hk}
                  name={hk}
                  stroke={colorPalette[idx % colorPalette.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default TopMinersTrendChart;
