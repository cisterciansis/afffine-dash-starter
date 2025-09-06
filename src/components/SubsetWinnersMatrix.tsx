import React, { useMemo, useState } from 'react';
import { useValidatorSummary } from '../hooks/useValidatorSummary';

type Theme = 'light' | 'dark';

type Miner = {
  id: string; // uid|model
  uid: number | null;
  model: string;
  weight: number | null;
  pts: number | null;
  env: Record<string, number | null>; // SAT/ABD/DED/ELR/HVM...
};

type SubsetColumn =
  | {
      kind: 'subset';
      mask: number; // bitmask over envs
      size: number; // |S|
      value: number; // bar height metric
      winnerId: string;
      winnerLabel: string;
      winnerWeight: number | null;
      winnerPts: number | null;
      envList: string[];
    }
  | {
      kind: 'other';
      size: number;
      value: number;
      count: number; // number of columns collapsed into this one
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

function subsetEnvList(mask: number, envs: string[]) {
  const list: string[] = [];
  for (let i = 0; i < envs.length; i++) {
    if (mask & (1 << i)) list.push(envs[i]);
  }
  return list;
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
  // Filter miners that have at least one defined score in mask
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

  // Remove dominated miners
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

const Dot: React.FC<{ active: boolean; theme: Theme }> = ({ active, theme }) => {
  const cls = active
    ? theme === 'dark'
      ? 'fill-white'
      : 'fill-gray-900'
    : theme === 'dark'
      ? 'fill-transparent stroke-white/40'
      : 'fill-transparent stroke-gray-400/60';
  return <circle cx={0} cy={0} r={4} className={cls} />;
};

const SubsetWinnersMatrix: React.FC<{ theme: Theme }> = ({ theme }) => {
  const { data: summary, loading, error } = useValidatorSummary();

  // Choose which columns count as "environments"
  const envs = useMemo(() => {
    if (!summary?.columns) return [] as string[];
    const cols = summary.columns;
    const norm = (s: string) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const want = ['SAT','ABD','DED','ELR','HVM','MTH','L1','L2','L3','L4'];
    const found: string[] = [];

    // Prefer known targets if present (case/format-insensitive)
    for (const w of want) {
      const i = cols.findIndex(c => {
        const nc = norm(c);
        return nc === w || nc.startsWith(w);
      });
      if (i !== -1) found.push(cols[i]);
    }

    // If still fewer than 2, include any score-like columns (exclude meta)
    if (found.length < 2) {
      const exclude = new Set(['UID','MODEL','REV','PTS','ELIG','WGT','WEIGHT','POINTS','ELIGIBLE']);
      cols.forEach(c => {
        const nc = norm(c);
        if (!exclude.has(nc) && /^[A-Z0-9]{2,6}$/.test(nc) && !found.includes(c)) {
          found.push(c);
        }
      });
    }

    // De-dup and cap for layout sanity
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
    const iElig = idx('Elig');
    const iWgt = idx('Wgt');

    return summary.rows.map((row) => {
      const uid = typeof row[iUID] === 'number' ? (row[iUID] as number) : Number(row[iUID]);
      const model = String(row[iModel] ?? '');
      const pts = row[iPts] == null ? null : Number(row[iPts] as number);
      const wgt = row[iWgt] == null ? null : Number(row[iWgt] as number);
      // We allow ineligible miners to be considered; eligibility affects payout but not pure dominance.
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

  // Controls
  const [topM, setTopM] = useState(30);
  const [barMetric, setBarMetric] = useState<'pts' | 'weight' | 'sum'>('pts');
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [hoverWinnerId, setHoverWinnerId] = useState<string | null>(null);

  // Debug counts: how many miners have numeric values per env
  const envCounts = useMemo(() => {
    return envs.map((e) => {
      let n = 0;
      for (const m of miners) {
        const v = m.env[e];
        if (v != null && Number.isFinite(v)) n++;
      }
      return { env: e, n };
    });
  }, [envs, miners]);

  // Build subset columns
  const rawColumns = useMemo<SubsetColumn[]>(() => {
    const N = envs.length;
    if (!N || !miners.length) return [];
    const cols: SubsetColumn[] = [];
    const maxMask = 1 << N;

    for (let mask = 1; mask < maxMask; mask++) {
      const size = popcount(mask);
      const winner = bestByPareto(envs, miners, mask);
      if (!winner) continue;

      const envList = subsetEnvList(mask, envs);
      let value: number;
      if (barMetric === 'pts') {
        value = winner.pts == null ? Number.NEGATIVE_INFINITY : Number(winner.pts);
      } else if (barMetric === 'weight') {
        value = winner.weight == null ? Number.NEGATIVE_INFINITY : Number(winner.weight);
      } else {
        value = sumScores(envs, winner, mask);
      }
      if (!Number.isFinite(value)) value = 0;

      cols.push({
        kind: 'subset',
        mask,
        size,
        value,
        winnerId: winner.id,
        winnerLabel: winner.model,
        winnerWeight: winner.weight,
        winnerPts: winner.pts,
        envList,
      });
    }
    return cols;
  }, [envs, miners, barMetric]);

  // Sort columns: |S| asc, value desc, winner label asc
  const sortedColumns = useMemo(() => {
    const arr = [...rawColumns] as (SubsetColumn & { kind: 'subset' })[];
    arr.sort((a, b) => {
      if (a.size !== b.size) return a.size - b.size;
      if (a.value !== b.value) return b.value - a.value;
      return a.winnerLabel.localeCompare(b.winnerLabel);
    });
    return arr;
  }, [rawColumns]);

  // Apply topM and aggregate tail per subset-size as "other"
  const columns = useMemo<SubsetColumn[]>(() => {
    const arr = [...sortedColumns];
    if (arr.length <= topM) return arr;

    const top = arr.slice(0, topM);
    const rest = arr.slice(topM);
    const bySize = new Map<number, { value: number; count: number }>();
    for (const c of rest) {
      const s = bySize.get(c.size) || { value: 0, count: 0 };
      s.value += c.value;
      s.count += 1;
      bySize.set(c.size, s);
    }
    const others: SubsetColumn[] = [];
    for (const [size, agg] of [...bySize.entries()].sort((a, b) => a[0] - b[0])) {
      if (agg.count > 0 && agg.value > 0) {
        others.push({ kind: 'other', size, value: agg.value, count: agg.count });
      }
    }
    return [...top, ...others];
  }, [sortedColumns, topM]);

  // Winner color mapping
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    for (const c of sortedColumns) {
      if (c.kind === 'subset' && !map.has(c.winnerId)) {
        map.set(c.winnerId, PALETTE[i % PALETTE.length]);
        i++;
      }
    }
    return map;
  }, [sortedColumns]);

  // Scales for drawing
  const maxValue = useMemo(() => {
    let m = 0;
    for (const c of columns) {
      m = Math.max(m, c.value);
    }
    return m || 1;
  }, [columns]);

  const tickStrings = useMemo(() => {
    const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
    const out: (string | null)[] = [];
    let last: string | null = null;
    for (const c of columns) {
      const s = fmt.format(c.value);
      if (s === last) {
        out.push(null);
      } else {
        out.push(s);
        last = s;
      }
    }
    return out;
  }, [columns]);

  // Visual constants
  const barH = 70;
  const dotCell = 22;
  const colW = 36;
  const gap = 10;
  const leftPad = 56;
  const barToDotsPad = 24;
  const envAreaH = envs.length * dotCell;
  const height = barH + barToDotsPad + envAreaH + 24;
  const colCount = columns.length;
  const width = Math.max(colCount * (colW + 8) + gap * 2 + leftPad, 360);

  const toBarHeight = (v: number) => (maxValue > 0 ? (v / maxValue) * (barH - 8) : 0);

  const frameCls = theme === 'dark'
    ? 'border-white bg-black text-white'
    : 'border-gray-300 bg-white text-gray-900';

  return (
    <div className={`p-4 border-2 rounded-none ${frameCls}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-mono font-bold">Subset Winners (UpSet-style)</h3>
        <div className={`flex items-center gap-3 px-3 py-2 border rounded-sm ${theme === 'dark' ? 'border-white/30 bg-white/5' : 'border-gray-300 bg-gray-50'}`}>
          <label className="text-xs font-mono flex items-center gap-2">
            <span>Bar Metric</span>
            <select
              className={`h-8 px-2 border text-xs font-mono rounded-sm ${
                theme === 'dark' ? 'border-white bg-black text-white' : 'border-gray-400 bg-white text-gray-800'
              }`}
              value={barMetric}
              onChange={(e) => setBarMetric(e.target.value as any)}
              title="Choose value for bar height"
            >
              <option value="pts">Pts (winner)</option>
              <option value="weight">Weight (winner)</option>
              <option value="sum">Sum scores (winner, |S|)</option>
            </select>
          </label>

          <label className="text-xs font-mono flex items-center gap-2">
            <span>Show Top M Subsets</span>
            <input
              type="number"
              placeholder="Top 20"
              min={5}
              max={200}
              step={5}
              className={`h-8 w-20 px-2 border text-xs font-mono rounded-sm ${
                theme === 'dark' ? 'border-white bg-black text-white' : 'border-gray-400 bg-white text-gray-800'
              }`}
              value={topM}
              onChange={(e) => setTopM(Math.max(5, Math.min(200, Number(e.target.value) || 0)))}
              title="Limit number of columns; remainder is aggregated as 'other' per subset-size"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>{String(error)}</div>
      )}
      {loading && !summary && <div className="text-xs font-mono opacity-70">Loading…</div>}

      {!loading && summary && envs.length >= 2 && columns.length > 0 ? (
        <div className="overflow-x-auto">
          <svg width={width} height={height} role="img" aria-label="UpSet-style subset winners matrix">
            {/* Column hover highlight stripes */}
            {columns.map((c, idx) => {
              const x = leftPad + gap + idx * (colW + 8);
              const isHover = hoverCol === idx;
              return (
                <rect
                  key={`hl-${idx}`}
                  x={x}
                  y={0}
                  width={colW}
                  height={height}
                  fill={isHover ? (theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent'}
                  pointerEvents="none"
                />
              );
            })}

            {/* Column separators */}
            {columns.map((_, idx) => {
              const x = leftPad + gap + idx * (colW + 8) + colW + 3;
              return <line key={`sep-${idx}`} x1={x} x2={x} y1={barH + barToDotsPad - 6} y2={barH + barToDotsPad + envAreaH + 6} stroke={theme === 'dark' ? '#222' : '#eee'} />;
            })}

            {/* Bars */}
            {columns.map((c, idx) => {
              const x = leftPad + gap + idx * (colW + 8);
              const h = toBarHeight(c.value);
              const y = barH - h;
              const color =
                c.kind === 'subset'
                  ? colorMap.get(c.winnerId) || (theme === 'dark' ? '#aaa' : '#444')
                  : theme === 'dark' ? '#666' : '#bbb';
              const title =
                c.kind === 'subset'
                  ? `S = {${(c.envList || []).join(', ')}}
|S| = ${c.size}
Bar: ${formatNumber(c.value, 4)} (${barMetric})
Winner: ${c.winnerLabel}
Weight: ${formatNumber(c.winnerWeight, 4)}
Pts: ${formatNumber(c.winnerPts, 4)}`
                  : `Other subsets of size ${c.size}
Aggregated bar: ${formatNumber(c.value, 4)}`;
              return (
                <g
                  key={idx}
                  onMouseEnter={() => {
                    setHoverCol(idx);
                    setHoverWinnerId(c.kind === 'subset' ? c.winnerId : null);
                  }}
                  onMouseLeave={() => {
                    setHoverCol(null);
                    setHoverWinnerId(null);
                  }}
                >
                  <title>{title}</title>
                  {/* Hover hit target */}
                  <rect x={x} y={0} width={colW} height={height} fill="transparent" />
                  <rect
                    x={x}
                    y={y}
                    width={colW}
                    height={h}
                    fill={color}
                    opacity={c.kind === 'other' ? 0.6 : 1}
                  />
                </g>
              );
            })}

            {/* Zero line */}
            <line x1={leftPad + gap} x2={width - gap} y1={barH + 0.5} y2={barH + 0.5} stroke={theme === 'dark' ? '#888' : '#bbb'} strokeDasharray="4 3" />

            {/* Env dot matrix */}
            {envs.map((env, row) => {
              const cy = barH + barToDotsPad + row * dotCell + dotCell / 2;
              return (
                <g key={env}>
                  {/* Row label */}
                  <text
                    x={8}
                    y={cy + 4}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                    fontSize="11"
                    fill={theme === 'dark' ? '#ddd' : '#555'}
                  >
                    {env}
                  </text>

                  {/* Row dots */}
                  {columns.map((c, idx) => {
                    const cx = leftPad + gap + idx * (colW + 8) + colW / 2;
                    if (c.kind === 'other') {
                      // Show a small badge "k-of-N" for aggregated
                      if (row === 0) {
                        const label = `${c.size}/${envs.length}`;
                        return (
                          <g key={`${idx}-other`} transform={`translate(${cx - colW / 2}, ${cy - 9})`}>
                            <title>{`Other subsets of size ${c.size} (aggregated ${c.count})`}</title>
                            <rect width={colW} height={18} rx={2} ry={2} fill="none" stroke={theme === 'dark' ? '#888' : '#bbb'} />
                            <text
                              x={colW / 2}
                              y={12}
                              textAnchor="middle"
                              fontSize={envs.length >= 10 ? 8 : 9}
                              fill={theme === 'dark' ? '#aaa' : '#666'}
                              fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                            >
                              {label}
                            </text>
                          </g>
                        );
                      }
                      return null;
                    }
                    const active = Boolean(c.mask & (1 << row));
                    return (
                      <g key={`${idx}-${row}`} transform={`translate(${cx}, ${cy})`}>
                        <Dot active={active} theme={theme} />
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* X-axis labels: bar value below dots (rounded, suppress repeats) */}
            {columns.map((c, idx) => {
              const x = leftPad + gap + idx * (colW + 8) + colW / 2;
              const y = barH + barToDotsPad + envAreaH + 12;
              const label = tickStrings[idx];
              return label ? (
                <text
                  key={`xlabel-${idx}`}
                  x={x}
                  y={y}
                  fontSize="10"
                  textAnchor="middle"
                  fill={theme === 'dark' ? '#aaa' : '#666'}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                >
                  {label}
                </text>
              ) : null;
            })}
          </svg>
        </div>
      ) : (
        !loading && (
          <div className="text-xs font-mono opacity-70">
            <div>Insufficient data to render matrix.</div>
            <div className="mt-1 opacity-70">Detected env columns: {envs.length ? envs.join(', ') : 'none'}</div>
            <div className="mt-1 opacity-70">
              Rows: {miners.length}. Numeric per env: {envCounts.map(ec => `${ec.env}:${ec.n}`).join('  ')}
            </div>
          </div>
        )
      )}

      {/* Legend */}
      {columns.some((c) => c.kind === 'subset') && (
        <div className="mt-2">
          <div className="text-xs font-mono uppercase tracking-wider mb-2 opacity-70">Legend: row dots = envs in S; bar height = chosen metric; bar color = subset winner</div>
          <div className="flex flex-wrap gap-3">
            {[...new Map(sortedColumns.map((c) => [c.kind === 'subset' ? c.winnerId : '', c])).values()]
              .filter((c): c is Extract<SubsetColumn, { kind: 'subset' }> => Boolean(c) && c.kind === 'subset')
              .slice(0, 14)
              .map((c) => {
                const color = colorMap.get(c.winnerId) || (theme === 'dark' ? '#aaa' : '#444');
                return (
                  <div key={c.winnerId} className="flex items-center gap-2 text-xs font-mono">
                    <span className="inline-block w-4 h-4" style={{ background: color, outline: hoverWinnerId === c.winnerId ? (theme === 'dark' ? '2px solid #fff' : '2px solid #333') : 'none' }} />
                    <span className="truncate max-w-[14rem]" title={c.winnerLabel}>{c.winnerLabel}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubsetWinnersMatrix;
