import { useEffect, useState } from 'react';

interface SummaryResponse {
  timestamp: string;
  tail: number;
  columns: string[];
  rows: (string | number | null)[][];
  raw?: string;
}

export const useValidatorSummary = () => {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('https://sn120-viewer.onrender.com/api/weights/summary/latest', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SummaryResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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

