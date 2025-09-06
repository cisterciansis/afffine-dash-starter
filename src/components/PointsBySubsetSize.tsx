import React, { useMemo } from 'react';
import { useValidatorSummary } from '../hooks/useValidatorSummary';

type Theme = 'light' | 'dark';

type Miner = {
  id: string; // uid|model
  uid: number | null;
  model: string;
  weight: number | null;
  pts: number | null;
  env: Record<string, number | null>;
};

const PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#a55194', '#393b79', '#637939', '#8c6d31', '#843c39',
  '#5254a3', '#6b6ecf', '#9c9ede', '#637939', '#b5cf6b',
];

function popcount(n: number) {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

function sumScores(envs: string[], miner: Miner, mask: number) {
  let s = 0;
  for (let i = 0; i < envs.length; i++) {
    if (mask & (1 << i)) {
      const v = miner.env[envs[i]];
      if (v == null || !Number.isFinite(v)) return -Infinity;
      s += v;
    }
  }
  return s;
}

function dominates(envs: string[], a: Miner, b: Miner, mask: number) {
  // Return true if 'a' Pareto-dominates 'b' on subset 'mask'
  let anyStrict = false;
  for (let i = 0; i < envs.length; i++) {
    if (!(mask & (1 << i))) continue;
    const ea = a.env[envs[i]];
    const eb = b.env[envs[i]];
    const va = ea == null ? -Infinity : Number(ea);
    const vb = eb == null ? -Infinity : Number(eb);
    if (va < vb) return false;
    if (va > vb) anyStrict = true;
  }
  return anyStrict;
}

function bestByPareto(envs: string[], miners: Miner[], mask: number): Miner | null {
  if (!miners.length) return null;

  const candidates = miners.filter((m) => {
    for (let i = 0; i < envs.length; i++) {
      if (mask & (1 << i)) {
        const v = m.env[envs[i]];
        if (v != null && Number.isFinite(Number(v))) return true;
      }
    }
    return false;
  });
  if (!candidates.length) return null;

  const nonDominated: Miner[] = [];
  outer: for (const a of candidates) {
    for (const b of candidates) {
      if (a === b) continue;
      if (dominates(envs, b, a, mask)) {
        continue outer; // a is dominated by b
      }
    }
    nonDominated.push(a);
  }

  // Tie-break: by weight desc, then pts desc, then sum of scores desc, then model label asc
  let best: Miner | null = null;
  let bestKey: [number, number, number, string] | null = null;
  for (const m of nonDominated) {
    const w = m.weight == null ? -Infinity : Number(m.weight);
    const p = m.pts == null ? -Infinity : Number(m.pts);
    const s = sumScores(envs, m, mask);
    const key: [number, number, number, string] = [w, p, s, m.model.toLowerCase()];
    if (!best || compareTupleDesc(key, bestKey!) > 0) {
      best = m;
      bestKey = key;
    }
  }
  return best;
}

function compareTupleDesc(a: [number, number, number, string], b: [number, number, number, string]) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  if (a[2] !== b[2]) return a[2] - b[2];
  return b[3].localeCompare(a[3]); // string asc
}

function formatNumber(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n as number)) return '—';
  return (n as number).toFixed(digits);
}

/**
 * Parse score-like values that may be numbers or strings such as "81.9*"
 * or "81.9/…" seen in fallback payloads.
 */
function parseScoreAny(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const str = String(v).replace(/\*/g, '');
  const head = str.includes('/') ? str.split('/')[0] : str;
  const n = parseFloat(head);
  return Number.isFinite(n) ? n : null;
}

/**
 * Points by subset size (stacked by winner)
 * For each subset size s ∈ {1..N}, show a stacked horizontal bar where each segment
 * is the total points (Pts) won by a miner across all subsets of size s.
 */
