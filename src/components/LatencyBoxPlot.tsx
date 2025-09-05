import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLatencyDistributionByEnv, type LatencyDistributionByEnvRow } from '../services/api';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Scatter,
  ErrorBar,
} from 'recharts';

interface Props {
  env: string; // e.g., 'SAT'
  theme: 'light' | 'dark';
}

type StatRow = {
  hotkey: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  eRange: [number, number]; // distances from median -> [median - min, max - median]
  eIQR: [number, number];   // distances from median -> [median - q1, q3 - median]
};

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

const truncHotkey = (s: string, max = 14) =>
  (s.length <= max ? s : `${s.slice(0, 6)}…${s.slice(-7)}`);

const LatencyBoxPlot: React.FC<Props> = ({ env, theme }) => {
  const { data, isLoading, error } = useQuery<LatencyDistributionByEnvRow[]>({
    queryKey: ['latency-distribution-by-env', env],
    queryFn: () => fetchLatencyDistributionByEnv(env),
    enabled: Boolean(env),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: false,
  });

  const stats: StatRow[] = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const byHotkey = new Map<string, number[]>();

    for (const r of rows) {
      if (r.latency_seconds == null) continue;
      const arr = byHotkey.get(r.hotkey) ?? [];
      arr.push(r.latency_seconds);
      byHotkey.set(r.hotkey, arr);
    }

    const out: StatRow[] = [];
    for (const [hotkey, arr] of byHotkey.entries()) {
      if (arr.length === 0) continue;
      const sorted = arr.slice().sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const q1 = quantile(sorted, 0.25);
      const median = quantile(sorted, 0.5);
      const q3 = quantile(sorted, 0.75);
      out.push({
        hotkey,
        min,
        q1,
        median,
        q3,
        max,
        eRange: [median - min, max - median],
        eIQR: [median - q1, q3 - median],
      });
    }
    // Sort by median ascending for consistent layout
    out.sort((a, b) => a.median - b.median);
    return out;
  }, [data]);

  return (
    <div className={`p-4 border-2 rounded-none overflow-hidden ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <h3 className={`text-lg font-mono font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Latency Distribution (Top Miners) — {env}
      </h3>

      {error && (
        <div className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>
          {(error as Error).message}
        </div>
      )}
      {isLoading && !error && (
        <div style={{ width: '100%', height: 400 }}>
          <div className={`h-full w-full animate-pulse ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`} />
        </div>
      )}

      {!isLoading && !error && (
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <ComposedChart data={stats} margin={{ top: 12, right: 56, left: 56, bottom: 56 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#ddd'} />
              <XAxis
                dataKey="hotkey"
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                tickMargin={8}
                interval={0}
                height={80}
                angle={-30}
                textAnchor="end"
                tickFormatter={truncHotkey}
              />
              <YAxis
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                tickMargin={8}
                label={{ value: 'Latency (s)', angle: -90, position: 'left', offset: 0, fill: theme === 'dark' ? '#ddd' : '#333' }}
              />
              <Tooltip
                contentStyle={{ background: theme === 'dark' ? '#111' : '#fff', border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}
                formatter={(value: any, name: any, props: any) => {
                  if (name === 'Median') return [Number(value).toFixed(3) + ' s', name];
                  return [value, name];
                }}
                labelFormatter={(label, payload: any) => {
                  const p = Array.isArray(payload) && payload.length > 0 ? payload[0].payload as StatRow : undefined;
                  if (!p) return String(label);
                  return `${p.hotkey}
min=${p.min.toFixed(3)}s  q1=${p.q1.toFixed(3)}s  median=${p.median.toFixed(3)}s  q3=${p.q3.toFixed(3)}s  max=${p.max.toFixed(3)}s`;
                }}
              />
              <Legend
                verticalAlign="bottom"
                align="left"
                wrapperStyle={{ paddingTop: 8 }}
              />
              {/* Scatter anchored at median; two ErrorBars for IQR and range to emulate box+whiskers */}
              <Scatter name="Median" data={stats} dataKey="median" fill={theme === 'dark' ? '#34d399' : '#16a34a'} shape="circle">
                {/* Thicker bar to represent IQR (q1..q3) */}
                <ErrorBar dataKey="eIQR" width={20} direction="y" stroke={theme === 'dark' ? '#60a5fa' : '#3b82f6'} />
                {/* Thinner bar to represent full range (min..max) */}
                <ErrorBar dataKey="eRange" width={8} direction="y" stroke={theme === 'dark' ? '#ddd' : '#333'} />
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default LatencyBoxPlot;
