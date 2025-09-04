import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Check, MoreVertical } from 'lucide-react';
import { fetchSubnetOverview, SubnetOverviewRow, enrichLiveSubnetRows, LiveEnrichmentRow } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { useEnvironments } from '../contexts/EnvironmentsContext';
import { Skeleton, SkeletonText } from './Skeleton';
import { useValidatorSummary } from '../hooks/useValidatorSummary';

interface OverviewTableProps {
  environments?: any[]; // kept for compatibility with existing App.tsx; not used
  theme: 'light' | 'dark';
}

type HistoricalDisplayRow = SubnetOverviewRow & { uniqueId: string };

// Live (API) display row derived from summary endpoint
type LiveDisplayRow = {
  uniqueId: string;
  uid: string;
  model: string;
  rev: string;
  avgScore: number | null;
  successRatePercent?: number | null; // not available in live; kept for compatibility
  weight: number | null;
  eligible: boolean;
  sat: number | null;
  abd: number | null;
  ded: number | null;
  elr: number | null;
  pts: number | null;
  // Optional granular levels if present
  l1?: number | null;
  l2?: number | null;
  l3?: number | null;
  l4?: number | null;
};

const OverviewTable: React.FC<OverviewTableProps> = ({ theme }) => {
  // View mode (Historical = DB queries, Live = Public API)
  const [viewMode, setViewMode] = useState<'historical' | 'live'>('live');
  // Enrichment state for Live view (DB-backed fields keyed by uid|model|rev)
  const [enrichedMap, setEnrichedMap] = useState<Record<string, LiveEnrichmentRow>>({});
  const [enriching, setEnriching] = useState<boolean>(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);

  // Historical: keep existing data flow exactly the same
  const {
    data: historicalData,
    error: historicalQueryError,
    isLoading: isHistoricalLoading,
  } = useQuery({
    queryKey: ['subnet-overview'],
    queryFn: fetchSubnetOverview,
    staleTime: 60000, // 1 min: show cached data when revisiting; background refresh runs separately
    enabled: viewMode === 'historical', // Do not fetch historical until user selects it
    refetchInterval: viewMode === 'historical' ? 6000 : false, // Only poll when viewing historical
    refetchOnMount: false, // do not refetch immediately on mount if cache exists
  });

  const historicalRows: HistoricalDisplayRow[] = (historicalData ?? []).map((r) => ({
    ...r,
    uniqueId: `${r.uid}-${r.model}-${r.rev}`,
  }));

  // Live: uses new public API hook
  const {
    data: liveSummary,
    loading: isLiveLoading,
    error: liveError,
  } = useValidatorSummary();

  const liveRows: LiveDisplayRow[] = useMemo(() => {
    if (!liveSummary) return [];
    const cols = liveSummary.columns || [];

    const idx = (name: string) => cols.indexOf(name);
    const iUID = idx('UID');
    const iModel = idx('Model');
    const iRev = idx('Rev');
    const iSAT = idx('SAT');
    const iABD = idx('ABD');
    const iDED = idx('DED');
    const iELR = idx('ELR');
    const iL1 = idx('L1');
    const iL2 = idx('L2');
    const iL3 = idx('L3');
    const iL4 = idx('L4');
    const iPts = idx('Pts');
    const iElig = idx('Elig');
    const iWgt = idx('Wgt');

    const parseScore = (v: unknown): number | null => {
      if (v == null) return null;
      const str = String(v).replace(/\*/g, '');
      const [score] = str.split('/');
      const n = parseFloat(score);
      return Number.isFinite(n) ? n : null;
    };

    const parseNum = (v: unknown): number | null => {
      if (v == null || v === '') return null;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };

    const parseBoolY = (v: unknown): boolean => {
      if (v == null) return false;
      return String(v).trim().toUpperCase().startsWith('Y');
    };

    return liveSummary.rows.map((row) => {
      const uid = String(row[iUID] ?? '');
      const model = String(row[iModel] ?? '');
      const rev = String(row[iRev] ?? '');

      const sat = parseScore(row[iSAT]);
      const abd = parseScore(row[iABD]);
      const ded = parseScore(row[iDED]);
      const elr = parseScore(row[iELR]);

      const envScores = [sat, abd, ded, elr].filter((n): n is number => n != null);
      const avgScore = envScores.length ? envScores.reduce((a, b) => a + b, 0) / envScores.length : null;

      const weight = parseNum(row[iWgt]);
      const pts = parseNum(row[iPts]);
      const eligible = parseBoolY(row[iElig]);

      const l1 = parseNum(row[iL1]);
      const l2 = parseNum(row[iL2]);
      const l3 = parseNum(row[iL3]);
      const l4 = parseNum(row[iL4]);

      return {
        uniqueId: `live-${uid}-${model}-${rev}`,
        uid,
        model,
        rev,
        avgScore,
        successRatePercent: null,
        weight,
        eligible,
        sat,
        abd,
        ded,
        elr,
        pts,
        l1,
        l2,
        l3,
        l4,
      };
    });
  }, [liveSummary]);

  // Unify rows/flags based on mode for rendering/pagination
  const rows = (viewMode === 'historical' ? historicalRows : liveRows) as Array<any & { uniqueId: string; eligible: boolean }>;
  const loading = viewMode === 'historical'
    ? isHistoricalLoading && historicalRows.length === 0
    : isLiveLoading && liveRows.length === 0;
  const errorMsg = viewMode === 'historical'
    ? (historicalQueryError ? (historicalQueryError instanceof Error ? historicalQueryError.message : String(historicalQueryError)) : null)
    : (liveError ?? null);

  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);

  // Environments from global context (dynamic)
  const { environments: envs, loading: envLoading } = useEnvironments();

  // Fixed column layout to keep table compact and readable across widths.
  const gridCols = 'grid grid-cols-[72px_minmax(0,1fr)_72px_88px_96px_120px_72px_112px] gap-2 items-center';

  // Computed pagination values
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(rows.length, startIndex + pageSize);
  const pagedRows = rows.slice(startIndex, startIndex + pageSize);

  // Reset to first page when rows count or page size changes
  useEffect(() => {
    setPage(1);
  }, [pageSize, rows.length]);

  // Clamp page if it exceeds totalPages
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Helper to build a stable key for enrichment lookups
  const liveKey = (uid: string | number, model: string) => `${Number(uid)}|${model.toLowerCase()}`;


  // Enrich only the currently visible page of live rows to minimize DB load
  useEffect(() => {
    if (viewMode !== 'live' || !liveRows.length) return;

    const start = (page - 1) * pageSize;
    const end = Math.min(liveRows.length, start + pageSize);
    const slice = liveRows.slice(start, end);

    // Prepare unique items not yet enriched
    const toFetch: Array<{ uid: number; model: string }> = [];
    const seen = new Set<string>();
    for (const r of slice) {
      const k = liveKey(r.uid, r.model);
      if (seen.has(k) || enrichedMap[k]) continue;
      seen.add(k);
      const uidNum = Number(r.uid);
      if (!Number.isFinite(uidNum) || !r.model) continue;
      toFetch.push({ uid: uidNum, model: r.model });
    }
    if (toFetch.length === 0) return;

    setEnriching(true);
    setEnrichmentError(null);
    enrichLiveSubnetRows(toFetch)
      .then((rows) => {
        setEnrichedMap((prev) => {
          const next = { ...prev };
          for (const er of rows) {
            next[liveKey(er.uid, er.model)] = er;
          }
          return next;
        });
      })
      .catch((err) => setEnrichmentError(err instanceof Error ? err.message : String(err)))
      .finally(() => setEnriching(false));
  }, [viewMode, page, pageSize, liveRows, liveSummary]);

  const fmt = (n: number | null | undefined, digits = 1) => (n == null ? '—' : n.toFixed(digits));
  const fmtTs = (iso: string | null | undefined) => (!iso ? '—' : new Date(iso).toLocaleString());
  const dash = '—';
  const midTrunc = (s: string, max = 36) => {
    if (!s) return s as unknown as string;
    if (s.length <= max) return s;
    const half = Math.floor((max - 1) / 2);
    return s.slice(0, half) + '…' + s.slice(s.length - half);
  };

  const toggleExpanded = (uniqueId: string) => {
    setExpandedModel(expandedModel === uniqueId ? null : uniqueId);
  };

  // Keyboard shortcuts when hovering a row or when actions menu is open.
  // t => toggle details, h => Hugging Face, c => Chutes, Esc => close
  useEffect(() => {
    const activeId = openMenuId ?? hoveredRowId;
    if (!activeId) return;

    const onKey = (e: KeyboardEvent) => {
      const row = rows.find(r => r.uniqueId === activeId);
      if (!row) return;

      const key = e.key.toLowerCase();
      if (key === 'escape') {
        if (openMenuId) setOpenMenuId(null);
        else setHoveredRowId(null);
        return;
      }
      if (key === 't') {
        setExpandedModel(prev => (prev === row.uniqueId ? null : row.uniqueId));
        if (openMenuId) setOpenMenuId(null);
        return;
      }
      if (key === 'h') {
        window.open(`https://huggingface.co/${String((row as any).model)}`, '_blank', 'noopener,noreferrer');
        if (openMenuId) setOpenMenuId(null);
        return;
      }
      if (key === 'c') {
        const chuteId = (row as any).chute_id;
        if (chuteId) {
          window.open(`https://chutes.ai/app/chute/${String(chuteId)}`, '_blank', 'noopener,noreferrer');
        }
        if (openMenuId) setOpenMenuId(null);
        return;
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openMenuId, hoveredRowId, rows]);

  return (
    <div className={`space-y-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
      {/* Overview Stats */}
      <div className={`p-4 border-2 rounded-none ${
        theme === 'dark'
          ? 'border-white bg-black'
          : 'border-gray-300 bg-cream-100'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-lg font-mono font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            SUBNET OVERVIEW
          </h3>

          {/* Live / Historical toggle */}
          <div className="inline-flex items-center gap-0">
            <button
              onClick={() => setViewMode('live')}
              className={`h-8 px-3 text-xs font-mono border rounded-l-sm ${viewMode === 'live'
                  ? (theme === 'dark' ? 'bg-white text-black border-white' : 'bg-gray-900 text-white border-gray-900')
                  : (theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100')
                }`}
              aria-pressed={viewMode === 'live'}
            >
              Live
            </button>
            <button
              onClick={() => setViewMode('historical')}
              className={`h-8 px-3 text-xs font-mono border rounded-r-sm -ml-px ${viewMode === 'historical'
                  ? (theme === 'dark' ? 'bg-white text-black border-white' : 'bg-gray-900 text-white border-gray-900')
                  : (theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100')
                }`}
              aria-pressed={viewMode === 'historical'}
            >
              Historical
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {loading ? <Skeleton theme={theme} className="h-6 w-12 mx-auto" /> : rows.length}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Total Models
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-green-400' : 'text-green-600'
            }`}>
              {loading ? <Skeleton theme={theme} className="h-6 w-12 mx-auto" /> : rows.filter(r => r.eligible).length}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Eligible
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {envLoading ? <Skeleton theme={theme} className="h-6 w-12 mx-auto" /> : envs.length}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Environments
            </div>
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
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className={`h-8 px-2 border text-xs font-mono rounded-sm ${theme === 'dark' ? 'border-white bg-black text-white' : 'border-gray-400 bg-white text-gray-800'}`}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`}
              aria-label="First page"
              title="First page"
            >«</button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`}
              aria-label="Previous page"
              title="Previous page"
            >‹</button>
            <span className={`text-xs font-mono px-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`}
              aria-label="Next page"
              title="Next page"
            >›</button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`}
              aria-label="Last page"
              title="Last page"
            >»</button>
          </div>
        </div>
      </div>

      {/* Models Table */}
      <div className={`border-2 rounded-none overflow-x-auto ${
        theme === 'dark'
          ? 'border-white bg-black'
          : 'border-gray-300 bg-white'
      }`}>
        {/* Table Header */}
        <div className={`p-3 border-b-2 ${
          theme === 'dark' ? 'border-white bg-gray-900' : 'border-gray-300 bg-cream-50'
        }`}>
          <div className={`${gridCols} text-center`}>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>UID</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold text-left ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Model</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Rev</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Avg Score</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Success %</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {viewMode === 'live' ? 'Weight' : 'Avg Latency (s)'}
            </div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Eligible</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Actions</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y-2 divide-gray-300">
          {errorMsg && (
            <div className={`p-4 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
              {errorMsg}
            </div>
          )}
          {loading && !errorMsg && (
            <div className="divide-y-2 divide-gray-300">
              {Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => (
                <div key={i}>
                  {/* Main Row Skeleton */}
                  <div className={`p-3 ${theme === 'dark' ? 'hover:bg-gray-800/40' : 'hover:bg-cream-50/60'}`}>
                    <div className={`${gridCols} text-center`}>
                      <SkeletonText theme={theme} className="h-4 w-12 mx-auto" />
                      <div className="text-left">
                        <SkeletonText theme={theme} className="h-4 w-48" />
                      </div>
                      <SkeletonText theme={theme} className="h-3 w-10 mx-auto" />
                      <SkeletonText theme={theme} className="h-4 w-12 mx-auto" />
                      <SkeletonText theme={theme} className="h-4 w-12 mx-auto" />
                      <SkeletonText theme={theme} className="h-4 w-16 mx-auto" />
                      <div className="flex items-center justify-center">
                        <Skeleton theme={theme} className="h-4 w-4 rounded-full" />
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Skeleton theme={theme} className="h-8 w-8" />
                        <Skeleton theme={theme} className="h-8 w-8" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Historical rows */}
          {viewMode === 'historical' && !loading && !errorMsg && pagedRows.map((model: HistoricalDisplayRow) => (
            <div key={model.uniqueId} onMouseEnter={() => setHoveredRowId(model.uniqueId)} onMouseLeave={() => setHoveredRowId(prev => (prev === model.uniqueId ? null : prev))}>
              {/* Main Row */}
              <div className={`p-3 hover:bg-opacity-50 transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-cream-50'
              }`}>
                <div className={`${gridCols} text-center`}>
                  <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {String(model.uid)}
                  </div>
                  <div className={`text-sm font-mono truncate whitespace-nowrap text-left ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} title={model.model}>
                    {midTrunc(model.model, 48)}
                  </div>
                  <div className={`text-xs font-mono whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} title={model.rev}>
                    {midTrunc(String(model.rev), 10)}
                  </div>
                  <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {fmt(model.overall_avg_score)}
                  </div>
                  <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {model.success_rate_percent == null ? '—' : `${model.success_rate_percent.toFixed(1)}%`}
                  </div>
                  <div className={`text-sm font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    {model.avg_latency == null ? dash : model.avg_latency.toFixed(2)}
                  </div>
                  <div className="flex items-center justify-center">
                    {model.eligible ? (
                      <Check
                        size={16}
                        className={theme === 'dark' ? 'text-green-400' : 'text-green-600'}
                      />
                    ) : (
                      <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                        {dash}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {/* Toggle details control (hotkey: T) */}
                    <button
                      onClick={() => toggleExpanded(model.uniqueId)}
                      aria-label={`Toggle details for model ${model.uid}`}
                      aria-expanded={expandedModel === model.uniqueId}
                      aria-controls={`details-${model.uniqueId}`}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        theme === 'dark'
                          ? 'border-white text-white hover:bg-gray-800'
                          : 'border-gray-400 text-gray-700 hover:bg-gray-100'
                      }`}
                      title="Toggle details (T)"
                    >
                      {expandedModel === model.uniqueId ? 
                        <ChevronDown size={16} /> : 
                        <ChevronRight size={16} />
                      }
                    </button>

                    {/* Actions dropdown menu */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === model.uniqueId ? null : model.uniqueId)}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === model.uniqueId}
                        aria-controls={`actions-${model.uniqueId}`}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          theme === 'dark'
                            ? 'border-white text-white hover:bg-gray-800'
                            : 'border-gray-400 text-gray-700 hover:bg-gray-100'
                        }`}
                        title="Actions (open menu)"
                      >
                        <MoreVertical size={16} />
                        <span className="sr-only">Open actions menu</span>
                      </button>

                      {openMenuId === model.uniqueId && (
                        <div
                          id={`actions-${model.uniqueId}`}
                          role="menu"
                          aria-label={`Actions for model ${model.uid}`}
                          className={`absolute right-0 mt-1 w-56 z-20 rounded-sm border shadow-lg ${
                            theme === 'dark'
                              ? 'bg-gray-900 border-white text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        >
                          <button
                            role="menuitem"
                            onClick={() => { toggleExpanded(model.uniqueId); setOpenMenuId(null); }}
                            className={`flex w-full items-center justify-between px-3 h-9 text-sm text-left transition-colors ${
                              theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                            }`}
                          >
                            <span>Toggle details</span>
                            <span className="text-xs opacity-70">T</span>
                          </button>
                          <a
                            role="menuitem"
                            href={`https://huggingface.co/${model.model}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpenMenuId(null)}
                            className={`flex w-full items-center justify-between px-3 h-9 text-sm transition-colors ${
                              theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                            }`}
                          >
                            <span>View on Hugging Face</span>
                            <span className="text-xs opacity-70">H</span>
                          </a>
                          {model.chute_id ? (
                            <a
                              role="menuitem"
                              href={`https://chutes.ai/app/chute/${model.chute_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOpenMenuId(null)}
                              className={`flex w-full items-center justify-between px-3 h-9 text-sm transition-colors ${
                                theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                              }`}
                            >
                              <span>Open Chutes</span>
                              <span className="text-xs opacity-70">C</span>
                            </a>
                          ) : (
                            <div
                              role="menuitem"
                              aria-disabled="true"
                              className={`flex w-full items-center justify-between px-3 h-9 text-sm opacity-50`}
                            >
                              <span>Open Chutes</span>
                              <span className="text-xs opacity-70">C</span>
                            </div>
                          )}
                          <div className={`px-3 py-2 border-t text-[11px] font-mono opacity-70 ${
                            theme === 'dark' ? 'border-white/30' : 'border-gray-300'
                          }`}>
                            Shortcuts active while menu is open: T, H, C, Esc
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details (Historical) */}
              {expandedModel === model.uniqueId && (
                <div
                  id={`details-${model.uniqueId}`}
                  role="region"
                  aria-label={`Details for model ${model.uid}`}
                  className={`px-3 pb-3 text-left ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-cream-50'}`}
                >
                  <div className="text-xs font-mono grid grid-cols-2 gap-2">
                    <div><span className="font-bold">UID:</span> {String(model.uid)}</div>
                    <div className="break-all"><span className="font-bold">Hotkey:</span> {model.hotkey}</div>
                    <div><span className="font-bold">Rev:</span> {String(model.rev)}</div>
                    <div><span className="font-bold">Last Rollout:</span> {fmtTs(model.last_rollout_at)}</div>
                    <div><span className="font-bold">Avg Score:</span> {fmt(model.overall_avg_score)}</div>
                    <div><span className="font-bold">Success %:</span> {model.success_rate_percent == null ? '—' : `${model.success_rate_percent.toFixed(1)}%`}</div>
                    <div><span className="font-bold">Avg Latency (s):</span> {model.avg_latency == null ? dash : model.avg_latency.toFixed(2)}</div>
                    <div><span className="font-bold">Total Rollouts:</span> {model.total_rollouts.toLocaleString()}</div>
                    <div><span className="font-bold">Eligible:</span> {model.eligible ? 'Yes' : 'No'}</div>
                    {envs.map((env) => {
                      // Keep key generation in sync with server aliasing: lowercase + non-alnum to underscore
                      const key = env.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                      const score = (model as any)[key] as number | null | undefined;
                      return (
                        <div key={env}><span className="font-bold">{env}:</span> {fmt(score)}</div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Live rows */}
          {viewMode === 'live' && !loading && pagedRows.map((model: LiveDisplayRow) => (
            <div key={model.uniqueId} onMouseEnter={() => setHoveredRowId(model.uniqueId)} onMouseLeave={() => setHoveredRowId(prev => (prev === model.uniqueId ? null : prev))}>
              {/* Main Row */}
              <div className={`p-3 hover:bg-opacity-50 transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-cream-50'
              }`}>
                <div className={`${gridCols} text-center`}>
                  <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {String(model.uid)}
                  </div>
                  <div className={`text-sm font-mono truncate whitespace-nowrap text-left ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} title={model.model}>
                    {midTrunc(model.model, 48)}
                  </div>
                  <div className={`text-xs font-mono whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} title={model.rev}>
                    {midTrunc(String(model.rev), 10)}
                  </div>
                  <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {fmt(model.avgScore)}
                  </div>
                  <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {(() => {
                      const er = enrichedMap[liveKey(model.uid, model.model)];
                        return er && er.success_rate_percent != null ? `${er.success_rate_percent.toFixed(1)}%` : '—';
                    })()}
                  </div>
                  <div className={`text-sm font-mono tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    {/* In Live view, show Weight instead of Avg Latency */}
                    {model.weight == null ? dash : model.weight.toFixed(4)}
                  </div>
                  <div className="flex items-center justify-center">
                    {model.eligible ? (
                      <Check
                        size={16}
                        className={theme === 'dark' ? 'text-green-400' : 'text-green-600'}
                      />
                    ) : (
                      <div className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                        {dash}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {/* Toggle details control (hotkey: T) */}
                    <button
                      onClick={() => toggleExpanded(model.uniqueId)}
                      aria-label={`Toggle details for model ${model.uid}`}
                      aria-expanded={expandedModel === model.uniqueId}
                      aria-controls={`details-${model.uniqueId}`}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        theme === 'dark'
                          ? 'border-white text-white hover:bg-gray-800'
                          : 'border-gray-400 text-gray-700 hover:bg-gray-100'
                      }`}
                      title="Toggle details (T)"
                    >
                      {expandedModel === model.uniqueId ? 
                        <ChevronDown size={16} /> : 
                        <ChevronRight size={16} />
                      }
                    </button>

                    {/* Actions dropdown menu */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === model.uniqueId ? null : model.uniqueId)}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === model.uniqueId}
                        aria-controls={`actions-${model.uniqueId}`}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          theme === 'dark'
                            ? 'border-white text-white hover:bg-gray-800'
                            : 'border-gray-400 text-gray-700 hover:bg-gray-100'
                        }`}
                        title="Actions (open menu)"
                      >
                        <MoreVertical size={16} />
                        <span className="sr-only">Open actions menu</span>
                      </button>

                      {openMenuId === model.uniqueId && (
                        <div
                          id={`actions-${model.uniqueId}`}
                          role="menu"
                          aria-label={`Actions for model ${model.uid}`}
                          className={`absolute right-0 mt-1 w-56 z-20 rounded-sm border shadow-lg ${
                            theme === 'dark'
                              ? 'bg-gray-900 border-white text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        >
                          <button
                            role="menuitem"
                            onClick={() => { toggleExpanded(model.uniqueId); setOpenMenuId(null); }}
                            className={`flex w-full items-center justify-between px-3 h-9 text-sm text-left transition-colors ${
                              theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                            }`}
                          >
                            <span>Toggle details</span>
                            <span className="text-xs opacity-70">T</span>
                          </button>
                          <a
                            role="menuitem"
                            href={`https://huggingface.co/${model.model}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpenMenuId(null)}
                            className={`flex w-full items-center justify-between px-3 h-9 text-sm transition-colors ${
                              theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                            }`}
                          >
                            <span>View on Hugging Face</span>
                            <span className="text-xs opacity-70">H</span>
                          </a>
                          {(() => {
                            const er = enrichedMap[liveKey(model.uid, model.model)];
                            if (er && er.chute_id) {
                              return (
                                <a
                                  role="menuitem"
                                  href={`https://chutes.ai/app/chute/${String(er.chute_id)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => setOpenMenuId(null)}
                                  className={`flex w-full items-center justify-between px-3 h-9 text-sm transition-colors ${
                                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                                  }`}
                                >
                                  <span>Open Chutes</span>
                                  <span className="text-xs opacity-70">C</span>
                                </a>
                              );
                            }
                            return (
                              <div
                                role="menuitem"
                                aria-disabled="true"
                                className={`flex w-full items-center justify-between px-3 h-9 text-sm opacity-50`}
                              >
                                <span>Open Chutes</span>
                                <span className="text-xs opacity-70">C</span>
                              </div>
                            );
                          })()}
                          <div className={`px-3 py-2 border-t text-[11px] font-mono opacity-70 ${
                            theme === 'dark' ? 'border-white/30' : 'border-gray-300'
                          }`}>
                            Shortcuts active while menu is open: T, H, C, Esc
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details (Live) */}
              {expandedModel === model.uniqueId && (
                <div
                  id={`details-${model.uniqueId}`}
                  role="region"
                  aria-label={`Details for model ${model.uid}`}
                  className={`px-3 pb-3 text-left ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-cream-50'}`}
                >
                  <div className="text-xs font-mono grid grid-cols-2 gap-2">
                    <div><span className="font-bold">UID:</span> {String(model.uid)}</div>
                    <div><span className="font-bold">Rev:</span> {String(model.rev)}</div>
                    <div><span className="font-bold">Avg Score:</span> {fmt(model.avgScore)}</div>
                    <div><span className="font-bold">Eligible:</span> {model.eligible ? 'Yes' : 'No'}</div>
                    <div><span className="font-bold">PTS:</span> {fmt(model.pts, 4)}</div>
                    <div><span className="font-bold">Weight:</span> {fmt(model.weight, 4)}</div>
                    <div><span className="font-bold">Hotkey:</span> {(() => { const er = enrichedMap[liveKey(model.uid, model.model)]; return er ? er.hotkey : '—'; })()}</div>
                    <div><span className="font-bold">Success %:</span> {(() => { const er = enrichedMap[liveKey(model.uid, model.model)]; return er && er.success_rate_percent != null ? `${er.success_rate_percent.toFixed(1)}%` : '—'; })()}</div>
                    <div><span className="font-bold">Avg Latency (s):</span> {(() => { const er = enrichedMap[liveKey(model.uid, model.model)]; return er && er.avg_latency != null ? er.avg_latency.toFixed(2) : '—'; })()}</div>
                    <div><span className="font-bold">Total Rollouts:</span> {(() => { const er = enrichedMap[liveKey(model.uid, model.model)]; return er && er.total_rollouts != null ? er.total_rollouts.toLocaleString() : '—'; })()}</div>
                    <div><span className="font-bold">Last Rollout:</span> {(() => { const er = enrichedMap[liveKey(model.uid, model.model)]; return er ? fmtTs(er.last_rollout_at) : '—'; })()}</div>
                    <div><span className="font-bold">SAT:</span> {fmt(model.sat)}</div>
                    <div><span className="font-bold">ABD:</span> {fmt(model.abd)}</div>
                    <div><span className="font-bold">DED:</span> {fmt(model.ded)}</div>
                    <div><span className="font-bold">ELR:</span> {fmt(model.elr)}</div>
                    {/* Optional levels if present */}
                    {typeof model.l1 === 'number' || model.l1 == null ? <div><span className="font-bold">L1:</span> {fmt(model.l1)}</div> : null}
                    {typeof model.l2 === 'number' || model.l2 == null ? <div><span className="font-bold">L2:</span> {fmt(model.l2)}</div> : null}
                    {typeof model.l3 === 'number' || model.l3 == null ? <div><span className="font-bold">L3:</span> {fmt(model.l3)}</div> : null}
                    {typeof model.l4 === 'number' || model.l4 == null ? <div><span className="font-bold">L4:</span> {fmt(model.l4)}</div> : null}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OverviewTable;
