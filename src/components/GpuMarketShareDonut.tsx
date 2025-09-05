import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchGpuMarketShare, GpuMarketShareRow } from '../services/api';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

interface Props {
  theme: 'light' | 'dark';
}

type Slice = { name: string; value: number };

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#22c55e', // green
  '#eab308', // yellow
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f43f5e', // rose
];

function parseGpuList(raw: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  // Try JSON parsing if looks like JSON
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x)).filter(Boolean);
      }
      if (typeof parsed === 'string') {
        return [parsed].filter(Boolean);
      }
    } catch {
      // fall through to heuristic parsing
    }
  }
  // Heuristic: strip brackets and split by comma
  const stripped = trimmed.replace(/^\[|\]$/g, '');
  return stripped
    .split(',')
    .map((s) => s.replace(/['"]/g, '').trim())
    .filter(Boolean);
}

function buildSlices(rows: GpuMarketShareRow[]): Slice[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const gpus = parseGpuList(r.gpus);
    if (gpus.length === 0) {
      // Optionally count unknowns; skip for now
      continue;
    }
    const n = typeof r.miner_count === 'number' ? r.miner_count : 0;
    for (const g of gpus) {
      counts.set(g, (counts.get(g) ?? 0) + n);
    }
  }
  const all: Slice[] = Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  all.sort((a, b) => b.value - a.value);
  // Group long tail into "Other" for readability
  const topN = 10;
  if (all.length > topN) {
    const head = all.slice(0, topN);
    const tail = all.slice(topN);
    const otherTotal = tail.reduce((sum, s) => sum + s.value, 0);
    return [...head, { name: 'Other', value: otherTotal }];
  }
  return all;
}

const GpuMarketShareDonut: React.FC<Props> = ({ theme }) => {
  const { data, isLoading, error } = useQuery<GpuMarketShareRow[]>({
    queryKey: ['gpu-market-share'],
    queryFn: fetchGpuMarketShare,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: false,
  });

  const slices = React.useMemo(() => buildSlices(data ?? []), [data]);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className={`p-4 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <h3 className={`text-lg font-mono font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        GPU Market Share (Last 7 Days)
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
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
              >
                {slices.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: any) => {
                  const v = Number(value);
                  const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
                  return [`${v} (${pct}%)`, String(name)];
                }}
                contentStyle={{ background: theme === 'dark' ? '#111' : '#fff', border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default GpuMarketShareDonut;
