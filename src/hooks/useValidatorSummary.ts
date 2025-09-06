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
const PRIMARY_URL = '/api/miners';
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

        // Normalize fallback payload to the same column schema used by miners->summary:
        // ['UID','Model','Rev','SAT','ABD','DED','ELR','L1','L2','L3','L4','Pts','Elig','Wgt']
        const wantCols = [
          'UID','Model','Rev','SAT','ABD','DED','ELR','L1','L2','L3','L4','Pts','Elig','Wgt'
        ];

        const colIndex = (name: string) => json.columns.indexOf(name);

        // Detect if fallback already matches desired shape
        const alreadyCompatible = wantCols.every((c) => colIndex(c) !== -1);

        let normalized: SummaryResponse;
        if (alreadyCompatible) {
          // Use as-is
          normalized = json;
        } else {
          // Build rows defensively by mapping known/approximate names to our canonical columns
          // Known alternates seen historically:
          // - 'Weight' for 'Wgt'
          // - 'Points' or 'Pts' for Pts
          // - 'Eligible'/'Elig' for Elig (may be boolean)
          // - 'UID' sometimes as string
          // - Missing L1..L4 entirely
          const alt = {
            Wgt: colIndex('Wgt') !== -1 ? 'Wgt' : (colIndex('Weight') !== -1 ? 'Weight' : null),
            Pts: colIndex('Pts') !== -1 ? 'Pts' : (colIndex('Points') !== -1 ? 'Points' : null),
            Elig: colIndex('Elig') !== -1 ? 'Elig' : (colIndex('Eligible') !== -1 ? 'Eligible' : null),
          };

          const get = (row: (string | number | null)[], key: string | null): string | number | null => {
            if (!key) return null;
            const i = colIndex(key);
            return i === -1 ? null : row[i];
          };

          const toYN = (v: unknown): 'Y' | 'N' => {
            if (typeof v === 'string') {
              const s = v.trim().toLowerCase();
              if (s === 'y' || s === 'yes' || s === 'true' || s === '1') return 'Y';
            }
            if (typeof v === 'number') return v ? 'Y' : 'N';
            if (typeof v === 'boolean') return v ? 'Y' : 'N';
            return 'N';
          };

          const rows = json.rows.map((r) => {
            const uid = get(r, 'UID');
            const model = get(r, 'Model');
            const rev = get(r, 'Rev') ?? get(r, 'Revision') ?? '';

            const sat = get(r, 'SAT');
            const abd = get(r, 'ABD');
            const ded = get(r, 'DED');
            const elr = get(r, 'ELR');

            // Optional levels
            const l1 = get(r, 'L1');
            const l2 = get(r, 'L2');
            const l3 = get(r, 'L3');
            const l4 = get(r, 'L4');

            const pts = get(r, alt.Pts);
            const elig = toYN(get(r, alt.Elig));
            const wgt = get(r, alt.Wgt);

            return [
              typeof uid === 'string' ? Number(uid) : (uid as number | null),
              String(model ?? ''),
              String(rev ?? ''),
              sat as number | null,
              abd as number | null,
              ded as number | null,
              elr as number | null,
              (l1 as number | null) ?? null,
              (l2 as number | null) ?? null,
              (l3 as number | null) ?? null,
              (l4 as number | null) ?? null,
              (pts as number | null) ?? null,
              elig,
              (wgt as number | null) ?? null,
            ] as (string | number | null)[];
          });

          normalized = {
            timestamp: json.timestamp,
            tail: json.tail,
            columns: wantCols,
            rows,
            raw: json.raw,
          };
        }

        setData(normalized);
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
