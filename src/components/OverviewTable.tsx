import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Check, MoreVertical } from 'lucide-react';
import { fetchSubnetOverview, SubnetOverviewRow } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { useEnvironments } from '../contexts/EnvironmentsContext';

interface OverviewTableProps {
  environments?: any[]; // kept for compatibility with existing App.tsx; not used
  theme: 'light' | 'dark';
}

type DisplayRow = SubnetOverviewRow & { uniqueId: string };

const OverviewTable: React.FC<OverviewTableProps> = ({ theme }) => {
  const { data, error: queryError, isLoading } = useQuery({
    queryKey: ['subnet-overview'],
    queryFn: fetchSubnetOverview,
    staleTime: 60000, // 1 min: show cached data when revisiting; background refresh runs separately
    refetchInterval: 6000, // refresh every 6s
    refetchOnMount: false, // do not refetch immediately on mount if cache exists
  });
  const rows: DisplayRow[] = (data ?? []).map((r) => ({
    ...r,
    uniqueId: `${r.uid}-${r.model}-${r.rev}`,
  }));
  const loading = isLoading && rows.length === 0;
  const errorMsg = queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null;
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  // Pagination state
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  // Environments from global context (dynamic)
  const { environments: envs, loading: envLoading } = useEnvironments();

  // Dynamic CSS grid template columns: adds one 72px column per environment between "Rev" and the aggregate stats
  const gridTemplateColumns = `72px minmax(0,1fr) 72px ${envs.map(() => '72px').join(' ')} 88px 96px 120px 72px 112px`;

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

  const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(1));
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
        window.open(`https://huggingface.co/affine-subnet/model-${row.uid}`, '_blank', 'noopener,noreferrer');
        if (openMenuId) setOpenMenuId(null);
        return;
      }
      if (key === 'c') {
        window.open(`https://chutes.ai/deploy/${row.uid}`, '_blank', 'noopener,noreferrer');
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
        <h3 className={`text-lg font-mono font-bold mb-3 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          SUBNET OVERVIEW
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {loading ? '...' : rows.length}
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
              {loading ? '...' : rows.filter(r => r.eligible).length}
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
              {envLoading ? '...' : envs.length}
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
          <div className="grid gap-2 items-center text-center" style={{ gridTemplateColumns }}>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>UID</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold text-left ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Model</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Rev</div>
            {envs.map((env) => (
              <div key={env} className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{env}</div>
            ))}
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Avg Score</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Success %</div>
            <div className={`text-xs font-mono uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Avg Latency (s)</div>
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
            <div className={`p-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Loading...
            </div>
          )}
          {!loading && !errorMsg && pagedRows.map((model) => (
            <div key={model.uniqueId} onMouseEnter={() => setHoveredRowId(model.uniqueId)} onMouseLeave={() => setHoveredRowId(prev => (prev === model.uniqueId ? null : prev))}>
              {/* Main Row */}
              <div className={`p-3 hover:bg-opacity-50 transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-cream-50'
              }`}>
                <div className="grid gap-2 items-center text-center" style={{ gridTemplateColumns }}>
                  <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {String(model.uid)}
                  </div>
                  <div className={`text-sm font-mono truncate whitespace-nowrap text-left ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} title={model.model}>
                    {midTrunc(model.model, 48)}
                  </div>
                  <div className={`text-xs font-mono whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} title={model.rev}>
                    {midTrunc(String(model.rev), 10)}
                  </div>
                  {envs.map((env) => {
                    const key = env.toLowerCase();
                    const score = (model as any)[key] as number | null | undefined;
                    return (
                      <div
                        key={env}
                        className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                      >
                        {fmt(score)}
                      </div>
                    );
                  })}
                  <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {fmt(model.overall_avg_score)}
                  </div>
                  <div className={`text-sm font-mono font-bold tabular-nums whitespace-nowrap ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {model.success_rate_percent.toFixed(1)}%
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
                            href={`https://huggingface.co/affine-subnet/model-${model.uid}`}
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
                          <a
                            role="menuitem"
                            href={`https://chutes.ai/deploy/${model.uid}`}
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

              {/* Expanded Details */}
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
                    <div><span className="font-bold">Success %:</span> {model.success_rate_percent.toFixed(1)}%</div>
                    <div><span className="font-bold">Avg Latency (s):</span> {model.avg_latency == null ? dash : model.avg_latency.toFixed(2)}</div>
                    <div><span className="font-bold">Total Rollouts:</span> {model.total_rollouts.toLocaleString()}</div>
                    <div><span className="font-bold">Eligible:</span> {model.eligible ? 'Yes' : 'No'}</div>
                    {envs.map((env) => {
                      const key = env.toLowerCase();
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
        </div>
      </div>
    </div>
  );
};

export default OverviewTable;
