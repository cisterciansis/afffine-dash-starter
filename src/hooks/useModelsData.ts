import { useState, useEffect } from 'react';

interface Model {
  uid: string;
  hotkey: string;
  model: string;
  revision: string;
  environment: string;
  total_rollouts: number;
  score: number;
  success_rate: number;
  avg_latency: number;
  last_updated: string;
  status: 'training' | 'evaluating' | 'idle';
  daily_rollouts: number;
  miner_block: number;
  recent_activity: number;
  epochs: number;
}

interface Environment {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  models: Model[];
}

interface ApiResponse {
  success: boolean;
  environments: Environment[];
  models: Model[];
  error?: string;
}

export const useModelsData = () => {
  const [data, setData] = useState<{
    environments: Environment[];
    models: Model[];
    loading: boolean;
    error: string | null;
  }>({
    environments: [],
    models: [],
    loading: true,
    error: null
  });

  const fetchData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));
      
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-models`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      setData({
        environments: result.environments,
        models: result.models,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Error fetching models data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  };

  useEffect(() => {
    fetchData();
    
    // Set up polling to refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const refetch = () => {
    fetchData();
  };

  return {
    ...data,
    refetch
  };
};