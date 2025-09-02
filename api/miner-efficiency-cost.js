import { query } from './_db.js';

/**
 * GET /api/miner-efficiency-cost
 * Returns pre-aggregated cost vs performance data per miner (hotkey, model)
 * over the last 7 days. Filters out miners without valid cost data and with
 * insufficient recent activity.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      -- This query robustly calculates the average score and AVERAGE TOKEN COST for each active miner.
      SELECT
          hotkey,
          model,
          AVG(score) as avg_score,
          -- This is the key change:
          -- 1. Extract the input and output token costs.
          -- 2. Average them to get a single representative token cost metric.
          AVG(
              (
                  (extra -> 'miner_chute' -> 'current_estimated_price' -> 'per_million_tokens' -> 'usd' ->> 'input')::numeric
                  +
                  (extra -> 'miner_chute' -> 'current_estimated_price' -> 'per_million_tokens' -> 'usd' ->> 'output')::numeric
              ) / 2
          ) as avg_token_cost_usd
      FROM
          public.affine_results
      WHERE
          ingested_at > NOW() - INTERVAL '7 days'
          -- This filter is critical: it ensures we only include rows that have valid, non-null TOKEN cost data.
          AND jsonb_path_exists(extra, '$.miner_chute.current_estimated_price.per_million_tokens.usd.input')
          AND jsonb_path_exists(extra, '$.miner_chute.current_estimated_price.per_million_tokens.usd.output')
          AND (extra -> 'miner_chute' -> 'current_estimated_price' -> 'per_million_tokens' -> 'usd' ->> 'input') IS NOT NULL
          AND (extra -> 'miner_chute' -> 'current_estimated_price' -> 'per_million_tokens' -> 'usd' ->> 'output') IS NOT NULL
      GROUP BY
          hotkey, model
      HAVING
          -- Only include miners with significant recent activity.
          COUNT(*) > 20
          -- Only include miners with a positive cost.
          AND AVG(
              (
                  (extra -> 'miner_chute' -> 'current_estimated_price' -> 'per_million_tokens' -> 'usd' ->> 'input')::numeric
                  +
                  (extra -> 'miner_chute' -> 'current_estimated_price' -> 'per_million_tokens' -> 'usd' ->> 'output')::numeric
              ) / 2
          ) > 0
      ORDER BY
          hotkey;
    `;
    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('miner-efficiency-cost query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}
