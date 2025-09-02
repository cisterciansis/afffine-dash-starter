import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdvancedInsights, AdvancedInsightRow } from '../services/api';
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

type Row = { template: string; count: number };

function normalizeTemplate(t: string | null): string | null {
  if (!t) return null;
  const s = t.trim().toLowerCase();
  if (!s) return null;
  // Common alias normalization
  if (s === 'vllm' || s === 'vllm-openai' || s === 'openai') return 'vllm';
  if (s === 'sglang' || s === 'sglang-openai') return 'sglang';
  if (s === 'tgi' || s === 'text-generation-inference') return 'tgi';
  return s;
}

function buildTemplateCounts(rows: AdvancedInsightRow[]): Row[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const t = normalizeTemplate(r.template);
    if (!t) continue;
    map.set(t, (map.get(t) ?? 0) + 1);
  }
  const arr: Row[] = Array.from(map.entries()).map(([template, count]) => ({ template, count }));
  arr.sort((a, b) => b.count - a.count);
  return arr;
}

const TemplateUsageBar: React.FC<Props> = ({ theme }) => {
  const { data, isLoading, error } = useQuery<AdvancedInsightRow[]>({
    queryKey: ['advanced-insights'],
    queryFn: fetchAdvancedInsights,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: false,
  });

  const rows = React.useMemo(() => buildTemplateCounts(data ?? []), [data]);

  return (
    <div className={`p-4 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <h3 className={`text-lg font-mono font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Inference Template Usage (Last 7 Days)
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
              data={rows}
              margin={{ top: 12, right: 56, left: 56, bottom: 20 }}
              barGap={4}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#ddd'} />
              <XAxis dataKey="template" stroke={theme === 'dark' ? '#ddd' : '#333'} tickMargin={8} />
              <YAxis
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                tickMargin={8}
                label={{ value: 'Number of Miners', angle: -90, position: 'left', offset: 0, fill: theme === 'dark' ? '#ddd' : '#333' }}
              />
              <Tooltip
                contentStyle={{ background: theme === 'dark' ? '#111' : '#fff', border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}
              />
              <Legend />
              <Bar dataKey="count" name="Miners" fill={theme === 'dark' ? '#34d399' : '#16a34a'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default TemplateUsageBar;
