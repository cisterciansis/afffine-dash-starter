import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      -- This query provides a daily summary of network-wide activity and performance.
      -- Returns:
      --   - avg_all: daily average over all models (continuous line)
      --   - avg_top50_daily: daily average over the top 50 models for that same day
      --     (top 50 determined by that day's per-model average score)
      WITH windowed AS (
        SELECT DATE_TRUNC('day', ingested_at)::date AS period, model, score
        FROM public.affine_results
        WHERE ingested_at > NOW() - INTERVAL '60 days'
      ),
      daily_model_avgs AS (
        SELECT period, model, AVG(score) AS model_avg
        FROM windowed
        GROUP BY period, model
      ),
      top50_daily AS (
        SELECT period, model
        FROM (
          SELECT
            period,
            model,
            model_avg,
            ROW_NUMBER() OVER (PARTITION BY period ORDER BY model_avg DESC) AS rn
          FROM daily_model_avgs
        ) t
        WHERE rn <= 50
      )
      SELECT
        w.period,
        COUNT(*) AS total_rollouts,
        AVG(w.score) AS avg_all,
        AVG(w.score) FILTER (WHERE t.model IS NOT NULL) AS avg_top50_daily
      FROM windowed w
      LEFT JOIN top50_daily t
        ON t.period = w.period AND t.model = w.model
      GROUP BY w.period
      ORDER BY w.period ASC;
    `;
    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('network-activity query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}
