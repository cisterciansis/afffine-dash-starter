import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      -- This query provides a daily summary of network-wide activity and performance.
      -- Average score is computed only over the Top 50 models (by avg score within last 60 days).
      WITH windowed AS (
        SELECT DATE_TRUNC('day', ingested_at)::date AS period, model, score
        FROM public.affine_results
        WHERE ingested_at > NOW() - INTERVAL '60 days'
      ),
      top_models AS (
        SELECT model
        FROM windowed
        GROUP BY model
        ORDER BY AVG(score) DESC
        LIMIT 50
      )
      SELECT
          period,
          COUNT(*) AS total_rollouts,
          AVG(score) FILTER (WHERE model IN (SELECT model FROM top_models)) AS average_score
      FROM
          windowed
      GROUP BY
          period
      ORDER BY
          period ASC;
    `;
    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('network-activity query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}
