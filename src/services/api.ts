/**
 * Typed client for the backend API endpoints deployed on Vercel under /api.
 * Note: When running locally, prefer `vercel dev` so these routes are available.
 * Running `vite` alone will not serve /api and requests will 404.
 */

export type LeaderboardRow = {
  hotkey: string;
  last_seen_uid: number;
  model: string;
  total_rollouts: number;
  average_score: number;
  success_rate_percent: number;
  avg_latency: number | null;
};

export type ActivityRow = {
  ingested_at: string; // ISO timestamp
  hotkey: string;
  uid: number;
  model: string;
  env_name: string;
  score: number;
  success: boolean;
};

export type PerformanceByEnvRow = {
  env_name: string;
  total_rollouts: number;
  average_score: number;
  success_rate_percent: number;
};

export type ResultsOverTimeRow = {
  period: string; // ISO date at day granularity
  total_rollouts: number;
  average_score: number;
};

export type DailyRolloutsByModelRow = {
  day: string; // YYYY-MM-DD
  model: string;
  daily_rollouts: number;
};

export type NetworkActivityRow = {
  period: string; // ISO date at day granularity
  total_rollouts: number;
  average_score: number;
};

export type EnvironmentStatsRow = {
  env_name: string;
  total_rollouts: number;
  success_rate: number; // percent 0-100
};

export type MinerEfficiencyRow = {
  hotkey: string;
  model: string;
  avg_score: number;
  avg_latency: number | null;
};

export type TopMinersByEnvRow = {
  period: string; // YYYY-MM-DD
  hotkey: string;
  average_score: number;
};

export type ScoreDistributionByEnvRow = {
  score_bucket: number; // 1..10
  number_of_miners: number;
};

export type LatencyDistributionByEnvRow = {
  hotkey: string;
  latency_seconds: number;
};

async function getJSON<T>(path: string): Promise<T> {
  try {
    const res = await fetch(path, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GET ${path} failed: ${res.status} ${res.statusText} ${text}`);
    }
    // In Vite-only dev, hitting /api/* may return JS source with content-type text/javascript,
    // which will fail JSON parsing. Detect and handle gracefully.
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!contentType.includes('application/json')) {
      throw new Error(`Unexpected content-type for ${path}: ${contentType}`);
    }
    return JSON.parse(text) as T;
  } catch (err) {
    // Fallback to local mock when running Vite without serverless APIs
    const mockMap: Record<string, string> = {
      '/api/subnet-overview': '/mock/subnet-overview.json',
      '/api/leaderboard': '/mock/leaderboard.json',
      '/api/activity': '/mock/activity.json',
      '/api/performance-by-env': '/mock/performance-by-env.json',
      '/api/results-over-time': '/mock/results-over-time.json',
      '/api/daily-rollouts-by-model': '/mock/daily-rollouts-by-model.json',
      '/api/environments': '/mock/environments.json',
      '/api/network-activity': '/mock/network-activity.json',
      '/api/environment-stats': '/mock/environment-stats.json',
      '/api/miner-efficiency': '/mock/miner-efficiency.json',
      // New env-specific endpoints (querystring stripped below)
      '/api/top-miners-by-env': '/mock/top-miners-by-env.json',
      '/api/score-distribution-by-env': '/mock/score-distribution-by-env.json',
      '/api/latency-distribution-by-env': '/mock/latency-distribution-by-env.json',
    };
    // Support querystring paths by mapping base path to mock file
    const basePath = path.split('?')[0];
    const mockPath = mockMap[basePath];
    if (mockPath) {
      const mockRes = await fetch(mockPath, { method: 'GET' });
      if (!mockRes.ok) {
        const t = await mockRes.text().catch(() => '');
        throw new Error(`Mock fallback for ${path} failed: ${mockRes.status} ${mockRes.statusText} ${t}`);
      }
      return mockRes.json() as Promise<T>;
    }
    throw err;
  }
}

/**
 * Fetch top 20 miners by average score with stats.
 * GET /api/leaderboard
 */
export function fetchLeaderboard() {
  return getJSON<LeaderboardRow[]>('/api/leaderboard');
}

/**
 * Fetch latest 10 rollouts (activity feed).
 * GET /api/activity
 */
export function fetchActivity() {
  return getJSON<ActivityRow[]>('/api/activity');
}

/**
 * Fetch performance aggregated by environment.
 * GET /api/performance-by-env
 */
export function fetchPerformanceByEnv() {
  return getJSON<PerformanceByEnvRow[]>('/api/performance-by-env');
}

/**
 * Fetch results over time (last 30 days, day buckets).
 * GET /api/results-over-time
 */
export function fetchResultsOverTime() {
  return getJSON<ResultsOverTimeRow[]>('/api/results-over-time');
}

/**
 * Fetch daily rollouts per model for top 5 models over last 7 days.
 * GET /api/daily-rollouts-by-model
 */
export function fetchDailyRolloutsByModel() {
  return getJSON<DailyRolloutsByModelRow[]>('/api/daily-rollouts-by-model');
}

export function fetchNetworkActivity() {
  return getJSON<NetworkActivityRow[]>('/api/network-activity');
}

export function fetchEnvironmentStats() {
  return getJSON<EnvironmentStatsRow[]>('/api/environment-stats');
}

export function fetchMinerEfficiency() {
  return getJSON<MinerEfficiencyRow[]>('/api/miner-efficiency');
}

/**
 * Subnet Overview row type from /api/subnet-overview
 * Note: sat/abd/ded/elr/overall_avg_score may be null if no data exists for that env; avg_latency may be null.
 * last_rollout_at is an ISO timestamp string (or may be null if no data).
 */
export type SubnetOverviewRow = {
  hotkey: string;
  model: string;
  rev: string;
  uid: number;
  sat: number | null;
  abd: number | null;
  ded: number | null;
  elr: number | null;
  eligible: boolean;
  overall_avg_score: number | null;
  success_rate_percent: number;
  avg_latency: number | null;
  total_rollouts: number;
  last_rollout_at: string | null;
};

/**
 * Fetch subnet overview aggregated by model/revision with env averages.
 * GET /api/subnet-overview
 */
export function fetchSubnetOverview() {
  return getJSON<SubnetOverviewRow[]>('/api/subnet-overview');
}

export type EnvironmentsResponse = string[];

/**
 * Fetch list of active environments (simple array of strings).
 * GET /api/environments
 */
export function fetchEnvironments() {
  return getJSON<EnvironmentsResponse>('/api/environments');
}

export function fetchTopMinersByEnv(env: string) {
  return getJSON<TopMinersByEnvRow[]>(`/api/top-miners-by-env?env=${encodeURIComponent(env)}`);
}

export function fetchScoreDistributionByEnv(env: string) {
  return getJSON<ScoreDistributionByEnvRow[]>(`/api/score-distribution-by-env?env=${encodeURIComponent(env)}`);
}

export function fetchLatencyDistributionByEnv(env: string) {
  return getJSON<LatencyDistributionByEnvRow[]>(`/api/latency-distribution-by-env?env=${encodeURIComponent(env)}`);
}
