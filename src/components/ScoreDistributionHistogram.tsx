import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchScoreDistributionByEnv, type ScoreDistributionByEnvRow } from '../services/api';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  Tooltip,
  Legend,
} from 'recharts';

interface Props {
  env: string; // e.g., 'SAT'
  theme: 'light' | 'dark';
}

const bucketLabel = (bucket: number) => {
  const start = (bucket - 1) * 10;
  const end = bucket * 10;
  return `${start}-${end}%`;
};

const ScoreDistributionHistogram: React.FC<Props> = ({ env, theme }) => {
  const { data, isLoading, error } = useQuery<ScoreDistributionByEnvRow[]>({
    queryKey: ['score-distribution-by-env', env],
    queryFn: () => fetchScoreDistributionByEnv(env),
    enabled: Boolean(env),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: false,
  });

  const chartData = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    // Ensure buckets 1..10 present
    const filled = Array.from({ length: 10 }, (_, i) => {
      const b = i + 1;
      const found = rows.find(r => r.score_bucket === b);
      return {
        bucket: b,
        label: bucketLabel(b),
        number_of_miners: found ? found.number_of_miners : 0,
      };
    });
    return filled;
  }, [data]);

  return (
    <div className={`p-4 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <h3 className={`text-lg font-mono font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Score Distribution — {env}
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
            <BarChart data={chartData} margin={{ top: 12, right: 24, left: 24, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#ddd'} />
              <XAxis
                dataKey="label"
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                tickMargin={8}
              />
              <YAxis
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                tickMargin={8}
                label={{ value: 'Number of Miners', angle: -90, position: 'left', offset: 0, fill: theme === 'dark' ? '#ddd' : '#333' }}
              />
              <Tooltip
                contentStyle={{ background: theme === 'dark' ? '#111' : '#fff', border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}
                formatter={(value: any) => [value, 'Miners']}
                labelFormatter={(label) => `Bucket: ${label}`}
              />
              <Legend />
              <Bar dataKey="number_of_miners" name="Miners" fill={theme === 'dark' ? '#60a5fa' : '#3b82f6'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ScoreDistributionHistogram;
