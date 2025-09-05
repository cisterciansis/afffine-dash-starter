import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Check, MoreVertical } from 'lucide-react';
import { fetchSubnetOverview, SubnetOverviewRow, enrichLiveSubnetRows, LiveEnrichmentRow } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { useEnvironments } from '../contexts/EnvironmentsContext';
import { Skeleton, SkeletonText } from './Skeleton';
import { useValidatorSummary } from '../hooks/useValidatorSummary';

interface OverviewTableProps {
  environments?: any[]; // Kept for compatibility, not actively used
  theme: 'light' | 'dark';
}

type HistoricalDisplayRow = SubnetOverviewRow & { uniqueId: string };

// Live (API) display row derived from the summary endpoint
type LiveDisplayRow = {
  uniqueId: string;
  uid: string;
  model: string;
  rev: string;
  avgScore: number | null;
  successRatePercent?: number | null;
  weight: number | null;
  eligible: boolean;
  sat: number | null;
  abd: number | null;
  ded: number | null;
  elr: number | null;
  pts: number | null;
  l1?: number | null;
  l2?: number | null;
  l3?: number | null;
  l4?: number | null;
};

const OverviewTable: React.FC<OverviewTableProps> = ({ theme }) => {
  const [viewMode, setViewMode] = useState<'historical' | 'live'>('live');
  const [enrichedMap, setEnrichedMap] = useState<Record<string, LiveEnrichmentRow>>({});
  const [enriching, setEnriching] = useState<boolean>(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<'weight' | 'uid' | 'avgScore' | 'success' | 'pts' | 'model'>('weight');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const liveKey = (uid: string | number, model: string) => `${Number(uid)}|${model.toLowerCase()}`;

  // Data fetching for Historical view
  const {
    data: historicalData,
    error: historicalQueryError,
    isLoading: isHistoricalLoading,
  } = useQuery({
    queryKey: ['subnet-overview'],
    queryFn: fetchSubnetOverview,
    staleTime: 60000,
    enabled: viewMode === 'historical',
    refetchInterval: viewMode === 'historical' ? 6000 : false,
    refetchOnMount: false,
  });

  const historicalRows: HistoricalDisplayRow[] = (historicalData ?? []).map((r) => ({
    ...r,
    uniqueId: `${r.uid}-${r.model}-${r.rev}`,
  }));

  // Data fetching for Live view
  const { data: liveSummary, loading: isLiveLoading, error: liveError } = useValidatorSummary();

  const liveRows: LiveDisplayRow[] = useMemo(() => {
    if (!liveSummary) return [];
    const cols = liveSummary.columns || [];
    const idx = (name: string) => cols.indexOf(name);
    const iUID = idx('UID'), iModel = idx('Model'), iRev = idx('Rev'), iSAT = idx('SAT'), iABD = idx('ABD'), iDED = idx('DED'), iELR = idx('ELR'), iL1 = idx('L1'), iL2 = idx('L2'), iL3 = idx('L3'), iL4 = idx('L4'), iPts = idx('Pts'), iElig = idx('Elig'), iWgt = idx('Wgt');
    const parseScore = (v: unknown): number | null => v == null ? null : parseFloat(String(v).replace(/\*/g, '').split('/')[0]) || null;
    const parseNum = (v: unknown): number | null => v == null || v === '' ? null : (typeof v === 'number' ? v : parseFloat(String(v))) || null;
    const parseBoolY = (v: unknown): boolean => v != null && String(v).trim().toUpperCase().startsWith('Y');

    return liveSummary.rows.map((row) => {
      const sat = parseScore(row[iSAT]), abd = parseScore(row[iABD]), ded = parseScore(row[iDED]), elr = parseScore(row[iELR]);
      const envScores = [sat, abd, ded, elr].filter((n): n is number => n != null);
      return {
        uniqueId: `live-${row[iUID]}-${row[iModel]}-${row[iRev]}`,
        uid: String(row[iUID] ?? ''), model: String(row[iModel] ?? ''), rev: String(row[iRev] ?? ''),
        avgScore: envScores.length ? envScores.reduce((a, b) => a + b, 0) / envScores.length : null,
        weight: parseNum(row[iWgt]), pts: parseNum(row[iPts]), eligible: parseBoolY(row[iElig]),
        sat, abd, ded, elr,
        l1: parseNum(row[iL1]), l2: parseNum(row[iL2]), l3: parseNum(row[iL3]), l4: parseNum(row[iL4]),
      };
    });
  }, [liveSummary]);

  const baseRows = (viewMode === 'historical' ? historicalRows : liveRows) as Array<any & { uniqueId: string; eligible: boolean }>;

  // Sorting logic for Live view
  const rows = useMemo(() => {
    if (viewMode !== 'live') return baseRows;
    const arr = [...(baseRows as any[])];
    const getVal = (r: any): any => {
      switch (sortField) {
        case 'weight': return Number.isFinite(r.weight) ? r.weight : -Infinity;
        case 'uid': return Number.isFinite(Number(r.uid)) ? Number(r.uid) : Infinity;
        case 'avgScore': return Number.isFinite(r.avgScore) ? r.avgScore : -Infinity;
        case 'success': return enrichedMap[liveKey(r.uid, r.model)]?.success_rate_percent ?? -Infinity;
        case 'pts': return Number.isFinite(r.pts) ? r.pts : -Infinity;
        case 'model': return String(r.model || '').toLowerCase();
        default: return 0;
      }
    };
    arr.sort((a, b) => {
      const av = getVal(a), bv = getVal(b);
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [baseRows, viewMode, sortField, sortDir, enrichedMap]);

  const loading = viewMode === 'historical' ? isHistoricalLoading && historicalRows.length === 0 : isLiveLoading && liveRows.length === 0;
  const errorMsg = viewMode === 'historical' ? (historicalQueryError ? String(historicalQueryError) : null) : (liveError ?? null);

  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const { environments: envs, loading: envLoading } = useEnvironments();
  const gridCols = 'grid grid-cols-[72px_minmax(0,1fr)_72px_88px_96px_120px_72px_112px] gap-2 items-center';

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(rows.length, startIndex + pageSize);
  const pagedRows = rows.slice(startIndex, endIndex);

  useEffect(() => setPage(1), [pageSize, rows.length, sortField, sortDir, viewMode]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  // Data enrichment effect for visible live rows
  useEffect(() => {
    if (viewMode !== 'live' || !pagedRows.length) return;
    const toFetch = pagedRows
      .map(r => ({ uid: Number(r.uid), model: r.model }))
      .filter(r => Number.isFinite(r.uid) && r.model && !enrichedMap[liveKey(r.uid, r.model)]);
    if (toFetch.length === 0) return;

    setEnriching(true);
    setEnrichmentError(null);
    enrichLiveSubnetRows(toFetch)
      .then(rows => setEnrichedMap(prev => ({ ...prev, ...Object.fromEntries(rows.map(r => [liveKey(r.uid, r.model), r])) })))
      .catch(err => setEnrichmentError(String(err)))
      .finally(() => setEnriching(false));
  }, [viewMode, page, pageSize, pagedRows, liveSummary]); // Re-run when pagedRows change

  const fmt = (n: number | null | undefined, digits = 1) => (n == null ? '—' : n.toFixed(digits));
  const fmtTs = (iso: string | null | undefined) => (!iso ? '—' : new Date(iso).toLocaleString());
  const dash = '—';
  const midTrunc = (s: string, max = 36) => s && s.length > max ? `${s.slice(0, max/2)}…${s.slice(s.length - max/2)}` : s;
  
  const toggleSort = (field: typeof sortField) => {
    if (viewMode !== 'live') return;
    setSortDir(prev => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'));
    setSortField(field);
  };
  const sortIndicator = (field: typeof sortField) => viewMode !== 'live' || sortField !== field ? '' : (sortDir === 'asc' ? '▲' : '▼');
  const toggleExpanded = (uniqueId: string) => setExpandedModel(prev => prev === uniqueId ? null : uniqueId);

  // Keyboard shortcut handler
  useEffect(() => {
    const activeId = openMenuId ?? hoveredRowId;
    if (!activeId) return;

    const onKey = (e: KeyboardEvent) => {
      const row = rows.find(r => r.uniqueId === activeId);
      if (!row) return;
      const key = e.key.toLowerCase();
      if (key === 'escape') { setOpenMenuId(null); setHoveredRowId(null); }
      if (key === 't') { toggleExpanded(row.uniqueId); setOpenMenuId(null); }
      if (key === 'h') { window.open(`https://huggingface.co/${row.model}`, '_blank'); setOpenMenuId(null); }
      if (key === 'c') {
        const chuteId = (row as any).chute_id ?? enrichedMap[liveKey(row.uid, row.model)]?.chute_id;
        if (chuteId) { window.open(`https://chutes.ai/app/chute/${chuteId}`, '_blank'); }
        setOpenMenuId(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openMenuId, hoveredRowId, rows]);


  // RENDER METHOD STARTS HERE
  return (
    <div className={`space-y-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
      {/* Overview Stats */}
      <div className={`p-4 border-2 rounded-none ${ theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-cream-100' }`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-lg font-mono font-bold ${ theme === 'dark' ? 'text-white' : 'text-gray-900' }`}>
            SUBNET OVERVIEW
          </h3>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-0">
              <button onClick={() => setViewMode('live')} className={`h-8 px-3 text-xs font-mono border rounded-l-sm ${viewMode === 'live' ? (theme === 'dark' ? 'bg-white text-black border-white' : 'bg-gray-900 text-white border-gray-900') : (theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100')}`} aria-pressed={viewMode === 'live'}>Live</button>
              <button onClick={() => setViewMode('historical')} className={`h-8 px-3 text-xs font-mono border rounded-r-sm -ml-px ${viewMode === 'historical' ? (theme === 'dark' ? 'bg-white text-black border-white' : 'bg-gray-900 text-white border-gray-900') : (theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100')}`} aria-pressed={viewMode === 'historical'}>Historical</button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${ theme === 'dark' ? 'text-white' : 'text-gray-900' }`}>{loading ? <Skeleton theme={theme} className="h-6 w-12 mx-auto" /> : rows.length}</div>
            <div className={`text-xs font-mono uppercase tracking-wider ${ theme === 'dark' ? 'text-gray-300' : 'text-gray-600' }`}>Total Models</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${ theme === 'dark' ? 'text-green-400' : 'text-green-600' }`}>{loading ? <Skeleton theme={theme} className="h-6 w-12 mx-auto" /> : rows.filter(r => r.eligible).length}</div>
            <div className={`text-xs font-mono uppercase tracking-wider ${ theme === 'dark' ? 'text-gray-300' : 'text-gray-600' }`}>Eligible</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${ theme === 'dark' ? 'text-white' : 'text-gray-900' }`}>{envLoading ? <Skeleton theme={theme} className="h-6 w-12 mx-auto" /> : envs.length}</div>
            <div className={`text-xs font-mono uppercase tracking-wider ${ theme === 'dark' ? 'text-gray-300' : 'text-gray-600' }`}>Environments</div>
          </div>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
          Showing {rows.length === 0 ? 0 : startIndex + 1}–{endIndex} of {rows.length}
        </div>
        <div className="flex items-center gap-2">
          <label className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Rows per page:</label>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className={`h-8 px-2 border text-xs font-mono rounded-sm ${theme === 'dark' ? 'border-white bg-black text-white' : 'border-gray-400 bg-white text-gray-800'}`}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`} title="First page">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`} title="Previous page">‹</button>
            <span className={`text-xs font-mono px-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`} title="Next page">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`} title="Last page">»</button>
          </div>
        </div>
      </div>

      {/* Models Table */}
      <div className={`border-2 rounded-none overflow-x-auto ${theme === 'dark' ? 'border-white bg-black' : 'border-gray-300 bg-white'}`}>
        {/* Table Header */}
        <div className={`p-3 border-b-2 ${theme === 'dark' ? 'border-white bg-gray-900' : 'border-gray-300 bg-cream-50'}`}>
          <div className={`${gridCols} text-center`}>
            {/* Headers with sort functionality */}
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><button disabled={viewMode !== 'live'} onClick={() => toggleSort('uid')} className={`inline-flex items-center gap-1 ${viewMode === 'live' ? 'cursor-pointer underline-offset-2 hover:underline' : 'opacity-60 cursor-default'}`}><span>UID</span><span>{sortIndicator('uid')}</span></button></div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold text-left ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><button disabled={viewMode !== 'live'} onClick={() => toggleSort('model')} className={`inline-flex items-center gap-1 ${viewMode === 'live' ? 'cursor-pointer underline-offset-2 hover:underline' : 'opacity-60 cursor-default'}`}><span>Model</span><span>{sortIndicator('model')}</span></button></div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Rev</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><button disabled={viewMode !== 'live'} onClick={() => toggleSort('avgScore')} className={`inline-flex items-center gap-1 ${viewMode === 'live' ? 'cursor-pointer underline-offset-2 hover:underline' : 'opacity-60 cursor-default'}`}><span>Avg Score</span><span>{sortIndicator('avgScore')}</span></button></div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><button disabled={viewMode !== 'live'} onClick={() => toggleSort('success')} className={`inline-flex items-center gap-1 ${viewMode === 'live' ? 'cursor-pointer underline-offset-2 hover:underline' : 'opacity-60 cursor-default'}`}><span>Success %</span><span>{sortIndicator('success')}</span></button></div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{viewMode === 'live' ? <button onClick={() => toggleSort('weight')} className="inline-flex items-center gap-1 cursor-pointer underline-offset-2 hover:underline"><span>Weight</span><span>{sortIndicator('weight')}</span></button> : 'Avg Latency (s)'}</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Eligible</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Actions</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y-2 divide-gray-300">
          {errorMsg && <div className={`p-4 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{errorMsg}</div>}
          
          {/* Skeleton Loader */}
          {loading && !errorMsg && Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => (
            <div key={i} className={`p-3 ${theme === 'dark' ? 'hover:bg-gray-800/40' : 'hover:bg-cream-50/60'}`}>
              <div className={`${gridCols} text-center`}>
                <SkeletonText theme={theme} className="h-4 w-12 mx-auto" />
                <div className="text-left"><SkeletonText theme={theme} className="h-4 w-48" /></div>
                <SkeletonText theme={theme} className="h-3 w-10 mx-auto" />
                <SkeletonText theme={theme} className="h-4 w-12 mx-auto" />
                <SkeletonText theme={theme} className="h-4 w-12 mx-auto" />
                <SkeletonText theme={theme} className="h-4 w-16 mx-auto" />
                <div className="flex items-center justify-center"><Skeleton theme={theme} className="h-4 w-4 rounded-full" /></div>
                <div className="flex items-center justify-center gap-2"><Skeleton theme={theme} className="h-8 w-8" /><Skeleton theme={theme} className="h-8 w-8" /></div>
              </div>
            </div>
          ))}

          {/* Render Rows based on viewMode */}
          {!loading && !errorMsg && pagedRows.map((model: any) => {
            const isLive = viewMode === 'live';
            const enriched = isLive ? enrichedMap[liveKey(model.uid, model.model)] : null;
            const chuteId = isLive ? enriched?.chute_id : model.chute_id;

            return (
              <div key={model.uniqueId} onMouseEnter={() => setHoveredRowId(model.uniqueId)} onMouseLeave={() => setHoveredRowId(null)}>
                {/* Main Row */}
                <div className={`p-3 transition-colors ${theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-cream-50'}`}>
                  <div className={`${gridCols} text-center`}>
                    <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap`}>{model.uid}</div>
                    <div className={`text-sm font-mono truncate whitespace-nowrap text-left ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} title={model.model}>{midTrunc(model.model, 48)}</div>
                    <div className={`text-xs font-mono whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} title={model.rev}>{midTrunc(model.rev, 10)}</div>
                    <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap`}>{fmt(isLive ? model.avgScore : model.overall_avg_score)}</div>
                    <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap`}>{isLive ? (enriched?.success_rate_percent != null ? `${enriched.success_rate_percent.toFixed(1)}%` : dash) : (model.success_rate_percent != null ? `${model.success_rate_percent.toFixed(1)}%` : dash)}</div>
                    <div className={`text-sm font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{isLive ? fmt(model.weight, 4) : fmt(model.avg_latency, 2)}</div>
                    <div className="flex items-center justify-center">{model.eligible ? <Check size={16} className={theme === 'dark' ? 'text-green-400' : 'text-green-600'} /> : <span className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{dash}</span>}</div>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => toggleExpanded(model.uniqueId)} aria-label="Toggle details" className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`} title="Toggle details (T)">
                        {expandedModel === model.uniqueId ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(prev => prev === model.uniqueId ? null : model.uniqueId)} aria-haspopup="menu" className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`} title="Actions (open menu)">
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === model.uniqueId && (
                          <div className={`absolute right-0 mt-1 w-56 z-20 rounded-sm border shadow-lg ${theme === 'dark' ? 'bg-gray-900 border-white text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                            <button onClick={() => { toggleExpanded(model.uniqueId); setOpenMenuId(null); }} className={`flex w-full items-center justify-between px-3 h-9 text-sm text-left transition-colors ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}><span>Toggle details</span><span className="text-xs opacity-70">T</span></button>
                            <a href={`https://huggingface.co/${model.model}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenuId(null)} className={`flex w-full items-center justify-between px-3 h-9 text-sm transition-colors ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}><span>View on Hugging Face</span><span className="text-xs opacity-70">H</span></a>
                            {chuteId ? (<a href={`https://chutes.ai/app/chute/${chuteId}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenuId(null)} className={`flex w-full items-center justify-between px-3 h-9 text-sm transition-colors ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}><span>Open Chutes</span><span className="text-xs opacity-70">C</span></a>) : (<div className={`flex w-full items-center justify-between px-3 h-9 text-sm opacity-50`}><span>Open Chutes</span><span className="text-xs opacity-70">C</span></div>)}
                            <div className={`px-3 py-2 border-t text-[11px] font-mono opacity-70 ${theme === 'dark' ? 'border-white/30' : 'border-gray-300'}`}>Shortcuts: T, H, C, Esc</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {expandedModel === model.uniqueId && (
                  <div className={`px-3 pb-3 text-left ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-cream-50'}`}>
                    <div className="text-xs font-mono grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                      {/* Common fields */}
                      <div><span className="font-bold">UID:</span> {model.uid}</div>
                      <div className="break-all"><span className="font-bold">Rev:</span> {model.rev}</div>
                      <div><span className="font-bold">Avg Score:</span> {fmt(isLive ? model.avgScore : model.overall_avg_score)}</div>
                      <div><span className="font-bold">Success %:</span> {isLive ? (enriched?.success_rate_percent != null ? `${enriched.success_rate_percent.toFixed(1)}%` : dash) : (model.success_rate_percent != null ? `${model.success_rate_percent.toFixed(1)}%` : dash)}</div>
                      <div><span className="font-bold">Eligible:</span> {model.eligible ? 'Yes' : 'No'}</div>
                      {/* View-specific fields */}
                      {isLive ? (<>
                        <div><span className="font-bold">Hotkey:</span> {enriched?.hotkey ?? dash}</div>
                        <div><span className="font-bold">Avg Latency (s):</span> {fmt(enriched?.avg_latency, 2)}</div>
                        <div><span className="font-bold">Total Rollouts:</span> {enriched?.total_rollouts?.toLocaleString() ?? dash}</div>
                        <div><span className="font-bold">Last Rollout:</span> {fmtTs(enriched?.last_rollout_at)}</div>
                        <div><span className="font-bold">PTS:</span> {fmt(model.pts, 4)}</div>
                        <div><span className="font-bold">Weight:</span> {fmt(model.weight, 4)}</div>
                        <div><span className="font-bold">SAT:</span> {fmt(model.sat)}</div>
                        <div><span className="font-bold">ABD:</span> {fmt(model.abd)}</div>
                        <div><span className="font-bold">DED:</span> {fmt(model.ded)}</div>
                        <div><span className="font-bold">ELR:</span> {fmt(model.elr)}</div>
                        {model.l1 != null && <div><span className="font-bold">L1:</span> {fmt(model.l1)}</div>}
                        {model.l2 != null && <div><span className="font-bold">L2:</span> {fmt(model.l2)}</div>}
                      </>) : (<>
                        <div className="break-all"><span className="font-bold">Hotkey:</span> {model.hotkey}</div>
                        <div><span className="font-bold">Avg Latency (s):</span> {fmt(model.avg_latency, 2)}</div>
                        <div><span className="font-bold">Total Rollouts:</span> {model.total_rollouts.toLocaleString()}</div>
                        <div><span className="font-bold">Last Rollout:</span> {fmtTs(model.last_rollout_at)}</div>
                        {envs.map(env => {
                          const key = env.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                          return <div key={env}><span className="font-bold">{env}:</span> {fmt((model as any)[key])}</div>
                        })}
                      </>)}
                    </div>
                  </div>
                )}
              </div>
            )})}
        </div>
      </div>
    </div>
  );
};

export default OverviewTable;