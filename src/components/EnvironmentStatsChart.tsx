import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEnvironmentStats, EnvironmentStatsRow } from '../services/api';
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
  theme: 'light' | 'dark';
}

const compactNumber = (n: number) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

const EnvironmentStatsChart: React.FC<Props> = ({ theme }) => {
  const { data, isLoading, error } = useQuery<EnvironmentStatsRow[]>({
    queryKey: ['environment-stats'],
    queryFn: fetchEnvironmentStats,
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchOnMount: false,
  });

  return (
    <div className={`p-4 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <h3 className={`text-lg font-mono font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Environment Popularity & Difficulty
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
            <BarChart
              data={data ?? []}
              margin={{ top: 12, right: 56, left: 56, bottom: 20 }}
              barGap={4}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#ddd'} />
              <XAxis dataKey="env_name" stroke={theme === 'dark' ? '#ddd' : '#333'} tickMargin={8} />
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
                label={{ value: 'Success %', angle: 90, position: 'right', offset: 0, fill: theme === 'dark' ? '#ddd' : '#333' }}
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                allowDecimals={false}
                tickFormatter={(v: number) => `${v}%`}
                tickMargin={8}
              />
              <Tooltip
                contentStyle={{ background: theme === 'dark' ? '#111' : '#fff', border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}
                formatter={(value: any, name: string) => {
                  if (name === 'Success %') return [`${(value as number).toFixed(1)}%`, name];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="total_rollouts" name="Total Rollouts" fill={theme === 'dark' ? '#60a5fa' : '#3b82f6'} />
              <Bar yAxisId="right" dataKey="success_rate" name="Success %" fill={theme === 'dark' ? '#f59e0b' : '#d97706'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default EnvironmentStatsChart;
