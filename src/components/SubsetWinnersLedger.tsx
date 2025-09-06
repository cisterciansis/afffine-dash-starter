import React, { useMemo } from 'react';
import { useValidatorSummary } from '../hooks/useValidatorSummary';

type Theme = 'light' | 'dark';

type Miner = {
  id: string; // uid|model
  uid: number | null;
  model: string;
  rev: string;
  weight: number | null;
  pts: number | null;
  env: Record<string, number | null>;
};

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

function avgScores(envs: string[], miner: Miner, mask: number) {
  let s = 0;
  let n = 0;
  for (let i = 0; i < envs.length; i++) {
    if (mask & (1 << i)) {
      const v = miner.env[envs[i]];
      if (v != null && Number.isFinite(v)) {
        s += Number(v);
        n++;
      }
    }
  }
  return n > 0 ? s / n : -Infinity;
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

function compareTupleDesc(a: [number, number, number, string], b: [number, number, number, string]) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  if (a[2] !== b[2]) return a[2] - b[2];
  return b[3].localeCompare(a[3]); // string asc
}

function parseScoreAny(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const str = String(v).replace(/\*/g, '');
  const head = str.includes('/') ? str.split('/')[0] : str;
  const n = parseFloat(head);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(n: number | null | undefined, digits = 3) {
  if (n == null || !Number.isFinite(n as number)) return '—';
  return (n as number).toFixed(digits);
}

/**
 * Normalize a mean accuracy into 0..1 if possible. We look at the maximum score
 * observed on the subset across all miners to infer the scale.
 */
function normalizedMeanAcc(meanRaw: number, maxObserved: number): number {
  if (!Number.isFinite(meanRaw)) return Number.NaN;
  if (!Number.isFinite(maxObserved) || maxObserved <= 0) return meanRaw;
  if (maxObserved <= 1.00001) return meanRaw; // already 0..1
  if (maxObserved <= 10.00001) return meanRaw / 10;
  if (maxObserved <= 100.00001) return meanRaw / 100;
  return meanRaw / maxObserved;
}

type WinnerDetail = {
  winner: Miner | null;
  domEdges: number;
  tieBreak: 'weight' | 'pts' | 'sum' | 'model' | '-';
  winMode: 'dom' | 'mean' | '-';
  meanAcc01: number | null;
};

function computeWinnerDetail(envs: string[], miners: Miner[], mask: number): WinnerDetail {
  // Candidates: miners with at least one defined score in mask
  const candidates = miners.filter((m) => {
    for (let i = 0; i < envs.length; i++) {
      if (mask & (1 << i)) {
        const v = m.env[envs[i]];
        if (v != null && Number.isFinite(Number(v))) return true;
      }
    }
    return false;
  });
  if (!candidates.length) {
    return { winner: null, domEdges: 0, tieBreak: '-', winMode: '-', meanAcc01: null };
  }

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

  // Build keys and select best
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

  if (!best || !bestKey) {
    return { winner: null, domEdges: 0, tieBreak: '-', winMode: '-', meanAcc01: null };
  }

  // Determine tie-break dimension used
  let tieBreak: WinnerDetail['tieBreak'] = '-';
  // If there are multiple nonDominated, figure which dimension had a strict unique max
  if (nonDominated.length > 1) {
    const dims = ['weight', 'pts', 'sum', 'model'] as const;
    const buildKey = (m: Miner): [number, number, number, string] => [
      m.weight == null ? -Infinity : Number(m.weight),
      m.pts == null ? -Infinity : Number(m.pts),
      sumScores(envs, m, mask),
      m.model.toLowerCase(),
    ];
    const allKeys = nonDominated.map(buildKey);
    for (let d = 0; d < dims.length; d++) {
      // For model (string), lower is better (we invert in compareTupleDesc)
      if (d < 3) {
        const vals = allKeys.map(k => k[d] as number);
        const max = Math.max(...vals);
        const countMax = vals.filter(v => v === max).length;
        if (countMax === 1) {
          tieBreak = dims[d] as WinnerDetail['tieBreak'];
          break;
        }
      } else {
        const vals = allKeys.map(k => k[3] as string);
        const min = vals.slice().sort((a, b) => a.localeCompare(b))[0];
        const countMin = vals.filter(v => v === min).length;
        if (countMin === 1) {
          tieBreak = 'model';
          break;
        }
      }
    }
  }

  // Count dominance edges (ε-dom proxy): number of candidates dominated by winner
  let domEdges = 0;
  for (const m of candidates) {
    if (m === best) continue;
    if (dominates(envs, best, m, mask)) domEdges++;
  }
  const winMode: WinnerDetail['winMode'] = domEdges > 0 ? 'dom' : 'mean';

  // Compute normalized mean accuracy (0..1 heuristic)
  // Find max observed score across this subset for normalization
  let maxObserved = 0;
  for (const m of candidates) {
    for (let i = 0; i < envs.length; i++) {
      if (mask & (1 << i)) {
        const v = m.env[envs[i]];
        if (v != null && Number.isFinite(v)) {
          maxObserved = Math.max(maxObserved, Number(v));
        }
      }
    }
  }
  const meanRaw = avgScores(envs, best, mask);
  const meanAcc01 = Number.isFinite(meanRaw) ? normalizedMeanAcc(meanRaw, maxObserved) : null;

  return { winner: best, domEdges, tieBreak, winMode, meanAcc01 };
}

const SubsetWinnersLedger: React.FC<{ theme: Theme }> = ({ theme }) => {
  const { data: summary, loading, error } = useValidatorSummary();

  // Infer environment columns (same strategy as other visuals)
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

  // Map rows to Miner[]
  const miners = useMemo<Miner[]>(() => {
    if (!summary) return [];
    const cols = summary.columns;
    const idx = (name: string) => cols.indexOf(name);

    const iUID = idx('UID');
    const iModel = idx('Model');
    const iRev = idx('Rev');
    const iPts = idx('Pts');
    const iWgt = idx('Wgt');

    return summary.rows.map((row) => {
      const uid = typeof row[iUID] === 'number' ? (row[iUID] as number) : Number(row[iUID]);
      const model = String(row[iModel] ?? '');
      const rev = String(row[iRev] ?? '');
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
        rev,
        weight: wgt,
        pts,
        env: envMap,
      } as Miner;
    });
  }, [summary, envs]);

  type Row = {
    mask: number;
    size: number;
    subset: string; // tuple, e.g., (E1,E3)
    Ks: number; // points awarded (winner.pts)
    winnerLabel: string;
    winnerUid: number | null;
    winnerRev: string;
    winMode: 'dom' | 'mean' | '-';
    meanAcc: number | null; // 0..1
    domEdges: number;
    tieBreak: string;
  };

  const rows = useMemo<Row[]>(() => {
    const N = envs.length;
    if (!N || !miners.length) return [];
    const maxMask = 1 << N;
    const out: Row[] = [];

    for (let mask = 1; mask < maxMask; mask++) {
      const size = popcount(mask);
      const envList = subsetEnvList(mask, envs);
      const det = computeWinnerDetail(envs, miners, mask);
      const w = det.winner;

      if (!w) continue;

      const Ks = w.pts == null ? 0 : Number(w.pts);
      const tuple = `(${envList.join(',')})`;

      out.push({
        mask,
        size,
        subset: tuple,
        Ks: Number.isFinite(Ks) ? Ks : 0,
        winnerLabel: w.model,
        winnerUid: w.uid,
        winnerRev: w.rev || '',
        winMode: det.winMode,
        meanAcc: det.meanAcc01,
        domEdges: det.domEdges,
        tieBreak: det.tieBreak,
      });
    }

    // Sort: size asc, then Ks desc, then winner asc
    out.sort((a, b) => {
      if (a.size !== b.size) return a.size - b.size;
      if (a.Ks !== b.Ks) return b.Ks - a.Ks;
      return a.winnerLabel.localeCompare(b.winnerLabel);
    });

    return out;
  }, [envs, miners]);

  const frameCls = theme === 'dark'
    ? 'border-white bg-black text-white'
    : 'border-gray-300 bg-white text-gray-900';

  const exportCsv = () => {
    const header = ['Subset','|S|','K_s','Winner','UID','Rev','WinMode','MeanAcc(S)','DomEdges','TieBreak'];
    const lines = [header.join(',')];

    for (const r of rows) {
      const line = [
        r.subset,
        String(r.size),
        String(r.Ks),
        r.winnerLabel,
        r.winnerUid == null ? '' : String(r.winnerUid),
        r.winnerRev ?? '',
        r.winMode,
        r.meanAcc == null || !Number.isFinite(r.meanAcc) ? '' : formatNumber(r.meanAcc, 3),
        String(r.domEdges),
        r.tieBreak,
      ].map((cell) => {
        const s = String(cell ?? '');
        return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',');
      lines.push(line);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subset_winners_ledger.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`p-4 border-2 rounded-none ${frameCls}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-mono font-bold">Subset winners ledger</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className={`px-3 h-8 border text-xs font-mono rounded-sm ${theme === 'dark'
              ? 'border-white text-white hover:bg-gray-800'
              : 'border-gray-400 text-gray-800 hover:bg-cream-100'
            }`}
            title="Export table as CSV"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>{String(error)}</div>
      )}
      {loading && !summary && <div className="text-xs font-mono opacity-70">Loading…</div>}

      {!loading && summary && envs.length >= 2 && rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className={theme === 'dark' ? 'bg-gray-900' : 'bg-cream-100'}>
                {['Subset','|S|','K_s','Winner','UID','Rev','WinMode','MeanAcc(S)','DomEdges','TieBreak'].map((h) => (
                  <th key={h} className="px-2 py-2 border text-left font-mono text-xs uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.mask}-${i}`} className={i % 2 === 0 ? (theme === 'dark' ? 'bg-black' : 'bg-white') : (theme === 'dark' ? 'bg-gray-950' : 'bg-cream-50')}>
                  <td className="px-2 py-1 border font-mono text-sm">{r.subset}</td>
                  <td className="px-2 py-1 border font-mono text-sm">{r.size}</td>
                  <td className="px-2 py-1 border font-mono text-sm">{formatNumber(r.Ks, 3)}</td>
                  <td className="px-2 py-1 border font-mono text-sm truncate max-w-[18rem]" title={r.winnerLabel}>{r.winnerLabel}</td>
                  <td className="px-2 py-1 border font-mono text-sm">{r.winnerUid ?? '—'}</td>
                  <td className="px-2 py-1 border font-mono text-sm">{r.winnerRev || '—'}</td>
                  <td className="px-2 py-1 border font-mono text-sm">{r.winMode}</td>
                  <td className="px-2 py-1 border font-mono text-sm">{r.meanAcc != null && Number.isFinite(r.meanAcc) ? formatNumber(r.meanAcc, 3) : '—'}</td>
                  <td className="px-2 py-1 border font-mono text-sm">{r.domEdges}</td>
                  <td className="px-2 py-1 border font-mono text-sm">{r.tieBreak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <div className="text-xs font-mono opacity-70">
            Insufficient data to produce ledger. Detected envs: {envs.length ? envs.join(', ') : 'none'}
          </div>
        )
      )}
      <div className="mt-2 text-[11px] font-mono opacity-70">
        Notes: WinMode=dom if the winner Pareto-dominated ≥1 competitors on the subset; otherwise mean (fallback to non-dominated tie-breakers).
        MeanAcc(S) normalized to 0..1 when possible (based on observed scale for this subset).
      </div>
    </div>
  );
};

export default SubsetWinnersLedger;
