import React from 'react';

type Theme = 'light' | 'dark';

interface PaginationControlsProps {
  theme: Theme;
  total: number;
  page: number;
  setPage: (page: number | ((p: number) => number)) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  className?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  theme,
  total,
  page,
  setPage,
  pageSize,
  setPageSize,
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(total, (page - 1) * pageSize + pageSize);

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}>
      <div className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
        Showing {startIndex}–{endIndex} of {total}
      </div>
      <div className="flex items-center gap-2">
        <label className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Rows per page:</label>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className={`h-8 px-2 border text-xs font-mono rounded-sm ${theme === 'dark' ? 'border-white bg-black text-white' : 'border-gray-400 bg-white text-gray-800'}`}
          aria-label="Rows per page"
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
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`}
            aria-label="Previous page"
            title="Previous page"
          >
            ‹
          </button>
          <span className={`text-xs font-mono px-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`}
            aria-label="Next page"
            title="Next page"
          >
            ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className={`inline-flex items-center justify-center h-8 w-8 border text-xs font-mono disabled:opacity-50 ${theme === 'dark' ? 'border-white text-white hover:bg-gray-800' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`}
            aria-label="Last page"
            title="Last page"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaginationControls;
