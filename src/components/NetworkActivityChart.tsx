import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchNetworkActivity, NetworkActivityRow } from '../services/api';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  Line,
  Tooltip,
  Legend,
} from 'recharts';

interface Props {
  theme: 'light' | 'dark';
}

const formatDate = (isoDate: string) => {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return isoDate;
  }
};

const compactNumber = (n: number) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

const NetworkActivityChart: React.FC<Props> = ({ theme }) => {
  const { data, isLoading, error } = useQuery<NetworkActivityRow[]>({
    queryKey: ['network-activity'],
    queryFn: fetchNetworkActivity,
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchOnMount: false,
  });

  // Normalize server and mock data to expose two lines:
  // - avg_all_plot: daily average over all models (continuous)
  // - avg_top50_daily_plot: daily average over top 50 models for that day (dynamic cohort)
  const chartData = (data ?? []).map((row) => ({
    ...row,
    // API returns { avg_all, avg_top50_daily }; mock has only { average_score }
    avg_all_plot: (row as any).avg_all ?? (row as any).average_score ?? null,
    avg_top50_daily_plot: (row as any).avg_top50_daily ?? null,
  }));

  return (
    <div className={`p-4 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <h3 className={`text-lg font-mono font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Network Activity & Performance (Last 60 Days)
      </h3>

      {error && (
        <div className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>
          {(error as Error).message}
        </div>
      )}
      {isLoading && !error && (
        <div style={{ width: '100%', height: 300 }}>
          <div className={`h-full w-full animate-pulse ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`} />
        </div>
      )}

      {!isLoading && !error && (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 12, right: 56, left: 56, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#ddd'} />
              <XAxis dataKey="period" tickFormatter={formatDate} stroke={theme === 'dark' ? '#ddd' : '#333'} tickMargin={8} />
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                tickFormatter={(v: number) => compactNumber(v)}
                tickMargin={8}
                label={{ value: 'Total Rollouts', angle: -90, position: 'left', offset: 0, fill: theme === 'dark' ? '#ddd' : '#333' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                label={{ value: 'Avg Score', angle: 90, position: 'right', offset: 0, fill: theme === 'dark' ? '#ddd' : '#333' }}
                domain={[0, 1]}
                tickFormatter={(v: number) => v.toFixed(2)}
                tickMargin={8}
              />
              <Tooltip
                contentStyle={{ background: theme === 'dark' ? '#111' : '#fff', border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}
                labelFormatter={(label) => `Date: ${formatDate(String(label))}`}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="total_rollouts" name="Total Rollouts" fill={theme === 'dark' ? '#60a5fa' : '#3b82f6'} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avg_all_plot"
                name="Average Score (All Models)"
                stroke={theme === 'dark' ? '#34d399' : '#16a34a'}
                dot={false}
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avg_top50_daily_plot"
                name="Average Score (Top 50 Daily)"
                stroke={theme === 'dark' ? '#fbbf24' : '#f59e0b'}
                strokeDasharray="5 3"
                dot={false}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default NetworkActivityChart;
