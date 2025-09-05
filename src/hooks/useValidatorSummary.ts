import { useEffect, useState } from 'react';

interface SummaryResponse {
  timestamp: string;
  tail: number;
  columns: string[];
  rows: (string | number | null)[][];
  raw?: string;
}

/**
 * Primary new endpoint for live miners view.
 * Fallback to the previous summary endpoint if the new one is unavailable.
 */
const PRIMARY_URL = 'http://65.109.19.166:9000/api/miners';
const FALLBACK_URL = 'https://sn120-viewer.onrender.com/api/weights/summary/latest';

// Types for the new miners endpoint
type MinerEnvStat = {
  count: number;
  success_rate: number; // 0..1
};

type MinerEnvs = {
  ABD?: MinerEnvStat;
  DED?: MinerEnvStat;
  ELR?: MinerEnvStat;
  HVM?: MinerEnvStat;
  SAT?: MinerEnvStat;
  [k: string]: MinerEnvStat | undefined;
};

type MinerDetail = {
  block: number;
  hotkey: string;
  model: string;
  revision: string | null;
  uid: number;
  // many other fields exist under chute, node, etc. but we don't need them here
};

type MinerItem = {
  detail: MinerDetail;
  eligible: boolean;
  envs: MinerEnvs;
  hotkey: string;
  pts: number | null;
  score: Record<string, unknown>;
  uid: number;
  weight: number | null;
};

type MinersResponse = {
  best: number;
  current_block: number;
  data: MinerItem[];
};

/**
 * Extract L1-L4 from the miners "score" field, supporting a few shapes:
 * - { L1, L2, L3, L4 }
 * - { l1, l2, l3, l4 }
 * - { '1', '2', '3', '4' }
 * - array-like values
 * - any other object: use first four values encountered
 */
function extractL1toL4(score: unknown): [number | null, number | null, number | null, number | null] {
  const toNum = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const str = String(v).replace(/\*/g, '');
    const head = str.includes('/') ? str.split('/')[0] : str;
    const n = parseFloat(head);
    return Number.isFinite(n) ? n : null;
  };

  if (!score) return [null, null, null, null];

  if (Array.isArray(score)) {
    return [
      toNum(score[0]),
      toNum(score[1]),
      toNum(score[2]),
      toNum(score[3]),
    ];
  }

  if (typeof score === 'object') {
    const s = score as Record<string, unknown>;
    const keySets = [
      ['L1', 'L2', 'L3', 'L4'],
      ['l1', 'l2', 'l3', 'l4'],
      ['1', '2', '3', '4'],
      ['level1', 'level2', 'level3', 'level4'],
    ];
    for (const keys of keySets) {
      const vals = keys.map(k => toNum(s[k]));
      if (vals.some(v => v != null)) {
        return [vals[0], vals[1], vals[2], vals[3]];
      }
    }
    const vals = Object.values(s).slice(0, 4).map(toNum);
    while (vals.length < 4) vals.push(null);
    return [vals[0] ?? null, vals[1] ?? null, vals[2] ?? null, vals[3] ?? null];
  }

  return [null, null, null, null];
}

/**
 * Transform the miners API response into the existing "summary" shape
 * expected by the live view. We preserve the same column names used in
 * OverviewTable so indexes continue to work unchanged.
 *
 * Note: The miners endpoint exposes env success_rate (0..1). We map that
 * onto a 0..10 scale for SAT/ABD/DED/ELR to approximate a "score".
 */
function transformMinersToSummary(resp: MinersResponse): SummaryResponse {
  const columns = [
    'UID',
    'Model',
    'Rev',
    'SAT',
    'ABD',
    'DED',
    'ELR',
    'L1',
    'L2',
    'L3',
    'L4',
    'Pts',
    'Elig',
    'Wgt',
  ];

  const toScore10 = (v: number | undefined): number | null => {
    if (v == null || Number.isNaN(v)) return null;
    const n = v * 10; // convert 0..1 success_rate to 0..10 scale
    return Number.isFinite(n) ? n : null;
    // OverviewTable.parseScore will handle numeric values fine.
  };

  const rows: (string | number | null)[][] = resp.data.map((m) => {
    const uid = m.detail?.uid ?? m.uid ?? null;
    const model = m.detail?.model ?? '';
    const rev = m.detail?.revision ?? '';

    const sat = toScore10(m.envs?.SAT?.success_rate);
    const abd = toScore10(m.envs?.ABD?.success_rate);
    const ded = toScore10(m.envs?.DED?.success_rate);
    const elr = toScore10(m.envs?.ELR?.success_rate);

    const [l1, l2, l3, l4] = extractL1toL4(m.score);

    const pts = m.pts ?? null;
    const elig = m.eligible ? 'Y' : 'N';
    const wgt = m.weight ?? null;

    return [
      uid as number | null,
      model,
      rev,
      sat,
      abd,
      ded,
      elr,
      l1,
      l2,
      l3,
      l4,
      pts,
      elig,
      wgt,
    ];
  });

  return {
    timestamp: new Date().toISOString(),
    tail: typeof resp.best === 'number' ? resp.best : 0,
    columns,
    rows,
  };
}

export const useValidatorSummary = () => {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    // Try primary (new miners endpoint)
    try {
      const res = await fetch(PRIMARY_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MinersResponse = await res.json();
      const summary = transformMinersToSummary(json);
      setData(summary);
      setError(null);
      return;
    } catch (primaryErr) {
      // Fallback to the previous summary endpoint
      try {
        const res = await fetch(FALLBACK_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: SummaryResponse = await res.json();
        setData(json);
        setError(null);
        return;
      } catch (fallbackErr) {
        setError(
          fallbackErr instanceof Error
            ? fallbackErr.message
            : primaryErr instanceof Error
              ? primaryErr.message
              : 'Unknown error'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, []);

  return { data, loading, error, refetch: fetchData } as const;
};