const PointsBySubsetSize: React.FC<{ theme: Theme }> = ({ theme }) => {
  const { data: summary, loading, error } = useValidatorSummary();

  // Choose which columns count as "environments" — same logic as SubsetWinnersMatrix
  const envs = useMemo(() => {
    if (!summary?.columns) return [] as string[];
    const cols = summary.columns;
    const norm = (s: string) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const want = ['SAT','ABD','DED','ELR','HVM','MTH','L1','L2','L3','L4'];
    const found: string[] = [];

    for (const w of want) {
      const i = cols.findIndex(c => {
        const nc = norm(c);
        return nc === w || nc.startsWith(w);
      });
      if (i !== -1) found.push(cols[i]);
    }

    if (found.length < 2) {
      const exclude = new Set(['UID','MODEL','REV','PTS','ELIG','WGT','WEIGHT','POINTS','ELIGIBLE']);
      cols.forEach(c => {
        const nc = norm(c);
        if (!exclude.has(nc) && /^[A-Z0-9]{2,6}$/.test(nc) && !found.includes(c)) {
          found.push(c);
        }
      });
    }

    return Array.from(new Set(found)).slice(0, 8);
  }, [summary]);

  // Map summary rows -> Miner[] shape
  const miners = useMemo<Miner[]>(() => {
    if (!summary) return [];
    const cols = summary.columns;
    const idx = (name: string) => cols.indexOf(name);

    const iUID = idx('UID');
    const iModel = idx('Model');
    const iPts = idx('Pts');
    const iWgt = idx('Wgt');

    return summary.rows.map((row) => {
      const uid = typeof row[iUID] === 'number' ? (row[iUID] as number) : Number(row[iUID]);
      const model = String(row[iModel] ?? '');
      const pts = row[iPts] == null ? null : Number(row[iPts] as number);
      const wgt = row[iWgt] == null ? null : Number(row[iWgt] as number);

      const envMap: Record<string, number | null> = {};
      for (const e of envs) {
        const j = idx(e);
        const vRaw = j >= 0 ? row[j] : null;
        envMap[e] = parseScoreAny(vRaw);
      }
      return {
        id: `${Number.isFinite(uid) ? uid : -1}|${model}`,
        uid: Number.isFinite(uid) ? uid : null,
        model,
        weight: wgt,
        pts,
        env: envMap,
      } as Miner;
    });
  }, [summary, envs]);

  // Compute winners for all subsets; aggregate their points per subset size
  type WinnerAgg = { id: string; label: string; value: number };
  const aggBySize = useMemo(() => {
    const N = envs.length;
    const result = new Map<number, Map<string, WinnerAgg>>(); // size -> (winnerId -> agg)
    if (!N || !miners.length) return result;

    const maxMask = 1 << N;
    for (let mask = 1; mask < maxMask; mask++) {
      const size = popcount(mask);
      const winner = bestByPareto(envs, miners, mask);
      if (!winner) continue;

      // Metric: Points (Pts) only for this visual
      const pts = winner.pts == null ? 0 : Number(winner.pts);
      if (!Number.isFinite(pts) || pts <= 0) continue;

      if (!result.has(size)) result.set(size, new Map());
      const byMiner = result.get(size)!;
      const prev = byMiner.get(winner.id) || { id: winner.id, label: winner.model, value: 0 };
      prev.value += pts;
      byMiner.set(winner.id, prev);
    }
    return result;
  }, [envs, miners]);

  // Prepare stacked bars data per size, and color mapping
  const sizes = useMemo(() => {
    const N = envs.length;
    return Array.from({ length: N }, (_, i) => i + 1);
  }, [envs.length]);

  const totalsPerSize = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of sizes) {
      const byMiner = aggBySize.get(s);
      let total = 0;
      if (byMiner) {
        for (const v of byMiner.values()) total += v.value;
      }
      map.set(s, total);
    }
    return map;
  }, [aggBySize, sizes]);

  const winnerOrder = useMemo(() => {
    // Order miners by their global total across all sizes (desc)
    const totalByMiner = new Map<string, { label: string; value: number }>();
    for (const byMiner of aggBySize.values()) {
      for (const v of byMiner.values()) {
        const cur = totalByMiner.get(v.id) || { label: v.label, value: 0 };
        cur.value += v.value;
        totalByMiner.set(v.id, cur);
      }
    }
    return [...totalByMiner.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .map(([id, { label }]) => ({ id, label }));
  }, [aggBySize]);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    winnerOrder.forEach(({ id }, i) => {
      map.set(id, PALETTE[i % PALETTE.length]);
    });
    return map;
  }, [winnerOrder]);

  // Visual constants
  const barH = 18;
  const gapY = 8;
  const leftW = 70;
  const rightW = 50;
  const gapX = 10;
  const width = Math.max(540, 680);
  const chartW = width - leftW - rightW - gapX * 2;
  const topPad = 16;
  const height = topPad + sizes.length * (barH + gapY) + 8;

  const frameCls = theme === 'dark'
    ? 'border-white bg-black text-white'
    : 'border-gray-300 bg-white text-gray-900';

  return (
    <div className={`p-4 border-2 rounded-none ${frameCls}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-mono font-bold">Points by subset size (stacked by winner)</h3>
        <div className="text-[11px] font-mono opacity-70">Metric: Pts per winning subset</div>
      </div>

      {error && (
        <div className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>{String(error)}</div>
      )}
      {loading && !summary && <div className="text-xs font-mono opacity-70">Loading…</div>}

      {!loading && summary && envs.length >= 2 ? (
        <svg width={width} height={height} role="img" aria-label="Points by subset size (stacked)">
          {sizes.map((s, idx) => {
            const y = topPad + idx * (barH + gapY);
            const byMiner = aggBySize.get(s);
            const total = totalsPerSize.get(s) || 0;

            // Build ordered segments by global winner order, but only those present for this size
            const segments = (byMiner
              ? winnerOrder
                  .map(({ id, label }) => {
                    const v = byMiner.get(id);
                    return v ? { id, label, value: v.value } : null;
                  })
                  .filter(Boolean) as WinnerAgg[]
              : []) as WinnerAgg[];

            let accX = leftW + gapX;
            return (
              <g key={`row-${s}`}>
                {/* y-axis label: |S|=s */}
                <text
                  x={6}
                  y={y + barH - 3}
                  fontSize="11"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                  fill={theme === 'dark' ? '#ddd' : '#555'}
                >
                  |S|={s}:
                </text>

                {/* Background bar */}
                <rect
                  x={leftW + gapX}
                  y={y}
                  width={chartW}
                  height={barH}
                  fill={theme === 'dark' ? '#111' : '#f6f6f6'}
                  stroke={theme === 'dark' ? '#666' : '#ddd'}
                  strokeWidth={1}
                />

                {/* Segments */}
                {total > 0 && segments.map((seg, j) => {
                  const w = Math.max(0, Math.round((seg.value / total) * chartW));
                  const x = accX;
                  accX += w;
                  const color = colorMap.get(seg.id) || (theme === 'dark' ? '#aaa' : '#444');
                  const title = `|S|=${s}
${seg.label}
Total Pts across subsets of size ${s}: ${formatNumber(seg.value, 4)}`;
                  return w > 0 ? (
                    <g key={`seg-${s}-${seg.id}-${j}`}>
                      <title>{title}</title>
                      <rect x={x} y={y} width={w} height={barH} fill={color} />
                    </g>
                  ) : null;
                })}

                {/* Row total (right side) */}
                <text
                  x={leftW + gapX + chartW + 8}
                  y={y + barH - 3}
                  fontSize="11"
                  textAnchor="start"
                  fill={theme === 'dark' ? '#aaa' : '#666'}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                >
                  {formatNumber(total, 3)}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        !loading && (
          <div className="text-xs font-mono opacity-70">Insufficient data to compute stacked points per subset size.</div>
        )
      )}

      {/* Legend */}
      {winnerOrder.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-mono uppercase tracking-wider mb-2 opacity-70">
            Legend: segment color = miner (winner across subsets)
          </div>
          <div className="flex flex-wrap gap-3">
            {winnerOrder.slice(0, 16).map(({ id, label }) => {
              const color = colorMap.get(id) || (theme === 'dark' ? '#aaa' : '#444');
              return (
                <div key={id} className="flex items-center gap-2 text-xs font-mono">
                  <span className="inline-block w-3 h-3" style={{ background: color }} />
                  <span className="truncate max-w-[14rem]" title={label}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PointsBySubsetSize;
