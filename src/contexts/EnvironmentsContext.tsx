import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchEnvironments } from '../services/api';

type EnvironmentsContextValue = {
  environments: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const EnvironmentsContext = createContext<EnvironmentsContextValue | undefined>(undefined);

export const EnvironmentsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [environments, setEnvironments] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const envs = await fetchEnvironments();
      // Ensure strings, dedupe, and sort for stability
      const uniqueSorted = Array.from(new Set((envs ?? []).map(String))).sort((a, b) => a.localeCompare(b));
      setEnvironments(uniqueSorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // fetch once on mount
    load();
  }, []);

  const value = useMemo<EnvironmentsContextValue>(() => ({
    environments,
    loading,
    error,
    refresh: load,
  }), [environments, loading, error]);

  return (
    <EnvironmentsContext.Provider value={value}>
      {children}
    </EnvironmentsContext.Provider>
  );
};

export function useEnvironments(): EnvironmentsContextValue {
  const ctx = useContext(EnvironmentsContext);
  if (!ctx) {
    throw new Error('useEnvironments must be used within an EnvironmentsProvider');
  }
  return ctx;
}
