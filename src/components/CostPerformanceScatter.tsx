import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMinerEfficiencyCost, MinerEfficiencyCostRow } from '../services/api';
import {
  ResponsiveContainer,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Scatter,
  Tooltip,
  Legend,
} from 'recharts';

interface Props {
  theme: 'light' | 'dark';
}

type Point = {
  hotkey: string;
  model: string | null;
  avg_token_cost_usd: number;
  avg_score: number;
};

function buildPoints(rows: MinerEfficiencyCostRow[]): Point[] {
  const pts: Point[] = rows.map((r) => ({
    hotkey: r.hotkey,
    model: r.model,
    avg_token_cost_usd: Number(r.avg_token_cost_usd),
    avg_score: Number(r.avg_score),
  }));
  // Optional: clamp/clean extremes if needed. For now just sort by cost asc.
  pts.sort((a, b) => a.avg_token_cost_usd - b.avg_token_cost_usd);
  return pts;
}

const CostPerformanceScatter: React.FC<Props> = ({ theme }) => {
  const { data, isLoading, error } = useQuery<MinerEfficiencyCostRow[]>({
    queryKey: ['miner-efficiency-cost'],
    queryFn: fetchMinerEfficiencyCost,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: false,
  });

  const points = React.useMemo(() => buildPoints(data ?? []), [data]);

  return (
    <div className={`p-4 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <h3 className={`text-lg font-mono font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Cost vs Performance (Avg by Hotkey, Last 7 Days)
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
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 12, right: 56, left: 56, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#ddd'} />
              <XAxis
                type="number"
                dataKey="avg_token_cost_usd"
                name="Avg Cost ($ / Million Tokens)"
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                tickMargin={8}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                label={{ value: 'Avg Cost ($ / Million Tokens)', position: 'bottom', offset: 0, fill: theme === 'dark' ? '#ddd' : '#333' }}
              />
              <YAxis
                type="number"
                dataKey="avg_score"
                name="Avg Score"
                stroke={theme === 'dark' ? '#ddd' : '#333'}
                tickMargin={8}
                domain={[0, 1]}
                tickFormatter={(v: number) => v.toFixed(2)}
                label={{ value: 'Avg Score', angle: -90, position: 'left', offset: 0, fill: theme === 'dark' ? '#ddd' : '#333' }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ background: theme === 'dark' ? '#111' : '#fff', border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}` }}
                formatter={(value: any, name: any) => {
                  if (name === 'avg_token_cost_usd') return [`$${Number(value).toFixed(3)}`, 'Avg Cost ($ / Million Tokens)'];
                  if (name === 'avg_score') return [Number(value).toFixed(3), 'Avg Score'];
                  return [value, name];
                }}
                labelFormatter={(_: any, payload: readonly any[]) => {
                  if (!payload || payload.length === 0) return '';
                  const p = (payload[0] as any)?.payload as Point;
                  const modelStr = p.model ? ` (${p.model})` : '';
                  return `Hotkey: ${p.hotkey}${modelStr}`;
                }}
              />
              <Legend />
              <Scatter
                name="Miners"
                data={points}
                fill={theme === 'dark' ? '#60a5fa' : '#3b82f6'}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default CostPerformanceScatter;
