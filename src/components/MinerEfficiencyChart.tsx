import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMinerEfficiency, MinerEfficiencyRow } from '../services/api';
import {
  ResponsiveContainer,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Scatter,
} from 'recharts';
import { Skeleton, SkeletonText } from './Skeleton';

interface Props {
  theme: 'light' | 'dark';
}

type TooltipProps = {
  active?: boolean;
  payload?: any[];
  label?: any;
};

type RelayTooltipProps = TooltipProps & {
  onUpdate: (row: MinerEfficiencyRow | null) => void;
};

const CustomTooltip: React.FC<RelayTooltipProps> = ({ active, payload, onUpdate }) => {
  const lastKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let next: MinerEfficiencyRow | null = null;
    if (active && payload && payload.length > 0) {
      next = payload[0].payload as MinerEfficiencyRow;
    }
    const nextKey = next?.hotkey ?? null;

    // Only update when the hovered point actually changes.
    if (nextKey !== lastKeyRef.current) {
      onUpdate(next);
      lastKeyRef.current = nextKey;
    }
  }, [active, payload, onUpdate]);

  return null;
};

type ChartProps = {
  theme: 'light' | 'dark';
  data: MinerEfficiencyRow[];
  setHovered: (row: MinerEfficiencyRow | null) => void;
};

const MinerScatterChart = React.memo<ChartProps>(({ theme, data, setHovered }) => {
  const axisColor = theme === 'dark' ? '#ddd' : '#333';
  const gridColor = theme === 'dark' ? '#333' : '#ddd';
  const dotColor = theme === 'dark' ? '#60a5fa' : '#3b82f6';

  return (
    <div style={{ width: '100%', height: 340 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 32, right: 24, bottom: 56, left: 64 }} onMouseLeave={() => setHovered(null)}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            type="number"
            dataKey="avg_latency"
            name="Avg Latency (s)"
            unit="s"
            stroke={axisColor}
            domain={[0, 'auto']}
            tickMargin={8}
            height={48}
            label={{ value: 'Avg Latency (s) ↓ is better', position: 'bottom', offset: 28, fill: axisColor }}
          />
          <YAxis
            type="number"
            dataKey="avg_score"
            name="Avg Score"
            stroke={axisColor}
            domain={[0, 1]}
            label={{ value: 'Avg Score ↑ is better', angle: -90, position: 'left', offset: 0, fill: axisColor }}
          />
          <Tooltip content={<CustomTooltip onUpdate={setHovered} />} />
          <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 8 }} height={24} />
          <Scatter
            name="Miners"
            data={data}
            fill={dotColor}
            shape="circle"
            stroke={theme === 'dark' ? '#93c5fd' : '#1d4ed8'}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
});

const MinerEfficiencyChart: React.FC<Props> = ({ theme }) => {
  const { data, isLoading, error } = useQuery<MinerEfficiencyRow[]>({
    queryKey: ['miner-efficiency'],
    queryFn: fetchMinerEfficiency,
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchOnMount: false,
  });

  const [hovered, setHovered] = React.useState<MinerEfficiencyRow | null>(null);


  return (
    <div className={`p-4 border-2 rounded-none ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
      <h3 className={`text-lg font-mono font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Performance vs. Latency (7d Active Miners)
      </h3>

      <div
        className={`mb-3 p-2 ${
          theme === 'dark'
            ? 'bg-black/40 border border-white/20 text-white'
            : 'bg-gray-50 border border-gray-200 text-gray-900'
        } font-mono text-xs`}
        style={{ minHeight: 80 }}
      >
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {isLoading ? (
            <>
              <SkeletonText theme={theme} className="h-4 w-20" />
              <SkeletonText theme={theme} className="h-4 w-32" />
              <SkeletonText theme={theme} className="h-4 w-40" />
              <SkeletonText theme={theme} className="h-4 w-28" />
              <SkeletonText theme={theme} className="h-4 w-32" />
            </>
          ) : (
            <>
              <div><strong>Miner</strong></div>
              <div>Hotkey: {hovered?.hotkey ?? '—'}</div>
              <div>Model: {hovered?.model ?? '—'}</div>
              <div>Avg Score: {hovered ? hovered.avg_score.toFixed(3) : '—'}</div>
              <div>Avg Latency: {hovered ? (hovered.avg_latency == null ? '—' : `${hovered.avg_latency.toFixed(2)}s`) : '—'}</div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>
          {(error as Error).message}
        </div>
      )}
      {isLoading && !error && (
        <div style={{ width: '100%', height: 340 }}>
          <div className={`h-full w-full animate-pulse ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`} />
        </div>
      )}

      {!isLoading && !error && (
        <MinerScatterChart theme={theme} data={data ?? []} setHovered={setHovered} />
      )}
    </div>
  );
};

export default MinerEfficiencyChart;
